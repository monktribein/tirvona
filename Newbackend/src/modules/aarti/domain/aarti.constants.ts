export const AARTI_KINDS = [
  "ganga_aarti",
  "mangala_aarti",
  "bhasma_aarti",
  "sandhya_aarti",
  "shayan_aarti",
  "maha_aarti",
  "abhishek",
  "havan",
  "bhajan_sandhya",
  "other",
] as const;
export type AartiKind = (typeof AARTI_KINDS)[number];

export const AARTI_KIND_META: Record<AartiKind, { label: string }> = {
  ganga_aarti: { label: "Ganga Aarti" },
  mangala_aarti: { label: "Mangala Aarti" },
  bhasma_aarti: { label: "Bhasma Aarti" },
  sandhya_aarti: { label: "Sandhya Aarti" },
  shayan_aarti: { label: "Shayan Aarti" },
  maha_aarti: { label: "Maha Aarti" },
  abhishek: { label: "Abhishek" },
  havan: { label: "Havan" },
  bhajan_sandhya: { label: "Bhajan Sandhya" },
  other: { label: "Aarti" },
};

export const AARTI_SESSION_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "suspended",
  "archived",
] as const;

export const AARTI_BOOKING_STATUSES = [
  "pending",
  "upcoming",
  "checked_in",
  "attended",
  "cancelled",
  "expired",
  "no_show",
] as const;

export const AARTI_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;

export const AARTI_STREAM_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "archived",
] as const;

export const AARTI_STREAM_PROVIDERS = [
  "youtube",
  "facebook",
  "vimeo",
  "custom",
] as const;

export const AARTI_ROLES = ["aarti_coordinator", "aarti_gate_staff"] as const;

export const AARTI_FACILITIES = [
  "seating",
  "vip_ghat",
  "front_row",
  "prasad_included",
  "garland_included",
  "priest_sankalp",
  "photography",
  "wheelchair_access",
  "shoe_stand",
  "drinking_water",
  "live_stream",
] as const;

export const AARTI_CAPABILITIES = {
  VIEW_BOOKING: "view_booking",
  SCAN_QR: "scan_qr",
  CHECK_IN: "check_in",
  MANUAL_CHECK_IN: "manual_check_in",
  MANAGE_BOOKINGS: "manage_bookings",
  MANAGE_AVAILABILITY: "manage_availability",
  MANAGE_SESSION: "manage_session",
  MANAGE_PASS_TYPES: "manage_pass_types",
  MANAGE_PRICING: "manage_pricing",
  MANAGE_STREAM: "manage_stream",
  MANAGE_STAFF: "manage_staff",
  VIEW_REPORTS: "view_reports",
  REQUEST_REFUND: "request_refund",
  APPROVE_SESSION: "approve_session",
  APPROVE_STREAM: "approve_stream",
  MANAGE_COMMISSION: "manage_commission",
  MANAGE_SETTINGS: "manage_settings",
  VIEW_ANALYTICS: "view_analytics",
} as const;

const C = AARTI_CAPABILITIES;

export const AARTI_STAFF_ROLE_CAPABILITIES: Record<string, string[]> = {
  aarti_gate_staff: [C.VIEW_BOOKING, C.SCAN_QR, C.CHECK_IN],
  aarti_coordinator: [
    C.VIEW_BOOKING,
    C.SCAN_QR,
    C.CHECK_IN,
    C.MANUAL_CHECK_IN,
    C.MANAGE_BOOKINGS,
    C.MANAGE_AVAILABILITY,
    C.VIEW_REPORTS,
    C.REQUEST_REFUND,
  ],
};

export const AARTI_ASHRAM_OWNER_CAPABILITIES: string[] = [
  ...AARTI_STAFF_ROLE_CAPABILITIES.aarti_coordinator,
  C.MANAGE_SESSION,
  C.MANAGE_PASS_TYPES,
  C.MANAGE_PRICING,
  C.MANAGE_STREAM,
  C.MANAGE_STAFF,
];

export const AARTI_ASHRAM_ADMIN_CAPABILITIES: string[] = [
  ...AARTI_ASHRAM_OWNER_CAPABILITIES,
  C.VIEW_ANALYTICS,
];

export const AARTI_DEFAULTS = {
  reservationHoldMinutes: 15,
  gateOpensBeforeMinutes: 60,
  gateClosesAfterMinutes: 30,
  noShowAfterMinutes: 45,
  commissionPercent: 10,
  taxPercent: 0,
  maxPassesPerBooking: 10,
  bookingOpensDaysAhead: 60,
  bookingClosesBeforeMinutes: 120,
  freeCancellationHours: 24,
  refundPercentInsideWindow: 100,
  refundPercentOutsideWindow: 50,
  qrValidityBufferMinutes: 120,
  allowOnlineBooking: true,
  allowCancellation: true,
  requireDevoteeNames: false,
};

export const AARTI_MODEL = {
  Session: "AartiSession",
  PassType: "AartiPassType",
  Pricing: "AartiPricing",
  Availability: "AartiAvailability",
  Holiday: "AartiHoliday",
  Setting: "AartiSetting",
  Staff: "AartiStaff",
  Booking: "AartiBooking",
  Payment: "AartiPayment",
  Transaction: "AartiTransaction",
  Commission: "AartiCommission",
  QrCode: "AartiQrCode",
  ScanLog: "AartiScanLog",
  Review: "AartiReview",
  Notification: "AartiNotification",
  Stream: "AartiStream",
  AshramRef: "AartiAshramRef",
} as const;
