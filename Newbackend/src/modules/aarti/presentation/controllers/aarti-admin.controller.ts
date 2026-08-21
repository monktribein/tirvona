import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { AARTI_MODEL } from "../../domain/aarti.constants";
import { AartiManagementService } from "../../application/aarti-management.service";
import { AartiStreamService } from "../../application/aarti-stream.service";
import { AartiReportService } from "../../application/aarti-report.service";
import {
  AartiCapabilityGuard,
  type AartiRequest,
} from "../guards/aarti-capability.guard";
import {
  AartiListQueryDto,
  ApproveAartiDto,
  PaginationDto,
  ReportQueryDto,
  SetSessionStatusDto,
  SettlementQueryDto,
  ToggleFlagDto,
  UpsertAartiSettingDto,
} from "../dtos/aarti.dto";

@ApiTags("Aarti Platform Admin")
@ApiBearerAuth()
@Roles("super_admin")
@UseGuards(AartiCapabilityGuard)
@Controller("aarti/admin")
export class AartiAdminController {
  constructor(
    private readonly management: AartiManagementService,
    private readonly streams: AartiStreamService,
    private readonly reports: AartiReportService,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.Stream) private readonly streamModel: Model<any>,
    @InjectModel(AARTI_MODEL.ScanLog) private readonly scanLogs: Model<any>,
    @InjectModel(AARTI_MODEL.Review) private readonly reviews: Model<any>,
  ) {}

  @Get("dashboard")
  async dashboard(@Req() request: AartiRequest, @Query() query: ReportQueryDto) {
    return {
      success: true,
      data: await this.reports.dashboard(request.aarti, query.days),
    };
  }

  @Get("sessions")
  async sessions_(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listSessions(request.aarti, query)),
    };
  }

  @Get("approvals")
  async approvals(@Query() page: PaginationDto) {
    const [sessions, streams] = await Promise.all([
      this.sessions
        .find({ status: "pending" })
        .populate("ashramId", "name ashramCode")
        .populate("ownerId", "name email phone")
        .sort({ submittedAt: 1 })
        .limit(page.limit)
        .lean(),
      this.streamModel
        .find({ status: "pending" })
        .populate("ashramId", "name ashramCode")
        .populate("ownerId", "name email phone")
        .sort({ submittedAt: 1 })
        .limit(page.limit)
        .lean(),
    ]);
    return {
      success: true,
      data: { sessions, streams },
      counts: { sessions: sessions.length, streams: streams.length },
    };
  }

  @Post("sessions/:id/review")
  async reviewSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApproveAartiDto,
  ) {
    return {
      success: true,
      message:
        dto.decision === "approve"
          ? "Aarti approved and now live."
          : "Aarti sent back to the ashram.",
      data: await this.management.reviewSession(user, id, dto),
    };
  }

  @Patch("sessions/:id/status")
  async setStatus(@Param("id") id: string, @Body() dto: SetSessionStatusDto) {
    return {
      success: true,
      message: "Aarti status updated.",
      data: await this.management.setSessionStatus(id, dto.status),
    };
  }

  @Patch("sessions/:id/featured")
  async setFeatured(@Param("id") id: string, @Body() dto: ToggleFlagDto) {
    return {
      success: true,
      message: dto.value ? "Aarti featured." : "Aarti unfeatured.",
      data: await this.management.setFeatured(id, dto.value),
    };
  }

  @Get("streams")
  async streams_(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.streams.list(request.aarti, query)),
    };
  }

  @Post("streams/:id/review")
  async reviewStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApproveAartiDto,
  ) {
    return {
      success: true,
      message:
        dto.decision === "approve"
          ? "Live pooja approved and now visible."
          : "Live pooja sent back to the ashram.",
      data: await this.streams.review(user, id, dto),
    };
  }

  @Patch("streams/:id/featured")
  async setStreamFeatured(
    @Param("id") id: string,
    @Body() dto: ToggleFlagDto,
  ) {
    return {
      success: true,
      message: dto.value ? "Live pooja featured." : "Live pooja unfeatured.",
      data: await this.streams.setFeatured(id, dto.value),
    };
  }

  @Get("bookings")
  async bookings(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listBookings(request.aarti, query)),
    };
  }

  @Get("settlements")
  async settlements(
    @Req() request: AartiRequest,
    @Query() query: SettlementQueryDto,
  ) {
    return {
      success: true,
      ...(await this.reports.settlements(request.aarti, query.status)),
    };
  }

  @Get("scan-logs")
  async scanLogList(@Query() page: PaginationDto) {
    const [data, total] = await Promise.all([
      this.scanLogs
        .find()
        .populate("sessionId", "name slug")
        .populate("scannedByUserId", "name email")
        .sort({ scannedAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit)
        .lean(),
      this.scanLogs.estimatedDocumentCount(),
    ]);
    return { success: true, data, total, page: page.page };
  }

  @Get("reviews")
  async reviewList(@Query() page: PaginationDto) {
    const [data, total] = await Promise.all([
      this.reviews
        .find()
        .populate("sessionId", "name slug")
        .populate("customerId", "name email")
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit)
        .lean(),
      this.reviews.estimatedDocumentCount(),
    ]);
    return { success: true, data, total, page: page.page };
  }

  @Patch("reviews/:id/status")
  async moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("status") status: string,
    @Body("note") note?: string,
  ) {
    const review = await this.reviews.findByIdAndUpdate(
      id,
      { $set: { status, moderationNote: note ?? "", moderatedBy: user.id } },
      { new: true },
    );
    return { success: true, message: "Review moderated.", data: review };
  }

  @Get("settings")
  async settings(@Req() request: AartiRequest) {
    return {
      success: true,
      data: await this.management.listSettings(request.aarti),
    };
  }

  @Post("settings")
  async upsertSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: UpsertAartiSettingDto,
  ) {
    return {
      success: true,
      message: "Aarti settings saved.",
      data: await this.management.upsertSetting(user, request.aarti, dto),
    };
  }
}
