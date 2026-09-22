import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { actorFromUser } from "../domain/booking-customer";
import { BookingsService } from "../application/bookings.service";
import {
  AssignRoomDto,
  AdminUpdateBookingDto,
  BookingDashboardQueryDto,
  CancelBookingDto,
  CheckinDto,
  CheckoutDto,
  ConfirmBookingPaymentDto,
  CreateBookingDto,
  ManualConfirmBookingDto,
  UpdateBookingStatusDto,
} from "./dtos/booking.dto";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly service: BookingsService) {}
  @Post("quote")
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async quote(@Body() dto: CreateBookingDto) {
    return { success: true, data: await this.service.quote(dto) };
  }
  @Post("create") @Roles("customer") async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return {
      success: true,
      message: "Reservation held successfully. Complete payment to confirm.",
      // A booking made through this controller came in from the website.
      data: await this.service.create(actorFromUser(user), dto),
    };
  }
  @Post(":id/payment/order")
  @Roles(
    "customer",
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  @HttpCode(200)
  async order(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      ...(await this.service.paymentOrder(id, actorFromUser(user))),
    };
  }
  @Post(":id/payment")
  @Roles(
    "customer",
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  @HttpCode(200)
  async payment(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmBookingPaymentDto,
  ) {
    const result = await this.service.confirmPayment(
      id,
      actorFromUser(user),
      dto,
    );
    return {
      success: true,
      message: "Payment verified successfully and booking confirmed",
      data: result.booking,
      payment: result.payment,
      invoice: result.invoice,
    };
  }
  @Post(":id/manual-confirm")
  @Roles(
    "owner",
    "ashram_owner",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  @HttpCode(200)
  async manualConfirm(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualConfirmBookingDto,
  ) {
    const result = await this.service.manualConfirm(id, user, dto);
    return {
      success: true,
      message: "Booking confirmed manually",
      data: result.booking,
      payment: result.payment,
      invoice: result.invoice,
    };
  }
  @Get("payment-pending")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  async paymentPending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingDashboardQueryDto,
  ) {
    return { success: true, data: await this.service.paymentPendingList(user, query) };
  }
  @Get("history") @Roles("customer") async history(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { success: true, data: await this.service.historyFor({ userId: user.id }) };
  }
  @Get("frontdesk-summary")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  async frontdeskSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.frontdeskSummary(user, ashramId),
    };
  }
  @Get("dashboard")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "housekeeping",
    "staff",
    "support",
    "inspector",
    "national_admin",
    "state_admin",
    "government_admin",
    "govt_admin",
    "district_officer",
    "super_admin",
  )
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingDashboardQueryDto,
  ) {
    return { success: true, data: await this.service.dashboard(user, query) };
  }
  @Get(":id")
  @Roles(
    "customer",
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "housekeeping",
    "staff",
    "support",
    "inspector",
    "district_officer",
    "state_admin",
    "govt_admin",
    "government_admin",
    "national_admin",
    "super_admin",
  )
  async get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: await this.service.get(id, actorFromUser(user)),
    };
  }
  @Put(":id/room-number")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  async room(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignRoomDto,
  ) {
    return {
      success: true,
      data: await this.service.assignRoom(id, user, dto),
    };
  }
  @Put(":id/status")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  async status(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return {
      success: true,
      data: await this.service.updateStatus(id, user, dto),
    };
  }
  @Put(":id/admin")
  @Roles("super_admin")
  async adminUpdate(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminUpdateBookingDto,
  ) {
    return {
      success: true,
      message: "Booking details updated successfully",
      data: await this.service.adminUpdate(id, user, dto),
    };
  }
  @Delete(":id/admin")
  @Roles("super_admin")
  async adminDelete(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      message: "Eligible unpaid booking deleted successfully",
      data: await this.service.adminDelete(id, user),
    };
  }
  @Post(":id/checkin")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  @Throttle({ default: { limit: 100, ttl: 900_000 } })
  @HttpCode(200)
  async checkin(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckinDto,
  ) {
    return {
      success: true,
      message: "Guest checked in successfully",
      data: await this.service.checkin(id, user, dto),
    };
  }
  @Post(":id/checkout")
  @Roles(
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "super_admin",
  )
  @HttpCode(200)
  async checkout(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ) {
    return {
      success: true,
      message: "Guest checked out successfully",
      data: await this.service.checkout(id, user, dto),
    };
  }
  @Post(":id/cancel")
  @Roles(
    "customer",
    "owner",
    "ashram_owner",
    "ashram_admin",
    "stay_admin",
    "manager",
    "reception",
    "support",
    "super_admin",
  )
  @HttpCode(200)
  async cancel(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return {
      success: true,
      message: "Booking cancelled successfully",
      data: await this.service.cancel(id, actorFromUser(user), dto),
    };
  }
}
