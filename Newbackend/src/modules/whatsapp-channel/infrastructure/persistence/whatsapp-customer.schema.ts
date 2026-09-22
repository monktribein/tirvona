import { Schema, SchemaTypes } from "mongoose";
import { WHATSAPP_CUSTOMER_CODE_PATTERN } from "../../domain/whatsapp-customer.code";

/**
 * A customer who reached Tirvona through WhatsApp and has no website account.
 *
 * This is a separate identity from `users` on purpose. A WhatsApp guest has
 * no email and no password, so they cannot be represented as a website user
 * without inventing both — and the `users` collection stays completely
 * untouched by this channel, which is what guarantees website registration,
 * login and OTP cannot regress.
 *
 * `phone` is the natural key: the same number must always resolve to the same
 * `wappId`, six months later just as on first contact. The unique index on it
 * is what enforces that under concurrency — two simultaneous first messages
 * from one number race on the index and exactly one wins, so a number can
 * never end up with two codes.
 *
 * The number stored here is the normalized international form produced by
 * `normalizeWhatsAppNumber` (digits only, no `+`), which is the same shape
 * the outbound providers use, so a lookup never has to guess a format.
 */
export const WhatsAppCustomerSchema = new Schema(
  {
    wappId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      uppercase: true,
      trim: true,
      match: WHATSAPP_CUSTOMER_CODE_PATTERN,
    },
    /** Normalized E.164 digits, e.g. "919876543210". Never displayed as the id. */
    phone: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    /**
     * The name Meta reports on the inbound message, or one the guest gives
     * during a booking. Never used for authorization and never used to match
     * a website account.
     */
    name: { type: String, default: "", trim: true },
    /**
     * True because Meta attests the sender's number on every inbound webhook
     * delivery. No separate OTP is issued for this channel; the existing OTP
     * flow is untouched.
     */
    whatsappVerified: { type: Boolean, default: true },
    /** Preferred reply language, carried between conversations. */
    language: {
      type: String,
      enum: ["en", "hi", "hinglish"],
      default: "hinglish",
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
      index: true,
    },
    /**
     * Set only if the guest later, deliberately, links a website account.
     * Nothing writes this in the first release — account linking is explicitly
     * out of scope, and identities are never merged automatically on phone or
     * name alone.
     */
    linkedUserId: {
      type: SchemaTypes.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    linkedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "whatsapp_customers",
    optimisticConcurrency: true,
  },
);

WhatsAppCustomerSchema.index({ createdAt: -1 });
