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

  @Get(":id/qr/:qrId/download/:format")
  async renderRegisteredQr(
    @Param("id") id: string,
    @Param("qrId") qrId: string,
    @Param("format") format: string,
    @Query() query: QrRenderQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const asset = await this.qrCodes.findOne(id, qrId);
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
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(rendered.body);
  }

  @Get(":id/analytics")
  async profileAnalytics(
    @Param("id") id: string,
    @Query() query: SmartContactAnalyticsQueryDto,
  ) {
    await this.profiles.findById(id);
    return {
      success: true,
      data: await this.analytics.forProfile(id, query as never),
    };
  }
}
