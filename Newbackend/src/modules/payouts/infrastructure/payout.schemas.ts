import { Schema, SchemaTypes } from "mongoose";
import { PAYOUT_MODES, PAYOUT_STATUSES } from "../domain/payout.constants";

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

export const PayoutBankAccountSchema = new Schema(
  {
    ashramId: id("Ashram", true),
    ownerId: id("User", true),
    accountHolderName: { type: String, required: true, trim: true },
    accountNumberCiphertext: { type: String, required: true, select: false },
    accountNumberIv: { type: String, required: true, select: false },
    accountNumberTag: { type: String, required: true, select: false },
    accountNumberLast4: { type: String, required: true },
    accountFingerprint: { type: String, required: true, select: false },
    ifsc: { type: String, required: true, uppercase: true, select: false },
    ifscPrefix: { type: String, required: true },
    beneficiaryEmail: String,
    beneficiaryPhone: String,
    providerContactId: { type: String, select: false },
    providerFundAccountId: { type: String, select: false },
    active: { type: Boolean, default: true },
    createdBy: id("User", true),
    updatedBy: id("User", true),
  },
  opts("payout_bank_accounts"),
);
PayoutBankAccountSchema.index(
  { ownerId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
PayoutBankAccountSchema.index({ ashramId: 1, active: 1 });

export const PayoutRequestSchema = new Schema(
  {
    payoutReference: { type: String, required: true, unique: true },
    ashramId: id("Ashram", true),
    ownerId: id("User", true),
    bankAccountId: id("PayoutBankAccount", true),
    commissionIds: [{ type: SchemaTypes.ObjectId, ref: "BookingCommission" }],
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    mode: { type: String, enum: PAYOUT_MODES, required: true },
    status: { type: String, enum: PAYOUT_STATUSES, default: "pending", index: true },
    clientRequestId: { type: String, required: true },
    providerIdempotencyKey: { type: String, required: true, unique: true, select: false },
    provider: { type: String, default: "razorpayx" },
    providerPayoutId: { type: String, sparse: true, unique: true },
    providerStatus: String,
    providerUtr: String,
    settlementMethod: {
      type: String,
      enum: ["razorpayx", "manual_bank_transfer"],
      default: "razorpayx",
    },
    manualPaymentReference: { type: String, sparse: true, unique: true },
    manualPaymentIdempotencyKeyHash: {
      type: String,
      sparse: true,
      unique: true,
      select: false,
    },
    manualPaymentNote: { type: String, maxlength: 500, select: false },
    failureReason: String,
    requestedBy: id("User", true),
    processedBy: id("User"),
    requestedAt: { type: Date, default: Date.now },
    processingAt: Date,
    paidAt: Date,
    failedAt: Date,
    lastReconciledAt: Date,
  },
  opts("payout_requests"),
);
PayoutRequestSchema.index({ requestedBy: 1, clientRequestId: 1 }, { unique: true });
PayoutRequestSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
PayoutRequestSchema.index({ ownerId: 1, createdAt: -1 });

export const PayoutTransactionSchema = new Schema(
  {
    payoutId: id("PayoutRequest", true),
    ashramId: id("Ashram", true),
    ownerId: id("User", true),
    type: { type: String, required: true },
    amount: Number,
    status: String,
    providerPayoutId: String,
    idempotencyKeyHash: String,
    details: SchemaTypes.Mixed,
    occurredAt: { type: Date, default: Date.now },
  },
  opts("payout_transactions"),
);
PayoutTransactionSchema.index({ payoutId: 1, occurredAt: -1 });

export const PayoutAuditLogSchema = new Schema(
  {
    payoutId: id("PayoutRequest"),
    bankAccountId: id("PayoutBankAccount"),
    ashramId: id("Ashram", true),
    actorId: id("User"),
    action: { type: String, required: true },
    before: SchemaTypes.Mixed,
    after: SchemaTypes.Mixed,
    requestId: String,
    occurredAt: { type: Date, default: Date.now },
  },
  opts("payout_audit_logs"),
);
PayoutAuditLogSchema.index({ ashramId: 1, occurredAt: -1 });
PayoutAuditLogSchema.index({ payoutId: 1, occurredAt: -1 });

export const PayoutWebhookSchema = new Schema(
  {
    provider: { type: String, default: "razorpayx" },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    providerPayoutId: String,
    status: { type: String, enum: ["received", "processed", "ignored", "failed"] },
    error: String,
    processedAt: Date,
  },
  opts("payout_webhooks"),
);
PayoutWebhookSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const PAYOUT_MODELS = [
  { name: "PayoutBankAccount", schema: PayoutBankAccountSchema },
  { name: "PayoutRequest", schema: PayoutRequestSchema },
  { name: "PayoutTransaction", schema: PayoutTransactionSchema },
  { name: "PayoutAuditLog", schema: PayoutAuditLogSchema },
  { name: "PayoutWebhook", schema: PayoutWebhookSchema },
];
