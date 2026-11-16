/**
 * Tirvona Yatra: bus and group-tour journeys sold by verified partners from
 * one central seat inventory. Every customer payment goes to Tirvona's own
 * Razorpay account; organisers never collect money. See docs/yatra/README.md.
 */

export const YATRA_MODEL = {
  Operator: "YatraOperator",
  Member: "YatraOperatorMember",
  Document: "YatraDocument",
  Vehicle: "YatraVehicle",
  Tour: "YatraTour",
  Departure: "YatraDeparture",
  Seat: "YatraSeat",
  Booking: "YatraBooking",
  Payment: "YatraPayment",
  Ledger: "YatraLedgerEntry",
  Link: "YatraBookingLink",
  Journey: "YatraJourney",
  JourneyLink: "YatraJourneyLink",
  ServiceRequest: "YatraServiceRequest",
  Setting: "YatraSetting",
  // Read-only views of tables owned by other modules (no new columns).
  UserRef: "YatraUserRef",
  CircuitRef: "YatraCircuitRef",
  CircuitStopRef: "YatraCircuitStopRef",
  StayBookingRef: "YatraStayBookingRef",
  ParkingBookingRef: "YatraParkingBookingRef",
  AartiBookingRef: "YatraAartiBookingRef",
  FoodVendorRef: "YatraFoodVendorRef",
  ProviderRef: "YatraProviderRef",
  // P5: rides, finance, payouts, operations
  RidePartner: "YatraRidePartner",
  RideRequest: "YatraRideRequest",
  CommissionRule: "YatraCommissionRule",
  PayeeEntry: "YatraPayeeEntry",
  Payout: "YatraPayout",
  Reconciliation: "YatraReconciliation",
  Issue: "YatraIssue",
  Rating: "YatraRating",
  TripLocation: "YatraTripLocation",
  CharterRequest: "YatraCharterRequest",
} as const;

/** The only role that can approve partners, verify documents and publish tours. */
export const YATRA_ADMIN_ROLES = ["super_admin"];
/** Commission rules, payouts, transfers and reconciliation. */
export const YATRA_FINANCE_ROLES = ["super_admin", "finance_manager"];
/** Destination operations: Super Admin everywhere, HR / Executive in their office city only. */
export const YATRA_OPS_ROLES = ["super_admin", "hr", "executive"];

// ------------------------------------------------------------------ operators
export const OPERATOR_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "suspended",
] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const ORGANISATION_TYPES = [
  "proprietorship",
  "partnership",
  "private_limited",
  "llp",
  "trust",
  "society",
  "other",
] as const;

/** Roles inside one partner. Platform roles (users.role) are not changed. */
export const MEMBER_ROLES = ["owner", "manager", "staff"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const MEMBER_STATUSES = ["active", "removed"] as const;

/** What each partner role may do. Checked on the server for every call. */
export const MEMBER_PERMISSIONS = {
  manageOrganisation: ["owner"],
  manageStaff: ["owner"],
  managePayoutDetails: ["owner"],
  manageDocuments: ["owner", "manager"],
  manageVehicles: ["owner", "manager"],
  manageTours: ["owner", "manager"],
  manageDepartures: ["owner", "manager"],
  manageLinks: ["owner", "manager"],
  viewFinance: ["owner", "manager"],
  createBookings: ["owner", "manager", "staff"],
  viewBookings: ["owner", "manager", "staff"],
  checkIn: ["owner", "manager", "staff"],
  // The driver (a staff member) shares the bus's live location from their phone.
  shareLocation: ["owner", "manager", "staff"],
} as const satisfies Record<string, readonly MemberRole[]>;
export type MemberPermission = keyof typeof MEMBER_PERMISSIONS;

// ------------------------------------------------------------------ documents
export const OPERATOR_DOCUMENT_TYPES = [
  "pan_card",
  "gst_certificate",
  "business_registration",
  "tourism_licence",
  "address_proof",
  "cancelled_cheque",
  "other",
] as const;
export const VEHICLE_DOCUMENT_TYPES = [
  "registration_certificate",
  "tourist_permit",
  "contract_carriage_permit",
  "stage_carriage_permit",
  "all_india_tourist_permit",
  "insurance",
  "fitness_certificate",
  "pollution_certificate",
  "other",
] as const;
export const RIDE_PARTNER_DOCUMENT_TYPES = [
  "pan_card",
  "driving_licence",
  "registration_certificate",
  "insurance",
  "tourist_permit",
  "contract_carriage_permit",
  "address_proof",
  "cancelled_cheque",
  "other",
] as const;
export const DOCUMENT_TYPES = [
  ...new Set([...OPERATOR_DOCUMENT_TYPES, ...VEHICLE_DOCUMENT_TYPES, ...RIDE_PARTNER_DOCUMENT_TYPES]),
] as string[];
export const DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const;

/** KYC files: images and PDFs only, never public. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
/** How long a signed document link stays valid. */
export const DOCUMENT_LINK_SECONDS = 300;

// ------------------------------------------------------------------- vehicles
export const VEHICLE_TYPES = [
  "bus",
  "mini_bus",
  "tempo_traveller",
  "car",
  "other",
] as const;
export const PERMIT_TYPES = [
  "tourist_permit",
  "contract_carriage",
  "stage_carriage",
  "all_india_tourist",
  "other",
] as const;
export const VEHICLE_STATUSES = [
  "draft",
  "pending_verification",
  "approved",
  "rejected",
  "suspended",
] as const;
export const SEAT_LAYOUT_TEMPLATES = ["2x2", "2x1", "1x1", "sleeper_2x1", "sleeper_double", "custom"] as const;
/**
 * A bus plan is one of the named layouts, "custom", or any "<left>x<right>" (seats on the left of the aisle
 * by seats on the right, 1 to 4 each, e.g. 2x3 or 1x2) and "sleeper_<left>x<right>" for berths.
 */
export type SeatLayoutTemplate = (typeof SEAT_LAYOUT_TEMPLATES)[number] | `${number}x${number}` | `sleeper_${number}x${number}`;
export const SEAT_LAYOUT_PATTERN = /^((sleeper_)?[1-4]x[1-4]|sleeper_double|custom)$/;
export const SEAT_KINDS = ["seater", "sleeper"] as const;
export const MAX_SEATS_PER_VEHICLE = 120;

// ---------------------------------------------------------------------- tours
/**
 * Product type decides how a tour may be sold. Seat-by-seat sale is only for
 * operators whose permit allows it; group tours sell places in a package.
 */
export const PRODUCT_TYPES = ["group_tour", "seat_journey"] as const;
export const TOUR_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "unpublished",
] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];
/** Partners may edit a tour only in these states; an edit sends it back to draft. */
export const TOUR_EDITABLE_STATUSES: TourStatus[] = ["draft", "rejected", "unpublished"];

// ----------------------------------------------------------------- departures
export const DEPARTURE_STATUSES = [
  "draft",
  "scheduled",
  "sales_closed",
  "cancelled",
  "completed",
] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];
export const SEAT_MODES = ["choose", "auto"] as const;
export const SEAT_STATUSES = ["available", "held", "booked", "blocked"] as const;

// ------------------------------------------------------------------- bookings
export const BOOKING_SOURCES = ["MARKETPLACE", "OPERATOR_LINK", "ORGANIZER"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];
export const BOOKING_STATUSES = [
  "held",
  "payment_pending",
  "confirmed",
  "cancellation_requested",
  "cancelled",
  "expired",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
/** Bookings that still own their seats until payment or expiry. */
export const OPEN_BOOKING_STATUSES: BookingStatus[] = ["held", "payment_pending"];
/** Bookings whose travellers are on the manifest. */
export const MANIFEST_BOOKING_STATUSES: BookingStatus[] = [
  "confirmed",
  "cancellation_requested",
  "completed",
];
export const PAYMENT_STATUSES = ["unpaid", "paid", "partially_refunded", "refunded"] as const;
export const CANCELLATION_STATUSES = ["requested", "approved", "rejected"] as const;
export const PASSENGER_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

// ------------------------------------------------------------------- payments
export const PAYMENT_PURPOSES = ["booking", "service_request", "ride_request"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];
export const PAYMENT_ROW_STATUSES = ["pending", "paid", "failed", "superseded"] as const;
export const LEDGER_TYPES = [
  "booking_payment",
  "booking_refund",
  "service_payment",
  "service_refund",
  "unapplied_payment",
  "unapplied_refund",
  "ride_payment",
  "ride_refund",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];
/** Purpose label inside the signed payment-link token. */
export const YATRA_PAYMENT_LINK_PURPOSE = "yatra_pay";

// -------------------------------------------------------------------- journey
export const JOURNEY_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"] as const;
export const JOURNEY_LINK_MODULES = ["stay", "parking", "aarti"] as const;
export type JourneyLinkModule = (typeof JOURNEY_LINK_MODULES)[number];
export const SERVICE_TYPES = ["food", "puja"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
/**
 * An add-on is never "confirmed" until the supplier accepted it (with a price)
 * and the customer's payment is verified.
 */
export const SERVICE_REQUEST_STATUSES = [
  "requested",
  "supplier_pending",
  "accepted",
  "confirmed",
  "rejected",
  "cancelled",
  "fulfilled",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];
export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "packed_meal"] as const;
export const DIETARY_PREFERENCES = ["satvik", "jain", "regular", "no_onion_garlic"] as const;

// ------------------------------------------------------------------- settings
export const YATRA_DEFAULT_SETTINGS = {
  /** Minutes a website checkout holds its seats. */
  holdMinutes: 10,
  /** Minutes a partner-assisted booking holds its seats for the payment link. */
  paymentLinkMinutes: 30,
  maxSeatsPerBooking: 10,
  /** Sales stop this many minutes before departure. */
  salesCloseMinutes: 60,
  supportPhone: "",
  /** A confirmed ride cancelled at least this many hours before pickup is refunded in full. */
  rideFullRefundHours: 2,
  /** Hours a ride partner has to answer before the request goes back to Tirvona Ops. */
  ridePartnerResponseHours: 6,
  /** Hours before departure the journey reminder is sent. */
  reminderHours: 24,
};
export const YATRA_SETTING_LIMITS = {
  holdMinutes: { min: 5, max: 30 },
  paymentLinkMinutes: { min: 10, max: 120 },
  maxSeatsPerBooking: { min: 1, max: 40 },
  salesCloseMinutes: { min: 0, max: 1440 },
  rideFullRefundHours: { min: 0, max: 72 },
  ridePartnerResponseHours: { min: 1, max: 72 },
  reminderHours: { min: 1, max: 96 },
};

export const YATRA_AUDIT_MODULE = "yatra";

// ====================================================================== P5: rides
export const RIDE_PARTNER_STATUSES = ["draft", "submitted", "approved", "rejected", "suspended"] as const;
export const RIDE_TYPES = ["any", "auto", "e_rickshaw", "sedan", "suv", "tempo_traveller", "mini_bus"] as const;
/**
 * requested → partner_pending → accepted (priced) | rejected → confirmed (paid)
 * → in_progress → completed. A ride is shown as confirmed only after the
 * partner accepted it and the pilgrim's payment is verified.
 */
export const RIDE_STATUSES = [
  "requested",
  "partner_pending",
  "accepted",
  "rejected",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];
export const OPEN_RIDE_STATUSES: RideStatus[] = ["requested", "partner_pending", "accepted"];

// ================================================================ P5: finance
/** What a commission rule applies to. */
export const COMMISSION_APPLIES_TO = ["yatra_booking", "ride", "addon_referral"] as const;
export type CommissionAppliesTo = (typeof COMMISSION_APPLIES_TO)[number];
/** Booking channel a rule applies to. DIRECT = organiser link or organiser-assisted. */
export const COMMISSION_CHANNELS = ["any", "MARKETPLACE", "DIRECT"] as const;
export const COMMISSION_RULE_STATUSES = ["active", "retired"] as const;
export const PAYEE_TYPES = ["operator", "ride_partner"] as const;
export type PayeeType = (typeof PAYEE_TYPES)[number];
/**
 * The payee ledger: one immutable row per money movement owed to (credit) or
 * taken from (debit) a partner or ride partner. Balances are always summed
 * from these rows, never stored.
 */
export const PAYEE_ENTRY_TYPES = [
  "gross_earning",
  "commission",
  "tax_on_commission",
  "tds",
  "refund_deduction",
  "commission_reversal",
  "tax_reversal",
  "tds_reversal",
  "referral_earning",
  "adjustment",
  "transfer",
] as const;
export type PayeeEntryType = (typeof PAYEE_ENTRY_TYPES)[number];
/** PENDING → UNDER_REVIEW → APPROVED → TRANSFER_RECORDED → RECONCILED. Nothing here moves money. */
export const PAYOUT_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "transfer_recorded",
  "reconciled",
  "rejected",
  "cancelled",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
/** Payouts still holding part of a payee's balance. */
export const OPEN_PAYOUT_STATUSES: PayoutStatus[] = ["pending", "under_review", "approved"];
export const TRANSFER_METHODS = ["neft", "rtgs", "imps", "upi", "bank_transfer"] as const;
export const RECONCILIATION_KINDS = ["razorpay_settlement"] as const;

// ============================================================= P5: operations
export const ISSUE_CATEGORIES = ["incident", "service", "ride", "booking", "payment", "safety", "other"] as const;
export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const ISSUE_SUBJECTS = ["booking", "ride", "service_request", "departure", "none"] as const;

// ----------------------------------------- trip details, live location, full-bus requests
/** A pilgrim's request for the whole bus. Only a partner's answer moves it on; payment is the normal checkout. */
export const CHARTER_STATUSES = ["requested", "accepted", "declined", "cancelled"] as const;
/** What a traveller can tick when rating a trip; "Loved by travellers" counts these. */
export const RATING_TAGS = ["Punctual", "Clean bus", "Comfortable seats", "Courteous staff", "Safe driving", "Good value"] as const;
/** The driver may share the live location from this long before departure until this long after return. */
export const LOCATION_SHARE_BEFORE_HOURS = 6;
export const LOCATION_SHARE_AFTER_HOURS = 12;
/** A position older than this is shown as "last seen" rather than live. */
export const LOCATION_STALE_SECONDS = 600;

export const OTHER_POLICY_KEYS = ["childPolicy", "luggagePolicy", "petsPolicy", "alcoholPolicy", "pickupPolicy"] as const;
export type OtherPolicyKey = (typeof OTHER_POLICY_KEYS)[number];
export const OTHER_POLICY_TITLES: Record<OtherPolicyKey, string> = {
  childPolicy: "Child passenger policy",
  luggagePolicy: "Luggage policy",
  petsPolicy: "Pets policy",
  alcoholPolicy: "Alcohol policy",
  pickupPolicy: "Pick-up time policy",
};
/** Tirvona's standard wording, shown until the partner writes its own for a tour. */
export const DEFAULT_OTHER_POLICIES: Record<OtherPolicyKey, string> = {
  childPolicy: "Every traveller who needs a seat, including a child, needs a ticket. Ask the partner about infants.",
  luggagePolicy: "Reasonable personal luggage is carried free. Excess or very heavy luggage may be refused or charged by the partner.",
  petsPolicy: "Pets are not allowed unless the partner says so for this trip.",
  alcoholPolicy: "Carrying or drinking alcohol on the bus is prohibited. The partner may ask anyone who breaks this rule to leave the bus.",
  pickupPolicy: "The bus will not wait beyond the scheduled boarding time. Arriving late is not a reason for a refund.",
};

/** Where the WhatsApp ticket sends people for more details. */
export const TIRVONA_APP_URL = "https://play.google.com/store/apps/details?id=com.tirvona.app";

/**
 * An optional add-on at booking: a small fee per seat that guarantees a full refund of the fare when the
 * pilgrim cancels at least `cutoffHours` before departure. The fee itself is never refunded and belongs to Tirvona.
 */
export const CANCELLATION_PROTECTION = { feePerSeat: 15, refundPercent: 100, cutoffHours: 6 } as const;

/** Services a partner can add to a tour at its own price: short stay, food and a local taxi. */
export const SERVICE_ADD_ON_KEYS = ["stay", "food", "taxi"] as const;
export type ServiceAddOnKey = (typeof SERVICE_ADD_ON_KEYS)[number];
export const SERVICE_ADD_ON_TITLES: Record<ServiceAddOnKey, string> = {
  stay: "Short stay",
  food: "Food and meals",
  taxi: "Local taxi",
};
