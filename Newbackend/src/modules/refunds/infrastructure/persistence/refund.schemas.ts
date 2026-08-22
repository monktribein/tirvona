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

export const REFUND_MODULES = [
  "ashram_booking",
  "parking_booking",
  "marketplace_order",
  "donation",
  "service_booking",
] as const;

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

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  pending: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["processing", "cancelled", "failed"],
  processing: ["refunded", "failed"],
  failed: ["processing", "rejected", "cancelled"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

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
    ashramId: id("Ashram"),
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },

    cancellationWindows: [
      {
        label: { type: String, default: "" },
        hoursBefore: { type: Number, required: true, min: 0 },
        refundPercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    defaultRefundPercent: { type: Number, default: 0, min: 0, max: 100 },

    processingFee: {
      type: { type: String, enum: ["none", "flat", "percent"], default: "none" },
      value: { type: Number, default: 0, min: 0 },
      maxAmount: { type: Number, default: 0, min: 0 },
    },

    refundPlatformFee: { type: Boolean, default: false },
    refundGst: { type: Boolean, default: false },
    refundAddOns: { type: Boolean, default: true },
    refundDonation: { type: Boolean, default: false },

    autoApproveBelow: { type: Number, default: 0, min: 0 },
    requiresSecondApprovalAbove: { type: Number, default: 0, min: 0 },
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

export const RefundRequestSchema = new Schema(
  {
    refundNumber: { type: String, required: true, unique: true },
    module: { type: String, enum: REFUND_MODULES, required: true, index: true },
    sourceId: { type: SchemaTypes.ObjectId, required: true, index: true },
    sourceReference: { type: String, default: "" },
    customerId: id("User", true),
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
RefundRequestSchema.index(
  { module: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "under_review", "approved", "processing"] },
    },
  },
);

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
    notes: [{ type: String }],
  },
  opts("refund_calculations"),
);
RefundCalculationSchema.index({ requestId: 1 }, { unique: true });

export const RefundTransactionSchema = new Schema(
  {
    requestId: id("RefundRequest", true),
    idempotencyKey: { type: String, required: true, unique: true },
    provider: { type: String, default: "razorpay" },
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
