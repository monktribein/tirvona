import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { PaymentsWebhookService } from "../application/payments-webhook.service";

/// Receives Razorpay's server-to-server payment webhooks. Public (no JWT) —
/// Razorpay is the caller, authenticated instead by the HMAC signature over
/// the raw body (see `PaymentsWebhookService.verifySignature`). Configure
/// this URL + a webhook secret on the Razorpay Dashboard under
/// Settings → Webhooks, events `payment.captured` and `order.paid`, and set
/// that secret as RAZORPAY_WEBHOOK_SECRET here.
@Controller("payments/razorpay")
export class PaymentsWebhookController {
  constructor(private readonly webhook: PaymentsWebhookService) {}

  @Public()
  @Post("webhook")
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature = "",
    @Headers("x-razorpay-event-id") headerEventId = "",
    @Body() body: any,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody)
      throw new UnauthorizedException("Raw webhook body is unavailable");
    if (!this.webhook.verifySignature(rawBody, signature))
      throw new UnauthorizedException("Invalid Razorpay webhook signature");

    const eventType = String(body?.event ?? "unknown");
    const paymentId: string | undefined = body?.payload?.payment?.entity?.id;
    // Razorpay sends a stable event id header on most accounts; fall back to
    // a payment-scoped key so retries of the same event still dedupe even if
    // the header is ever absent.
    const eventId =
      headerEventId || (paymentId ? `${eventType}:${paymentId}` : "");
    if (!eventId) throw new UnauthorizedException("Malformed webhook payload");

    await this.webhook.handleEvent(eventId, eventType, body);
    // Razorpay only needs a 2xx to stop retrying — no response body contract.
    return { success: true };
  }
}
