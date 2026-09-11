import { Schema } from "mongoose";

/// One row per Razorpay webhook delivery, keyed by (provider, eventId) so a
/// retried delivery (Razorpay retries on timeout/5xx) is a no-op rather than
/// double-processing a payment. Shared across every payment-taking module
/// (bookings, parking, marketplace, aarti) since the webhook endpoint itself
/// is shared — each module's own confirmation logic still runs exactly once
/// per underlying booking/order via its own paymentStatus checks.
export const PaymentWebhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, default: "razorpay" },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    orderId: String,
    paymentId: String,
    matchedModule: String,
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      default: "received",
    },
    processingError: String,
    processedAt: Date,
  },
  { timestamps: true, collection: "payment_webhook_events" },
);
PaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
