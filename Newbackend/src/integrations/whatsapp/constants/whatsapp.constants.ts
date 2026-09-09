export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");

export const WHATSAPP_TEMPLATE = {
  AUTH_OTP: "auth_otp",
  BOOKING_CONFIRMATION: "booking_confirmation",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILURE: "payment_failure",
  CANCELLATION: "cancellation",
  REFUND: "refund",
  CHECKIN_REMINDER: "checkin_reminder",
  CHECKIN_CONFIRMED: "checkin_confirmed",
  CHECKOUT_COMPLETED: "checkout_completed",
  AARTI_CONFIRMATION: "aarti_confirmation",
  AARTI_CANCELLATION: "aarti_cancellation",
  EVENT_REGISTRATION: "event_registration",
  EVENT_CANCELLATION: "event_cancellation",
  GENERAL_NOTIFICATION: "general_notification",
} as const;

/** Domains that raise outbox notifications Tirvona delivers over WhatsApp. */
export const WHATSAPP_DOMAIN = {
  BOOKING: "booking",
  PARKING: "parking",
  COMMUNITY: "community",
  AARTI: "aarti",
  EVENT: "event",
} as const;

export const WHATSAPP_OUTBOX_EVENT_TEMPLATE: Readonly<Record<string, string>> =
  Object.freeze({
    booking_confirmed: WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION,
    payment_success: WHATSAPP_TEMPLATE.PAYMENT_SUCCESS,
    booking_payment_success: WHATSAPP_TEMPLATE.PAYMENT_SUCCESS,
    payment_failed: WHATSAPP_TEMPLATE.PAYMENT_FAILURE,
    booking_payment_failed: WHATSAPP_TEMPLATE.PAYMENT_FAILURE,
    booking_cancelled: WHATSAPP_TEMPLATE.CANCELLATION,
    refund_requested: WHATSAPP_TEMPLATE.REFUND,
    refund_approved: WHATSAPP_TEMPLATE.REFUND,
    refund_completed: WHATSAPP_TEMPLATE.REFUND,
    refunded: WHATSAPP_TEMPLATE.REFUND,
    checkin_reminder: WHATSAPP_TEMPLATE.CHECKIN_REMINDER,
    check_in_reminder: WHATSAPP_TEMPLATE.CHECKIN_REMINDER,
    checked_in: WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED,
    booking_checked_in: WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED,
    checked_out: WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED,
    booking_checked_out: WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED,
    cancellation: WHATSAPP_TEMPLATE.CANCELLATION,
    refund: WHATSAPP_TEMPLATE.REFUND,
    registration_confirmed: WHATSAPP_TEMPLATE.EVENT_REGISTRATION,
    booking_held: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    booking_expired: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    volunteer_application_submitted: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    volunteer_application_updated: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
  });

/**
 * Aarti and event registrations reuse generic event names such as
 * `booking_confirmed` and `cancellation`, so their domain decides the template
 * before the shared event map is consulted.
 */
export const WHATSAPP_DOMAIN_EVENT_TEMPLATE: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = Object.freeze({
  [WHATSAPP_DOMAIN.AARTI]: Object.freeze({
    booking_confirmed: WHATSAPP_TEMPLATE.AARTI_CONFIRMATION,
    cancellation: WHATSAPP_TEMPLATE.AARTI_CANCELLATION,
    refund: WHATSAPP_TEMPLATE.REFUND,
  }),
  [WHATSAPP_DOMAIN.EVENT]: Object.freeze({
    registration_confirmed: WHATSAPP_TEMPLATE.EVENT_REGISTRATION,
    cancellation: WHATSAPP_TEMPLATE.EVENT_CANCELLATION,
    refund: WHATSAPP_TEMPLATE.REFUND,
  }),
});

export const WHATSAPP_OUTBOX_FALLBACK_TEMPLATE =
  WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION;

export const AK_NEXUS_PROVIDER_NAME = "ak_nexus" as const;

export const MSG91_PROVIDER_NAME = "msg91" as const;

/** Default approved MSG91 WhatsApp template for authentication codes. */
export const MSG91_DEFAULT_AUTH_OTP_TEMPLATE = "tirvona_otp" as const;

/** Language of the approved MSG91 templates. */
export const MSG91_DEFAULT_TEMPLATE_LANGUAGE = "en_GB" as const;

