import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SmartContactAnalyticsService } from "../application/smart-contact-analytics.service";
import { SmartContactAuditService } from "../application/smart-contact-audit.service";
import { SmartContactProfilesService } from "../application/smart-contact-profiles.service";
import { SmartContactQrCodesService } from "../application/smart-contact-qr-codes.service";
import { QrService } from "../application/qr.service";
import { ContactCardService } from "../application/contact-card.service";
import { VcardService } from "../application/vcard.service";
import {
  SMART_CONTACT_ADMIN_ROLES,
  type SmartContactQrFormat,
  type SmartContactQrSource,
} from "../domain/smart-contact.constants";
import type {
  ActorRef,
  SmartContactProfileView,
} from "../domain/smart-contact.types";
import { SmartContactAnalyticsQueryDto } from "./dtos/smart-contact-event.dto";
import {
  CreateSmartContactProfileDto,
  DeleteSmartContactProfilesDto,
  GenerateQrDto,
  QrRenderQueryDto,
  SmartContactProfileQueryDto,
  UpdateSmartContactProfileDto,
} from "./dtos/smart-contact-profile.dto";

/**
 * The Smart Contact console surface (spec §18–§20, §33, §36).
 *
 * Gated by the platform's own auth, exactly as Lead Collection's admin
 * controller is: these are Tirvona staff using their normal login. The role
 * list is Smart Contact's own vocabulary (spec §36) and `super_admin` passes
 * regardless — `RolesGuard` short-circuits on it — so naming a role here never
 * requires touching the platform's role catalogue.
 */
@ApiTags("Smart Contact")
@ApiBearerAuth()
@Roles(...SMART_CONTACT_ADMIN_ROLES)
@Controller({ path: "admin/smart-contacts", version: "1" })
export class SmartContactAdminController {
  constructor(
    private readonly profiles: SmartContactProfilesService,
    private readonly qrCodes: SmartContactQrCodesService,
    private readonly qr: QrService,
    private readonly cards: ContactCardService,
    private readonly analytics: SmartContactAnalyticsService,
    private readonly audit: SmartContactAuditService,
    private readonly vcards: VcardService,
  ) {}

  private actor(user: AuthenticatedUser): ActorRef {
    return { id: user.id, name: user.name };
  }

  private ip(request: Request): string {
    return request.ip ?? "";
  }

  // ── Profiles ─────────────────────────────────────────────────────────────

  /**
   * The console list. Headline counters are joined in from the event log in
   * one grouped aggregation rather than per row, so the page stays at two
   * queries regardless of page size.
   */
  @Get()
  async list(@Query() query: SmartContactProfileQueryDto) {
    const page = await this.profiles.list(query as never);
    const summaries = await this.analytics.summaryFor(
      page.items.map((item) => item.id),
    );
    return {
      success: true,
      data: {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          metrics: summaries.get(item.id) ?? {
            profileViews: 0,
            qrScans: 0,
            saveContacts: 0,
            conversionRate: 0,
          },
        })),
      },
    };
  }

  @Get("stats")
  async stats() {
    const [profiles, events] = await Promise.all([
      this.profiles.stats(),
      this.analytics.platformTotals(),
    ]);
    return { success: true, data: { profiles, events } };
  }

  @Get(":id")
  async one(@Param("id") id: string) {
    const [profile, qrCodes] = await Promise.all([
      this.profiles.findById(id),
      this.qrCodes.listForProfile(id),
    ]);
    return { success: true, data: { profile, qrCodes } };
  }

  /**
   * A preview of the .vcf the public endpoint would serve right now.
   * Lets an admin confirm a change landed without printing anything.
   */
  @Get(":id/vcard-preview")
  async vcardPreview(@Param("id") id: string) {
    const profile = await this.profiles.findById(id);
    return { success: true, data: { vcard: this.vcards.build(profile) } };
  }

  @Get(":id/audit")
  async auditTrail(@Param("id") id: string) {
    return { success: true, data: await this.audit.list(id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSmartContactProfileDto,
    @Req() request: Request,
  ) {
    return {
      success: true,
      message: "Smart Contact profile created",
      data: await this.profiles.create(
        dto as never,
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  @Put(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateSmartContactProfileDto,
    @Req() request: Request,
  ) {
    const { allowSlugChange, ...payload } = dto;
    return {
      success: true,
      message: "Smart Contact profile updated",
      data: await this.profiles.update(
        id,
        payload as never,
        this.actor(user),
        { allowSlugChange },
        this.ip(request),
      ),
    };
  }

  // ── Lifecycle (spec §21, §22) ────────────────────────────────────────────

  @Post(":id/activate")
  @HttpCode(200)
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    return {
      success: true,
      message: "Profile is now live",
      data: await this.profiles.setStatus(
        id,
        "ACTIVE",
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  @Post(":id/disable")
  @HttpCode(200)
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    return {
      success: true,
      message:
        "Profile disabled. Printed QR codes still resolve and now show the " +
        "inactive notice.",
      data: await this.profiles.setStatus(
        id,
        "SUSPENDED",
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  /**
   * Archive, the terminal state — the module's stand-in for delete.
   *
   * Spec §22 forbids removing a profile whose cards are in circulation, so
   * there is no delete endpoint at all. Archiving keeps the URL resolving to
   * the notice for as long as the printed cards exist.
   */
  @Post(":id/archive")
  @HttpCode(200)
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    return {
      success: true,
      message: "Profile archived. Its URL keeps resolving to the inactive notice.",
      data: await this.profiles.setStatus(
        id,
        "ARCHIVED",
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  /**
   * Permanent bulk deletion — the one route that really removes a profile.
   *
   * Archiving is the module's normal end state (spec §22) precisely because a
   * freed slug stops resolving and any printed QR carrying it dies. That makes
   * this the wrong tool for a representative who has left and the right one
   * for clearing drafts and test rows, which archiving only hides. Restricted
   * to `super_admin`: the wider Smart Contact admin roles can archive, but
   * nobody below the top role can destroy.
   *
   * The response reports how many QR assets were registered against the
   * selection, so the console can say plainly what was just invalidated.
   */
  @Post("bulk-delete")
  @Roles("super_admin")
  @HttpCode(200)
  async bulkDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteSmartContactProfilesDto,
  ) {
    const result = await this.profiles.deleteMany(dto.ids, this.actor(user));
    return {
      success: true,
      message:
        `${result.deleted} profile(s) permanently deleted.` +
        (result.printedQrCodes > 0
          ? ` ${result.printedQrCodes} generated QR code(s) will no longer resolve.`
          : ""),
      data: result,
    };
  }

  // ── QR assets (spec §17, §20) ────────────────────────────────────────────

  @Get(":id/qr")
  async listQr(@Param("id") id: string) {
    return { success: true, data: await this.qrCodes.listForProfile(id) };
  }

  @Post(":id/qr")
  async generateQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: GenerateQrDto,
    @Req() request: Request,
  ) {
    const profile = await this.profiles.findById(id);
    return {
      success: true,
      message: "QR asset registered",
      data: await this.qrCodes.create(
        profile,
        {
          source: dto.source as SmartContactQrSource,
          formats: dto.formats as SmartContactQrFormat[],
          label: dto.label,
        },
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  @Post(":id/qr/:qrId/retire")
  @HttpCode(200)
  async retireQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("qrId") qrId: string,
    @Req() request: Request,
  ) {
    return {
      success: true,
      message: "QR asset retired",
      data: await this.qrCodes.retire(
        id,
        qrId,
        this.actor(user),
        this.ip(request),
      ),
    };
  }

  /**
   * Renders a registered QR asset in one of the three formats (spec §13).
   *
   * The format is its own path segment rather than a filename extension:
   * Express 5's router treats a dot as a literal, and `:qrId.:format` parses
   * in a way that varies between versions. The downloaded file still gets its
   * extension from `Content-Disposition`, which is what names it on disk.
   *
   * Rendering is pure: it reads `destinationUrl` off the row, which is
   * immutable, so this endpoint cannot change what a QR points at no matter
   * how often it is called (spec §20).
   */
  @Get(":id/qr/:qrId/download/:format")
  async renderRegisteredQr(
    @Param("id") id: string,
    @Param("qrId") qrId: string,
    @Param("format") format: string,
    @Query() query: QrRenderQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const asset = await this.qrCodes.findOne(id, qrId);
    // A card layout needs the identity as well as the URL; the plain symbol
    // does not, so the profile is only read when it is actually going on the
    // artwork.
    const profile =
      query.layout === "card" ? await this.profiles.findById(id) : null;
    await this.sendQr(
      response,
      asset.destinationUrl,
      format,
      query,
      asset.qrIdentifier,
      profile,
    );
  }

  /**
   * Renders the profile's canonical QR without registering an asset — the
   * "Preview QR" control in spec §20.
   */
  @Get(":id/qr-preview/:format")
  async previewQr(
    @Param("id") id: string,
    @Param("format") format: string,
    @Query() query: QrRenderQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const profile = await this.profiles.findById(id);
    await this.sendQr(
      response,
      profile.profileUrl,
      format,
      query,
      query.layout === "card" ? `${profile.slug}-card` : profile.slug,
      profile,
    );
  }

  private async sendQr(
    response: Response,
    url: string,
    format: string,
    query: QrRenderQueryDto,
    filename: string,
    profile: SmartContactProfileView | null = null,
  ): Promise<void> {
    const normalised = ["svg", "png", "pdf"].includes(format)
      ? (format as SmartContactQrFormat)
      : "svg";
    const rendered =
      query.layout === "card" && profile
        ? this.cards.render(profile, url, normalised, {
            caption: query.caption,
            photo: query.photo,
          })
        : await this.qr.render(url, normalised, {
            size: query.size,
            caption: query.caption,
            frame: query.frame,
            logo: query.logo,
          });
    response.setHeader("Content-Type", rendered.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.${rendered.extension}"`,
    );
    // Artwork for a given URL is deterministic, so it is safe to cache — but
    // privately, since the URL is behind an admin session.
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(rendered.body);
  }

  // ── Analytics (spec §24–§27) ─────────────────────────────────────────────

  @Get(":id/analytics")
  async profileAnalytics(
    @Param("id") id: string,
    @Query() query: SmartContactAnalyticsQueryDto,
  ) {
    // Resolve first so an unknown id 404s rather than returning empty charts.
    await this.profiles.findById(id);
    return {
      success: true,
      data: await this.analytics.forProfile(id, query as never),
    };
  }
}
