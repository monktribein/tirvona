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
  modes?: string[];
  minNoticeHours?: number;
  regions?: string[];
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
