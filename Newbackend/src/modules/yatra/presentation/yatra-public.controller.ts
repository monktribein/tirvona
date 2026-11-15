import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../../common/decorators/public.decorator";
import { type AuthenticatedUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { SensitiveThrottle } from "../../../common/throttling/rate-limit.decorators";
import { YatraBookingService } from "../application/yatra-booking.service";
import { YatraInventoryService } from "../application/yatra-inventory.service";
import { YatraInsightsService } from "../application/yatra-insights.service";
import { YatraJourneyService } from "../application/yatra-journey.service";
import {
  BookingQueryDto,
  ConfirmPaymentDto,
  CreateBookingDto,
  JourneyLinkDto,
  ReasonDto,
  SearchDto,
  ServiceRequestDto,
  SupplierResponseDto,
} from "./yatra.dto";
import { EntityIdPipe, ok, paged, YatraAlwaysAvailable, YatraEnabledGuard, YatraWriteThrottle } from "./yatra-http";

/** The public Yatra site: search, departure pages, booking links and payment-link pages. */
@ApiTags("Yatra · Public")
@Public()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra")
export class YatraPublicController {
  constructor(
    private readonly config: ConfigService,
    private readonly inventory: YatraInventoryService,
    private readonly insights: YatraInsightsService,
    private readonly bookings: YatraBookingService,
  ) {}

  /** Whether Yatra is switched on (the web app hides every Yatra entry point when it is not). */
  @Get("config")
  @YatraAlwaysAvailable()
  config_() {
    return ok({ enabled: Boolean(this.config.get<boolean>("yatraEnabled")) });
  }

  @Get("search")
  async search(@Query() query: SearchDto) {
    return paged(await this.inventory.search(query), query.page, query.limit);
  }

  @Get("filters")
  async filters() {
    return ok(await this.inventory.filters());
  }

  @Get("departures/:code")
  async departure(@Param("code") code: string) {
    return ok(await this.inventory.publicDeparture(code));
  }

  @Get("departures/:code/seats")
  async seats(@Param("code") code: string) {
    const departure = await this.inventory.publicDeparture(code);
    return ok(await this.inventory.seatMap(departure.departure.id, "public"));
  }

  @Get("links/:code")
  async link(@Param("code") code: string) {
    return ok(await this.insights.resolveLink(code));
  }

  @Get("payment-links/:token")
  @SensitiveThrottle(60, 60_000, "token")
  async paymentLink(@Param("token") token: string) {
    return ok(await this.bookings.paymentLinkSummary(token));
  }
}

/** Signed-in pilgrims: bookings, payments, tickets, cancellations, journeys and add-ons. */
@ApiTags("Yatra · Pilgrim")
@ApiBearerAuth()
@UseGuards(YatraEnabledGuard)
@Controller("v1/yatra")
export class YatraCustomerController {
  constructor(
    private readonly bookings: YatraBookingService,
    private readonly journeys: YatraJourneyService,
  ) {}

  @Post("bookings")
  @YatraWriteThrottle(20, 600_000)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return ok(await this.bookings.createCustomerBooking(user, dto), "Seats held. Complete the payment to confirm them.");
  }

  @Get("bookings")
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: BookingQueryDto) {
    return paged(await this.bookings.listMine(user, query.status, query.page, query.limit), query.page, query.limit);
  }

  @Get("bookings/:id")
  async get(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.getMine(user, id));
  }

  @Post("bookings/:id/payment-order")
  @YatraWriteThrottle(30, 600_000)
  async paymentOrder(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.paymentOrder(user, id));
  }

  @Post("bookings/:id/confirm-payment")
  async confirm(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ConfirmPaymentDto) {
    return ok(await this.bookings.confirmPayment(user, id, dto), "Payment verified. Your Yatra booking is confirmed.");
  }

  @Post("bookings/:id/release")
  async release(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.releaseMine(user, id), "Your seats were released.");
  }

  @Get("bookings/:id/ticket")
  async ticket(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.ticket(user, id));
  }

  @Get("bookings/:id/refund-preview")
  async refundPreview(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.bookings.refundPreview(user, id));
  }

  @Post("bookings/:id/cancel-request")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.bookings.requestCancellation(user, id, dto.reason), "Your cancellation request was sent to Tirvona.");
  }

  @Post("payment-links/:token/order")
  @YatraWriteThrottle(30, 600_000)
  async linkOrder(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string) {
    return ok(await this.bookings.paymentLinkOrder(user, token));
  }

  @Post("payment-links/:token/confirm")
  async linkConfirm(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string, @Body() dto: ConfirmPaymentDto) {
    return ok(await this.bookings.paymentLinkConfirm(user, token, dto), "Payment verified. The booking is confirmed.");
  }

  // ------------------------------------------------------------------ journeys
  @Get("journeys")
  async journeysList(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.journeys.listMine(user));
  }

  @Get("journeys/:id")
  async journey(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.journeys.detail(user, id));
  }

  @Get("journeys/:id/linkable")
  async linkable(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.journeys.linkable(user, id));
  }

  @Post("journeys/:id/links")
  async addLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: JourneyLinkDto) {
    return ok(await this.journeys.addLink(user, id, dto.module, dto.refId), "Added to your journey.");
  }

  @Delete("journeys/:id/links/:linkId")
  async removeLink(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Param("linkId", EntityIdPipe) linkId: string) {
    return ok(await this.journeys.removeLink(user, id, linkId), "Removed from your journey.");
  }

  @Post("journeys/:id/requests")
  @YatraWriteThrottle(20, 600_000)
  async createRequest(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ServiceRequestDto) {
    return ok(await this.journeys.createRequest(user, id, dto), "Request sent. You will be told when it is accepted.");
  }

  @Post("requests/:id/cancel")
  async cancelRequest(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReasonDto) {
    return ok(await this.journeys.cancelRequest(user, id, dto.reason), "Request cancelled.");
  }

  @Post("requests/:id/payment-order")
  @YatraWriteThrottle(30, 600_000)
  async requestOrder(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.journeys.requestPaymentOrder(user, id));
  }

  @Post("requests/:id/confirm-payment")
  async requestConfirm(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ConfirmPaymentDto) {
    return ok(await this.journeys.confirmRequestPayment(user, id, dto), "Payment verified. Your add-on is confirmed.");
  }

  @Get("suppliers/food")
  async foodSuppliers() {
    return ok(await this.journeys.foodSuppliers());
  }

  @Get("suppliers/puja")
  async pujaProviders(@Query("city") city?: string) {
    return ok(await this.journeys.pujaProviders(city));
  }

  // ------------------------------------------------- restaurants and pandits
  @Get("supplier/requests")
  async supplierRequests(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    return ok(await this.journeys.supplierRequests(user, status));
  }

  @Post("supplier/requests/:id/respond")
  async supplierRespond(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string, @Body() dto: SupplierResponseDto) {
    return ok(await this.journeys.supplierRespond(user, id, dto));
  }

  @Post("supplier/requests/:id/fulfil")
  async supplierFulfil(@CurrentUser() user: AuthenticatedUser, @Param("id", EntityIdPipe) id: string) {
    return ok(await this.journeys.supplierFulfil(user, id), "Marked as delivered.");
  }
}
