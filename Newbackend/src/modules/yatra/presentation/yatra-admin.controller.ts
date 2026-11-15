import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type AuthenticatedUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { YATRA_ADMIN_ROLES } from "../domain/yatra.constants";
import { YatraBookingService } from "../application/yatra-booking.service";
import { YatraCatalogService } from "../application/yatra-catalog.service";
import { YatraInsightsService } from "../application/yatra-insights.service";
import { YatraInventoryService } from "../application/yatra-inventory.service";
import { YatraJourneyService } from "../application/yatra-journey.service";
import { YatraOperatorService } from "../application/yatra-operator.service";
import { YatraAuditService, YatraSettingsService } from "../application/yatra-support.service";
import {
  AdminCancelBookingDto,
  AdminDepartureQueryDto,
  AssignSupplierDto,
  AuditQueryDto,
  BlockSeatsDto,
  BookingQueryDto,
  CancellationDecisionDto,
  DateRangeDto,
  DocumentStatusQueryDto,
  LedgerQueryDto,
  OperatorReviewDto,
  OperatorStatusQueryDto,
  ReasonDto,
  ServiceRequestQueryDto,
  SettingsDto,
  SimpleReviewDto,
  SupplierResponseDto,
  TourReviewDto,
  TourStatusQueryDto,
  VehicleReviewDto,
  VehicleStatusQueryDto,
} from "./yatra.dto";
import { EntityIdPipe, ok, paged, YatraEnabledGuard } from "./yatra-http";

/** Super Admin console. Only Super Admin approves organisers, verifies documents and publishes tours. */
@ApiTags("Yatra · Super Admin")
@ApiBearerAuth()
@Roles(...YATRA_ADMIN_ROLES)
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra/admin")
export class YatraAdminController {
  constructor(
    private readonly operators: YatraOperatorService,
    private readonly catalog: YatraCatalogService,
    private readonly inventory: YatraInventoryService,
    private readonly bookings: YatraBookingService,
    private readonly journeys: YatraJourneyService,
    private readonly insights: YatraInsightsService,
    private readonly settings: YatraSettingsService,
    private readonly audit: YatraAuditService,
  ) {}

  @Get("overview")
  async overview() {
    return ok(await this.insights.adminOverview());
  }

  // --------------------------------------------------------------- organisers
  @Get("operators")
  async operatorsList(@Query() query: OperatorStatusQueryDto) {
    return paged(await this.operators.adminList(query), query.page, query.limit);
  }

  @Get("operators/:id")
  async operator(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.operators.adminDetail(id));
  }

  @Post("operators/:id/review")
  async reviewOperator(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: OperatorReviewDto) {
    return ok(await this.operators.adminReview(admin, id, dto.action, dto.note));
  }

  // ---------------------------------------------------------------- documents
  @Get("documents")
  async documents(@Query() query: DocumentStatusQueryDto) {
    return paged(await this.operators.adminDocuments(query), query.page, query.limit);
  }

  @Get("documents/:id/link")
  async documentLink(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.operators.documentLink(admin, id, true));
  }

  @Post("documents/:id/review")
  async reviewDocument(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: SimpleReviewDto) {
    return ok(await this.operators.adminReviewDocument(admin, id, dto.decision, dto.note));
  }

  // ----------------------------------------------------------------- vehicles
  @Get("vehicles")
  async vehicles(@Query() query: VehicleStatusQueryDto) {
    return paged(await this.catalog.adminVehicles(query), query.page, query.limit);
  }

  @Post("vehicles/:id/review")
  async reviewVehicle(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: VehicleReviewDto) {
    return ok(await this.catalog.adminReviewVehicle(admin, id, dto.action, dto.note));
  }

  // -------------------------------------------------------------------- tours
  @Get("tours")
  async tours(@Query() query: TourStatusQueryDto) {
    return paged(await this.catalog.adminTours(query), query.page, query.limit);
  }

  @Get("tours/:id")
  async tour(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.catalog.adminTour(id));
  }

  @Post("tours/:id/review")
  async reviewTour(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: TourReviewDto) {
    return ok(await this.catalog.adminReviewTour(admin, id, dto.action, dto.note));
  }

  // --------------------------------------------------------------- departures
  @Get("departures")
  async departures(@Query() query: AdminDepartureQueryDto) {
    return paged(await this.inventory.adminDepartures(query), query.page, query.limit);
  }

  @Get("departures/:id")
  async departure(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.adminDeparture(id));
  }

  @Post("departures/:id/close-sales")
  async closeSales(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.setSales(admin, id, false, true), "Sales stopped.");
  }

  @Post("departures/:id/reopen-sales")
  async reopenSales(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.inventory.setSales(admin, id, true, true), "Sales reopened.");
  }

  @Post("departures/:id/cancel")
  async cancelDeparture(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.bookings.cancelDeparture(admin, id, dto.reason), "Departure cancelled. Paid travellers were refunded to their wallets.");
  }

  @Post("departures/:id/seats")
  async blockSeats(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: BlockSeatsDto) {
    return ok(await this.inventory.adminBlockSeats(admin, id, dto.seatNos, dto.blocked));
  }

  // ----------------------------------------------------------------- bookings
  @Get("bookings")
  async bookingsList(@Query() query: BookingQueryDto) {
    return paged(await this.bookings.adminBookings(query), query.page, query.limit);
  }

  @Get("bookings/:id")
  async booking(@Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.adminBooking(id));
  }

  @Post("bookings/:id/cancellation")
  async decide(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: CancellationDecisionDto) {
    return ok(await this.bookings.decideCancellation(admin, id, dto.decision, { refundPercent: dto.refundPercent, note: dto.note }));
  }

  @Post("bookings/:id/cancel")
  async cancelBooking(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: AdminCancelBookingDto) {
    return ok(await this.bookings.decideCancellation(admin, id, "approve", { refundPercent: dto.refundPercent, note: dto.reason, direct: true }), "Booking cancelled.");
  }

  // -------------------------------------------------------- service requests
  @Get("service-requests")
  async requests(@Query() query: ServiceRequestQueryDto) {
    return paged(await this.journeys.adminRequests(query), query.page, query.limit);
  }

  @Post("service-requests/:id/assign")
  async assign(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: AssignSupplierDto) {
    return ok(await this.journeys.adminAssign(admin, id, dto));
  }

  @Post("service-requests/:id/respond")
  async respond(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: SupplierResponseDto) {
    return ok(await this.journeys.adminRespond(admin, id, dto));
  }

  @Post("service-requests/:id/fulfil")
  async fulfil(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.journeys.adminFulfil(admin, id));
  }

  @Post("service-requests/:id/cancel")
  async cancelRequest(@CurrentUser() admin: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.journeys.adminCancel(admin, id, dto.reason));
  }

  // -------------------------------------------------------- finance & system
  @Get("finance")
  async finance(@Query() query: DateRangeDto) {
    return ok(await this.insights.adminFinance(query));
  }

  @Get("ledger")
  async ledger(@Query() query: LedgerQueryDto) {
    return paged(await this.insights.adminLedger(query), query.page, query.limit);
  }

  @Get("audit")
  async auditLog(@Query() query: AuditQueryDto) {
    return paged(await this.insights.adminAudit(query), query.page, query.limit);
  }

  @Get("settings")
  async getSettings() {
    return ok(await this.settings.get());
  }

  @Put("settings")
  async putSettings(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SettingsDto) {
    const change = await this.settings.update(dto, admin.id);
    await this.audit.record(admin, "settings.updated", {}, change);
    return ok(change.after, "Settings saved.");
  }
}
