import { Schema, SchemaTypes } from "mongoose";
import { AARTI_PAYMENT_STATUSES } from "../../domain/aarti.constants";

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

export const AartiPaymentSchema = new Schema(
  {
    bookingId: id("AartiBooking", true),
    userId: { ...id("User", true), index: true },
    ashramId: id("Ashram"),
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    purpose: {
      type: String,
      enum: ["booking", "donation"],
      default: "booking",
    },
    method: {
      type: String,
      enum: ["razorpay", "upi", "card", "netbanking", "wallet", "cash", "demo"],
      default: "razorpay",
    },
    status: {
      type: String,
      enum: AARTI_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    transactionId: { type: String, default: "", index: true },
    gateway: {
      orderId: String,
      paymentId: String,
      signature: { type: String, select: false },
      provider: { type: String, default: "razorpay" },
    },
    failureReason: String,
    paidAt: Date,
    refund: {
      amount: { type: Number, default: 0 },
      reference: String,
      at: Date,
      by: id("User"),
      reason: String,
    },
    ipAddress: String,
  },
  opts("aarti_payments"),
);
AartiPaymentSchema.index({ bookingId: 1, status: 1 });
AartiPaymentSchema.index({ ashramId: 1, status: 1, paidAt: -1 });
AartiPaymentSchema.index({ "gateway.orderId": 1 });
AartiPaymentSchema.index(
  { "gateway.paymentId": 1 },
  { unique: true, sparse: true },
);

export const AartiTransactionSchema = new Schema(
  {
    bookingId: { ...id("AartiBooking"), index: true },
    paymentId: { ...id("AartiPayment"), index: true },
    ashramId: id("Ashram"),
    sessionId: id("AartiSession"),
    type: {
      type: String,
      enum: ["booking", "donation", "refund", "commission", "payout"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    description: String,
    reference: { type: String, required: true, unique: true },
    meta: { type: SchemaTypes.Mixed, default: {} },
    recordedBy: id("User"),
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  opts("aarti_transactions"),
);
AartiTransactionSchema.index({ ashramId: 1, type: 1, occurredAt: -1 });
AartiTransactionSchema.index({ sessionId: 1, occurredAt: -1 });
AartiTransactionSchema.index({ type: 1, occurredAt: -1 });

export const AartiCommissionSchema = new Schema(
  {
    bookingId: { ...id("AartiBooking", true), unique: true },
    ashramId: id("Ashram", true),
    sessionId: { ...id("AartiSession", true), index: true },
    grossAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    ashramEarning: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    settlementStatus: {
      type: String,
      enum: ["pending", "processing", "settled", "on_hold", "reversed"],
      default: "pending",
      index: true,
    },
    settledAt: Date,
    settlementReference: String,
    payoutBatchId: { type: String, default: "", index: true },
    reversedAt: Date,
    reversalReason: String,
    notes: String,
  },
  opts("aarti_commissions"),
);
AartiCommissionSchema.index({
  ashramId: 1,
  settlementStatus: 1,
  createdAt: 1,
});
AartiCommissionSchema.index({ settlementStatus: 1, createdAt: -1 });
