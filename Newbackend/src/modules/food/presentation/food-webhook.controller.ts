import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
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
    @Headers("x-razorpay-signature") razorpaySig?: string,
    @Headers("x-webhook-signature") genericSig?: string,
  ) {
    const signature = razorpaySig || genericSig;
    return this.paymentService.handlePaymentWebhook(
      provider,
      payload,
      signature,
    );
  }
}
