export const PARKING_VEHICLE_TYPES = [
  "bike",
  "scooter",
  "car",
  "suv",
  "luxury_car",
  "tempo",
  "mini_bus",
  "bus",
  "ev",
] as const;
export type ParkingVehicleType = (typeof PARKING_VEHICLE_TYPES)[number];

export const PARKING_VEHICLE_META: Record<
  ParkingVehicleType,
  { label: string; footprint: number; icon: string }
> = {
  bike: { label: "Bike", footprint: 0.34, icon: "bike" },
  scooter: { label: "Scooter", footprint: 0.34, icon: "bike" },
  car: { label: "Car", footprint: 1, icon: "car" },
  suv: { label: "SUV", footprint: 1.25, icon: "car" },
  luxury_car: { label: "Luxury Car", footprint: 1.25, icon: "car" },
  tempo: { label: "Tempo", footprint: 2, icon: "truck" },
  mini_bus: { label: "Mini Bus", footprint: 3, icon: "bus" },
  bus: { label: "Bus", footprint: 4, icon: "bus" },
  ev: { label: "EV", footprint: 1, icon: "zap" },
};

export const PARKING_BOOKING_STATUSES = [
  "pending",
  "upcoming",
  "checked_in",
  "checked_out",
  "cancelled",
  "expired",
  "no_show",
] as const;
export const PARKING_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export const PARKING_LOCATION_STATUSES = [
  "draft",
  "pending",
  "active",
  "inactive",
  "suspended",
] as const;

export const PARKING_ROLES = [
  "parking_partner",
  "parking_manager",
  "security_guard",
] as const;
export const PARKING_AMENITIES = [
  "covered",
  "cctv",
  "security",
  "washroom",
  "ev_charging",
  "wheelchair_access",
  "valet",
  "car_wash",
  "drinking_water",
  "waiting_lounge",
] as const;

export const PARKING_CAPABILITIES = {
  SCAN_QR: "scan_qr",
  VIEW_BOOKING: "view_booking",
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  MANUAL_CHECK_IN: "manual_check_in",
  VIEW_OCCUPANCY: "view_occupancy",
  MANAGE_BOOKINGS: "manage_bookings",
  MANAGE_STAFF: "manage_staff",
  MANAGE_LOCATION: "manage_location",
  MANAGE_PRICING: "manage_pricing",
  MANAGE_SLOTS: "manage_slots",
  MANAGE_AVAILABILITY: "manage_availability",
  VIEW_REPORTS: "view_reports",
  REQUEST_REFUND: "request_refund",
  ISSUE_REFUND: "issue_refund",
  MANAGE_PARTNERS: "manage_partners",
  MANAGE_COMMISSION: "manage_commission",
  MANAGE_SETTINGS: "manage_settings",
  VIEW_QR_LOGS: "view_qr_logs",
  VIEW_ANALYTICS: "view_analytics",
} as const;

const C = PARKING_CAPABILITIES;
export const PARKING_ROLE_CAPABILITIES: Record<string, string[]> = {
  security_guard: [C.SCAN_QR, C.VIEW_BOOKING, C.CHECK_IN, C.CHECK_OUT],
  parking_manager: [
    C.SCAN_QR,
    C.VIEW_BOOKING,
    C.CHECK_IN,
    C.CHECK_OUT,
    C.MANUAL_CHECK_IN,
    C.VIEW_OCCUPANCY,
    C.MANAGE_BOOKINGS,
    C.MANAGE_STAFF,
    C.MANAGE_LOCATION,
    C.MANAGE_PRICING,
    C.MANAGE_SLOTS,
    C.MANAGE_AVAILABILITY,
    C.VIEW_REPORTS,
    C.REQUEST_REFUND,
  ],
  parking_partner: [
    C.SCAN_QR,
    C.VIEW_BOOKING,
    C.CHECK_IN,
    C.CHECK_OUT,
    C.MANUAL_CHECK_IN,
    C.VIEW_OCCUPANCY,
    C.MANAGE_BOOKINGS,
    C.MANAGE_STAFF,
    C.MANAGE_LOCATION,
    C.MANAGE_PRICING,
    C.MANAGE_SLOTS,
    C.MANAGE_AVAILABILITY,
    C.VIEW_REPORTS,
    C.REQUEST_REFUND,
  ],
};

export const PARKING_ASHRAM_OWNER_ROLE = "ashram_parking_owner";

PARKING_ROLE_CAPABILITIES[PARKING_ASHRAM_OWNER_ROLE] =
  PARKING_ROLE_CAPABILITIES.parking_partner;

export const PARKING_DEFAULTS = {
  reservationHoldMinutes: 15,
  overstayGraceMinutes: 15,
  noShowAfterMinutes: 120,
  overstayMultiplier: 1.5,
  commissionPercent: 12,
  taxPercent: 18,
  minimumBillableHours: 1,
  freeCancellationHours: 6,
  refundPercentInsideWindow: 100,
  refundPercentOutsideWindow: 50,
  qrValidityBufferMinutes: 120,
  maxSearchRadiusKm: 50,
  allowOnlineBooking: true,
  allowCancellation: true,
  requireVehicleNumber: true,
};

export const PARKING_MODEL = {
  Partner: "ParkingPartner",
  Location: "ParkingLocation",
  SlotType: "ParkingSlotType",
  Slot: "ParkingSlot",
  VehicleType: "ParkingVehicleType",
  Pricing: "ParkingPricing",
  Availability: "ParkingAvailability",
  Booking: "ParkingBooking",
  Payment: "ParkingPayment",
  Transaction: "ParkingTransaction",
  QrCode: "ParkingQrCode",
  ScanLog: "ParkingScanLog",
  Staff: "ParkingStaff",
  Review: "ParkingReview",
  Notification: "ParkingNotification",
  Setting: "ParkingSetting",
  Holiday: "ParkingHoliday",
  Commission: "ParkingCommission",
} as const;
