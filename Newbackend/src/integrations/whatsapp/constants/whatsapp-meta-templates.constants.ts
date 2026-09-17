/**
 * Transactional WhatsApp templates delivered through Meta's Cloud API.
 *
 * Business services never name a Meta template. They keep writing outbox rows
 * with their existing event names; this catalog maps a row's domain and event
 * onto one logical transactional event, and the config maps that logical event
 * onto an approved template only once its name has been configured.
 *
 * `proposedName` is documentation, not configuration: nothing reaches Meta
 * until the approved name is set in `WHATSAPP_META_TEMPLATE_<EVENT>`, so an
 * unapproved template can never be sent.
 *
 * Approved in Meta (UTILITY, language `en`, positional parameters, no buttons),
 * verified against the Graph API on 2026-09-15: reservation_held,
 * stay_confirmed, parking_confirmed, aarti_confirmed, event_registered,
 * reservation_cancelled, refund_update, reservation_expired,
 * service_checked_in, service_checked_out. Not created: payment_failed and the
 * four reminders.
 *
 * The approved body wording lives in Meta and is not copied here. Only the
 * name and the order of `bodyVariables` must match it; that order was checked
 * placeholder by placeholder against each approved body.
 */

export const META_TRANSACTIONAL_EVENT = {
  RESERVATION_HELD: "reservation_held",
  STAY_CONFIRMED: "stay_confirmed",
  PARKING_CONFIRMED: "parking_confirmed",
  AARTI_CONFIRMED: "aarti_confirmed",
  EVENT_REGISTERED: "event_registered",
  PAYMENT_FAILED: "payment_failed",
  RESERVATION_CANCELLED: "reservation_cancelled",
  REFUND_UPDATE: "refund_update",
  RESERVATION_EXPIRED: "reservation_expired",
  SERVICE_CHECKED_IN: "service_checked_in",
  SERVICE_CHECKED_OUT: "service_checked_out",
  STAY_REMINDER: "stay_reminder",
  PARKING_REMINDER: "parking_reminder",
  AARTI_REMINDER: "aarti_reminder",
  EVENT_REMINDER: "event_reminder",
} as const;

export type MetaTransactionalEvent =
  (typeof META_TRANSACTIONAL_EVENT)[keyof typeof META_TRANSACTIONAL_EVENT];

/** Language code used when a template's language is not configured. */
export const META_TRANSACTIONAL_DEFAULT_LANGUAGE = "en" as const;

export interface MetaTransactionalTemplateSpec {
  /** Name proposed for Meta WhatsApp Manager. Never sent until configured. */
  proposedName: string;
  /**
   * Variables filling the template body's `{{1}}`, `{{2}}`, ... in order. An
   * approved template with a different order overrides this per environment.
   */
  bodyVariables: readonly string[];
}

const E = META_TRANSACTIONAL_EVENT;

export const META_TRANSACTIONAL_TEMPLATE_SPEC: Readonly<
  Record<MetaTransactionalEvent, MetaTransactionalTemplateSpec>
> = Object.freeze({
  [E.RESERVATION_HELD]: {
    proposedName: "tirvona_reservation_held",
    bodyVariables: [
      "customer_name",
      "booking_type",
      "reference",
      "amount_due",
      "payment_deadline",
    ],
  },
  [E.STAY_CONFIRMED]: {
    proposedName: "tirvona_stay_confirmed",
    bodyVariables: [
      "customer_name",
      "property_name",
      "reference",
      "check_in_date",
      "check_out_date",
      "guests",
      "amount_paid",
      // Approved body shows {{8}} as the guest's "arrival reference".
      "check_in_code",
    ],
  },
  [E.PARKING_CONFIRMED]: {
    proposedName: "tirvona_parking_confirmed",
    bodyVariables: [
      "parking_location",
      "reference",
      "vehicle_number",
      "entry_time",
      "exit_time",
      "amount_paid",
      // Approved body shows {{7}} as "Parking access".
      "gate_code",
    ],
  },
  [E.AARTI_CONFIRMED]: {
    proposedName: "tirvona_aarti_confirmed",
    bodyVariables: [
      "customer_name",
      "service_name",
      "reference",
      "scheduled_at",
      "devotees",
      "amount_paid",
      // Approved body shows {{7}} as "Aarti booking access".
      "entry_code",
    ],
  },
  [E.EVENT_REGISTERED]: {
    proposedName: "tirvona_event_registered",
    bodyVariables: [
      "customer_name",
      "event_name",
      "reference",
      "start_time",
      "venue",
      "seats",
      // Approved body shows {{7}} as "Event booking access".
      "entry_code",
    ],
  },
  [E.PAYMENT_FAILED]: {
    proposedName: "tirvona_payment_failed",
    // Retry guidance is static template text, so only the identifiers vary.
    bodyVariables: ["booking_type", "reference"],
  },
  [E.RESERVATION_CANCELLED]: {
    proposedName: "tirvona_reservation_cancelled",
    bodyVariables: [
      "customer_name",
      "booking_type",
      "reference",
      "refund_status",
      "refund_amount",
    ],
  },
  [E.REFUND_UPDATE]: {
    proposedName: "tirvona_refund_update",
    bodyVariables: [
      "reference",
      "refund_status",
      "refund_amount",
      "payment_reference",
    ],
  },
  [E.RESERVATION_EXPIRED]: {
    proposedName: "tirvona_reservation_expired",
    bodyVariables: ["booking_type", "reference", "expiry_time"],
  },
  [E.SERVICE_CHECKED_IN]: {
    proposedName: "tirvona_service_checked_in",
    bodyVariables: [
      "booking_type",
      "reference",
      "check_in_time",
      "service_details",
    ],
  },
  [E.SERVICE_CHECKED_OUT]: {
    proposedName: "tirvona_service_checked_out",
    bodyVariables: [
      "booking_type",
      "reference",
      "check_out_time",
      "settlement_details",
    ],
  },
  [E.STAY_REMINDER]: {
    proposedName: "tirvona_stay_reminder",
    bodyVariables: [
      "property_name",
      "check_in_date",
      "reference",
      "check_in_code",
      "check_out_date",
    ],
  },
  [E.PARKING_REMINDER]: {
    proposedName: "tirvona_parking_reminder",
    bodyVariables: [
      "parking_location",
      "reference",
      "vehicle_number",
      "exit_time",
      "gate_code",
    ],
  },
  [E.AARTI_REMINDER]: {
    proposedName: "tirvona_aarti_reminder",
    bodyVariables: [
      "customer_name",
      "service_name",
      "reference",
      "scheduled_at",
      "entry_code",
    ],
  },
  [E.EVENT_REMINDER]: {
    proposedName: "tirvona_event_reminder",
    bodyVariables: [
      "customer_name",
      "event_name",
      "reference",
      "start_time",
      "venue",
      "entry_code",
    ],
  },
});

/**
 * Outbox `(domain, event)` pairs that map to a logical transactional event.
 * Anything absent here (community, marketplace, room assignment, ...) is not a
 * Meta transactional message and keeps its existing delivery path untouched.
 */
export const META_TRANSACTIONAL_EVENT_BY_OUTBOX: Readonly<
  Record<string, Readonly<Record<string, MetaTransactionalEvent>>>
> = Object.freeze({
  booking: Object.freeze({
    booking_held: E.RESERVATION_HELD,
    booking_confirmed: E.STAY_CONFIRMED,
    payment_failed: E.PAYMENT_FAILED,
    booking_cancelled: E.RESERVATION_CANCELLED,
    booking_expired: E.RESERVATION_EXPIRED,
    checked_in: E.SERVICE_CHECKED_IN,
    checked_out: E.SERVICE_CHECKED_OUT,
    checkin_reminder: E.STAY_REMINDER,
    refund_approved: E.REFUND_UPDATE,
    refund_failed: E.REFUND_UPDATE,
    refund_completed: E.REFUND_UPDATE,
  }),
  parking: Object.freeze({
    booking_confirmed: E.PARKING_CONFIRMED,
    payment_failed: E.PAYMENT_FAILED,
    cancellation: E.RESERVATION_CANCELLED,
    refund: E.RESERVATION_CANCELLED,
    checked_in: E.SERVICE_CHECKED_IN,
    checked_out: E.SERVICE_CHECKED_OUT,
    // Unpaid holds only. A paid no-show is not an expired reservation, so
    // `no_show` is deliberately absent here and suppressed below.
    expired: E.RESERVATION_EXPIRED,
    entry_reminder: E.PARKING_REMINDER,
    exit_reminder: E.PARKING_REMINDER,
  }),
  aarti: Object.freeze({
    booking_confirmed: E.AARTI_CONFIRMED,
    payment_failed: E.PAYMENT_FAILED,
    // Aarti cancellation writes `refund` when money is returned and
    // `cancellation` otherwise; both are the same cancellation transition.
    cancellation: E.RESERVATION_CANCELLED,
    refund: E.RESERVATION_CANCELLED,
    checked_in: E.SERVICE_CHECKED_IN,
    aarti_reminder: E.AARTI_REMINDER,
  }),
  event: Object.freeze({
    registration_confirmed: E.EVENT_REGISTERED,
    cancellation: E.RESERVATION_CANCELLED,
    event_reminder: E.EVENT_REMINDER,
  }),
});

export const metaTransactionalEventFor = (
  domain: string,
  event: string,
): MetaTransactionalEvent | undefined =>
  META_TRANSACTIONAL_EVENT_BY_OUTBOX[domain]?.[event.toLowerCase()];

/**
 * Outbox events kept for in-app and push delivery but never sent over WhatsApp
 * by any provider, with the reason recorded on the row.
 *
 * `payment_failed` is raised when a client-side Razorpay signature check fails.
 * That is a verification failure, not a confirmed payment failure: the payment
 * may still have succeeded and be confirmed moments later by the webhook, and
 * the stay row is written before the booking's ownership is checked. The
 * Razorpay `payment.failed` webhook is the authoritative source; until it is
 * wired, a WhatsApp "payment failed" could be false.
 *
 * Parking `no_show` marks a booking that was PAID but never arrived. The only
 * approved template that could carry it says the reservation "has expired and
 * is no longer valid", which misstates a paid booking, so it stays off
 * WhatsApp until a template for paid no-shows is decided.
 */
export const WHATSAPP_SUPPRESSED_OUTBOX_EVENTS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = Object.freeze({
  booking: Object.freeze({ payment_failed: "payment_failure_unverified" }),
  parking: Object.freeze({
    payment_failed: "payment_failure_unverified",
    no_show: "paid_no_show_has_no_template",
  }),
  aarti: Object.freeze({ payment_failed: "payment_failure_unverified" }),
});

export const whatsappSuppressionReasonFor = (
  domain: string,
  event: string,
): string | undefined =>
  WHATSAPP_SUPPRESSED_OUTBOX_EVENTS[domain]?.[event.toLowerCase()];

/** The booking type a guest reads in a transactional message. */
export const WHATSAPP_BOOKING_TYPE_LABEL: Readonly<Record<string, string>> =
  Object.freeze({
    booking: "Ashram stay",
    parking: "Parking",
    aarti: "Aarti",
    event: "Event registration",
  });
