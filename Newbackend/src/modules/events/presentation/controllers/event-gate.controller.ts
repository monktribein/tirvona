import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { EVENT_CAPABILITIES } from "../../domain/event.constants";
import { EventScanService } from "../../application/event-scan.service";
import { EventCapabilities } from "../decorators/event-capabilities.decorator";
import {
  EventCapabilityGuard,
  type EventRequest,
} from "../guards/event-capability.guard";
import {
  EventGateRosterDto,
  EventManualCheckInDto,
  EventScanDto,
} from "../dtos/event.dto";

@ApiTags("Event Gate")
@ApiBearerAuth()
@UseGuards(EventCapabilityGuard)
@Controller("events/scan")
export class EventGateController {
  constructor(private readonly service: EventScanService) {}

  @Get("me") access(@Req() request: EventRequest) {
    return { success: true, data: request.events };
  }

  @Post()
  @EventCapabilities(EVENT_CAPABILITIES.SCAN_QR)
  async scan(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: EventScanDto,
  ) {
    const result = await this.service.scan(user, request.events, dto);
    return { success: result.ok, ...result };
  }

  @Post("manual-check-in")
  @EventCapabilities(EVENT_CAPABILITIES.MANUAL_CHECK_IN)
  async manual(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: EventRequest,
    @Body() dto: EventManualCheckInDto,
  ) {
    return {
      success: true,
      message: "Attendees admitted.",
      data: await this.service.manualCheckIn(user, request.events, dto),
    };
  }

  @Get("roster")
  @EventCapabilities(EVENT_CAPABILITIES.VIEW_REGISTRATION)
  async roster(
    @Req() request: EventRequest,
    @Query() query: EventGateRosterDto,
  ) {
    return {
      success: true,
      data: await this.service.gateRoster(
        request.events,
        query.eventId,
        query.date,
      ),
    };
  }
}
