export const EVENT_TYPES = [
  "festival",
  "snan",
  "mahotsav",
  "jayanti",
  "yatra",
  "katha",
  "bhandara",
  "satsang",
  "cultural",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_META: Record<EventType, { label: string }> = {
  festival: { label: "Festival" },
  snan: { label: "Snan" },
  mahotsav: { label: "Mahotsav" },
  jayanti: { label: "Jayanti" },
  yatra: { label: "Yatra" },
  katha: { label: "Katha" },
  bhandara: { label: "Bhandara" },
  satsang: { label: "Satsang" },
  cultural: { label: "Cultural Programme" },
  other: { label: "Event" },
};

export const EVENT_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "suspended",
  "archived",
] as const;

/**
 * A free registration never waits on a gateway, so there is no "pending"
 * state — a seat is either held and confirmed, or it is not held at all.
 */
export const EVENT_REGISTRATION_STATUSES = [
  "confirmed",
  "checked_in",
  "attended",
  "cancelled",
  "no_show",
] as const;

export const EVENT_ROLES = ["event_coordinator", "event_gate_staff"] as const;

export const EVENT_FACILITIES = [
  "seating",
  "prasad",
  "bhandara",
  "parking",
  "drinking_water",
  "medical_camp",
  "shoe_stand",
  "wheelchair_access",
  "cloak_room",
  "live_stream",
  "photography",
  "volunteer_support",
] as const;

export const EVENT_CAPABILITIES = {
  VIEW_REGISTRATION: "view_registration",
  SCAN_QR: "scan_qr",
  CHECK_IN: "check_in",
  MANUAL_CHECK_IN: "manual_check_in",
  MANAGE_REGISTRATIONS: "manage_registrations",
  MANAGE_AVAILABILITY: "manage_availability",
  MANAGE_EVENT: "manage_event",
  MANAGE_STAFF: "manage_staff",
  VIEW_REPORTS: "view_reports",
  APPROVE_EVENT: "approve_event",
  MANAGE_SETTINGS: "manage_settings",
  VIEW_ANALYTICS: "view_analytics",
} as const;

const C = EVENT_CAPABILITIES;

export const EVENT_STAFF_ROLE_CAPABILITIES: Record<string, string[]> = {
  event_gate_staff: [C.VIEW_REGISTRATION, C.SCAN_QR, C.CHECK_IN],
  event_coordinator: [
    C.VIEW_REGISTRATION,
    C.SCAN_QR,
    C.CHECK_IN,
    C.MANUAL_CHECK_IN,
    C.MANAGE_REGISTRATIONS,
    C.MANAGE_AVAILABILITY,
    C.VIEW_REPORTS,
  ],
};

export const EVENT_ASHRAM_OWNER_CAPABILITIES: string[] = [
  ...EVENT_STAFF_ROLE_CAPABILITIES.event_coordinator,
  C.MANAGE_EVENT,
  C.MANAGE_STAFF,
];

export const EVENT_ASHRAM_ADMIN_CAPABILITIES: string[] = [
  ...EVENT_ASHRAM_OWNER_CAPABILITIES,
  C.VIEW_ANALYTICS,
];

export const EVENT_DEFAULTS = {
  gateOpensBeforeMinutes: 90,
  noShowAfterMinutes: 120,
  maxSeatsPerRegistration: 10,
  registrationOpensDaysAhead: 120,
  registrationClosesBeforeMinutes: 60,
  allowRegistration: true,
  allowCancellation: true,
  requireAttendeeNames: false,
  qrValidityBufferMinutes: 180,
};

export const EVENT_MODEL = {
  Event: "EventFestivalListing",
  Availability: "EventAvailability",
  Registration: "EventRegistration",
  QrCode: "EventQrCode",
  ScanLog: "EventScanLog",
  Notification: "EventNotification",
  Staff: "EventStaff",
  Setting: "EventSetting",
  AshramRef: "EventAshramRef",
} as const;
