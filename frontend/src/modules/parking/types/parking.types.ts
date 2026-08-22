
export type ParkingVehicleTypeCode =
  | "bike"
  | "scooter"
  | "car"
  | "suv"
  | "luxury_car"
  | "tempo"
  | "mini_bus"
  | "bus"
  | "ev";

export type ParkingBookingStatus =
  | "pending"
  | "upcoming"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "expired"
  | "no_show";

export type ParkingPaymentStatus =
  "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

export type ParkingRole =
  "parking_partner" | "parking_manager" | "security_guard";

export interface ParkingVehicleType {
  code: ParkingVehicleTypeCode;
  label: string;
  icon: string;
  footprint?: number;
}

export interface ParkingAddress {
  line1?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface ParkingNearbyDestination {
  name: string;
  templeSlug?: string;
  distanceKm?: number;
  walkingMinutes?: number;
}

export interface ParkingOpeningHours {
  is24x7: boolean;
  opensAt?: string;
  closesAt?: string;
}

export interface ParkingAvailabilitySummary {
  totalCapacity: number;
  availableCount: number;
  declaredCapacity?: number;
  isConfigured?: boolean;
  occupancyPercent?: number;
}

export interface ParkingQuote {
  vehicleType: ParkingVehicleTypeCode;
  slotTypeId: string;
  slotTypeName: string;
  durationHours: number;
  durationMinutes: number;
  baseFee: number;
  durationAmount: number;
  peakMultiplier: number;
  isPeak: boolean;
  peakReasons: { name: string; type: string }[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  freeMinutesApplied: number;
  pricingMode: string;
}

export interface ParkingSlotTypeAvailability {
  slotTypeId: string;
  name: string;
  code?: string;
  description?: string;
  vehicleTypes: ParkingVehicleTypeCode[];
  isCovered: boolean;
  hasEvCharging: boolean;
  floorLabel?: string;
  totalCapacity: number;
  availableCount: number;
  isAvailable: boolean;
  pricing: ParkingQuote | null;
}

export interface ParkingLocation {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  images: string[];
  coverImage?: string;
  address: ParkingAddress;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  distanceKm?: number | null;
  nearbyDestinations: ParkingNearbyDestination[];
  supportedVehicleTypes: ParkingVehicleTypeCode[];
  amenities: string[];
  isCovered: boolean;
  hasCctv: boolean;
  hasSecurity: boolean;
  hasWashroom: boolean;
  hasEvCharging: boolean;
  hasWheelchairAccess: boolean;
  openingHours: ParkingOpeningHours;
  totalCapacity: number;
  contactPhone?: string;
  termsAndConditions?: string;
  instructions?: string;
  rating: { average: number; count: number };
  status: string;
  isFeatured: boolean;
  isVerified: boolean;
  availability?: ParkingAvailabilitySummary;
}

export interface ParkingLocationDetail extends ParkingLocation {
  slotTypes: ParkingSlotTypeAvailability[];
  reviews: ParkingReview[];
  reviewCount: number;
}

export interface ParkingReview {
  _id: string;
  rating: {
    overall: number;
    safety?: number;
    cleanliness?: number;
    staff?: number;
    valueForMoney?: number;
  };
  comment: string;
  createdAt: string;
  customerId?: { name?: string; avatarUrl?: string };
  partnerResponse?: { text?: string; at?: string };
}

export interface ParkingBookingPricing {
  baseFee: number;
  durationAmount: number;
  peakMultiplier: number;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  overstayAmount: number;
  totalAmount: number;
  amountPaid: number;
  refundAmount: number;
  currency: string;
}

export interface ParkingBooking {
  _id: string;
  bookingReference: string;
  locationId: ParkingLocation | string;
  slotTypeId: { _id: string; name: string; isCovered?: boolean } | string;
  vehicleType: ParkingVehicleTypeCode;
  vehicleNumber: string;
  vehicleModel?: string;
  driverName?: string;
  driverPhone?: string;
  entryAt: string;
  exitAt: string;
  durationHours: number;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  actualDurationMinutes?: number | null;
  overstayMinutes?: number;
  assignedSlotNumber?: string;
  pricing: ParkingBookingPricing;
  status: ParkingBookingStatus;
  paymentStatus: ParkingPaymentStatus;
  reservationExpiresAt?: string | null;
  cancellation?: {
    reason?: string;
    cancelledAt?: string;
    refundAmount?: number;
  };
  createdAt: string;
}

export interface ParkingPass {
  token?: string;
  displayCode: string;
  image?: string;
  validFrom: string;
  validUntil: string;
  status?: string;
  entryScannedAt?: string | null;
  exitScannedAt?: string | null;
}

export interface ParkingRefundQuote {
  allowed: boolean;
  percent: number;
  refundAmount: number;
  hoursUntilEntry?: number;
  freeCancellationHours?: number;
  message?: string;
}

export interface ParkingSearchFilters {
  destination?: string;
  city?: string;
  templeSlug?: string;
  vehicleType?: ParkingVehicleTypeCode | "";
  amenities?: string[];
  covered?: boolean;
  evCharging?: boolean;
  minRating?: number;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  entryAt?: string;
  exitAt?: string;
  sortBy?: string;
}

export interface ParkingDashboardStats {
  todayRevenue: number;
  todayBookings: number;
  todayCommission: number;
  todayPartnerEarning: number;
  occupiedSlots: number;
  availableSlots: number;
  reservedSlots: number;
  maintenanceSlots: number;
  totalSlots: number;
  expectedArrivals: number;
  expectedExits: number;
  occupancyPercent: number;
  currentlyParked: number;
  statusBreakdown: Record<string, number>;
}

export interface ParkingScanResult {
  bookingReference: string;
  status: ParkingBookingStatus;
  paymentStatus?: ParkingPaymentStatus;
  vehicleNumber: string;
  vehicleType?: ParkingVehicleTypeCode;
  vehicleModel?: string;
  driverName?: string;
  driverPhone?: string;
  entryAt?: string;
  exitAt?: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  assignedSlotNumber?: string;
  slotType?: string;
  location?: string;
  actualDurationMinutes?: number;
  overstay?: { minutes: number; chargeableHours: number; amount: number };
  releasedSlot?: string;
}

export interface ParkingGuardContext {
  locations: {
    _id: string;
    name: string;
    slug: string;
    address?: ParkingAddress;
  }[];
  roles: ParkingRole[];
  capabilities: string[];
}

export interface ParkingApiListResponse<T> {
  success: boolean;
  count: number;
  total: number;
  page?: number;
  totalPages?: number;
  data: T[];
}
