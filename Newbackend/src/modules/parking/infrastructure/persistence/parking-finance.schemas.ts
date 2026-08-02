import { Schema, SchemaTypes } from "mongoose";
import { PARKING_PAYMENT_STATUSES } from "../../domain/parking.constants";

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

export const ParkingPaymentSchema = new Schema(
  {
    bookingId: id("ParkingBooking", true),
    userId: { ...id("User", true), index: true },
    partnerId: id("ParkingPartner"),
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    purpose: {
      type: String,
      enum: ["booking", "overstay"],
      default: "booking",
    },
    method: {
      type: String,
      enum: ["razorpay", "upi", "card", "netbanking", "wallet", "cash", "demo"],
      default: "razorpay",
    },
    status: {
      type: String,
      enum: PARKING_PAYMENT_STATUSES,
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
  opts("parking_payments"),
);
ParkingPaymentSchema.index({ bookingId: 1, status: 1 });
ParkingPaymentSchema.index({ partnerId: 1, status: 1, paidAt: -1 });
ParkingPaymentSchema.index({ "gateway.orderId": 1 });
ParkingPaymentSchema.index(
  { "gateway.paymentId": 1 },
  { unique: true, sparse: true },
);

export const ParkingTransactionSchema = new Schema(
  {
    bookingId: { ...id("ParkingBooking"), index: true },
    paymentId: { ...id("ParkingPayment"), index: true },
    partnerId: id("ParkingPartner"),
    locationId: id("ParkingLocation"),
    type: {
      type: String,
      enum: ["booking", "overstay", "refund", "commission", "payout"],
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
  opts("parking_transactions"),
);
ParkingTransactionSchema.index({ partnerId: 1, type: 1, occurredAt: -1 });
ParkingTransactionSchema.index({ locationId: 1, occurredAt: -1 });
ParkingTransactionSchema.index({ type: 1, occurredAt: -1 });

export const ParkingCommissionSchema = new Schema(
  {
    bookingId: { ...id("ParkingBooking", true), unique: true },
    partnerId: id("ParkingPartner", true),
    locationId: { ...id("ParkingLocation", true), index: true },
    grossAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    partnerEarning: { type: Number, required: true, min: 0 },
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
  opts("parking_commissions"),
);
ParkingCommissionSchema.index({
  partnerId: 1,
  settlementStatus: 1,
  createdAt: 1,
});
ParkingCommissionSchema.index({ settlementStatus: 1, createdAt: -1 });
