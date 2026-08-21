import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { ParkingBookingService } from "../../application/parking-booking.service";
import { ParkingPricingService } from "../../application/parking-pricing.service";
import { PARKING_MODEL } from "../../domain/parking.constants";
import {
  CancelParkingDto,
  ConfirmParkingPaymentDto,
  CreateParkingBookingDto,
  PaginationDto,
  ReviewParkingDto,
} from "../dtos/parking.dto";

@ApiTags("Parking Bookings")
@ApiBearerAuth()
@Controller("parking/bookings")
export class ParkingBookingController {
  constructor(
    private readonly service: ParkingBookingService,
    private readonly pricing: ParkingPricingService,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.QrCode) private readonly qrCodes: Model<any>,
    @InjectModel(PARKING_MODEL.Notification)
    private readonly notifications: Model<any>,
  ) {}

  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateParkingBookingDto,
  ) {
    return {
      success: true,
      message: "Bay held. Complete payment to confirm your booking.",
      data: await this.service.create(user, dto),
    };
  }

  @Get() async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
    @Query("status") status?: string,
  ) {
    const result = await this.service.listMine(
      user.id,
      status,
      page.page,
      page.limit,
    );
    return {
      success: true,
      count: result.items.length,
      total: result.total,
      page: page.page,
      totalPages: Math.ceil(result.total / page.limit),
      data: result.items,
    };
  }

  @Get("notifications") async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
  ) {
    const filter = { userId: user.id };
    const skip = (page.page - 1) * page.limit;
    const [data, total, unread] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(page.limit),
      this.notifications.countDocuments(filter),
      this.notifications.countDocuments({ ...filter, readAt: null }),
    ]);
    return { success: true, count: data.length, total, unread, data };
  }

  @Post("notifications/read-all") async readNotifications(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notifications.updateMany(
      { userId: user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return { success: true, message: "Notifications marked as read." };
  }

  @Get(":id") async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const booking = await this.service.ownBooking(id, user.id);
    const pass = await this.qrCodes
      .findOne({ bookingId: id, status: { $in: ["active", "used"] } })
      .sort({ version: -1 });
    return {
      success: true,
      data: {
        booking,
        pass: pass
          ? {
              displayCode: pass.displayCode,
              validFrom: pass.validFrom,
              validUntil: pass.validUntil,
              status: pass.status,
              entryScannedAt: pass.entryScannedAt,
              exitScannedAt: pass.exitScannedAt,
            }
          : null,
      },
    };
  }

  @Post(":id/payment/order") async order(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const result = await this.service.createPaymentOrder(id, user);
    return { success: true, ...result };
  }

  @Post(":id/payment") async payment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ConfirmParkingPaymentDto,
  ) {
    const result = await this.service.confirmPayment(id, user, dto);
    return {
      success: true,
      message: "Payment confirmed. Your parking pass is ready.",
      data: { booking: result.booking, qr: result.qr },
    };
  }

  @Get(":id/qr") async qr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("format") format = "png",
  ) {
    return {
      success: true,
      data: await this.service.currentPass(id, user.id, format),
    };
  }

  @Post(":id/qr/reissue") async reissue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("format") format = "png",
  ) {
    return {
      success: true,
      message: "A new pass has been issued. The previous one no longer works.",
      data: await this.service.reissueQr(id, user.id, format),
    };
  }

  @Get(":id/refund-preview") async refundPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const booking = await this.service.ownBooking(id, user.id);
    const location = await this.locations.findById(booking.locationId);
    return {
      success: true,
      data: await this.pricing.refundQuote(booking, location),
    };
  }

  @Post(":id/cancel") async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CancelParkingDto,
  ) {
    const data = await this.service.cancel(id, user, dto);
    return {
      success: true,
      message: data.refund.refundAmount
        ? `Booking cancelled. ₹${data.refund.refundAmount} will be refunded.`
        : "Booking cancelled.",
      data,
    };
  }

  @Post(":id/review") async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewParkingDto,
  ) {
    return {
      success: true,
      message: "Thank you for your feedback.",
      data: await this.service.review(id, user, dto),
    };
  }
}
