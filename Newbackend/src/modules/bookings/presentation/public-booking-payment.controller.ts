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
import { IsString, MaxLength, MinLength } from "class-validator";
import { Public } from "../../../common/decorators/public.decorator";
import { BookingPaymentLinkService } from "../application/booking-payment-link.service";

/** The Razorpay checkout result, and nothing else. The server supplies the rest. */
export class PublicPaymentProofDto {
  @IsString() @MinLength(5) @MaxLength(100) razorpay_order_id: string;
  @IsString() @MinLength(5) @MaxLength(100) razorpay_payment_id: string;
  @IsString() @MinLength(10) @MaxLength(200) razorpay_signature: string;
}

/**
 * The public, login-free side of the WhatsApp payment page.
 *
 * Reached only with a signed, short-lived payment token. Every response is
 * built from the booking's own record; the request carries no amount, no
 * booking id, no order id to trust — only the token and, on confirmation, the
 * Razorpay proof, which `confirmPayment` verifies against the server's own
 * order for that booking. Tight per-IP rate limits apply, and nothing here is
 * cacheable.
 */
@Controller("public/pay")
export class PublicBookingPaymentController {
  constructor(private readonly links: BookingPaymentLinkService) {}

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
