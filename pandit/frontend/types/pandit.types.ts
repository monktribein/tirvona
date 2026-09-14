// ─────────────────────────────────────────────────────────────────────────────
// Pandit / Provider Domain — TypeScript Types
// Based on API contract: https://api.tirvona.com/api/v2
// ─────────────────────────────────────────────────────────────────────────────

/** Provider type enum — matches backend API contract exactly */
export type ProviderType =
  | "PANDIT"
  | "PUROHIT"
  | "ACHARYA"
  | "VEDIC_SCHOLAR"
  | "KATHA_VACHAK"
  | "JYOTISHI"
  | "PROVIDER_TEAM";

/** Human-readable labels for each provider type */
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  PANDIT: "Pandit",
  PUROHIT: "Purohit",
  ACHARYA: "Acharya",
  VEDIC_SCHOLAR: "Vedic Scholar",
  KATHA_VACHAK: "Katha Vachak",
  JYOTISHI: "Jyotishi",
  PROVIDER_TEAM: "Provider Team",
};

/** Provider types relevant to the Puja/Pandit product (not Jyotishi-only) */
export const PANDIT_PROVIDER_TYPES: ProviderType[] = [
  "PANDIT",
  "PUROHIT",
  "ACHARYA",
  "VEDIC_SCHOLAR",
  "KATHA_VACHAK",
];

/** All provider types including Jyotishi */
export const ALL_PROVIDER_TYPES: ProviderType[] = [
  ...PANDIT_PROVIDER_TYPES,
  "JYOTISHI",
  "PROVIDER_TEAM",
];

export type VerificationLevel =
  | "UNVERIFIED"
  | "BASIC"
  | "STANDARD"
  | "PREMIUM"
  | "TRUSTED";

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  UNVERIFIED: "Unverified",
  BASIC: "Basic",
  STANDARD: "Standard",
  PREMIUM: "Premium",
  TRUSTED: "Trusted",
};

/** Provider profile — matches GET /providers/{providerId} response shape */
export interface ProviderProfile {
  id: string;
  providerType: ProviderType;
  displayName: string;
  verificationLevel: VerificationLevel;
  languages: string[];
  specializations: string[];
  bio?: string;
  avatarUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  profileCompletionPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape of the POST /provider/profile and PATCH /provider/profile body */
export interface ProviderProfileInput {
  providerType: ProviderType;
  displayName: string;
  languages: string[];
  specializations: string[];
  bio?: string;
  avatarUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

// ─── Offerings ────────────────────────────────────────────────────────────────

export type OfferingStatus = "ACTIVE" | "INACTIVE" | "DRAFT";

/** An individual service/ritual offering by the provider */
export interface Offering {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  status: OfferingStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** POST /provider/offerings body */
export interface OfferingInput {
  name: string;
  description?: string;
  durationMinutes?: number;
  tags?: string[];
}

// ─── Verification ─────────────────────────────────────────────────────────────

export type VerificationCaseStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVIEW_REQUIRED";

export const VERIFICATION_STATUS_LABELS: Record<VerificationCaseStatus, string> =
  {
    PENDING: "Pending",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REVIEW_REQUIRED: "Review Required",
  };

export interface VerificationCase {
  id: string;
  providerId: string;
  status: VerificationCaseStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  evidence?: VerificationEvidence[];
}

export interface VerificationEvidence {
  id: string;
  caseId: string;
  documentType: string;
  documentUrl: string;
  uploadedAt?: string;
}

/** POST /verification-cases body */
export interface StartVerificationInput {
  providerId: string;
  notes?: string;
}

/** POST /verification-cases/{caseId}/evidence body */
export interface SubmitEvidenceInput {
  documentType: string;
  documentUrl: string;
}

/** POST /verification-cases/{caseId}:decide body */
export interface DecideVerificationInput {
  decision: "APPROVE" | "REJECT" | "REQUEST_REVIEW";
  note?: string;
}

// ─── Availability ──────────────────────────────────────────────────────────────

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export const ORDERED_DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export interface AvailabilitySlot {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface AvailabilityRule {
  dayOfWeek: DayOfWeek;
  slots: AvailabilitySlot[];
  isAvailable: boolean;
}

/** GET /providers/{providerId}/availability response */
export interface ProviderAvailability {
  providerId: string;
  rules: AvailabilityRule[];
  timezone?: string;
}

/** PUT /provider/availability-rules body */
export interface UpdateAvailabilityRulesInput {
  rules: AvailabilityRule[];
  timezone?: string;
}

/** Calendar block — a specific date/time range where the provider is unavailable */
export interface CalendarBlock {
  id: string;
  providerId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  reason?: string;
}

/** POST /provider/calendar-blocks body */
export interface CreateCalendarBlockInput {
  startDate: string;
  endDate: string;
  reason?: string;
}

// ─── Consultations ────────────────────────────────────────────────────────────

export type ConsultationCategory = "PANDIT_ACHARYA" | "JYOTISHI";

export type ConsultationStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export interface Consultation {
  id: string;
  category: ConsultationCategory;
  providerId: string;
  customerId: string;
  status: ConsultationStatus;
  scheduledAt?: string;
  completedAt?: string;
  notes?: string;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export interface ProviderBooking {
  id: string;
  bookingReference: string;
  providerId: string;
  customerId: string;
  offeringId?: string;
  status: string;
  scheduledDate?: string;
  notes?: string;
  createdAt?: string;
}

// ─── Common API response wrapper ──────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

