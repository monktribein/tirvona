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

  @Get(":slug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async profile(
    @Param("slug") slug: string,
    @Query() query: PublicProfileQueryDto,
    @Req() request: Request,
  ) {
    const doc = await this.profiles.findBySlug(slug);
    const view = this.profiles.toPublicView(doc);

    const context = this.analytics.contextFrom(request, query.src);
    const qrId = await this.qrCodes.resolveSource(String(doc._id), query.src);
    void this.analytics.record(String(doc._id), "PROFILE_VIEW", context, qrId);
    if (query.scan) {
      void this.analytics.record(String(doc._id), "QR_SCAN", context, qrId);
    }

    return { success: true, data: view };
  }

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
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.send(Buffer.from(body, "utf8"));
  }

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
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.send(body);
  }

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
