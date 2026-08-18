import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { SmartContactAnalyticsService } from "../application/smart-contact-analytics.service";
import { SmartContactProfilesService } from "../application/smart-contact-profiles.service";
import { SmartContactQrCodesService } from "../application/smart-contact-qr-codes.service";
import { VcardService } from "../application/vcard.service";
import { IdCardService } from "../application/id-card.service";
import type { SmartContactEventType } from "../domain/smart-contact.constants";
import {
  LogSmartContactEventDto,
  PublicProfileQueryDto,
} from "./dtos/smart-contact-event.dto";

/**
 * The public surface behind a scanned QR (spec §33).
 *
 * Every route is `@Public()` — this is what a stranger's phone hits after
 * scanning a printed card, so there is no session and no token. The gate is
 * therefore rate limiting rather than authentication, and the projection: the
 * service hands back `SmartContactPublicView`, which structurally cannot carry
 * an internal id, an actor or an unpublished field.
 */
@ApiTags("Smart Contact")
@Public()
@Controller({ path: "smart-contact", version: "1" })
export class SmartContactPublicController {
  constructor(
    private readonly profiles: SmartContactProfilesService,
    private readonly vcards: VcardService,
    private readonly analytics: SmartContactAnalyticsService,
    private readonly qrCodes: SmartContactQrCodesService,
    private readonly idCards: IdCardService,
  ) {}

  /**
   * The contact page's data source.
   *
   * Records the view itself rather than trusting the client to report it, and
   * awaits nothing: the visitor is waiting on this response, and an analytics
   * write has no business adding latency to it.
   */
  @Get(":slug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async profile(
    @Param("slug") slug: string,
    @Query() query: PublicProfileQueryDto,
    @Req() request: Request,
  ) {
    const doc = await this.profiles.findBySlug(slug);
    const view = this.profiles.toPublicView(doc);

    // A draft never reaches here (findBySlug excludes it), and an inactive
    // profile is still worth counting — knowing that an obsolete card is
    // circulating is exactly what spec §22 is about.
    const context = this.analytics.contextFrom(request, query.src);
    const qrId = await this.qrCodes.resolveSource(String(doc._id), query.src);
    void this.analytics.record(String(doc._id), "PROFILE_VIEW", context, qrId);
    if (query.scan) {
      void this.analytics.record(String(doc._id), "QR_SCAN", context, qrId);
    }

    return { success: true, data: view };
  }

  /**
   * The .vcf download (spec §9–§11).
   *
   * Generated per request from current profile data, which is the mechanism
   * behind the product's central promise: the admin edits a number, and the
   * next person to scan a years-old card gets the new one.
   */
  @Get(":slug/vcard")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async vcard(
    @Param("slug") slug: string,
    @Query() query: PublicProfileQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const doc = await this.profiles.findBySlug(slug);
    const view = this.profiles.toPublicView(doc);

    // An inactive profile must not hand out a contact card — that is the whole
    // point of not deleting it. 410 rather than 404: the resource existed and
    // is deliberately gone, which is also what tells the page to show the
    // notice instead of an error.
    if (!view.isActive) {
      response.status(410).json({
        success: false,
        message: "This Tirvona representative profile is no longer active.",
      });
      return;
    }

    const profile = await this.profiles.findById(String(doc._id));
    const body = this.vcards.build(profile);

    const context = this.analytics.contextFrom(request, query.src);
    const qrId = await this.qrCodes.resolveSource(String(doc._id), query.src);
    void this.analytics.record(String(doc._id), "VCARD_DOWNLOAD", context, qrId);

    response.setHeader("Content-Type", "text/vcard; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${this.vcards.filename(view.slug)}"`,
    );
    // Spec §11. Caching a vCard would let a stale number survive an edit,
    // which is the one failure mode the product exists to prevent.
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.send(Buffer.from(body, "utf8"));
  }

  /**
   * The printable ID badge — CR80 portrait, vector PDF.
   *
   * Public, like the vCard, and for the same reason: it carries only the
   * business details the page already shows to anyone who scans the code. It
   * adds no field a visitor could not already read or screenshot.
   *
   * Inactive profiles get the same 410 as the vCard. An obsolete badge is
   * exactly the artefact spec §22 exists to stop circulating.
   */
  @Get(":slug/id-card")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async idCard(
    @Param("slug") slug: string,
    @Query() query: PublicProfileQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const doc = await this.profiles.findBySlug(slug);
    const view = this.profiles.toPublicView(doc);

    if (!view.isActive) {
      response.status(410).json({
        success: false,
        message: "This Tirvona representative profile is no longer active.",
      });
      return;
    }

    const profile = await this.profiles.findById(String(doc._id));
    const body = this.idCards.render(profile, profile.profileUrl);

    const context = this.analytics.contextFrom(request, query.src);
    const qrId = await this.qrCodes.resolveSource(String(doc._id), query.src);
    void this.analytics.record(String(doc._id), "ID_CARD_DOWNLOAD", context, qrId);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${this.idCards.filename(view.slug)}"`,
    );
    // Same reasoning as the vCard: a cached badge would outlive an edit.
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.send(body);
  }

  /**
   * Records a CTA tap from the page (spec §23).
   *
   * Throttled tighter than the page itself — a page view is one request, but
   * this one is driven by taps and is the only write a stranger can trigger.
   * Always 204: the browser has nothing to do with the outcome, and returning
   * a body would only invite the client to depend on it.
   */
  @Post(":slug/event")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async logEvent(
    @Param("slug") slug: string,
    @Body() dto: LogSmartContactEventDto,
    @Query() query: PublicProfileQueryDto,
    @Req() request: Request,
  ): Promise<void> {
    const doc = await this.profiles.findBySlug(slug);
    const source = dto.source ?? query.src;
    const context = this.analytics.contextFrom(request, source);
    const qrId = await this.qrCodes.resolveSource(String(doc._id), source);
    await this.analytics.record(
      String(doc._id),
      dto.eventType as SmartContactEventType,
      context,
      qrId,
    );
  }
}
