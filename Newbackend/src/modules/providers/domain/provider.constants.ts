/**
 * Provider (Pandit / Purohit / Acharya / Jyotishi) domain constants.
 *
 * Source of truth: Tirvona Puja + Jyotish Data Dictionary v2.0 (7.17-7.23,
 * 7.27, 7.28, 7.47) and the Detailed SRS v2.0 (M06, M07, M10, M12, M18).
 * Where the repository forced a deviation it is recorded in ../README.md.
 */

export const PROVIDER_TYPES = [
  "PANDIT",
  "PUROHIT",
  "ACHARYA",
  "VEDIC_SCHOLAR",
  "KATHA_VACHAK",
  "JYOTISHI",
  "PROVIDER_TEAM",
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Provider types that may offer an "Ask a Pandit/Acharya" consultation. */
export const PANDIT_CONSULTANT_TYPES: readonly ProviderType[] = [
  "PANDIT",
  "PUROHIT",
  "ACHARYA",
  "VEDIC_SCHOLAR",
  "KATHA_VACHAK",
];

export const FULFILMENT_TYPES = [
  "LOCAL_HOME",
  "DESTINATION_PROVIDER_HOME",
  "AT_DESTINATION",
  "ON_BEHALF",
  "INSTITUTION_AUTHORIZED",
  "CORPORATE",
] as const;
export type FulfilmentType = (typeof FULFILMENT_TYPES)[number];

/**
 * INSTITUTION_AUTHORIZED needs the Institution Authorization Ledger (SRS M08,
 * BR-003), which is not part of this phase. Offerings of that type are refused
 * rather than being listed without the authorization they would claim.
 */
export const OFFERABLE_FULFILMENT_TYPES: readonly FulfilmentType[] =
  FULFILMENT_TYPES.filter((type) => type !== "INSTITUTION_AUTHORIZED");

// --------------------------------------------------------------- provider
export const PROVIDER_STATUSES = [
  "ONBOARDING",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/** Statuses a provider may move to by themselves. SUSPENDED is admin-only. */
export const PROVIDER_SELF_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const VERIFICATION_LEVELS = [
  "UNVERIFIED",
  "IDENTITY_VERIFIED",
  "PROFESSIONAL_VERIFIED",
  "INSTITUTION_VERIFIED",
  "TIRVONA_TRUSTED",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_RANK: Record<VerificationLevel, number> = {
  UNVERIFIED: 0,
  IDENTITY_VERIFIED: 1,
  PROFESSIONAL_VERIFIED: 2,
  INSTITUTION_VERIFIED: 3,
  TIRVONA_TRUSTED: 4,
};

export const VERIFICATION_CASE_TYPES = [
  "IDENTITY",
  "PROFESSIONAL",
  "INSTITUTION",
  "TRUST_REVIEW",
] as const;
export type VerificationCaseType = (typeof VERIFICATION_CASE_TYPES)[number];

/** Case type -> the verification level it grants when approved. */
export const LEVEL_BY_CASE_TYPE: Record<VerificationCaseType, VerificationLevel> =
  {
    IDENTITY: "IDENTITY_VERIFIED",
    PROFESSIONAL: "PROFESSIONAL_VERIFIED",
    INSTITUTION: "INSTITUTION_VERIFIED",
    TRUST_REVIEW: "TIRVONA_TRUSTED",
  };

/** Case types a provider may open themselves. Trust is earned (SRS FR-PR-003). */
export const PROVIDER_OPENABLE_CASE_TYPES: readonly VerificationCaseType[] = [
  "IDENTITY",
  "PROFESSIONAL",
  "INSTITUTION",
];

export const VERIFICATION_CASE_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
export type VerificationCaseStatus = (typeof VERIFICATION_CASE_STATUSES)[number];

/** A case in one of these states blocks opening another of the same type. */
export const ACTIVE_CASE_STATUSES: readonly VerificationCaseStatus[] = [
  "OPEN",
  "IN_REVIEW",
];

export const EVIDENCE_TYPES = [
  "KYC_ID",
  "PROFESSIONAL_CERT",
  "REFERENCE",
  "INSTITUTION_LETTER",
  "OTHER",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Evidence a case must hold before it can be submitted for review. */
export const REQUIRED_EVIDENCE: Record<
  VerificationCaseType,
  readonly EvidenceType[]
> = {
  IDENTITY: ["KYC_ID"],
  PROFESSIONAL: ["PROFESSIONAL_CERT", "REFERENCE"], // any one of
  INSTITUTION: ["INSTITUTION_LETTER"],
  TRUST_REVIEW: [],
};

export const MALWARE_SCAN_STATUSES = ["PENDING", "CLEAN", "REJECTED"] as const;

export const VERIFICATION_DECISIONS = ["APPROVE", "REJECT"] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

/** Controlled reason codes (Data Dictionary 7.22: `decisionReasonCode` is allow-listed). */
export const APPROVAL_REASON_CODES = ["VERIFIED"] as const;
export const REJECTION_REASON_CODES = {
  ILLEGIBLE_EVIDENCE: { resubmittable: true },
  INSUFFICIENT_EVIDENCE: { resubmittable: true },
  NAME_MISMATCH: { resubmittable: true },
  EXPIRED_DOCUMENT: { resubmittable: true },
  UNVERIFIABLE_CREDENTIAL: { resubmittable: true },
  INVALID_REFERENCE: { resubmittable: true },
  FRAUD_SUSPECTED: { resubmittable: false },
  POLICY_VIOLATION: { resubmittable: false },
  DUPLICATE_ACCOUNT: { resubmittable: false },
} as const;
export type RejectionReasonCode = keyof typeof REJECTION_REASON_CODES;
export const REJECTION_REASON_LIST = Object.keys(
  REJECTION_REASON_CODES,
) as RejectionReasonCode[];

/** How many rejected cases of one type a provider may have before resubmission is closed. */
export const MAX_REJECTED_CASES_PER_TYPE = 3;
/** Default validity of an approved verification. Reviewers may shorten it. */
export const DEFAULT_VERIFICATION_VALIDITY_DAYS = 365;
export const MAX_VERIFICATION_VALIDITY_DAYS = 730;

// -------------------------------------------------------------- catalogue
export const RITUAL_STATUSES = [
  "DRAFT",
  "DOMAIN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type RitualStatus = (typeof RITUAL_STATUSES)[number];

/** Allowed ritual lifecycle moves (SRS: DRAFT -> DOMAIN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED). */
export const RITUAL_TRANSITIONS: Record<RitualStatus, readonly RitualStatus[]> = {
  DRAFT: ["DOMAIN_REVIEW", "ARCHIVED"],
  DOMAIN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["DRAFT", "ARCHIVED"], // DRAFT = "revise"; published content stays live
  ARCHIVED: [],
};

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

// -------------------------------------------------------------- offerings
export const OFFERING_STATUSES = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export type OfferingStatus = (typeof OFFERING_STATUSES)[number];

export const SUPPORTED_CURRENCIES = ["INR", "USD"] as const;
export const TRAVEL_CHARGE_POLICIES = ["NONE", "FLAT", "ACTUALS_AT_COST"] as const;
/** 1,00,00,000 rupees in minor units; refuses obvious typos such as an extra zero run. */
export const MAX_AMOUNT_MINOR = 1_000_000_000;

// ------------------------------------------------------ availability / time
export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** RFC 5545 BYDAY tokens, in DAYS_OF_WEEK order. */
export const RRULE_DAY_CODES: Record<DayOfWeek, string> = {
  MONDAY: "MO",
  TUESDAY: "TU",
  WEDNESDAY: "WE",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "SA",
  SUNDAY: "SU",
};

export const RESOURCE_TYPES = [
  "PROVIDER",
  "PROVIDER_TEAM",
  "VENUE",
  "CONSULTANT",
] as const;

export const CALENDAR_BLOCK_TYPES = [
  "BOOKING",
  "HOLD",
  "TRAVEL",
  "MANUAL",
  "CONSULTATION",
] as const;
export type CalendarBlockType = (typeof CALENDAR_BLOCK_TYPES)[number];
/** Block types a provider may create or release themselves. */
export const PROVIDER_MANAGED_BLOCK_TYPES: readonly CalendarBlockType[] = [
  "MANUAL",
  "TRAVEL",
];
export const CALENDAR_BLOCK_STATUSES = ["ACTIVE", "RELEASED", "EXPIRED"] as const;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const MAX_SLOTS_PER_DAY = 6;
export const MAX_AVAILABILITY_QUERY_DAYS = 62;
/** The rolling calendar shown to customers and Pandits. */
export const THIRTY_DAY_CALENDAR_DAYS = 30;
export const MAX_BLOCK_DAYS = 120;
/** Unpaid bookings keep their calendar hold this long (SRS FR-AV-002). */
export const DEFAULT_HOLD_MINUTES = 15;

// ------------------------------------------------------------- service types
export const PANDIT_SERVICE_TYPES = [
  "INDIVIDUAL",
  "GROUP",
  "KATHA",
] as const;
export type PanditServiceType = (typeof PANDIT_SERVICE_TYPES)[number];

export const KATHA_TYPES = [
  "BHAGWAT_KATHA",
  "SHIV_PURAN",
  "RAM_KATHA",
  "SUNDARKAND",
  "SATYANARAYAN_KATHA",
  "DEVI_BHAGWAT",
  "OTHER",
] as const;
export type KathaType = (typeof KATHA_TYPES)[number];

export const PANDIT_SHIFTS = ["MORNING", "EVENING", "ANY"] as const;
export type PanditShift = (typeof PANDIT_SHIFTS)[number];

export const MAX_MULTI_PANDIT_REQUESTS = 5;
export const ADVANCE_PAYMENT_WINDOW_HOURS = 1;
export const MAX_TRAVEL_RADIUS_KM = 50;
export const DEFAULT_ADVANCE_PERCENTAGE = 50;

// ---------------------------------------------------------------- bookings
export const BOOKING_STATUSES = [
  "REQUEST_PENDING",
  "ACCEPTED_AWAITING_ADVANCE",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
  "COMPLETED",
  "SETTLEMENT_PENDING",
  "CLOSED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_OPS",
  "DISPUTED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingActor = "CUSTOMER" | "PROVIDER" | "OPS" | "SYSTEM";

/** A booking in one of these states holds the provider's calendar. */
export const CALENDAR_HOLDING_STATUSES: readonly BookingStatus[] = [
  "ACCEPTED_AWAITING_ADVANCE",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROVIDER_ACCEPTED",
  "PREPARATION_IN_PROGRESS",
  "READY_FOR_FULFILMENT",
  "IN_PROGRESS",
];

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  "PAYMENT_FAILED",
  "CLOSED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_OPS",
];

export interface BookingTransition {
  to: BookingStatus;
  actors: readonly BookingActor[];
  /** Command name used by the API (`POST .../transitions {command}`). */
  command: string;
  /** Restricted reason codes accepted for this command, when a reason is required. */
  reasons?: readonly string[];
}

/**
 * Booking state machine (SRS 7.1). State changes are commands, never field
 * writes. SYSTEM transitions are driven by the payment and maintenance
 * integrations, not by HTTP callers.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingTransition[]> =
  {
    REQUEST_PENDING: [
      { command: "accept_request", to: "ACCEPTED_AWAITING_ADVANCE", actors: ["PROVIDER"] },
      {
        command: "decline_request",
        to: "CANCELLED_BY_PROVIDER",
        actors: ["PROVIDER"],
        reasons: ["UNAVAILABLE", "OUT_OF_SERVICE_AREA", "PERSONAL_EMERGENCY", "OTHER"],
      },
      {
        command: "cancel",
        to: "CANCELLED_BY_CUSTOMER",
        actors: ["CUSTOMER"],
        reasons: ["CHANGE_OF_PLAN", "FOUND_ALTERNATIVE", "OTHER"],
      },
      {
        command: "expire",
        to: "CANCELLED_BY_OPS",
        actors: ["SYSTEM"],
        reasons: ["REQUEST_EXPIRED"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "ANOTHER_PROVIDER_CONFIRMED"],
      },
    ],
    ACCEPTED_AWAITING_ADVANCE: [
      { command: "confirm_advance", to: "CONFIRMED", actors: ["SYSTEM"] },
      { command: "confirm_payment", to: "CONFIRMED", actors: ["SYSTEM"] },
      { command: "fail_payment", to: "PAYMENT_FAILED", actors: ["SYSTEM"] },
      {
        command: "cancel",
        to: "CANCELLED_BY_CUSTOMER",
        actors: ["CUSTOMER"],
        reasons: ["CHANGE_OF_PLAN", "FOUND_ALTERNATIVE", "OTHER"],
      },
      {
        command: "expire_hold",
        to: "CANCELLED_BY_OPS",
        actors: ["SYSTEM"],
        reasons: ["ADVANCE_PAYMENT_TIMEOUT", "HOLD_EXPIRED"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["ANOTHER_PROVIDER_CONFIRMED", "OPS_DECISION"],
      },
    ],
    PAYMENT_PENDING: [
      { command: "confirm_payment", to: "CONFIRMED", actors: ["SYSTEM"] },
      { command: "fail_payment", to: "PAYMENT_FAILED", actors: ["SYSTEM"] },
      {
        command: "cancel",
        to: "CANCELLED_BY_CUSTOMER",
        actors: ["CUSTOMER"],
        reasons: ["CHANGE_OF_PLAN", "FOUND_ALTERNATIVE", "OTHER"],
      },
      {
        command: "expire_hold",
        to: "CANCELLED_BY_OPS",
        actors: ["SYSTEM"],
        reasons: ["HOLD_EXPIRED"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "POLICY_VIOLATION"],
      },
    ],
    PAYMENT_FAILED: [],
    CONFIRMED: [
      { command: "accept", to: "PROVIDER_ACCEPTED", actors: ["PROVIDER"] },
      {
        command: "decline",
        to: "CANCELLED_BY_PROVIDER",
        actors: ["PROVIDER"],
        reasons: ["UNAVAILABLE", "OUT_OF_SERVICE_AREA", "PERSONAL_EMERGENCY", "OTHER"],
      },
      {
        command: "cancel",
        to: "CANCELLED_BY_CUSTOMER",
        actors: ["CUSTOMER"],
        reasons: ["CHANGE_OF_PLAN", "FOUND_ALTERNATIVE", "OTHER"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "POLICY_VIOLATION"],
      },
    ],
    PROVIDER_ACCEPTED: [
      {
        command: "start_preparation",
        to: "PREPARATION_IN_PROGRESS",
        actors: ["PROVIDER"],
      },
      {
        command: "cancel_by_provider",
        to: "CANCELLED_BY_PROVIDER",
        actors: ["PROVIDER"],
        reasons: ["UNAVAILABLE", "PERSONAL_EMERGENCY", "OTHER"],
      },
      {
        command: "cancel",
        to: "CANCELLED_BY_CUSTOMER",
        actors: ["CUSTOMER"],
        reasons: ["CHANGE_OF_PLAN", "FOUND_ALTERNATIVE", "OTHER"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "POLICY_VIOLATION"],
      },
    ],
    PREPARATION_IN_PROGRESS: [
      { command: "mark_ready", to: "READY_FOR_FULFILMENT", actors: ["PROVIDER"] },
      {
        command: "cancel_by_provider",
        to: "CANCELLED_BY_PROVIDER",
        actors: ["PROVIDER"],
        reasons: ["UNAVAILABLE", "PERSONAL_EMERGENCY", "OTHER"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "POLICY_VIOLATION"],
      },
    ],
    READY_FOR_FULFILMENT: [
      { command: "start", to: "IN_PROGRESS", actors: ["PROVIDER"] },
      {
        command: "cancel_by_provider",
        to: "CANCELLED_BY_PROVIDER",
        actors: ["PROVIDER"],
        reasons: ["UNAVAILABLE", "PERSONAL_EMERGENCY", "OTHER"],
      },
      {
        command: "cancel_by_ops",
        to: "CANCELLED_BY_OPS",
        actors: ["OPS"],
        reasons: ["OPS_DECISION", "POLICY_VIOLATION"],
      },
    ],
    IN_PROGRESS: [
      { command: "complete", to: "COMPLETED", actors: ["PROVIDER", "OPS"] },
      {
        command: "dispute",
        to: "DISPUTED",
        actors: ["CUSTOMER", "OPS"],
        reasons: ["SERVICE_NOT_AS_DESCRIBED", "PROVIDER_ABSENT", "OTHER"],
      },
    ],
    COMPLETED: [
      { command: "queue_settlement", to: "SETTLEMENT_PENDING", actors: ["SYSTEM", "OPS"] },
      {
        command: "dispute",
        to: "DISPUTED",
        actors: ["CUSTOMER", "OPS"],
        reasons: ["SERVICE_NOT_AS_DESCRIBED", "PROVIDER_ABSENT", "OTHER"],
      },
    ],
    SETTLEMENT_PENDING: [
      { command: "close", to: "CLOSED", actors: ["SYSTEM", "OPS"] },
      {
        command: "dispute",
        to: "DISPUTED",
        actors: ["OPS"],
        reasons: ["OTHER"],
      },
    ],
    CLOSED: [],
    CANCELLED_BY_CUSTOMER: [],
    CANCELLED_BY_PROVIDER: [],
    CANCELLED_BY_OPS: [],
    DISPUTED: [],
  };

/** Commands a provider may issue; used to build the "next actions" the API returns. */
export const BOOKING_NUMBER_PREFIX = "PJ";

// ------------------------------------------------------------ consultations
export const CONSULTATION_TYPES = ["PANDIT", "JYOTISHI"] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

/**
 * Data Dictionary 7.47 lists CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED |
 * NO_SHOW; OpenAPI v2.0 lists REQUESTED | SCHEDULED | IN_PROGRESS | COMPLETED |
 * CANCELLED. Both are supported: REQUESTED until the expert confirms a time,
 * then SCHEDULED (the dictionary's CONFIRMED); NO_SHOW is added by the expert.
 */
export const CONSULTATION_STATUSES = [
  "REQUESTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const CONSULTATION_CHANNELS = ["CHAT", "VIDEO", "PHONE", "IN_PERSON"] as const;

export const CONSULTATION_TRANSITIONS: Record<
  ConsultationStatus,
  readonly ConsultationStatus[]
> = {
  REQUESTED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ----------------------------------------------------------- generic limits
export const IDEMPOTENCY_TTL_HOURS = 24;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

// ------------------------------------------------------- controlled values
/** Service languages (Data Dictionary 7.19: "controlled values"). */
export const SUPPORTED_LANGUAGES = [
  "Sanskrit",
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Odia",
  "Assamese",
  "Maithili",
  "Bhojpuri",
  "Nepali",
  "Urdu",
] as const;

/** ROAD is a car / four-wheeler. */
export const TRAVEL_MODES = ["TRAIN", "FLIGHT", "ROAD"] as const;
/** Where a travelling pandit stays overnight. */
export const STAY_ARRANGEMENTS = ["HOST_PROVIDES", "SELF_ARRANGED", "EITHER"] as const;

/** How a booked puja / katha is delivered: in person, or live online on video (Zoom). */
export const DELIVERY_MODES = ["IN_PERSON", "LIVE_ONLINE"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

/** Puja process guide (set by Tirvona admins per ritual): who does each step. */
export const PROCESS_STEP_OWNERS = ["DEVOTEE", "PANDIT", "BOTH", "TIRVONA"] as const;
export const MAX_PROCESS_STEPS = 25;

/** Reason codes accepted when a provider or an administrator changes provider status. */
export const SUSPENSION_REASON_CODES = [
  "COMPLIANCE_VIOLATION",
  "FEAR_BASED_SELLING",
  "OUTCOME_GUARANTEE_CLAIM",
  "FRAUD_SUSPECTED",
  "CUSTOMER_SAFETY",
  "VERIFICATION_LAPSED",
  "OTHER",
] as const;

export const CONSULTATION_CANCEL_REASONS = [
  "CHANGE_OF_PLAN",
  "EXPERT_UNAVAILABLE",
  "SCHEDULING_CONFLICT",
  "EXPERT_NO_RESPONSE",
  "OTHER",
] as const;

export const CONSULTATION_REQUEST_HOLD_HOURS = 24;
export const MAX_BOOKING_HORIZON_DAYS = 365;
