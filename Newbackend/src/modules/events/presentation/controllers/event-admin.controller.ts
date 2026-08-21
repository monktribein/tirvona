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
import { EVENT_MODEL } from "../../domain/event.constants";
import { EventManagementService } from "../../application/event-management.service";
import {
  EventCapabilityGuard,
  type EventRequest,
} from "../guards/event-capability.guard";
import {
  ApproveEventDto,
  EventListQueryDto,
  PaginationDto,
  ReportQueryDto,
  SetEventStatusDto,
  ToggleFlagDto,
  UpsertEventSettingDto,
} from "../dtos/event.dto";

@ApiTags("Events Platform Admin")
@ApiBearerAuth()
@Roles("super_admin")
@UseGuards(EventCapabilityGuard)
@Controller("events/admin")
export class EventAdminController {
  constructor(
    private readonly management: EventManagementService,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
    @InjectModel(EVENT_MODEL.ScanLog) private readonly scanLogs: Model<any>,
  ) {}

  @Get("dashboard")
  async dashboard(@Req() request: EventRequest, @Query() query: ReportQueryDto) {
    return {
      success: true,
      data: await this.management.dashboard(request.events, query.days),
    };
  }

  @Get("events")
  async list(@Req() request: EventRequest, @Query() query: EventListQueryDto) {
    return {
      success: true,
      ...(await this.management.listEvents(request.events, query)),
    };
  }

  @Get("approvals")
  async approvals(@Query() page: PaginationDto) {
    const events = await this.events
      .find({ status: "pending" })
      .populate("ashramId", "name ashramCode")
      .populate("ownerId", "name email phone")
      .sort({ submittedAt: 1 })
      .limit(page.limit)
      .lean();
    return { success: true, data: { events }, counts: { events: events.length } };
  }

  @Post("events/:id/review")
  async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApproveEventDto,
  ) {
    return {
      success: true,
      message:
        dto.decision === "approve"
          ? "Event approved and now live."
          : "Event sent back to the ashram.",
      data: await this.management.reviewEvent(user, id, dto),
    };
  }

  @Patch("events/:id/status")
  async setStatus(@Param("id") id: string, @Body() dto: SetEventStatusDto) {
    return {
      success: true,
      message: "Event status updated.",
      data: await this.management.setStatus(id, dto.status),
    };
  }

  @Patch("events/:id/featured")
  async setFeatured(@Param("id") id: string, @Body() dto: ToggleFlagDto) {
    return {
      success: true,
      message: dto.value ? "Event featured." : "Event unfeatured.",
      data: await this.management.setFeatured(id, dto.value),
    };
  }

  @Get("registrations")
  async registrations(
    @Req() request: EventRequest,
    @Query() query: EventListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listRegistrations(request.events, query)),
    };
  }

  @Get("scan-logs")
  async scanLogList(@Query() page: PaginationDto) {
    const [data, total] = await Promise.all([
      this.scanLogs
        .find()
        .populate("eventId", "name slug")
        .populate("scannedByUserId", "name email")
        .sort({ scannedAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit)
        .lean(),
      this.scanLogs.estimatedDocumentCount(),
    ]);
    return { success: true, data, total, page: page.page };
  }

  @Get("settings")
  async settings(@Req() request: EventRequest) {
    return {
      success: true,
      data: await this.management.listSettings(request.events),
    };
  }

  @Post("settings")
  async upsertSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: UpsertEventSettingDto,
  ) {
    return {
      success: true,
      message: "Event settings saved.",
      data: await this.management.upsertSetting(user, request.events, dto),
    };
  }
}
