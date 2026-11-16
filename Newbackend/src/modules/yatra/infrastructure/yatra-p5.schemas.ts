import { Schema, SchemaTypes } from "../../../database/orm";
import {
  CHARTER_STATUSES,
  COMMISSION_APPLIES_TO,
  COMMISSION_CHANNELS,
  COMMISSION_RULE_STATUSES,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_SUBJECTS,
  PAYEE_ENTRY_TYPES,
  PAYEE_TYPES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  RECONCILIATION_KINDS,
  RIDE_PARTNER_STATUSES,
  RIDE_STATUSES,
  RIDE_TYPES,
  YATRA_MODEL,
} from "../domain/yatra.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});
const opts = (collection: string) => ({ timestamps: true, collection, optimisticConcurrency: true });
const historyEntry = {
  status: { type: String, default: "" },
  note: { type: String, default: "" },
  by: id("User"),
  at: { type: Date, default: () => new Date() },
};

/** A local transport partner (cab, tempo traveller, e-rickshaw) owned by one Tirvona account. */
export const YatraRidePartnerSchema = new Schema(
  {
    ownerUserId: id("User", true),
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, default: "", trim: true },
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    city: { type: String, default: "", trim: true },
    serviceAreas: [{ type: String, trim: true }],
    serviceAreaKeys: [{ type: String }],
    // [{ id, registrationNumber, vehicleType, seats, isAc }] — always $set as a whole.
    vehicles: { type: SchemaTypes.Mixed, default: [] },
    availability: {
      weekdays: [{ type: Number }],
      startTime: { type: String, default: "06:00" },
      endTime: { type: String, default: "22:00" },
      accepting: { type: Boolean, default: true },
    },
    kyc: {
      panNumber: { type: String, default: "", uppercase: true, trim: true },
      drivingLicenceNumber: { type: String, default: "", uppercase: true, trim: true },
    },
    payout: {
      accountHolderName: { type: String, default: "" },
      accountNumberEncrypted: { type: SchemaTypes.Mixed, default: null, select: false },
      accountNumberLast4: { type: String, default: "" },
      ifsc: { type: String, default: "", uppercase: true },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
    },
    status: { type: String, enum: RIDE_PARTNER_STATUSES, default: "draft" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: id("User"),
    reviewNote: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
  },
  opts("yatra_ride_partners"),
);
YatraRidePartnerSchema.index({ ownerUserId: 1 }, { unique: true });
YatraRidePartnerSchema.index({ status: 1, createdAt: -1 });
YatraRidePartnerSchema.index({ serviceAreaKeys: 1, status: 1 });

/** A local ride requested from a journey. */
export const YatraRideRequestSchema = new Schema(
  {
    requestNumber: { type: String, required: true },
    journeyId: id(YATRA_MODEL.Journey, true),
    bookingId: id(YATRA_MODEL.Booking, true),
    customerId: id("User", true),
    operatorId: id(YATRA_MODEL.Operator),
    partnerId: id(YATRA_MODEL.RidePartner),
    partnerName: { type: String, default: "" },
    partnerAssignedAt: { type: Date, default: null },
    city: { type: String, default: "" },
    cityKey: { type: String, default: "" },
    rideType: { type: String, enum: RIDE_TYPES, default: "any" },
    pickup: { address: { type: String, default: "" }, landmark: { type: String, default: "" } },
    drop: { address: { type: String, default: "" }, landmark: { type: String, default: "" } },
    pickupAt: { type: Date, required: true },
    passengers: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: "" },
    status: { type: String, enum: RIDE_STATUSES, default: "requested" },
    quotedAmount: { type: Number, default: 0, min: 0 },
    quotedAt: { type: Date, default: null },
    quotedBy: id("User"),
    partnerNote: { type: String, default: "" },
    assignment: {
      vehicleRegistration: { type: String, default: "" },
      vehicleType: { type: String, default: "" },
      driverName: { type: String, default: "" },
      driverPhone: { type: String, default: "" },
    },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: id("User"),
    cancelledByRole: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    commissionSnapshot: { type: SchemaTypes.Mixed, default: null },
    history: [historyEntry],
  },
  opts("yatra_ride_requests"),
);
YatraRideRequestSchema.index({ requestNumber: 1 }, { unique: true });
YatraRideRequestSchema.index({ journeyId: 1, createdAt: -1 });
YatraRideRequestSchema.index({ partnerId: 1, status: 1, pickupAt: 1 });
YatraRideRequestSchema.index({ status: 1, partnerAssignedAt: 1 });
YatraRideRequestSchema.index({ cityKey: 1, pickupAt: 1 });

/**
 * A commission rule. Rules are never edited: a change retires the active
 * version and creates the next one, and every booking keeps a snapshot of
 * the version that applied when it was created.
 */
export const YatraCommissionRuleSchema = new Schema(
  {
    ruleKey: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    name: { type: String, default: "", trim: true },
    appliesTo: { type: String, enum: COMMISSION_APPLIES_TO, required: true },
    channel: { type: String, enum: COMMISSION_CHANNELS, default: "any" },
    operatorId: id(YATRA_MODEL.Operator),
    ridePartnerId: id(YATRA_MODEL.RidePartner),
    commissionBps: { type: Number, required: true, min: 0, max: 10000 },
    flatFee: { type: Number, default: 0, min: 0 },
    taxOnCommissionBps: { type: Number, default: 0, min: 0, max: 10000 },
    tdsBps: { type: Number, default: 0, min: 0, max: 10000 },
    status: { type: String, enum: COMMISSION_RULE_STATUSES, default: "active" },
    effectiveFrom: { type: Date, default: () => new Date() },
    retiredAt: { type: Date, default: null },
    createdBy: id("User"),
    retiredBy: id("User"),
    note: { type: String, default: "" },
  },
  opts("yatra_commission_rules"),
);
YatraCommissionRuleSchema.index({ ruleKey: 1, version: 1 }, { unique: true });
YatraCommissionRuleSchema.index({ ruleKey: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
YatraCommissionRuleSchema.index({ appliesTo: 1, status: 1 });

/** The payee ledger (organisers and ride partners). Append-only; balances are summed. */
export const YatraPayeeEntrySchema = new Schema(
  {
    payeeType: { type: String, enum: PAYEE_TYPES, required: true },
    payeeId: { type: SchemaTypes.ObjectId, required: true },
    entryType: { type: String, enum: PAYEE_ENTRY_TYPES, required: true },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    bookingId: id(YATRA_MODEL.Booking),
    serviceRequestId: id(YATRA_MODEL.ServiceRequest),
    rideRequestId: id(YATRA_MODEL.RideRequest),
    payoutId: id(YATRA_MODEL.Payout),
    reference: { type: String, default: "" },
    source: { type: String, default: "" },
    ruleSnapshot: { type: SchemaTypes.Mixed, default: null },
    // Earnings become payable once the service is delivered (journey or ride completed).
    eligibleAt: { type: Date, default: () => new Date() },
    description: { type: String, default: "" },
    idempotencyKey: { type: String, required: true },
    recordedBy: id("User"),
  },
  opts("yatra_payee_entries"),
);
YatraPayeeEntrySchema.index({ idempotencyKey: 1 }, { unique: true });
YatraPayeeEntrySchema.index({ payeeType: 1, payeeId: 1, createdAt: -1 });
YatraPayeeEntrySchema.index({ bookingId: 1 });
YatraPayeeEntrySchema.index({ rideRequestId: 1 });
YatraPayeeEntrySchema.index({ payoutId: 1 });

/**
 * A manual payout. Finance reviews it, approves it, pays the payee outside
 * Tirvona (bank transfer / UPI) and records the transfer with its UTR and
 * proof; reconciliation confirms it against the bank statement. Nothing in
 * the system initiates or completes a bank transfer.
 */
export const YatraPayoutSchema = new Schema(
  {
    payoutNumber: { type: String, required: true },
    payeeType: { type: String, enum: PAYEE_TYPES, required: true },
    payeeId: { type: SchemaTypes.ObjectId, required: true },
    payeeName: { type: String, default: "" },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PAYOUT_STATUSES, default: "pending" },
    requestedBy: id("User"),
    requestedByRole: { type: String, default: "payee" },
    requestNote: { type: String, default: "" },
    bankSnapshot: { type: SchemaTypes.Mixed, default: null },
    reviewedBy: id("User"),
    reviewedAt: { type: Date, default: null },
    approvedBy: id("User"),
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    // Set only when Finance records a completed transfer.
    transfer: { type: SchemaTypes.Mixed, default: null },
    reconciliation: { type: SchemaTypes.Mixed, default: null },
    cancelledAt: { type: Date, default: null },
    history: [historyEntry],
  },
  opts("yatra_payouts"),
);
YatraPayoutSchema.index({ payoutNumber: 1 }, { unique: true });
YatraPayoutSchema.index({ payeeType: 1, payeeId: 1, createdAt: -1 });
YatraPayoutSchema.index({ status: 1, createdAt: -1 });
// One open payout per payee at a time: no double requests against the same balance.
YatraPayoutSchema.index(
  { payeeId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "under_review", "approved"] } } },
);
// A bank reference (UTR) can be recorded against one payout only.
YatraPayoutSchema.index({ "transfer.reference": 1 }, { unique: true, sparse: true });

/** One run of Razorpay settlement reconciliation for a day. Separate from payout reconciliation. */
export const YatraReconciliationSchema = new Schema(
  {
    kind: { type: String, enum: RECONCILIATION_KINDS, default: "razorpay_settlement" },
    periodDate: { type: String, required: true },
    status: { type: String, enum: ["completed", "skipped", "failed"], default: "completed" },
    checkedCount: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    settledCount: { type: Number, default: 0 },
    settledAmount: { type: Number, default: 0 },
    collectedAmount: { type: Number, default: 0 },
    mismatches: { type: SchemaTypes.Mixed, default: [] },
    note: { type: String, default: "" },
    ranBy: id("User"),
    ranAt: { type: Date, default: () => new Date() },
  },
  opts("yatra_reconciliations"),
);
YatraReconciliationSchema.index({ kind: 1, periodDate: 1 }, { unique: true });

/** An incident or service issue, raised by a pilgrim, partner, organiser or Destination Ops. */
export const YatraIssueSchema = new Schema(
  {
    issueNumber: { type: String, required: true },
    city: { type: String, default: "" },
    cityKey: { type: String, default: "" },
    category: { type: String, enum: ISSUE_CATEGORIES, default: "other" },
    severity: { type: String, enum: ISSUE_SEVERITIES, default: "medium" },
    subjectType: { type: String, enum: ISSUE_SUBJECTS, default: "none" },
    subjectId: { type: SchemaTypes.ObjectId, default: null },
    journeyId: id(YATRA_MODEL.Journey),
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    reportedBy: id("User"),
    reportedByRole: { type: String, default: "" },
    status: { type: String, enum: ISSUE_STATUSES, default: "open" },
    assignedTo: id("User"),
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: id("User"),
    history: [historyEntry],
  },
  opts("yatra_issues"),
);
YatraIssueSchema.index({ issueNumber: 1 }, { unique: true });
YatraIssueSchema.index({ cityKey: 1, status: 1, createdAt: -1 });
YatraIssueSchema.index({ status: 1, createdAt: -1 });
YatraIssueSchema.index({ subjectId: 1 });

/** A pilgrim's rating of a finished trip: one per booking, for the partner that ran it. */
export const YatraRatingSchema = new Schema(
  {
    bookingId: id(YATRA_MODEL.Booking, true),
    departureId: id(YATRA_MODEL.Departure, true),
    tourId: id(YATRA_MODEL.Tour, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    vehicleId: id(YATRA_MODEL.Vehicle),
    customerId: id("User", true),
    // First name only: reviews are shown publicly.
    customerName: { type: String, default: "" },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
    tags: [{ type: String }],
    status: { type: String, enum: ["visible", "hidden"], default: "visible" },
  },
  opts("yatra_ratings"),
);
YatraRatingSchema.index({ bookingId: 1 }, { unique: true });
YatraRatingSchema.index({ operatorId: 1, status: 1, createdAt: -1 });
YatraRatingSchema.index({ departureId: 1 });

/** The latest position of a bus whose driver is sharing it. One row per departure; nothing is kept after sharing stops. */
export const YatraTripLocationSchema = new Schema(
  {
    departureId: id(YATRA_MODEL.Departure, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    status: { type: String, enum: ["sharing", "stopped"], default: "stopped" },
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    accuracyM: { type: Number, default: null },
    speedKmph: { type: Number, default: null },
    heading: { type: Number, default: null },
    recordedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
    sharedBy: id("User"),
    sharedByName: { type: String, default: "" },
  },
  opts("yatra_trip_locations"),
);
YatraTripLocationSchema.index({ departureId: 1 }, { unique: true });

/** A pilgrim's request to book the whole bus; the partner accepts (holding every seat for payment) or declines. */
export const YatraCharterRequestSchema = new Schema(
  {
    requestNumber: { type: String, required: true },
    departureId: id(YATRA_MODEL.Departure, true),
    tourId: id(YATRA_MODEL.Tour, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    customerId: id("User", true),
    contactName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    groupSize: { type: Number, default: 0, min: 0 },
    message: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: CHARTER_STATUSES, default: "requested" },
    organiserNote: { type: String, default: "" },
    respondedBy: id("User"),
    respondedAt: { type: Date, default: null },
    bookingId: id(YATRA_MODEL.Booking),
    history: [historyEntry],
  },
  opts("yatra_charter_requests"),
);
YatraCharterRequestSchema.index({ requestNumber: 1 }, { unique: true });
YatraCharterRequestSchema.index({ operatorId: 1, status: 1, createdAt: -1 });
YatraCharterRequestSchema.index({ customerId: 1, createdAt: -1 });
// One open request per pilgrim per departure.
YatraCharterRequestSchema.index({ departureId: 1, customerId: 1 }, { unique: true, partialFilterExpression: { status: "requested" } });

export const YATRA_P5_SCHEMAS = [
  [YATRA_MODEL.RidePartner, YatraRidePartnerSchema],
  [YATRA_MODEL.RideRequest, YatraRideRequestSchema],
  [YATRA_MODEL.CommissionRule, YatraCommissionRuleSchema],
  [YATRA_MODEL.PayeeEntry, YatraPayeeEntrySchema],
  [YATRA_MODEL.Payout, YatraPayoutSchema],
  [YATRA_MODEL.Reconciliation, YatraReconciliationSchema],
  [YATRA_MODEL.Issue, YatraIssueSchema],
  [YATRA_MODEL.Rating, YatraRatingSchema],
  [YATRA_MODEL.TripLocation, YatraTripLocationSchema],
  [YATRA_MODEL.CharterRequest, YatraCharterRequestSchema],
] as const;
