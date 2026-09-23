import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../../../common/decorators/public.decorator";
import { PublicPaymentProofDto } from "../../../bookings/presentation/public-booking-payment.controller";
import { ParkingPaymentLinkService } from "../../application/parking-payment-link.service";

/**
 * The login-free side of the WhatsApp parking payment page. Same rules as the
 * stay page (`public/pay`): the token is the only credential, every figure
 * comes from the booking record, strict per-IP limits, nothing cacheable.
 */
@Controller("public/parking-pay")
export class PublicParkingPaymentController {
  constructor(private readonly links: ParkingPaymentLinkService) {}

  @Get(":token")
  @Public()
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async summary(@Param("token") token: string) {
    return { success: true, data: await this.links.summary(token) };
  }

  @Post(":token/order")
  @Public()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async order(@Param("token") token: string) {
    return { success: true, data: await this.links.createOrder(token) };
  }

  @Post(":token/confirm")
  @Public()
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirm(
    @Param("token") token: string,
    @Body() proof: PublicPaymentProofDto,
  ) {
    return { success: true, data: await this.links.confirm(token, proof) };
  }
}
