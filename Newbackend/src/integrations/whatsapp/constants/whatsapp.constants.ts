export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");

export const WHATSAPP_TEMPLATE = {
  AUTH_OTP: "auth_otp",
  BOOKING_CONFIRMATION: "booking_confirmation",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILURE: "payment_failure",
  CANCELLATION: "cancellation",
  REFUND: "refund",
  CHECKIN_REMINDER: "checkin_reminder",
  GENERAL_NOTIFICATION: "general_notification",
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
    booking_held: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    booking_expired: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    volunteer_application_submitted: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
    volunteer_application_updated: WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION,
  });

export const WHATSAPP_OUTBOX_FALLBACK_TEMPLATE =
  WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION;

export const AK_NEXUS_PROVIDER_NAME = "ak_nexus" as const;

