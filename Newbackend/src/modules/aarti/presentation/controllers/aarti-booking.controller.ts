import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { AartiBookingService } from "../../application/aarti-booking.service";
import { AARTI_MODEL } from "../../domain/aarti.constants";
import {
  CancelAartiDto,
  ConfirmAartiPaymentDto,
  CreateAartiBookingDto,
  PaginationDto,
  PassFormatDto,
  ReviewAartiDto,
} from "../dtos/aarti.dto";

@ApiTags("Aarti Bookings")
@ApiBearerAuth()
@Controller("aarti/bookings")
export class AartiBookingController {
  constructor(
    private readonly service: AartiBookingService,
    @InjectModel(AARTI_MODEL.Notification)
    private readonly notifications: Model<any>,
  ) {}

  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAartiBookingDto,
  ) {
    return {
      success: true,
      message: "Seats held. Complete payment to confirm your aarti pass.",
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
      totalPages: Math.ceil(result.total / page.limit) || 1,
      data: result.items,
    };
  }

  @Get("notifications") async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
  ) {
    const filter = { userId: user.id };
    const [data, total, unread] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit),
      this.notifications.countDocuments(filter),
      this.notifications.countDocuments({ ...filter, readAt: null }),
    ]);
    return { success: true, count: data.length, total, unread, data };
  }

  @Post("notifications/read-all") async readNotifications(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.notifications.updateMany(
      { userId: user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return { success: true, data: { updated: result.modifiedCount } };
  }

  @Get(":id") async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.ownBooking(id, user.id) };
  }

  @Post(":id/payment/order") async order(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, ...(await this.service.createPaymentOrder(id, user)) };
  }

  @Post(":id/payment") async payment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ConfirmAartiPaymentDto,
  ) {
    return {
      success: true,
      message: "Payment confirmed. Your aarti pass is ready.",
      data: await this.service.confirmPayment(id, user, dto),
    };
  }

  @Get(":id/pass") async pass(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: PassFormatDto,
  ) {
    return {
      success: true,
      data: await this.service.currentPass(id, user.id, query.format),
    };
  }

  @Post(":id/pass/reissue") async reissue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: PassFormatDto,
  ) {
    return {
      success: true,
      message: "A new pass has been issued. Older passes no longer work.",
      data: await this.service.reissuePass(id, user.id, query.format),
    };
  }

  @Get(":id/refund-preview") async refundPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      data: await this.service.refundPreview(id, user.id),
    };
  }

  @Post(":id/cancel") async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CancelAartiDto,
  ) {
    return {
      success: true,
      message: "Your aarti booking has been cancelled.",
      data: await this.service.cancel(id, user, dto),
    };
  }

  @Post(":id/review") async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewAartiDto,
  ) {
    return {
      success: true,
      message: "Thank you for sharing your experience.",
      data: await this.service.review(id, user, dto),
    };
  }
}
