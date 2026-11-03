import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { FoodPaymentService } from "../application/food-payment.service";

@Controller("v1/food/webhooks")
export class FoodWebhookController {
  constructor(private readonly paymentService: FoodPaymentService) {}

  @Public()
  @Post("payments/:provider")
  async handlePaymentWebhook(
    @Param("provider") provider: string,
    @Body() payload: any,
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") razorpaySig?: string,
    @Headers("x-webhook-signature") genericSig?: string,
  ) {
    const signature = razorpaySig || genericSig;
    return this.paymentService.handlePaymentWebhook(
      provider,
      payload,
      signature,
      request.rawBody,
    );
  }
}
