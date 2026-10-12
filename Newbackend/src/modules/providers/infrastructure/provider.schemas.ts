/**
 * Provider-domain persistence (Data Dictionary v2.0 sections 7.17-7.23, 7.27,
 * 7.28, 7.31, 7.32, 7.47, 7.53). Collection names follow the dictionary so the
 * model stays traceable to the approved design; model names carry a
 * `Provider` prefix because model names are global in this application.
 *
 * Storage is the platform Postgres driver (one table per collection, generated
 * by `npm run db:generate`). The driver deliberately creates no foreign keys
 * (project policy), so referential integrity is enforced by the services inside
 * transactions and audited by `ProviderIntegrityService`.
 */
import { Schema, SchemaTypes } from "../../../database/orm";
import {
  BOOKING_STATUSES,
  CALENDAR_BLOCK_STATUSES,
  CALENDAR_BLOCK_TYPES,
  CONSULTATION_CHANNELS,
  CONSULTATION_STATUSES,
  CONSULTATION_TYPES,
  DELIVERY_MODES,
  EVIDENCE_TYPES,
  FULFILMENT_TYPES,
  MALWARE_SCAN_STATUSES,
  OFFERING_STATUSES,
  PROVIDER_STATUSES,
  PROVIDER_TYPES,
  RESOURCE_TYPES,
  RITUAL_STATUSES,
  VARIANT_STATUSES,
  VERIFICATION_CASE_STATUSES,
  VERIFICATION_CASE_TYPES,
  VERIFICATION_LEVELS,
} from "../domain/provider.constants";

const id = (ref: string, extra: Record<string, unknown> = {}) => ({
  type: SchemaTypes.ObjectId,
  ref,
  ...extra,
});
const opts = (collection: string, optimisticConcurrency = true) => ({
  timestamps: true,
  collection,
  optimisticConcurrency,
});

// ------------------------------------------------------------ 7.17 rituals
export const ProviderRitualSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    /** Working copy being edited. Locale map, e.g. { en: "Rudrabhishek", hi: "रुद्राभिषेक" }. */
    titles: { type: SchemaTypes.Mixed, required: true },
    summary: { type: SchemaTypes.Mixed, required: true },
    category: { type: String, trim: true, index: true },
    aliases: { type: [String], default: [] },
    applicableFulfilmentTypes: {
      type: [String],
      enum: FULFILMENT_TYPES,
      default: [],
    },
    defaultDurationMinutes: { type: Number, min: 1, default: null },
    status: {
      type: String,
      enum: RITUAL_STATUSES,
      default: "DRAFT",
    },
    contentVersion: { type: Number, min: 1, default: 1 },
    /**
     * The last published snapshot. Public reads use this, so revising a
     * published ritual (status -> DRAFT) never takes the live page down and a
     * half-edited draft never leaks (SRS FR-PC-003).
     */
    publishedContent: { type: SchemaTypes.Mixed, default: null },
    publishedAt: Date,
    /**
     * Step-by-step guide shown to devotee and pandit: { before, during, after },
     * each a list of { title, detail, owner }. Operational guidance, edited by
     * Tirvona admins directly and live at once (outside the content review).
     */
    process: { type: SchemaTypes.Mixed, default: null },
    processUpdatedAt: { type: Date, default: null },
    processUpdatedBy: id("User", { default: null }),
    /** Search-safe lowercase text built from the published content. */
    searchText: { type: String, default: "" },
    /** True when published content exists and the ritual is not archived. */
    isListed: { type: Boolean, default: false },
    /** Written only by the development seeder; hidden from every public read in production. */
    isDevFixture: { type: Boolean, default: false },
    createdBy: id("User"),
    submittedBy: id("User"),
    approvedBy: id("User"),
    publishedBy: id("User"),
    deletedAt: { type: Date, default: null },
  },
  opts("rituals"),
);
ProviderRitualSchema.index({ slug: 1 }, { unique: true, name: "ux_ritual_slug" });
ProviderRitualSchema.index({ status: 1, updatedAt: -1 }, { name: "ix_ritual_status" });
ProviderRitualSchema.index({ isListed: 1, category: 1 }, { name: "ix_ritual_listed" });

// ------------------------------------------------------ 7.18 ritual_variants
export const ProviderRitualVariantSchema = new Schema(
  {
    ritualId: id("ProviderRitual", { required: true, index: true }),
    code: { type: String, required: true, lowercase: true, trim: true },
    titles: { type: SchemaTypes.Mixed, required: true },
    /** Inclusions, indicative mantra count/steps, duration band, team-size range. */
    scope: { type: SchemaTypes.Mixed, required: true },
    status: { type: String, enum: VARIANT_STATUSES, default: "ACTIVE" },
    createdBy: id("User"),
  },
  opts("ritual_variants"),
);
ProviderRitualVariantSchema.index(
  { ritualId: 1, code: 1 },
  { unique: true, name: "ux_ritual_variant" },
);
ProviderRitualVariantSchema.index(
  { ritualId: 1, status: 1 },
  { name: "ix_variant_status" },
);

// ----------------------------------------------------- 7.19 provider_profiles
export const ProviderProfileSchema = new Schema(
  {
    userId: id("User", { required: true }),
    slug: { type: String, required: true, lowercase: true, trim: true },
    providerType: { type: String, enum: PROVIDER_TYPES, default: "PANDIT" },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 1000 },
    avatarUrl: { type: String, trim: true },
    languages: { type: [String], default: [] },
    /** Declared traditions/parampara labels (knowledge graph ids arrive with M05). */
    traditions: { type: [String], default: [] },
    /** Provider-declared specialisation labels shown on the public profile. */
    specializations: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 80 },
    homeCity: { type: String, trim: true },
    homeState: { type: String, trim: true },
    /** [{ city, state }]; `serviceCities` is the lowercase search form. */
    serviceAreas: { type: SchemaTypes.Mixed, default: [] },
    serviceCities: { type: [String], default: [] },
    travelProfile: { type: SchemaTypes.Mixed, default: {} },
    /** Ask-a-Pandit / Ask-a-Jyotishi settings: { enabled, feeMinor, currency, slotMinutes, channels }. */
    consultation: { type: SchemaTypes.Mixed, default: { enabled: false } },
    /** "Live online available" switch on the dashboard: { enabled, updatedAt }. Lets devotees book a live video katha / puja. */
    liveOnline: { type: SchemaTypes.Mixed, default: { enabled: false } },

    verificationLevel: { type: String, enum: VERIFICATION_LEVELS, default: "UNVERIFIED" },
    verificationRank: { type: Number, default: 0 },
    /** { IDENTITY: { caseId, approvedAt, validUntil }, PROFESSIONAL: ..., INSTITUTION: ..., TRUST_REVIEW: ... } */
    verification: { type: SchemaTypes.Mixed, default: {} },
    identityVerifiedUntil: { type: Date, default: null },

    status: { type: String, enum: PROVIDER_STATUSES, default: "ONBOARDING" },
    statusReason: String,
    statusChangedAt: Date,
    statusChangedBy: id("User"),
    metricsSnapshot: { type: SchemaTypes.Mixed, default: {} },

    /**
     * Calendar serialisation token. Every write that claims provider time
     * increments it first, so two concurrent bookings of the same provider
     * conflict on this row and the loser re-reads the winner's block.
     */
    calendarSeq: { type: Number, default: 0 },

    // ---- denormalised, search-safe read model (rebuilt by ProviderProjectionService)
    ritualIds: { type: [SchemaTypes.ObjectId], default: [] },
    ritualVariantIds: { type: [SchemaTypes.ObjectId], default: [] },
    fulfilmentTypes: { type: [String], default: [] },
    minFeeMinor: { type: Number, default: null },
    maxFeeMinor: { type: Number, default: null },
    feeCurrency: { type: String, default: "INR" },
    activeOfferingCount: { type: Number, default: 0 },
    availableWeekdays: { type: [String], default: [] },
    isPubliclyListed: { type: Boolean, default: false },

    /** Development fixtures are excluded from every public read in production. */
    isDevFixture: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  opts("provider_profiles"),
);
ProviderProfileSchema.index({ userId: 1 }, { unique: true, name: "ux_provider_user" });
ProviderProfileSchema.index({ slug: 1 }, { unique: true, name: "ux_provider_slug" });
ProviderProfileSchema.index(
  { providerType: 1, status: 1, verificationLevel: 1 },
  { name: "ix_provider_type_status" },
);
ProviderProfileSchema.index(
  { isPubliclyListed: 1, verificationRank: -1, createdAt: -1 },
  { name: "ix_provider_public" },
);
ProviderProfileSchema.index({ languages: 1 }, { name: "ix_provider_languages" });
ProviderProfileSchema.index({ serviceCities: 1 }, { name: "ix_provider_service_cities" });
ProviderProfileSchema.index({ ritualIds: 1 }, { name: "ix_provider_rituals" });

// ---------------------------------------------- 7.20 provider_private_profiles
export const ProviderPrivateProfileSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    legalName: { type: String, required: true, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: SchemaTypes.Mixed, default: null },
    /** Evidence ids only, never files. */
    kycRefs: { type: [SchemaTypes.ObjectId], default: [] },
  },
  opts("provider_private_profiles"),
);
ProviderPrivateProfileSchema.index(
  { providerId: 1 },
  { unique: true, name: "ux_provider_private" },
);

// ------------------------------------------------- 7.21 provider_offerings
export const ProviderOfferingSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    ritualId: id("ProviderRitual", { required: true }),
    ritualVariantId: id("ProviderRitualVariant", { required: true }),
    fulfilmentType: { type: String, enum: FULFILMENT_TYPES, required: true },
    title: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    /** Where destination-bound services are performed: { city, state, label }. */
    destination: { type: SchemaTypes.Mixed, default: null },
    durationMinutes: { type: Number, required: true, min: 1, max: 2880 },
    teamSize: { type: Number, required: true, min: 1, max: 50, default: 1 },
    minNoticeHours: { type: Number, min: 0, max: 24 * 90, default: 24 },
    /** Mandatory professional fee in minor units; voluntary dakshina is never part of it (BR-006). */
    baseProfessionalFeeMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR", uppercase: true },
    /** { policy: NONE | FLAT | ACTUALS_AT_COST, flatMinor?, notes? } */
    travelCharge: { type: SchemaTypes.Mixed, default: { policy: "NONE" } },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    samagriIncluded: { type: Boolean, default: false },
    voluntaryDakshinaAllowed: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    status: { type: String, enum: OFFERING_STATUSES, default: "ACTIVE" },
    deletedAt: { type: Date, default: null },
  },
  opts("provider_offerings"),
);
ProviderOfferingSchema.index(
  { providerId: 1, status: 1 },
  { name: "ix_offering_provider_status" },
);
ProviderOfferingSchema.index(
  { ritualVariantId: 1, fulfilmentType: 1, status: 1 },
  { name: "ix_offering_discovery" },
);
/** One live offering per provider x variant x fulfilment type. */
ProviderOfferingSchema.index(
  { providerId: 1, ritualVariantId: 1, fulfilmentType: 1 },
  {
    unique: true,
    name: "ux_offering_live",
    partialFilterExpression: { status: { $in: ["ACTIVE", "PAUSED"] } },
  },
);

// ------------------------------------------------ 7.22 verification_cases
export const ProviderVerificationCaseSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    /** Owner of the provider; used for the reviewer conflict-of-interest check. */
    providerUserId: id("User", { required: true }),
    verificationType: { type: String, enum: VERIFICATION_CASE_TYPES, required: true },
    status: { type: String, enum: VERIFICATION_CASE_STATUSES, default: "OPEN" },
    evidenceIds: { type: [SchemaTypes.ObjectId], default: [] },
    reviewerUserId: id("User", { default: null }),
    decisionReasonCode: { type: String, default: null },
    /** Shown to the provider. */
    providerMessage: { type: String, maxlength: 500 },
    /** Reviewer-only; never returned to the provider or any list. */
    internalNote: { type: String, maxlength: 2000, select: false },
    validUntil: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    openedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date, default: null },
    previousCaseId: id("ProviderVerificationCase", { default: null }),
    attempt: { type: Number, default: 1 },
    /** Bounded transition log: [{ from, to, actorId, actorRole, reasonCode, at }]. */
    history: { type: SchemaTypes.Mixed, default: [] },
  },
  opts("verification_cases"),
);
ProviderVerificationCaseSchema.index(
  { status: 1, verificationType: 1, openedAt: 1 },
  { name: "ix_verification_queue" },
);
ProviderVerificationCaseSchema.index(
  { providerId: 1, verificationType: 1, openedAt: -1 },
  { name: "ix_verification_provider" },
);
/** At most one open/in-review case per provider and type (concurrent submits cannot duplicate). */
ProviderVerificationCaseSchema.index(
  { providerId: 1, verificationType: 1 },
  {
    unique: true,
    name: "ux_verification_active",
    partialFilterExpression: { status: { $in: ["OPEN", "IN_REVIEW"] } },
  },
);

// ---------------------------------------------- 7.23 verification_evidence
export const ProviderVerificationEvidenceSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    caseId: id("ProviderVerificationCase", { required: true }),
    uploadedBy: id("User", { required: true }),
    evidenceType: { type: String, enum: EVIDENCE_TYPES, required: true },
    /** Opaque storage reference returned by the uploads module. Never a public link in API output. */
    objectStorageKey: { type: String, required: true, select: false },
    sha256: { type: String, required: true, lowercase: true },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number, min: 0 },
    label: { type: String, trim: true, maxlength: 100 },
    malwareScanStatus: { type: String, enum: MALWARE_SCAN_STATUSES, default: "PENDING" },
    uploadedAt: { type: Date, default: Date.now },
    retentionUntil: { type: Date, default: null },
  },
  opts("verification_evidence", false),
);
ProviderVerificationEvidenceSchema.index(
  { providerId: 1, uploadedAt: -1 },
  { name: "ix_evidence_provider" },
);
ProviderVerificationEvidenceSchema.index({ caseId: 1 }, { name: "ix_evidence_case" });
ProviderVerificationEvidenceSchema.index(
  { retentionUntil: 1 },
  { name: "ix_evidence_retention", sparse: true },
);

// ------------------------------------------------- 7.27 availability_rules
export const ProviderAvailabilityRuleSchema = new Schema(
  {
    resourceType: { type: String, enum: RESOURCE_TYPES, default: "PROVIDER" },
    resourceId: id("ProviderProfile", { required: true }),
    timezone: { type: String, required: true },
    rrule: { type: String, default: null },
    /** { startTime: "08:00", endTime: "18:00" } local to `timezone`. */
    window: { type: SchemaTypes.Mixed, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  opts("availability_rules", false),
);
ProviderAvailabilityRuleSchema.index(
  { resourceType: 1, resourceId: 1, status: 1 },
  { name: "ix_availability_resource" },
);

// --------------------------------------------------- 7.28 calendar_blocks
export const ProviderCalendarBlockSchema = new Schema(
  {
    resourceType: { type: String, enum: RESOURCE_TYPES, default: "PROVIDER" },
    resourceId: id("ProviderProfile", { required: true }),
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    blockType: { type: String, enum: CALENDAR_BLOCK_TYPES, default: "MANUAL" },
    /** Booking / consultation the block belongs to. */
    sourceId: { type: SchemaTypes.ObjectId, default: null },
    status: { type: String, enum: CALENDAR_BLOCK_STATUSES, default: "ACTIVE" },
    /** Only temporary holds expire; released by the maintenance job so linked records change state with them. */
    expiresAt: { type: Date, default: null },
    reason: { type: String, trim: true, maxlength: 200 },
    createdBy: id("User"),
    releasedAt: Date,
  },
  opts("calendar_blocks", false),
);
ProviderCalendarBlockSchema.index(
  { resourceId: 1, startAt: 1, endAt: 1, status: 1 },
  { name: "ix_calendar_conflict" },
);
ProviderCalendarBlockSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "ix_calendar_expiry" },
);
ProviderCalendarBlockSchema.index({ sourceId: 1 }, { name: "ix_calendar_source" });

// ------------------------------------------------------ 7.31 bookings (provider)
export const ProviderBookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true, immutable: true },
    customerUserId: id("User", { required: true }),
    providerId: id("ProviderProfile", { required: true }),
    /** Owner of the provider, so provider-side access checks need no join. */
    providerUserId: id("User", { required: true }),
    offeringId: id("ProviderOffering", { required: true }),
    ritualId: id("ProviderRitual", { required: true }),
    ritualVariantId: id("ProviderRitualVariant", { required: true }),
    fulfilmentType: { type: String, enum: FULFILMENT_TYPES, required: true },
    /** In person (the offering's fulfilment) or live online on video. */
    deliveryMode: { type: String, enum: DELIVERY_MODES, default: "IN_PERSON" },
    /** YouTube link the devotee watches: { youtubeUrl, videoId, source: PROFILE | BOOKING, addedAt }. */
    liveStream: { type: SchemaTypes.Mixed, default: null },
    /** Quote and payment live in the commerce/payments domains; only opaque references are kept here. */
    quoteId: { type: SchemaTypes.ObjectId, default: null },
    paymentRefs: { type: [String], default: [] },
    /**
     * The gateway order currently open for this booking and how it is split:
     * { orderId, gatewayMinor, walletMinor }. A payment is only accepted for
     * this order, and a webhook is only accepted for this gateway amount.
     */
    paymentOrder: { type: SchemaTypes.Mixed, default: null },
    /** What happened to the money when a paid booking was cancelled. See ProviderBookingPaymentService. */
    refund: { type: SchemaTypes.Mixed, default: null },
    /** Immutable at creation: ritual, variant, provider, offering and price as they were (BR-004). */
    serviceSnapshot: { type: SchemaTypes.Mixed, required: true, immutable: true },
    scheduledStartAt: { type: Date, required: true },
    scheduledEndAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    customerContact: { type: SchemaTypes.Mixed, select: false },
    serviceLocation: { type: SchemaTypes.Mixed, select: false },
    customerNotes: { type: String, maxlength: 500, select: false },
    status: { type: String, enum: BOOKING_STATUSES, default: "PAYMENT_PENDING" },
    /** Optimistic-concurrency version; every transition is a conditional update on it. */
    stateVersion: { type: Number, default: 0 },
    holdBlockId: id("ProviderCalendarBlock", { default: null }),
    holdExpiresAt: { type: Date, default: null },
    confirmedAt: Date,
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReasonCode: String,
    /**
     * Zoom Live Pooja session: { meetingId, topic, joinUrl, startUrl, password, status, createdAt },
     * or a short-lived { status: "CREATING", lockedAt } marker while it is being created.
     * startUrl (host) and password are secrets: no booking view includes them; only
     * ProviderZoomService returns startUrl, and only to the booking's provider.
     */
    zoomMeeting: { type: SchemaTypes.Mixed, default: null },
  },
  opts("provider_bookings", false),
);
ProviderBookingSchema.index({ bookingNumber: 1 }, { unique: true, name: "ux_pbooking_number" });
ProviderBookingSchema.index(
  { customerUserId: 1, createdAt: -1 },
  { name: "ix_pbooking_customer" },
);
ProviderBookingSchema.index(
  { providerId: 1, status: 1, scheduledStartAt: 1 },
  { name: "ix_pbooking_provider" },
);
/** Webhook lookup by gateway order id. */
ProviderBookingSchema.index({ paymentRefs: 1 }, { name: "ix_pbooking_payment_refs" });
ProviderBookingSchema.index(
  { status: 1, holdExpiresAt: 1 },
  { name: "ix_pbooking_hold_expiry" },
);

// ---------------------------------------------- 7.32 booking_state_history
export const ProviderBookingStateHistorySchema = new Schema(
  {
    bookingId: id("ProviderBooking", { required: true }),
    fromState: { type: String, enum: BOOKING_STATUSES, default: null },
    toState: { type: String, enum: BOOKING_STATUSES, required: true },
    command: String,
    reasonCode: { type: String, default: null },
    actorType: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER", "OPS", "SYSTEM"],
      default: "SYSTEM",
    },
    actorId: id("User", { default: null }),
    correlationId: { type: String, required: true },
    aggregateVersion: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "provider_booking_state_history" },
);
ProviderBookingStateHistorySchema.index(
  { bookingId: 1, createdAt: 1 },
  { name: "ix_pbooking_history" },
);

// ------------------------------------------------ 7.47 expert_consultations
export const ProviderConsultationSchema = new Schema(
  {
    consultationType: { type: String, enum: CONSULTATION_TYPES, required: true },
    customerUserId: id("User", { required: true }),
    expertProviderId: id("ProviderProfile", { required: true }),
    expertUserId: id("User", { required: true }),
    /** Display facts frozen at request time, so lists need no joins: { id, displayName, providerType }. */
    expertSnapshot: { type: SchemaTypes.Mixed, default: null },
    /** Name only. Phone and email are never copied to the expert. */
    customerSnapshot: { type: SchemaTypes.Mixed, default: null },
    channel: { type: String, enum: CONSULTATION_CHANNELS, required: true },
    scheduledStartAt: { type: Date, required: true },
    scheduledEndAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    /** Customer-entered; readable only by the customer and the expert. */
    questionSummary: { type: String, maxlength: 1000, select: false },
    /** Expert-only working notes; excluded from every generic read. */
    expertNotes: { type: String, maxlength: 4000, select: false },
    /** Jyotish chart access is explicit and scoped; no Kundli domain exists yet, so it stays null. */
    chartAccessGrant: { type: SchemaTypes.Mixed, default: null },
    fee: { type: SchemaTypes.Mixed, required: true },
    /** Optional provider booking this consultation relates to (same customer and provider). */
    bookingId: id("ProviderBooking", { default: null }),
    status: { type: String, enum: CONSULTATION_STATUSES, default: "REQUESTED" },
    stateVersion: { type: Number, default: 0 },
    holdBlockId: id("ProviderCalendarBlock", { default: null }),
    holdExpiresAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ["CUSTOMER", "EXPERT", "SYSTEM", "OPS"] },
    cancelReasonCode: String,
    completedAt: Date,
  },
  opts("expert_consultations", false),
);
ProviderConsultationSchema.index(
  { customerUserId: 1, status: 1, scheduledStartAt: -1 },
  { name: "ix_consult_customer" },
);
ProviderConsultationSchema.index(
  { expertProviderId: 1, scheduledStartAt: 1, status: 1 },
  { name: "ix_consult_expert" },
);
ProviderConsultationSchema.index(
  { status: 1, holdExpiresAt: 1 },
  { name: "ix_consult_hold_expiry" },
);

// ------------------------------------------------ consultation_messages
/**
 * The conversation between a devotee and an acharya. One row per message so a
 * send is a plain insert and marking messages read is one atomic update; an
 * embedded array would let a read receipt overwrite a message sent at the same
 * moment. Readable only by the two parties to the consultation.
 */
export const ProviderConsultationMessageSchema = new Schema(
  {
    consultationId: id("ProviderConsultation", { required: true }),
    senderUserId: id("User", { required: true }),
    senderRole: { type: String, enum: ["CUSTOMER", "EXPERT"], required: true },
    senderName: { type: String, required: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 4000 },
    /** [{ url, name, mimeType }]: files already stored by the upload service. */
    attachments: { type: SchemaTypes.Mixed, default: [] },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "consultation_messages" },
);
ProviderConsultationMessageSchema.index(
  { consultationId: 1, createdAt: 1 },
  { name: "ix_cmessage_thread" },
);
ProviderConsultationMessageSchema.index(
  { consultationId: 1, readAt: 1 },
  { name: "ix_cmessage_unread" },
);

// ---------------------------------------------------- 7.53 idempotency_keys
export const ProviderIdempotencyKeySchema = new Schema(
  {
    key: { type: String, required: true },
    operation: { type: String, required: true },
    actorId: { type: String, required: true },
    requestHash: { type: String, required: true },
    state: { type: String, enum: ["IN_PROGRESS", "COMPLETED"], default: "IN_PROGRESS" },
    /** Replay data: { statusCode, body } or, for sensitive operations, { statusCode, resourceId }. */
    responseRef: { type: SchemaTypes.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  opts("idempotency_keys", false),
);
ProviderIdempotencyKeySchema.index(
  { key: 1, operation: 1, actorId: 1 },
  { unique: true, name: "ux_idempotency_scope" },
);
ProviderIdempotencyKeySchema.index(
  { expiresAt: 1 },
  { name: "ttl_idempotency", expireAfterSeconds: 0 },
);

export const PROVIDER_MODELS = [
  { name: "ProviderRitual", schema: ProviderRitualSchema },
  { name: "ProviderRitualVariant", schema: ProviderRitualVariantSchema },
  { name: "ProviderProfile", schema: ProviderProfileSchema },
  { name: "ProviderPrivateProfile", schema: ProviderPrivateProfileSchema },
  { name: "ProviderOffering", schema: ProviderOfferingSchema },
  { name: "ProviderVerificationCase", schema: ProviderVerificationCaseSchema },
  { name: "ProviderVerificationEvidence", schema: ProviderVerificationEvidenceSchema },
  { name: "ProviderAvailabilityRule", schema: ProviderAvailabilityRuleSchema },
  { name: "ProviderCalendarBlock", schema: ProviderCalendarBlockSchema },
  { name: "ProviderBooking", schema: ProviderBookingSchema },
  { name: "ProviderBookingStateHistory", schema: ProviderBookingStateHistorySchema },
  { name: "ProviderConsultation", schema: ProviderConsultationSchema },
  { name: "ProviderConsultationMessage", schema: ProviderConsultationMessageSchema },
  { name: "ProviderIdempotencyKey", schema: ProviderIdempotencyKeySchema },
];
