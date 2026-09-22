import { Schema, SchemaTypes } from "mongoose";

/**
 * One row per inbound WhatsApp message Meta delivers to the webhook.
 *
 * Meta redelivers anything it does not get a prompt 2xx for, and redelivers
 * freely besides, so this is the idempotency record: `messageId` is Meta's own
 * `messages[].id` and it is unique. The webhook inserts first and lets a
 * duplicate key error (code 11000) mark the delivery as already handled,
 * exactly as `PaymentsWebhookService` does for Razorpay — the same pattern is
 * reused rather than a second one invented.
 *
 * Because the insert happens before any action runs, a redelivery cannot
 * create a second booking, a second payment order or a second cancellation.
 *
 * Message text is stored because support needs to see what a guest actually
 * asked. Nothing sensitive is kept: OTPs, tokens and payment credentials never
 * travel inbound, and the raw Meta payload is deliberately not retained.
 */
export const WhatsAppInboundEventSchema = new Schema(
  {
    /** Meta's `messages[].id` — the idempotency key. */
    messageId: { type: String, required: true, unique: true, trim: true },
    /** Normalized sender number, matching WhatsAppCustomer.phone. */
    phone: { type: String, required: true, index: true },
    whatsappCustomerId: {
      type: SchemaTypes.ObjectId,
      ref: "WhatsAppCustomer",
      default: null,
      index: true,
    },
    messageType: {
      type: String,
      enum: [
        "text",
        "interactive",
        "button",
        "location",
        "image",
        "audio",
        "document",
        "video",
        "sticker",
        "contacts",
        "order",
        "system",
        "unsupported",
      ],
      default: "text",
    },
    /** Plain text, or the title of the interactive row the guest tapped. */
    text: { type: String, default: "" },
    /** Reply id of a tapped list row or button, e.g. "menu:stay". */
    replyId: { type: String, default: "" },
    /** Meta's own message timestamp, seconds since epoch. */
    sentAt: { type: Date },
    status: {
      type: String,
      enum: ["received", "queued", "processed", "failed", "ignored"],
      default: "received",
      index: true,
    },
    processedAt: { type: Date },
    /** Error class name only — never a stack or a message with guest data. */
    processingError: { type: String, default: "" },
    queueJobId: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "whatsapp_inbound_events",
  },
);

WhatsAppInboundEventSchema.index({ phone: 1, createdAt: -1 });
WhatsAppInboundEventSchema.index({ status: 1, createdAt: -1 });
// Inbound chatter has no long-term value once support has had a chance to
// look at it; 90 days keeps the collection bounded without a manual job.
WhatsAppInboundEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
