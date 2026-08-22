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
import { AARTI_CAPABILITIES } from "../../domain/aarti.constants";
import { AartiManagementService } from "../../application/aarti-management.service";
import { AartiStreamService } from "../../application/aarti-stream.service";
import { AartiReportService } from "../../application/aarti-report.service";
import { AartiBookingService } from "../../application/aarti-booking.service";
import { AartiCapabilities } from "../decorators/aarti-capabilities.decorator";
import {
  AartiCapabilityGuard,
  type AartiRequest,
} from "../guards/aarti-capability.guard";
import {
  AartiCalendarQueryDto,
  AartiListQueryDto,
  BlockSeatsDto,
  CancelAartiDto,
  CreateAartiPassTypeDto,
  CreateAartiSessionDto,
  CreateAartiStaffDto,
  CreateAartiStreamDto,
  ReportQueryDto,
  SettlementQueryDto,
  ToggleFlagDto,
  UpdateAartiPassTypeDto,
  UpdateAartiSessionDto,
  UpdateAartiStreamDto,
  UpsertAartiHolidayDto,
  UpsertAartiPricingDto,
  UpsertAartiSettingDto,
} from "../dtos/aarti.dto";

const C = AARTI_CAPABILITIES;

/**
 * The ashram-facing console. `RolesGuard` keeps every non-ashram role out, and
 * `AartiCapabilityGuard` then narrows an owner to their own ashrams while an
 * ashram admin keeps platform-wide reach — the same request shape serves both.
 */
@ApiTags("Aarti Owner Console")
@ApiBearerAuth()
@Roles(
  "ashram_owner",
  "owner",
  "ashram_admin",
  "stay_admin",
  "manager",
  "super_admin",
)
@UseGuards(AartiCapabilityGuard)
@Controller("aarti/owner")
export class AartiOwnerController {
  constructor(
    private readonly management: AartiManagementService,
    private readonly streams: AartiStreamService,
    private readonly reports: AartiReportService,
    private readonly bookings: AartiBookingService,
  ) {}

  @Get("me") access(@Req() request: AartiRequest) {
    return { success: true, data: request.aarti };
  }

  @Get("ashrams") async ashrams(@Req() request: AartiRequest) {
    return {
      success: true,
      data: await this.management.listAshrams(request.aarti),
    };
  }

  @Get("dashboard")
  @AartiCapabilities(C.VIEW_REPORTS)
  async dashboard(@Req() request: AartiRequest, @Query() query: ReportQueryDto) {
    return {
      success: true,
      data: await this.reports.dashboard(request.aarti, query.days),
    };
  }

  @Get("sessions")
  async listSessions(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listSessions(request.aarti, query)),
    };
  }

  @Post("sessions")
  @AartiCapabilities(C.MANAGE_SESSION)
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: CreateAartiSessionDto,
  ) {
    return {
      success: true,
      message: "Aarti saved as a draft. Submit it for review when ready.",
      data: await this.management.createSession(user, request.aarti, dto),
    };
  }

  @Get("sessions/:id")
  async getSession(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      data: await this.management.getSession(request.aarti, id),
    };
  }

  @Put("sessions/:id")
  @AartiCapabilities(C.MANAGE_SESSION)
  async updateSession(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Body() dto: UpdateAartiSessionDto,
  ) {
    return {
      success: true,
      message: "Aarti updated.",
      data: await this.management.updateSession(request.aarti, id, dto),
    };
  }

  @Post("sessions/:id/submit")
  @AartiCapabilities(C.MANAGE_SESSION)
  async submitSession(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Sent for review. It goes live once the platform approves it.",
      data: await this.management.submitSession(request.aarti, id),
    };
  }

  @Delete("sessions/:id")
  @AartiCapabilities(C.MANAGE_SESSION)
  async deleteSession(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Aarti deleted permanently.",
      data: await this.management.deleteSession(request.aarti, id),
    };
  }

  @Post("pass-types")
  @AartiCapabilities(C.MANAGE_PASS_TYPES)
  async createPassType(
    @Req() request: AartiRequest,
    @Body() dto: CreateAartiPassTypeDto,
  ) {
    return {
      success: true,
      message: "Pass added.",
      data: await this.management.createPassType(request.aarti, dto),
    };
  }

  @Put("pass-types/:id")
  @AartiCapabilities(C.MANAGE_PASS_TYPES)
  async updatePassType(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Body() dto: UpdateAartiPassTypeDto,
  ) {
    return {
      success: true,
      message: "Pass updated.",
      data: await this.management.updatePassType(request.aarti, id, dto),
    };
  }

  @Delete("pass-types/:id")
  @AartiCapabilities(C.MANAGE_PASS_TYPES)
  async deletePassType(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Pass removed.",
      data: await this.management.deletePassType(request.aarti, id),
    };
  }

  @Get("sessions/:id/pricing")
  @AartiCapabilities(C.MANAGE_PRICING)
  async listPricing(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      data: await this.management.listPricing(request.aarti, id),
    };
  }

  @Post("pricing")
  @AartiCapabilities(C.MANAGE_PRICING)
  async upsertPricing(
    @Req() request: AartiRequest,
    @Body() dto: UpsertAartiPricingDto,
  ) {
    return {
      success: true,
      message: "Pricing rule saved.",
      data: await this.management.upsertPricing(request.aarti, dto),
    };
  }

  @Delete("pricing/:id")
  @AartiCapabilities(C.MANAGE_PRICING)
  async deletePricing(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Pricing rule removed.",
      data: await this.management.deletePricing(request.aarti, id),
    };
  }

  @Get("holidays")
  @AartiCapabilities(C.MANAGE_PRICING)
  async listHolidays(
    @Req() request: AartiRequest,
    @Query("sessionId") sessionId?: string,
  ) {
    return {
      success: true,
      data: await this.management.listHolidays(request.aarti, sessionId),
    };
  }

  @Post("holidays")
  @AartiCapabilities(C.MANAGE_PRICING)
  async upsertHoliday(
    @Req() request: AartiRequest,
    @Body() dto: UpsertAartiHolidayDto,
  ) {
    return {
      success: true,
      message: "Festival rule saved.",
      data: await this.management.upsertHoliday(request.aarti, dto),
    };
  }

  @Delete("holidays/:id")
  @AartiCapabilities(C.MANAGE_PRICING)
  async deleteHoliday(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Festival rule removed.",
      data: await this.management.deleteHoliday(request.aarti, id),
    };
  }

  @Get("sessions/:id/calendar")
  @AartiCapabilities(C.MANAGE_AVAILABILITY)
  async calendar(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Query() query: AartiCalendarQueryDto,
  ) {
    return {
      success: true,
      data: await this.management.calendar(
        request.aarti,
        id,
        query.fromDate,
        query.toDate,
      ),
    };
  }

  @Post("availability")
  @AartiCapabilities(C.MANAGE_AVAILABILITY)
  async blockSeats(
    @Req() request: AartiRequest,
    @Body() dto: BlockSeatsDto,
  ) {
    return {
      success: true,
      message: "Availability updated.",
      data: await this.management.blockSeats(request.aarti, dto),
    };
  }

  @Get("bookings")
  @AartiCapabilities(C.VIEW_BOOKING)
  async listBookings(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.management.listBookings(request.aarti, query)),
    };
  }

  @Post("bookings/:id/cancel")
  @AartiCapabilities(C.MANAGE_BOOKINGS)
  async cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CancelAartiDto,
  ) {
    return {
      success: true,
      message: "Booking cancelled.",
      data: await this.bookings.cancel(id, user, dto, true),
    };
  }

  @Get("streams")
  async listStreams(
    @Req() request: AartiRequest,
    @Query() query: AartiListQueryDto,
  ) {
    return {
      success: true,
      ...(await this.streams.list(request.aarti, query)),
    };
  }

  @Post("streams")
  @AartiCapabilities(C.MANAGE_STREAM)
  async createStream(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: CreateAartiStreamDto,
  ) {
    return {
      success: true,
      message: "Live pooja saved as a draft. Submit it for review when ready.",
      data: await this.streams.create(user, request.aarti, dto),
    };
  }

  @Put("streams/:id")
  @AartiCapabilities(C.MANAGE_STREAM)
  async updateStream(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Body() dto: UpdateAartiStreamDto,
  ) {
    return {
      success: true,
      message: "Live pooja updated.",
      data: await this.streams.update(request.aarti, id, dto),
    };
  }

  @Post("streams/:id/submit")
  @AartiCapabilities(C.MANAGE_STREAM)
  async submitStream(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Sent for review. It appears on Live Pooja once approved.",
      data: await this.streams.submit(request.aarti, id),
    };
  }

  @Patch("streams/:id/live")
  @AartiCapabilities(C.MANAGE_STREAM)
  async setLive(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Body() dto: ToggleFlagDto,
  ) {
    return {
      success: true,
      message: dto.value ? "Marked as live." : "Marked as offline.",
      data: await this.streams.setLive(request.aarti, id, dto.value),
    };
  }

  @Delete("streams/:id")
  @AartiCapabilities(C.MANAGE_STREAM)
  async deleteStream(@Req() request: AartiRequest, @Param("id") id: string) {
    return {
      success: true,
      message: "Live pooja deleted.",
      data: await this.streams.remove(request.aarti, id),
    };
  }

  @Get("staff")
  @AartiCapabilities(C.MANAGE_STAFF)
  async listStaff(
    @Req() request: AartiRequest,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.management.listStaff(request.aarti, ashramId),
    };
  }

  @Post("staff")
  @AartiCapabilities(C.MANAGE_STAFF)
  async createStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: CreateAartiStaffDto,
  ) {
    return {
      success: true,
      message: "Gate access granted.",
      data: await this.management.createStaff(user, request.aarti, dto),
    };
  }

  @Patch("staff/:id/status")
  @AartiCapabilities(C.MANAGE_STAFF)
  async setStaffStatus(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return {
      success: true,
      message: "Gate access updated.",
      data: await this.management.setStaffStatus(request.aarti, id, status),
    };
  }

  @Get("settings")
  async listSettings(@Req() request: AartiRequest) {
    return {
      success: true,
      data: await this.management.listSettings(request.aarti),
    };
  }

  @Post("settings")
  @AartiCapabilities(C.MANAGE_SESSION)
  async upsertSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: UpsertAartiSettingDto,
  ) {
    return {
      success: true,
      message: "Settings saved.",
      data: await this.management.upsertSetting(user, request.aarti, dto),
    };
  }

  @Get("settlements")
  @AartiCapabilities(C.VIEW_REPORTS)
  async settlements(
    @Req() request: AartiRequest,
    @Query() query: SettlementQueryDto,
  ) {
    return {
      success: true,
      ...(await this.reports.settlements(request.aarti, query.status)),
    };
  }

  @Get("sessions/:id/report")
  @AartiCapabilities(C.VIEW_REPORTS)
  async sessionReport(
    @Req() request: AartiRequest,
    @Param("id") id: string,
    @Query() query: AartiCalendarQueryDto,
  ) {
    return {
      success: true,
      data: await this.reports.sessionReport(
        request.aarti,
        id,
        query.fromDate,
        query.toDate,
      ),
    };
  }
}
