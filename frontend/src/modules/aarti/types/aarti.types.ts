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

export const AARTI_KIND_LABELS: Record<AartiKind, string> = {
  ganga_aarti: "Ganga Aarti",
  mangala_aarti: "Mangala Aarti",
  bhasma_aarti: "Bhasma Aarti",
  sandhya_aarti: "Sandhya Aarti",
  shayan_aarti: "Shayan Aarti",
  maha_aarti: "Maha Aarti",
  abhishek: "Abhishek",
  havan: "Havan",
  bhajan_sandhya: "Bhajan Sandhya",
  other: "Aarti",
};

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
export type AartiFacility = (typeof AARTI_FACILITIES)[number];

export type AartiSessionStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export type AartiBookingStatus =
  | "pending"
  | "upcoming"
  | "checked_in"
  | "attended"
  | "cancelled"
  | "expired"
  | "no_show";

export type AartiPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type AartiStreamStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export type AartiStreamProvider = "youtube" | "facebook" | "vimeo" | "custom";

export interface AartiVenue {
  name?: string;
  line1?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface AartiPassType {
  _id: string;
  sessionId?: string;
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  unitPrice?: number;
  totalCapacity: number;
  seatsRemaining?: number;
  maxPerBooking?: number;
  perks?: AartiFacility[];
  zoneLabel?: string;
  includesPrasad?: boolean;
  includesSankalp?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  available?: boolean;
  unavailableReason?: string | null;
  isPeak?: boolean;
}

export interface AartiSession {
  _id: string;
  ashramId?: string | { _id: string; name?: string; ashramCode?: string };
  ownerId?: string;
  name: string;
  slug: string;
  kind: AartiKind;
  kindLabel?: string;
  deity?: string;
  description?: string;
  ritualNotes?: string;
  dressCode?: string;
  instructions?: string;
  termsAndConditions?: string;
  images?: string[];
  coverImage?: string;
  venue?: AartiVenue;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  startTime: string;
  durationMinutes?: number;
  daysOfWeek?: number[];
  startDate?: string | null;
  endDate?: string | null;
  facilities?: AartiFacility[];
  contactPhone?: string;
  contactEmail?: string;
  totalCapacity?: number;
  commissionPercent?: number | null;
  isFeatured?: boolean;
  allowLiveStream?: boolean;
  status: AartiSessionStatus;
  rejectionReason?: string;
  rating?: { average: number; count: number };
  viewCount?: number;
  fromPrice?: number | null;
  nextOccurrence?: string | null;
  upcomingDates?: string[];
  passTypes?: AartiPassType[];
  passTypeCount?: number;
  bookingCount?: number;
  policy?: AartiPolicy;
  createdAt?: string;
  updatedAt?: string;
}

export interface AartiPolicy {
  allowOnlineBooking: boolean;
  allowCancellation: boolean;
  freeCancellationHours: number;
  refundPercentInsideWindow: number;
  refundPercentOutsideWindow: number;
  maxPassesPerBooking: number;
  gateOpensBeforeMinutes: number;
  bookingClosesBeforeMinutes: number;
}

export interface AartiQuote {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  passTypeId: string;
  passTypeName: string;
  unitPrice: number;
  passCount: number;
  peakMultiplier: number;
  isPeak: boolean;
  peakReasons: { name: string; type: string }[];
  subtotal: number;
  donationAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  seatsRemaining: number;
}

export interface AartiDevotee {
  name: string;
  age?: number;
  gotra?: string;
}

export interface AartiBooking {
  _id: string;
  bookingReference: string;
  customerId?: string;
  sessionId?: string | AartiSession;
  ashramId?: string;
  passTypeId?: string | AartiPassType;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  passCount: number;
  devotees?: AartiDevotee[];
  sankalpName?: string;
  sankalpGotra?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  checkedInAt?: string;
  checkedInCount?: number;
  pricing: {
    unitPrice: number;
    passCount: number;
    peakMultiplier: number;
    subtotal: number;
    donationAmount: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    refundAmount: number;
    currency: string;
  };
  commission?: { percent: number; amount: number; ashramEarning: number };
  status: AartiBookingStatus;
  paymentStatus: AartiPaymentStatus;
  reservationExpiresAt?: string | null;
  cancellation?: {
    reason?: string;
    cancelledAt?: string;
    refundAmount?: number;
    refundReference?: string;
  };
  createdAt?: string;
}

export interface AartiPass {
  format: string;
  image: string;
  token?: string;
  displayCode: string;
  validFrom: string;
  validUntil: string;
  bookingReference: string;
  passCount: number;
  startsAt: string;
}

export interface AartiRefundQuote {
  allowed: boolean;
  percent: number;
  refundAmount: number;
  donationRetained?: number;
  hoursUntilStart?: number;
  freeCancellationHours?: number;
  message?: string;
  sessionName?: string;
}

export interface AartiStream {
  _id: string;
  ashramId?: string | { _id: string; name?: string };
  ownerId?: string;
  sessionId?: string | AartiSession | null;
  title: string;
  slug: string;
  description?: string;
  deity?: string;
  provider: AartiStreamProvider;
  streamUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  venueName?: string;
  city?: string;
  state?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  recurrenceDays?: number[];
  isLive?: boolean;
  isLiveNow?: boolean;
  state_?: string;
  isFeatured?: boolean;
  status: AartiStreamStatus;
  rejectionReason?: string;
  viewCount?: number;
  lastLiveAt?: string;
  displayOrder?: number;
  createdAt?: string;
}

export interface AartiStreamWall {
  success: boolean;
  counts: { live: number; upcoming: number; recorded: number };
  total: number;
  page: number;
  totalPages: number;
  data: (AartiStream & { isLiveNow: boolean; state: string })[];
  live: (AartiStream & { isLiveNow: boolean; state: string })[];
  upcoming: (AartiStream & { isLiveNow: boolean; state: string })[];
}

export interface AartiSearchFilters {
  q?: string;
  city?: string;
  state?: string;
  kind?: AartiKind | "";
  ashramId?: string;
  date?: string;
  facilities?: AartiFacility[];
  sort?: "recommended" | "price_low" | "price_high" | "rating";
  page?: number;
  limit?: number;
}

export interface AartiAccess {
  isPlatformAdmin: boolean;
  isAshramAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
  sessionIds: string[];
  staffIds: string[];
}

export interface AartiDashboard {
  windowDays: number;
  sessions: { approved: number; pendingReview: number };
  streams: { approved: number; liveNow: number };
  totals: {
    bookings: number;
    passes: number;
    gross: number;
    donations: number;
    refunds: number;
  };
  byStatus: Record<string, number>;
  trend: { _id: string; bookings: number; passes: number; revenue: number }[];
  topSessions: {
    _id: string;
    name?: string;
    slug?: string;
    city?: string;
    bookings: number;
    passes: number;
    revenue: number;
  }[];
  settlements: {
    _id: string;
    amount: number;
    commission: number;
    count: number;
  }[];
}
