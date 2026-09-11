import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { Model } from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { BookingsService } from "../../bookings/application/bookings.service";
import { ParkingBookingService } from "../../parking/application/parking-booking.service";
import { MarketplaceOrderService } from "../../commerce/application/marketplace-order.service";
import { AartiBookingService } from "../../aarti/application/aarti-booking.service";

/// Server-to-server reconciliation for Razorpay payments, independent of the
/// guest's device ever delivering a client-side success callback.
///
/// The client-driven confirmation path (BookingsService.confirmPayment and
/// its equivalents) only runs if the guest's app is still alive when
/// Razorpay's checkout finishes — which is not guaranteed on low-RAM Android
/// devices: sending the guest to an external UPI app and back can cost the
/// app its process under memory pressure, silently dropping the in-flight
/// checkout callback even though the payment actually succeeded. Razorpay's
/// webhook is authoritative and arrives regardless of what happens to the
/// guest's phone, so this is the fix of record for "payment succeeded but
/// the app still shows pending."
@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel("PaymentWebhookEvent") private readonly events: Model<any>,
    private readonly bookings: BookingsService,
    private readonly parking: ParkingBookingService,
    private readonly marketplace: MarketplaceOrderService,
    private readonly aarti: AartiBookingService,
  ) {}

  /// Verifies Razorpay's `X-Razorpay-Signature` header: HMAC-SHA256 of the
  /// exact raw request body, keyed by the webhook secret configured on the
  /// Razorpay Dashboard (Settings → Webhooks) — distinct from the API key
  /// secret used for the per-payment checkout signature.
  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get<string>("razorpayWebhookSecret");
    if (!secret || !signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  }

  /// Processes one verified webhook delivery. Idempotent per (provider,
  /// eventId) — Razorpay retries deliveries that don't get a fast 2xx, so a
  /// duplicate must be a safe no-op rather than double-confirming a payment.
  async handleEvent(
    eventId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    let event: any;
    try {
      event = await this.events.create({ provider: "razorpay", eventId, eventType });
    } catch (error: any) {
      if (error?.code === 11000) return; // duplicate delivery, already handled
      throw error;
    }

    try {
      // Only these two events mean money has actually, verifiably moved.
      // Everything else (order.created, payment.failed, refund.*, ...) is
      // outside this endpoint's job — client flows and admin refund tooling
      // already own those.
      if (eventType !== "payment.captured" && eventType !== "order.paid") {
        event.status = "ignored";
        await event.save();
        return;
      }

      const paymentEntity = payload?.payload?.payment?.entity;
      const orderId: string | undefined = paymentEntity?.order_id;
      const paymentId: string | undefined = paymentEntity?.id;
      if (!orderId || !paymentId) {
        event.status = "ignored";
        await event.save();
        return;
      }
      event.orderId = orderId;
      event.paymentId = paymentId;

      const matchedModule = await this.dispatch(orderId, paymentId);
      event.matchedModule = matchedModule ?? undefined;
      event.status = matchedModule ? "processed" : "ignored";
      event.processedAt = new Date();
      await event.save();

      if (!matchedModule) {
        this.logger.warn(
          `Razorpay webhook ${eventType}: no booking/order in any module owns order ${orderId}`,
        );
      }
    } catch (error) {
      event.status = "failed";
      event.processingError =
        error instanceof Error ? error.message : "Webhook processing failed";
      await event.save();
      throw error;
    }
  }

  /// Tries each payment-taking module in turn. A given Razorpay order id is
  /// only ever created by exactly one of them, so at most one call matches;
  /// the rest return `false` immediately on their own `findOne` miss.
  private async dispatch(
    orderId: string,
    paymentId: string,
  ): Promise<string | null> {
    if (await this.bookings.confirmPaymentFromWebhook(orderId, paymentId))
      return "bookings";
    if (await this.parking.confirmPaymentFromWebhook(orderId, paymentId))
      return "parking";
    if (await this.marketplace.confirmPaymentFromWebhook(orderId, paymentId))
      return "marketplace";
    if (await this.aarti.confirmPaymentFromWebhook(orderId, paymentId))
      return "aarti";
    return null;
  }
}
