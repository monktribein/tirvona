// ─────────────────────────────────────────────────────────────────────────────
// Parking System — shared constants.
//
// Every enum used by the parking models, services, controllers and validators
// is declared here exactly once, so the schema, the API contract and the UI can
// never drift apart on a spelling. Mirrors the pattern used by models/Otp.js.
//
// This module is self-contained: it imports nothing from outside the parking
// module and is imported by nothing outside it.
// ─────────────────────────────────────────────────────────────────────────────

/** Vehicle classes the platform accepts. Order is the display order. */
export const PARKING_VEHICLE_TYPES = {
  BIKE: 'bike',
  SCOOTER: 'scooter',
  CAR: 'car',
  SUV: 'suv',
  LUXURY_CAR: 'luxury_car',
  TEMPO: 'tempo',
  MINI_BUS: 'mini_bus',
  BUS: 'bus',
  EV: 'ev',
};

export const PARKING_VEHICLE_TYPE_VALUES = Object.values(PARKING_VEHICLE_TYPES);

/**
 * Presentation metadata for each vehicle class. Kept server-side so the seedable
 * `parking_vehicle_types` collection and the UI agree without duplication.
 * `footprint` is the number of standard slot units a vehicle consumes — a bus
 * occupies four bays, a bike a third of one.
 */
export const PARKING_VEHICLE_TYPE_META = {
  [PARKING_VEHICLE_TYPES.BIKE]: { label: 'Bike', footprint: 0.34, icon: 'bike' },
  [PARKING_VEHICLE_TYPES.SCOOTER]: { label: 'Scooter', footprint: 0.34, icon: 'bike' },
  [PARKING_VEHICLE_TYPES.CAR]: { label: 'Car', footprint: 1, icon: 'car' },
  [PARKING_VEHICLE_TYPES.SUV]: { label: 'SUV', footprint: 1.25, icon: 'car' },
  [PARKING_VEHICLE_TYPES.LUXURY_CAR]: { label: 'Luxury Car', footprint: 1.25, icon: 'car' },
  [PARKING_VEHICLE_TYPES.TEMPO]: { label: 'Tempo', footprint: 2, icon: 'truck' },
  [PARKING_VEHICLE_TYPES.MINI_BUS]: { label: 'Mini Bus', footprint: 3, icon: 'bus' },
  [PARKING_VEHICLE_TYPES.BUS]: { label: 'Bus', footprint: 4, icon: 'bus' },
  [PARKING_VEHICLE_TYPES.EV]: { label: 'EV', footprint: 1, icon: 'zap' },
};

/** Booking lifecycle. Terminal states: checked_out, cancelled, expired, no_show. */
export const PARKING_BOOKING_STATUS = {
  PENDING: 'pending',        // created, awaiting payment — not yet a live reservation
  UPCOMING: 'upcoming',      // paid & confirmed, entry window not yet used
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  NO_SHOW: 'no_show',
};

export const PARKING_BOOKING_STATUS_VALUES = Object.values(PARKING_BOOKING_STATUS);

/** Statuses that hold live inventory and must be released when they end. */
export const PARKING_INVENTORY_HOLDING_STATUSES = [
  PARKING_BOOKING_STATUS.UPCOMING,
  PARKING_BOOKING_STATUS.CHECKED_IN,
];

export const PARKING_PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
};

export const PARKING_PAYMENT_STATUS_VALUES = Object.values(PARKING_PAYMENT_STATUS);

/** What a transaction row represents. Parking money never touches `payments`. */
export const PARKING_TRANSACTION_TYPES = {
  BOOKING: 'booking',
  OVERSTAY: 'overstay',
  REFUND: 'refund',
  COMMISSION: 'commission',
  PAYOUT: 'payout',
};

export const PARKING_TRANSACTION_TYPE_VALUES = Object.values(PARKING_TRANSACTION_TYPES);

/**
 * Parking-module roles. These are NOT values of the core `User.role` enum — the
 * User model is deliberately left untouched. A row in `parking_staff` grants an
 * existing user one of these roles, scoped to a partner and/or a location.
 */
export const PARKING_ROLES = {
  PARTNER: 'parking_partner',
  MANAGER: 'parking_manager',
  GUARD: 'security_guard',
};

export const PARKING_ROLE_VALUES = Object.values(PARKING_ROLES);

/**
 * Capability matrix. The guard is intentionally the narrowest role in the
 * platform: scan, verify, check in, check out, read a booking. Nothing else.
 */
export const PARKING_CAPABILITIES = {
  SCAN_QR: 'scan_qr',
  VIEW_BOOKING: 'view_booking',
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
  MANUAL_CHECK_IN: 'manual_check_in',
  VIEW_OCCUPANCY: 'view_occupancy',
  MANAGE_BOOKINGS: 'manage_bookings',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_LOCATION: 'manage_location',
  MANAGE_PRICING: 'manage_pricing',
  MANAGE_SLOTS: 'manage_slots',
  MANAGE_AVAILABILITY: 'manage_availability',
  VIEW_REPORTS: 'view_reports',
  REQUEST_REFUND: 'request_refund',
  ISSUE_REFUND: 'issue_refund',
  MANAGE_PARTNERS: 'manage_partners',
  MANAGE_COMMISSION: 'manage_commission',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_QR_LOGS: 'view_qr_logs',
  VIEW_ANALYTICS: 'view_analytics',
};

const C = PARKING_CAPABILITIES;

export const PARKING_ROLE_CAPABILITIES = {
  // Security Guard — scan only. No delete, no pricing, no refund, no management.
  [PARKING_ROLES.GUARD]: [C.SCAN_QR, C.VIEW_BOOKING, C.CHECK_IN, C.CHECK_OUT],

  // Parking Manager — day-to-day floor operations for the locations assigned.
  [PARKING_ROLES.MANAGER]: [
    C.SCAN_QR, C.VIEW_BOOKING, C.CHECK_IN, C.CHECK_OUT, C.MANUAL_CHECK_IN,
    C.VIEW_OCCUPANCY, C.MANAGE_BOOKINGS, C.MANAGE_STAFF, C.MANAGE_AVAILABILITY,
    C.VIEW_REPORTS, C.REQUEST_REFUND,
  ],

  // Parking Partner — owns the property: listing, photos, pricing, slots, staff.
  [PARKING_ROLES.PARTNER]: [
    C.SCAN_QR, C.VIEW_BOOKING, C.CHECK_IN, C.CHECK_OUT, C.MANUAL_CHECK_IN,
    C.VIEW_OCCUPANCY, C.MANAGE_BOOKINGS, C.MANAGE_STAFF, C.MANAGE_LOCATION,
    C.MANAGE_PRICING, C.MANAGE_SLOTS, C.MANAGE_AVAILABILITY, C.VIEW_REPORTS,
    C.REQUEST_REFUND,
  ],
};

/** Super Admin holds every capability. Resolved from the core `User.role`. */
export const PARKING_SUPER_ADMIN_CAPABILITIES = Object.values(C);

/** Core-platform roles that are granted full parking administration. */
export const PARKING_PLATFORM_ADMIN_ROLES = ['super_admin'];

export const PARKING_SCAN_ACTIONS = {
  ENTRY: 'entry',
  EXIT: 'exit',
  VERIFY: 'verify',
};

export const PARKING_SCAN_RESULTS = {
  SUCCESS: 'success',
  INVALID_TOKEN: 'invalid_token',
  NOT_FOUND: 'not_found',
  EXPIRED: 'expired',
  ALREADY_USED: 'already_used',
  WRONG_LOCATION: 'wrong_location',
  NOT_PAID: 'not_paid',
  CANCELLED: 'cancelled',
  OUT_OF_WINDOW: 'out_of_window',
};

export const PARKING_SLOT_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
  BLOCKED: 'blocked',
};

export const PARKING_NOTIFICATION_EVENTS = {
  BOOKING_CONFIRMED: 'booking_confirmed',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  QR_READY: 'qr_ready',
  ENTRY_REMINDER: 'entry_reminder',
  EXIT_REMINDER: 'exit_reminder',
  CANCELLATION: 'cancellation',
  REFUND: 'refund',
};

export const PARKING_NOTIFICATION_EVENT_VALUES = Object.values(PARKING_NOTIFICATION_EVENTS);

export const PARKING_PRICING_MODES = {
  HOURLY: 'hourly',
  SLAB: 'slab',
  FLAT_DAY: 'flat_day',
};

/** Amenity keys surfaced on the listing and filterable in search. */
export const PARKING_AMENITIES = [
  'covered',
  'cctv',
  'security',
  'washroom',
  'ev_charging',
  'wheelchair_access',
  'valet',
  'car_wash',
  'drinking_water',
  'waiting_lounge',
];

/** Operational defaults. Overridable per-location via `parking_settings`. */
export const PARKING_DEFAULTS = {
  /** Minutes a `pending` (unpaid) booking holds inventory before auto-expiry. */
  reservationHoldMinutes: 15,
  /** Grace period after the booked exit time before overstay billing starts. */
  overstayGraceMinutes: 15,
  /** Minutes after booked entry time before a no-show may be recorded. */
  noShowAfterMinutes: 120,
  /** Multiplier applied to the hourly rate for each overstayed hour. */
  overstayMultiplier: 1.5,
  /** Platform commission taken from each booking, as a percentage. */
  commissionPercent: 12,
  /** GST applied to the parking fee, as a percentage. */
  taxPercent: 18,
  /** Minimum billable duration. */
  minimumBillableHours: 1,
  /** Cancellation window — full refund if cancelled this long before entry. */
  freeCancellationHours: 6,
  /** Refund percentage when cancelled inside the free window. */
  refundPercentInsideWindow: 100,
  /** Refund percentage when cancelled outside the free window. */
  refundPercentOutsideWindow: 50,
  /** How long a QR stays valid after the booked exit time. */
  qrValidityBufferMinutes: 120,
  /** Search radius ceiling, in kilometres. */
  maxSearchRadiusKm: 50,
};

export default {
  PARKING_VEHICLE_TYPES,
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_VEHICLE_TYPE_META,
  PARKING_BOOKING_STATUS,
  PARKING_BOOKING_STATUS_VALUES,
  PARKING_INVENTORY_HOLDING_STATUSES,
  PARKING_PAYMENT_STATUS,
  PARKING_PAYMENT_STATUS_VALUES,
  PARKING_TRANSACTION_TYPES,
  PARKING_ROLES,
  PARKING_ROLE_VALUES,
  PARKING_CAPABILITIES,
  PARKING_ROLE_CAPABILITIES,
  PARKING_SUPER_ADMIN_CAPABILITIES,
  PARKING_SCAN_ACTIONS,
  PARKING_SCAN_RESULTS,
  PARKING_SLOT_STATUS,
  PARKING_NOTIFICATION_EVENTS,
  PARKING_PRICING_MODES,
  PARKING_AMENITIES,
  PARKING_DEFAULTS,
};
