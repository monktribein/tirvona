import { Schema, SchemaTypes } from "mongoose";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});

const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

/**
 * The revenue streams a refund can apply to.
 *
 * Each one settles through a different domain, so the policy, the source
 * record and the gateway reference are all resolved per module rather than
 * assumed to be a booking.
 */
export const REFUND_MODULES = [
  "ashram_booking",
  "parking_booking",
  "marketplace_order",
  "donation",
  "service_booking",
] as const;

/**
 * The refund lifecycle.
 *
 * `processing` is distinct from `approved` on purpose: approval is a human
 * decision, processing means money is moving at the gateway. A request that
 * fails at the gateway returns to `failed` and stays retryable rather than
 * collapsing back to approved, so an operator can always tell "nobody has
 * pressed the button yet" apart from "the bank rejected it".
 */
export const REFUND_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "processing",
  "refunded",
  "failed",
  "rejected",
  "cancelled",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Transitions the state machine permits. Anything else is rejected. */
export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  pending: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["processing", "cancelled", "failed"],
  processing: ["refunded", "failed"],
  // A failed gateway attempt is retryable, so it may go back to processing.
  failed: ["processing", "rejected", "cancelled"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

// ── Policies ────────────────────────────────────────────────────────────────
/**
 * A refund policy.
 *
 * Resolution is most-specific-first: an ashram-scoped policy beats a
 * module-wide one, which beats the global default. Exactly one policy applies
 * to any given refund, and the one that was used is snapshotted onto the
 * calculation so a later policy edit never rewrites a settled refund.
 */
export const RefundPolicySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    module: {
      type: String,
      enum: [...REFUND_MODULES, "global"],
      required: true,
      index: true,
    },
    /** Narrower scope than `module`; null means the whole module. */
    ashramId: id("Ashram"),
    isActive: { type: Boolean, default: true, index: true },
    /** Higher wins when two policies match at the same scope. */
    priority: { type: Number, default: 0 },

    /**
     * Refund percentage by how long before the service date the request is
     * made. Evaluated most-generous-window-first; the first window whose
     * `hoursBefore` threshold is met applies.
     */
    cancellationWindows: [
      {
        label: { type: String, default: "" },
        hoursBefore: { type: Number, required: true, min: 0 },
        refundPercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    /** Applied when the request falls outside every window above. */
    defaultRefundPercent: { type: Number, default: 0, min: 0, max: 100 },

    processingFee: {
      type: { type: String, enum: ["none", "flat", "percent"], default: "none" },
      value: { type: Number, default: 0, min: 0 },
      /** Never take more than this in fees, whatever the percentage yields. */
      maxAmount: { type: Number, default: 0, min: 0 },
    },

    /**
     * Whether the platform fee and the GST charged on it come back.
     *
     * GST on the platform fee is remitted to the government, so returning it
     * is a real cost to the business — it is opt-in, and defaults to keeping
     * the fee while refunding the tax only when the fee itself is refunded.
     */
    refundPlatformFee: { type: Boolean, default: false },
    refundGst: { type: Boolean, default: false },
    /** Add-ons and donations are frequently non-refundable; both are explicit. */
    refundAddOns: { type: Boolean, default: true },
    refundDonation: { type: Boolean, default: false },

    /** Auto-approve at or below this amount. 0 disables auto-approval. */
    autoApproveBelow: { type: Number, default: 0, min: 0 },
    /** Requests at or above this need a second approver. */
    requiresSecondApprovalAbove: { type: Number, default: 0, min: 0 },
    /** Hours after the service date beyond which no refund is possible. */
    claimWindowHours: { type: Number, default: 0, min: 0 },

    createdBy: id("User"),
    updatedBy: id("User"),
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  opts("refund_policies"),
);
RefundPolicySchema.index({ module: 1, ashramId: 1, isActive: 1, isDeleted: 1 });
RefundPolicySchema.index({ module: 1, priority: -1 });

// ── Requests ────────────────────────────────────────────────────────────────
export const RefundRequestSchema = new Schema(
  {
    refundNumber: { type: String, required: true, unique: true },
    module: { type: String, enum: REFUND_MODULES, required: true, index: true },
    /** The booking / order / donation this refund is against. */
    sourceId: { type: SchemaTypes.ObjectId, required: true, index: true },
    sourceReference: { type: String, default: "" },
    customerId: id("User", true),
    /** Set for ashram-scoped modules so owner queues can be filtered. */
    ashramId: id("Ashram"),

    reason: { type: String, required: true },
    customerNote: { type: String, default: "" },
    requestedAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: "pending",
      index: true,
    },
    calculationId: id("RefundCalculation"),
    policyId: id("RefundPolicy"),

    requestedBy: id("User", true),
    reviewedBy: id("User"),
    reviewedAt: Date,
    approvedBy: id("User"),
    approvedAt: Date,
    secondApprovedBy: id("User"),
    rejectedBy: id("User"),
    rejectedAt: Date,
    rejectionReason: { type: String, default: "" },
    /** True when a policy rule approved it rather than a person. */
    autoApproved: { type: Boolean, default: false },

    settledAt: Date,
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  opts("refund_requests"),
);
RefundRequestSchema.index({ status: 1, createdAt: -1 });
RefundRequestSchema.index({ customerId: 1, createdAt: -1 });
RefundRequestSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
RefundRequestSchema.index({ module: 1, status: 1, createdAt: -1 });
// One open request per source: a second claim on the same booking while one is
// still in flight would let the same money be refunded twice.
RefundRequestSchema.index(
  { module: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "under_review", "approved", "processing"] },
    },
  },
);

// ── Calculations ────────────────────────────────────────────────────────────
/**
 * The full financial breakdown behind one refund, with the policy snapshotted.
 *
 * Stored rather than recomputed so the figure a customer was told, the figure
 * an approver saw and the figure actually sent to the gateway are provably the
 * same number — even after the policy changes.
 */
export const RefundCalculationSchema = new Schema(
  {
    requestId: id("RefundRequest", true),
    policyId: id("RefundPolicy"),
    policySnapshot: { type: SchemaTypes.Mixed, default: {} },

    originalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0 },

    breakdown: {
      baseAmount: { type: Number, default: 0 },
      addOnsAmount: { type: Number, default: 0 },
      donationAmount: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
    },
    refundableComponents: {
      base: { type: Number, default: 0 },
      addOns: { type: Number, default: 0 },
      donation: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
    },

    appliedWindow: {
      label: String,
      hoursBefore: Number,
      refundPercent: Number,
    },
    hoursBeforeService: { type: Number, default: 0 },
    refundPercent: { type: Number, default: 0 },

    grossRefundable: { type: Number, default: 0, min: 0 },
    processingFee: { type: Number, default: 0, min: 0 },
    netRefundable: { type: Number, default: 0, min: 0 },
    nonRefundableAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
    /** Human-readable trace of how the number was reached. */
    notes: [{ type: String }],
  },
  opts("refund_calculations"),
);
RefundCalculationSchema.index({ requestId: 1 }, { unique: true });

// ── Transactions ────────────────────────────────────────────────────────────
/**
 * One row per gateway attempt.
 *
 * `idempotencyKey` is unique, which is what makes a retried approval or a
 * replayed webhook harmless: the second attempt collides instead of issuing a
 * second refund.
 */
export const RefundTransactionSchema = new Schema(
  {
    requestId: id("RefundRequest", true),
    idempotencyKey: { type: String, required: true, unique: true },
    provider: { type: String, default: "razorpay" },
    /** How the customer originally paid, so the money returns the same way. */
    method: { type: String, default: "razorpay" },
    gatewayPaymentId: String,
    gatewayRefundId: { type: String, index: true, sparse: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["initiated", "processing", "succeeded", "failed"],
      default: "initiated",
      index: true,
    },
    attempt: { type: Number, default: 1, min: 1 },
    failureReason: { type: String, default: "" },
    gatewayResponse: { type: SchemaTypes.Mixed, default: {} },
    initiatedBy: id("User"),
    settledAt: Date,
  },
  opts("refund_transactions"),
);
RefundTransactionSchema.index({ requestId: 1, createdAt: -1 });

// ── Status history ──────────────────────────────────────────────────────────
export const RefundStatusHistorySchema = new Schema(
  {
    requestId: id("RefundRequest", true),
    fromStatus: String,
    toStatus: { type: String, required: true },
    note: { type: String, default: "" },
    actorId: id("User"),
    actorRole: String,
    occurredAt: { type: Date, default: Date.now },
  },
  opts("refund_status_history"),
);
RefundStatusHistorySchema.index({ requestId: 1, occurredAt: 1 });

// ── Audit log ───────────────────────────────────────────────────────────────
export const RefundAuditLogSchema = new Schema(
  {
    requestId: id("RefundRequest"),
    policyId: id("RefundPolicy"),
    action: { type: String, required: true, index: true },
    actorId: id("User"),
    actorRole: String,
    before: { type: SchemaTypes.Mixed },
    after: { type: SchemaTypes.Mixed },
    ipAddress: String,
    userAgent: String,
    requestIdHeader: String,
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  opts("refund_audit_logs"),
);
RefundAuditLogSchema.index({ requestId: 1, occurredAt: -1 });
RefundAuditLogSchema.index({ action: 1, occurredAt: -1 });

// ── Documents ───────────────────────────────────────────────────────────────
export const RefundDocumentSchema = new Schema(
  {
    requestId: id("RefundRequest", true),
    label: { type: String, default: "" },
    url: { type: String, required: true },
    mimeType: String,
    sizeBytes: Number,
    uploadedBy: id("User"),
    isDeleted: { type: Boolean, default: false },
  },
  opts("refund_documents"),
);
RefundDocumentSchema.index({ requestId: 1, isDeleted: 1 });

// ── Webhooks ────────────────────────────────────────────────────────────────
/**
 * Raw gateway callbacks, stored before they are acted on.
 *
 * `eventId` is unique so a provider replaying the same event — which Razorpay
 * does on delivery failure — cannot apply it twice.
 */
export const RefundWebhookSchema = new Schema(
  {
    provider: { type: String, default: "razorpay" },
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, index: true },
    gatewayRefundId: { type: String, index: true, sparse: true },
    requestId: id("RefundRequest"),
    payload: { type: SchemaTypes.Mixed, default: {} },
    signatureValid: { type: Boolean, default: false },
    processedAt: Date,
    processingError: String,
  },
  opts("refund_webhooks"),
);
RefundWebhookSchema.index({ processedAt: 1, createdAt: -1 });

export const REFUND_MODELS = [
  { name: "RefundPolicy", schema: RefundPolicySchema },
  { name: "RefundRequest", schema: RefundRequestSchema },
  { name: "RefundCalculation", schema: RefundCalculationSchema },
  { name: "RefundTransaction", schema: RefundTransactionSchema },
  { name: "RefundStatusHistory", schema: RefundStatusHistorySchema },
  { name: "RefundAuditLog", schema: RefundAuditLogSchema },
  { name: "RefundDocument", schema: RefundDocumentSchema },
  { name: "RefundWebhook", schema: RefundWebhookSchema },
];
