import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SelfBookingService } from "../application/self-booking.service";
import {
  CreateSelfBookingDto,
  SelfBookingAvailabilityDto,
} from "./dtos/self-booking.dto";

@ApiTags("Self & Online Bookings")
@ApiBearerAuth()
@Roles(
  "ashram_owner",
  "owner",
  "manager",
  "reception",
  "ashram_admin",
  "stay_admin",
  "super_admin",
)
@Controller("bookings/self")
export class SelfBookingController {
  constructor(private readonly service: SelfBookingService) {}

  @Get("ashrams")
  async ashrams(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.authorizedAshrams(user);
    return { success: true, count: data.length, data };
  }

  @Get("availability")
  async availability(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SelfBookingAvailabilityDto,
  ) {
    const data = await this.service.availability(user, query);
    return { success: true, count: data.length, data };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSelfBookingDto,
  ) {
    const result = await this.service.create(user, dto);
    return {
      success: true,
      message: result.requiresOnlinePayment
        ? "Booking held. Collect payment through Razorpay to confirm."
        : "Self booking recorded.",
      data: {
        id: String(result.booking._id),
        bookingId: result.booking.bookingId,
        reservationNumber: result.booking.reservationNumber,
        bookingSource: result.booking.bookingSource,
        status: result.booking.status,
        checkInCode: result.checkInCode,
        receiptNumber: result.receipt?.receiptNumber ?? null,
        amountCollected: result.payment?.amount ?? 0,
        method: result.payment?.method ?? "razorpay",
        requiresOnlinePayment: result.requiresOnlinePayment,
        amountDue: result.amountDue,
        booking: result.booking,
      },
    };
  }

  @Get(":id/receipt")
  async receipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const data = await this.service.receipt(user, id);
    return { success: true, data };
  }

  @Get(":id/qr.svg")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async qr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const svg = await this.service.checkInQr(user, id);
    response.send(svg);
  }
}
