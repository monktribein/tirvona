/**
 * Mongoose model names owned by the WhatsApp channel.
 *
 * No counter model: `wappId` generation (see `whatsapp-customer.code.ts`)
 * generates a random suffix and relies on the unique index to catch a
 * collision, the same way every other Tirvona reference is generated, so
 * there is no shared sequence document to register here.
 */
export const WHATSAPP_CHANNEL_MODEL = {
  Customer: "WhatsAppCustomer",
  InboundEvent: "WhatsAppInboundEvent",
} as const;

/** BullMQ queue carrying one job per verified inbound WhatsApp message. */
export const WHATSAPP_INBOUND_QUEUE = "whatsapp-inbound";

// Booking channels live in the bookings domain, which owns the field. They
// are re-exported here so the channel code has one import for its vocabulary.
export {
  BOOKING_CHANNELS,
  DEFAULT_BOOKING_CHANNEL,
  WHATSAPP_BOOKING_CHANNEL,
  type BookingChannel,
} from "../../bookings/domain/booking.utils";

/** Conversation flows the engine can be in. */
export const WHATSAPP_FLOWS = [
  "stay_booking",
  "parking_booking",
  "aarti_booking",
  "event_registration",
  "my_bookings",
  "cancellation",
  "help",
] as const;
export type WhatsAppFlow = (typeof WHATSAPP_FLOWS)[number];

/** Idle lifetime of a conversation session. */
export const SESSION_IDLE_TTL_SECONDS = 30 * 60;

/**
 * Absolute lifetime, regardless of activity. A session that has been going
 * for this long is retired so a stale price or a stale availability snapshot
 * can never be carried indefinitely.
 */
export const SESSION_ABSOLUTE_TTL_SECONDS = 6 * 60 * 60;

/** Messages one session may carry before it is retired as runaway. */
export const SESSION_MAX_MESSAGES = 200;

/** Meta's customer service window for free-form (non-template) replies. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1_000;

/** Per-phone inbound rate limit. Meta's IPs make the HTTP tracker useless. */
export const INBOUND_RATE_LIMIT = { points: 20, windowSeconds: 60 } as const;
