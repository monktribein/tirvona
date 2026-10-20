/**
 * Tirvona Provider / Pandit types derived from the backend OpenAPI v2 contract.
 * Stay in sync with Newbackend/src/modules/providers/presentation/dto/
 */

// ── Shared ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Provider types (PROVIDER_TYPES constant) ──────────────────────────────────

export type ProviderType =
  | "PANDIT"
  | "PUROHIT"
  | "ACHARYA"
  | "JYOTISHI"
  | "VEDIC_SCHOLAR"
  | "KATHA_VACHAK"
  | "PROVIDER_TEAM";

export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  PANDIT: "Pandit",
  PUROHIT: "Purohit",
  ACHARYA: "Acharya",
  JYOTISHI: "Jyotishi",
  VEDIC_SCHOLAR: "Vedic Scholar",
  KATHA_VACHAK: "Katha Vachak",
  PROVIDER_TEAM: "Pandit Team",
};

export const PROVIDER_TYPES = Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[];

// ── Verification levels ───────────────────────────────────────────────────────

export type VerificationLevel =
  | "UNVERIFIED"
  | "IDENTITY_VERIFIED"
  | "PROFESSIONAL_VERIFIED"
  | "INSTITUTION_VERIFIED"
  | "TIRVONA_TRUSTED";

export const VERIFICATION_LEVEL_LABELS: Record<string, string> = {
  UNVERIFIED: "Not verified",
  IDENTITY_VERIFIED: "Identity verified",
  PROFESSIONAL_VERIFIED: "Vedic lineage verified",
  INSTITUTION_VERIFIED: "Institution authorized",
  TIRVONA_TRUSTED: "Tirvona trusted",
};

// ── Verification case statuses ────────────────────────────────────────────────

// Statuses the API stores. "Draft" and "submitted" are both OPEN: a case is submitted once `submitted` is true.
export type VerificationCaseStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "Being Reviewed",
  DRAFT: "Draft",
  SUBMITTED: "Under Review",
  CLAIMED: "Being Reviewed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  WITHDRAWN: "Withdrawn",
};

export const VERIFICATION_CASE_TYPES = [
  "IDENTITY",
  "PROFESSIONAL",
  "INSTITUTION",
  "TRUST_REVIEW",
] as const;

export type VerificationCaseType = (typeof VERIFICATION_CASE_TYPES)[number];

// ── Provider profile ──────────────────────────────────────────────────────────

export interface ServiceArea {
  city: string;
  state?: string;
}

export interface TravelProfile {
  willingToTravel?: boolean;
  overnightOk?: boolean;
  /** TRAIN | FLIGHT | ROAD (car / four-wheeler) */
  modes?: string[];
  minNoticeHours?: number;
  regions?: string[];
  maxDistanceKm?: number | null;
  /** HOST_PROVIDES | SELF_ARRANGED | EITHER */
  stayArrangement?: string | null;
  notes?: string | null;
}

export const TRAVEL_MODE_LABELS: Record<string, string> = {
  TRAIN: "Train",
  FLIGHT: "Flight",
  ROAD: "Car (four-wheeler)",
};

export const STAY_ARRANGEMENT_LABELS: Record<string, string> = {
  HOST_PROVIDES: "Stays with / is hosted by the family",
  SELF_ARRANGED: "Arranges own stay",
  EITHER: "Either is fine",
};

/** One step of a puja's process guide, set by Tirvona per ritual. */
export interface PujaProcessStep {
  title: string;
  detail?: string | null;
  /** DEVOTEE | PANDIT | BOTH | TIRVONA */
  owner?: string;
}

export interface PujaProcess {
  before: PujaProcessStep[];
  during: PujaProcessStep[];
  after: PujaProcessStep[];
}

export interface ConsultationSettings {
  enabled: boolean;
  feeMinor?: number;
  currency?: string;
  slotMinutes?: number;
  channels?: string[];
}

export interface ProviderAddress {
  line1?: string;
  city: string;
  state: string;
  pincode?: string;
}

export interface ProviderProfile {
  id: string;
  userId?: string;
  slug?: string;
  providerType: string;
  displayName: string;
  legalName?: string;
  bio?: string;
  avatarUrl?: string;
  languages: string[];
  traditions?: string[];
  specializations: string[];
  experienceYears?: number;
  homeCity?: string;
  homeState?: string;
  city?: string;
  state?: string;
  serviceAreas?: ServiceArea[];
  travelProfile?: TravelProfile;
  consultation?: ConsultationSettings;
  /** Dashboard switch: live online katha / puja available. */
  liveOnline?: { enabled: boolean; youtubeUrl?: string | null; updatedAt?: string | null };
  contactEmail?: string;
  contactPhone?: string;
  address?: ProviderAddress;
  verificationLevel: string;
  status: string;
  isActive: boolean;
  indicativeStartingFeeMinor?: number;
  profileCompletionPercent?: number;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProviderProfileInput {
  providerType?: string;
  displayName: string;
  legalName?: string;
  bio?: string;
  avatarUrl?: string;
  languages?: string[];
  traditions?: string[];
  specializations?: string[];
  experienceYears?: number;
  homeCity?: string;
  homeState?: string;
  serviceAreas?: ServiceArea[];
  travelProfile?: TravelProfile;
  consultation?: ConsultationSettings;
  contactEmail?: string;
  contactPhone?: string;
  address?: ProviderAddress;
}

export type UpdateProviderProfileInput = Partial<CreateProviderProfileInput>;

// ── Offerings ─────────────────────────────────────────────────────────────────

export interface TravelCharge {
  policy: string;
  flatMinor?: number;
  notes?: string;
}

export interface OfferingDestination {
  city: string;
  state?: string;
  label?: string;
}

export interface KathaDetails {
  kathaType: string;
  title?: string;
  numberOfDays?: number;
  dailyScheduleDescription?: string;
  samagriIncluded?: boolean;
  samagriDetails?: string;
}

export interface Offering {
  id: string;
  providerId?: string;
  ritualVariantId?: string;
  fulfilmentType: string;
  title?: string;
  name?: string;
  description?: string;
  destination?: OfferingDestination;
  durationMinutes: number;
  teamSize?: number;
  minNoticeHours?: number;
  baseProfessionalFeeMinor: number;
  currency?: string;
  travelCharge?: TravelCharge;
  inclusions?: string[];
  exclusions?: string[];
  samagriIncluded?: boolean;
  voluntaryDakshinaAllowed?: boolean;
  tags?: string[];
  status: string;
  serviceType?: "INDIVIDUAL" | "GROUP" | "KATHA";
  groupCapacity?: number;
  kathaDetails?: KathaDetails;
  advancePercentage?: number;
  advanceRequiredMinor?: number;
  remainingBalanceMinor?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOfferingInput {
  ritualVariantId: string;
  fulfilmentType: string;
  title?: string;
  description?: string;
  destination?: OfferingDestination;
  durationMinutes: number;
  teamSize?: number;
  minNoticeHours?: number;
  baseProfessionalFeeMinor: number;
  currency?: string;
  travelCharge?: TravelCharge;
  inclusions?: string[];
  exclusions?: string[];
  samagriIncluded?: boolean;
  voluntaryDakshinaAllowed?: boolean;
  tags?: string[];
  status?: string;
  serviceType?: "INDIVIDUAL" | "GROUP" | "KATHA";
  groupCapacity?: number;
  kathaDetails?: KathaDetails;
  advancePercentage?: number;
}

export type UpdateOfferingInput = Partial<Omit<CreateOfferingInput, "ritualVariantId" | "fulfilmentType">> & {
  status?: string;
};

// ── Availability ──────────────────────────────────────────────────────────────

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface WeeklyRule {
  dayOfWeek: string;
  isAvailable: boolean;
  slots?: TimeSlot[];
}

export interface AvailabilityRules {
  timezone?: string;
  rules: WeeklyRule[];
}

export interface CalendarBlock {
  id: string;
  providerId?: string;
  startAt?: string;
  endAt?: string;
  startDate?: string;
  endDate?: string;
  blockType?: string;
  reason?: string;
  createdAt?: string;
}

export interface CreateCalendarBlockInput {
  startAt?: string;
  endAt?: string;
  startDate?: string;
  endDate?: string;
  blockType?: string;
  reason?: string;
}

// ── Verification cases ────────────────────────────────────────────────────────

export interface Evidence {
  id: string;
  caseId: string;
  evidenceType: string;
  storageKey: string;
  sha256: string;
  mimeType?: string;
  sizeBytes?: number;
  label?: string;
  uploadedAt?: string;
}

export interface VerificationCase {
  id: string;
  providerId: string;
  verificationType?: string;
  status: string;
  notes?: string;
  evidence?: Evidence[];
  reviewerId?: string;
  reviewedAt?: string;
  providerMessage?: string;
  /** True once the provider has submitted the case for review (status stays OPEN until a reviewer claims it). */
  submitted?: boolean;
  evidenceCount?: number;
  submittedAt?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenVerificationCaseInput {
  verificationType?: string;
  providerId?: string;
  notes?: string;
}

export interface AddEvidenceInput {
  evidenceType: string;
  storageKey: string;
  sha256: string;
  mimeType?: string;
  sizeBytes?: number;
  label?: string;
}

export interface DecideVerificationInput {
  decision: "APPROVE" | "REJECT";
  reasonCode: string;
  providerMessage?: string;
  internalNote?: string;
  validityDays?: number;
}

// ── Bookings (puja bookings via /api/v2/bookings) ─────────────────────────────

export interface ProviderBooking {
  id: string;
  bookingNumber?: string;
  bookingReference?: string;
  offeringId?: string;
  providerId?: string;
  customerId?: string;
  customerUserId?: string;
  providerUserId?: string;
  scheduledAt?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  specialInstructions?: string;
  serviceSnapshot?: {
    ritual?: any;
    variant?: any;
    provider?: any;
    offering?: any;
    title?: string;
    description?: string;
    pricing?: {
      professionalFeeRupees?: number;
      travelChargeRupees?: number;
      totalRupees?: number;
      totalMinor?: number;
      professionalFeeMinor?: number;
      travelMinor?: number;
      pricingType?: string;
      lines?: any[];
      currency?: string;
    };
  };
  status: string;
  totalAmountMinor?: number;
  currency?: string;
  notes?: string;
  holdExpiresAt?: string | null;
  paymentRefs?: string[];
  serviceType?: "INDIVIDUAL" | "GROUP" | "KATHA";
  groupCapacity?: number;
  kathaDetails?: KathaDetails;
  shift?: "MORNING" | "EVENING" | "ANY";
  advanceRequiredMinor?: number;
  advancePaidMinor?: number;
  remainingBalanceMinor?: number;
  advancePaymentDeadlineAt?: string | null;
  contactUnlocked?: boolean;
  requestGroupId?: string | null;
  candidateProviderIds?: string[];
  providerContact?: { phone?: string | null; email?: string | null } | null;
  communication?: { chatAvailable: boolean; callAvailable: boolean; reason?: string | null };
  nextActions?: Array<{ command: string; reasons?: string[] | null }>;
  createdAt?: string;
  stateVersion?: number;
  zoomMeeting?: {
    meetingId?: string;
    password?: string;
    joinUrl?: string;
    startUrl?: string;
    topic?: string;
    status?: string;
    createdAt?: string;
  };
}

export interface CreateMultiPanditBookingRequestInput {
  offeringId: string;
  candidateProviderIds: string[];
  scheduledStartAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceLocation?: { line1?: string; city: string; state: string; pincode?: string };
  notes?: string;
  deliveryMode?: string;
  serviceType?: "INDIVIDUAL" | "GROUP" | "KATHA";
  groupCapacity?: number;
  kathaDetails?: KathaDetails;
  shift?: "MORNING" | "EVENING" | "ANY";
}

export interface ShiftAvailability {
  shift: "MORNING" | "EVENING";
  status: "AVAILABLE" | "UNAVAILABLE" | "HELD" | "BOOKED" | "OUT_OF_RANGE";
  isBookable?: boolean;
  isAvailable?: boolean;
  hasConfirmedBooking: boolean;
  bookingCount?: number;
  reason?: string;
  distanceKm?: number;
}

export interface ThirtyDayCalendarDay {
  date: string;
  dayOfWeek: string;
  shifts: {
    morning: ShiftAvailability;
    evening: ShiftAvailability;
  };
  confirmedBookingCount: number;
  hasHold: boolean;
}

export interface ThirtyDayCalendarData {
  providerId: string;
  timezone: string;
  scheduleConfigured: boolean;
  days: ThirtyDayCalendarDay[];
}

// ── Ritual catalog (public) ───────────────────────────────────────────────────

export interface RitualVariant {
  id: string;
  ritualId: string;
  name: string;
  slug?: string;
  description?: string;
  defaultDurationMinutes?: number;
  fulfilmentTypes?: string[];
}

export interface Ritual {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  variants?: RitualVariant[];
  coverImageUrl?: string;
  status?: string;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface ProviderSearchParams {
  q?: string;
  ritual?: string;
  ritualVariantId?: string;
  language?: string;
  providerType?: string;
  fulfilmentType?: string;
  city?: string;
  state?: string;
  minVerification?: string;
  hasConsultation?: boolean;
  date?: string;
  durationMinutes?: number;
  minFeeMinor?: number;
  maxFeeMinor?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

// ── Consultations ─────────────────────────────────────────────────────────────

export interface Consultation {
  id: string;
  bookingId?: string;
  providerId?: string;
  customerId?: string;
  channel?: string;
  scheduledAt?: string;
  status?: string;
  notes?: string;
}
