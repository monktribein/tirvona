import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { ProviderBookingService } from "../application/provider-booking.service";
import { ProviderBookingPaymentService } from "../application/provider-booking-payment.service";
import { ProviderZoomService } from "../application/provider-zoom.service";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import {
  BookingListQueryDto,
  BookingTransitionDto,
  CancelWithReasonDto,
  ConfirmProviderPaymentDto,
  CreatePaymentOrderDto,
  CreateProviderBookingDto,
} from "./dto/booking.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

/**
 * Puja bookings (OpenAPI v2.0 `/bookings`). The stay-booking module keeps its
 * own version-neutral `/api/bookings`; the two never share a route.
 *
 * Who the caller is for a given booking (customer, provider or ops) is derived
 * from the booking and the signed-in user on the server. The client cannot
 * pick a role.
 */
@ProviderApi()
@Controller({ path: "bookings", version: "2" })
export class ProviderBookingsController {
  constructor(
    private readonly bookings: ProviderBookingService,
    private readonly payments: ProviderBookingPaymentService,
    private readonly zoom: ProviderZoomService,
  ) {}

  @Post()
  @Idempotent("provider.booking.create", { sensitive: true })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProviderBookingDto) {
    return this.bookings.create(user, dto);
  }

  /** `?role=provider` lists the bookings made with the caller's provider profile. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: BookingListQueryDto) {
    return query.role === "provider"
      ? this.bookings.listForProvider(user, query)
      : this.bookings.listMine(user, query);
  }

  @Get(":bookingId")
  one(@CurrentUser() user: AuthenticatedUser, @Param("bookingId", ObjectIdPipe) bookingId: string) {
    return this.bookings.getAs(user, bookingId);
  }

  @Get(":bookingId/state-history")
  history(@CurrentUser() user: AuthenticatedUser, @Param("bookingId", ObjectIdPipe) bookingId: string) {
    return this.bookings.historyAs(user, bookingId);
  }

  @Post(":bookingId/transitions")
  @Idempotent("provider.booking.transition", { sensitive: true })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
    @Body() dto: BookingTransitionDto,
  ) {
    return this.bookings.transitionAs(user, bookingId, dto);
  }

  @Post(":bookingId\\:cancel")
  @Idempotent("provider.booking.cancel", { sensitive: true })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
    @Body() dto: CancelWithReasonDto,
  ) {
    return this.bookings.cancelAs(user, bookingId, dto.reasonCode);
  }

  @Post(":bookingId/payment/order")
  @Idempotent("provider.booking.payment.order", { sensitive: true })
  createPaymentOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.payments.createPaymentOrder(bookingId, user, dto);
  }

  @Post(":bookingId/payment")
  @Idempotent("provider.booking.payment.confirm", { sensitive: true })
  confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
    @Body() dto: ConfirmProviderPaymentDto,
  ) {
    return this.payments.confirmPayment(bookingId, user, dto);
  }

  @Get(":bookingId/zoom")
  getZoomMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
  ) {
    return this.zoom.getMeeting(user, bookingId);
  }

  @Post(":bookingId\\:zoom\\:create")
  @Idempotent("provider.booking.zoom.create", { sensitive: true })
  createZoomMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookingId", ObjectIdPipe) bookingId: string,
  ) {
    return this.zoom.createMeeting(user, bookingId);
  }
}
