import { Schema, SchemaTypes } from "mongoose";
import {
  WALLET_HOLD_STATUSES,
  WALLET_MODULES,
  WALLET_TXN_CATEGORIES,
  WITHDRAWAL_METHODS,
  WITHDRAWAL_STATUSES,
} from "../domain/wallet.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});

const opts = (collection: string) => ({ timestamps: true, collection });

/**
 * One wallet per pilgrim account. `balance` is what can be spent right now;
 * money parked against an open checkout sits in `heldAmount`, and money
 * waiting for an admin bank transfer sits in `pendingWithdrawal`. None of the
 * three can go negative, which is what the conditional `$inc` updates in
 * `WalletService` rely on.
 */
export const PilgrimWalletSchema = new Schema(
  {
    userId: { ...id("User", true), unique: true },
    balance: { type: Number, default: 0, min: 0 },
    heldAmount: { type: Number, default: 0, min: 0 },
    pendingWithdrawal: { type: Number, default: 0, min: 0 },
    totalCredited: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
  },
  opts("pilgrim_wallets"),
);
PilgrimWalletSchema.index({ balance: -1 });

/** The append-only statement a pilgrim and an admin both read. */
export const PilgrimWalletTransactionSchema = new Schema(
  {
    walletId: id("PilgrimWallet", true),
    userId: { ...id("User", true), index: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    category: { type: String, enum: WALLET_TXN_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, default: 0 },
    module: { type: String, enum: WALLET_MODULES, required: true },
    sourceId: { type: SchemaTypes.ObjectId, default: null },
    reference: { type: String, default: "" },
    description: { type: String, default: "" },
    idempotencyKey: { type: String, required: true, unique: true },
    actorId: id("User"),
    actorRole: { type: String, default: "system" },
  },
  opts("pilgrim_wallet_transactions"),
);
PilgrimWalletTransactionSchema.index({ userId: 1, createdAt: -1 });
PilgrimWalletTransactionSchema.index({ category: 1, createdAt: -1 });

/**
 * Wallet money set aside for one checkout while the pilgrim pays the rest on
 * Razorpay. Captured when the payment is confirmed, released when the
 * checkout is abandoned, replaced, or expires.
 */
export const PilgrimWalletHoldSchema = new Schema(
  {
    userId: id("User", true),
    module: { type: String, enum: WALLET_MODULES, required: true },
    sourceId: { type: SchemaTypes.ObjectId, required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, default: "" },
    status: {
      type: String,
      enum: WALLET_HOLD_STATUSES,
      default: "held",
      index: true,
    },
    expiresAt: { type: Date, required: true },
    capturedAt: Date,
    releasedAt: Date,
  },
  opts("pilgrim_wallet_holds"),
);
PilgrimWalletHoldSchema.index(
  { module: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { status: "held" } },
);
PilgrimWalletHoldSchema.index({ status: 1, expiresAt: 1 });

/** A pilgrim's request to move wallet money to their bank account or UPI. */
export const PilgrimWalletWithdrawalSchema = new Schema(
  {
    requestNumber: { type: String, required: true, unique: true },
    userId: { ...id("User", true), index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: WITHDRAWAL_METHODS, required: true },
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    bankName: { type: String, default: "" },
    upiId: { type: String, default: "" },
    customerNote: { type: String, default: "" },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      default: "pending",
      index: true,
    },
    adminNote: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    payoutReference: { type: String, default: "" },
    reviewedBy: id("User"),
    reviewedAt: Date,
    paidBy: id("User"),
    paidAt: Date,
    cancelledAt: Date,
  },
  opts("pilgrim_wallet_withdrawals"),
);
PilgrimWalletWithdrawalSchema.index({ status: 1, createdAt: -1 });
PilgrimWalletWithdrawalSchema.index({ userId: 1, createdAt: -1 });

export const WALLET_MODELS = [
  { name: "PilgrimWallet", schema: PilgrimWalletSchema },
  { name: "PilgrimWalletTransaction", schema: PilgrimWalletTransactionSchema },
  { name: "PilgrimWalletHold", schema: PilgrimWalletHoldSchema },
  { name: "PilgrimWalletWithdrawal", schema: PilgrimWalletWithdrawalSchema },
];
