import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { EVENT_CAPABILITIES } from "../../domain/event.constants";
import { EventManagementService } from "../../application/event-management.service";
import { EventRegistrationService } from "../../application/event-registration.service";
import { EventCapabilities } from "../decorators/event-capabilities.decorator";
import {
  EventCapabilityGuard,
  type EventRequest,
} from "../guards/event-capability.guard";
import {
  BlockEventDayDto,
  CancelRegistrationDto,
  CreateEventDto,
  CreateEventStaffDto,
  EventListQueryDto,
  ReportQueryDto,
  UpdateEventDto,
  UpsertEventSettingDto,
} from "../dtos/event.dto";

const C = EVENT_CAPABILITIES;

/**
 * The ashram-facing events console. `RolesGuard` keeps non-ashram roles out and
 * `EventCapabilityGuard` then narrows an owner to their own ashrams while an
 * ashram admin keeps platform-wide reach.
 */
@ApiTags("Event Owner Console")
@ApiBearerAuth()
@Roles(
  "ashram_owner",
  "owner",
  "ashram_admin",
  "stay_admin",
  "manager",
  "super_admin",
)
@UseGuards(EventCapabilityGuard)
@Controller("events/owner")
export class EventOwnerController {
  constructor(
    private readonly management: EventManagementService,
    private readonly registrations: EventRegistrationService,
  ) {}

  @Get("me") access(@Req() request: EventRequest) {
    return { success: true, data: request.events };
  }

  @Get("ashrams") async ashrams(@Req() request: EventRequest) {
    return {
      success: true,
      data: await this.management.listAshrams(request.events),
    };
  }

  @Get("dashboard")
  @EventCapabilities(C.VIEW_REPORTS)
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

  @Post("events")
  @EventCapabilities(C.MANAGE_EVENT)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: CreateEventDto,
  ) {
    return {
      success: true,
      message: "Event saved as a draft. Submit it for review when ready.",
      data: await this.management.createEvent(user, request.events, dto),
    };
  }

  @Get("events/:id")
  async get(@Req() request: EventRequest, @Param("id") id: string) {
    return {
      success: true,
      data: await this.management.getEvent(request.events, id),
    };
  }

  @Put("events/:id")
  @EventCapabilities(C.MANAGE_EVENT)
  async update(
    @Req() request: EventRequest,
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return {
      success: true,
      message: "Event updated.",
      data: await this.management.updateEvent(request.events, id, dto),
    };
  }

  @Post("events/:id/submit")
  @EventCapabilities(C.MANAGE_EVENT)
  async submit(@Req() request: EventRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Sent for review. It goes live once the platform approves it.",
      data: await this.management.submitEvent(request.events, id),
    };
  }

  @Delete("events/:id")
  @EventCapabilities(C.MANAGE_EVENT)
  async remove(@Req() request: EventRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Event deleted.",
      data: await this.management.deleteEvent(request.events, id),
    };
  }

  @Get("events/:id/days")
  @EventCapabilities(C.MANAGE_AVAILABILITY)
  async days(@Req() request: EventRequest, @Param("id") id: string) {
    return {
      success: true,
      data: await this.management.dayCalendar(request.events, id),
    };
  }

  @Post("availability")
  @EventCapabilities(C.MANAGE_AVAILABILITY)
  async blockDay(@Req() request: EventRequest, @Body() dto: BlockEventDayDto) {
    return {
      success: true,
      message: "Day updated.",
      data: await this.management.blockDay(request.events, dto),
    };
  }

  @Get("registrations")
  @EventCapabilities(C.VIEW_REGISTRATION)
  async listRegistrations(
    @Req() request: EventRequest,
    @Query() query: EventListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listRegistrations(request.events, query)),
    };
  }

  @Post("registrations/:id/cancel")
  @EventCapabilities(C.MANAGE_REGISTRATIONS)
  async cancelRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CancelRegistrationDto,
  ) {
    return {
      success: true,
      message: "Registration cancelled.",
      data: await this.registrations.cancel(id, user, dto, true),
    };
  }

  @Get("staff")
  @EventCapabilities(C.MANAGE_STAFF)
  async listStaff(
    @Req() request: EventRequest,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.management.listStaff(request.events, ashramId),
    };
  }

  @Post("staff")
  @EventCapabilities(C.MANAGE_STAFF)
  async createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: CreateEventStaffDto,
  ) {
    return {
      success: true,
      message: "Gate access granted.",
      data: await this.management.createStaff(user, request.events, dto),
    };
  }

  @Patch("staff/:id/status")
  @EventCapabilities(C.MANAGE_STAFF)
  async setStaffStatus(
    @Req() request: EventRequest,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return {
      success: true,
      message: "Gate access updated.",
      data: await this.management.setStaffStatus(request.events, id, status),
    };
  }

  @Get("settings")
  async listSettings(@Req() request: EventRequest) {
    return {
      success: true,
      data: await this.management.listSettings(request.events),
    };
  }

  @Post("settings")
  @EventCapabilities(C.MANAGE_EVENT)
  async upsertSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: UpsertEventSettingDto,
  ) {
    return {
      success: true,
      message: "Settings saved.",
      data: await this.management.upsertSetting(user, request.events, dto),
    };
  }
}
