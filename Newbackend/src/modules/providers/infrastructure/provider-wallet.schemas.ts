/**
 * Provider earnings wallet persistence. Separate from the pilgrim wallet
 * (`pilgrim_wallets`): that one holds a devotee's refunds and credits, this
 * one holds what Tirvona owes a pandit.
 */
import { Schema, SchemaTypes } from "mongoose";
import {
  PAYOUT_METHODS,
  WALLET_ENTRY_STATUSES,
  WALLET_ENTRY_TYPES,
  WITHDRAWAL_STATUSES,
} from "../domain/provider-wallet.constants";

const id = (ref: string, extra: Record<string, unknown> = {}) => ({
  type: SchemaTypes.ObjectId,
  ref,
  ...extra,
});
const opts = (collection: string) => ({ timestamps: true, collection });

/**
 * One wallet per provider. Every balance is paise and never negative; each
 * change is a conditional `$inc` paired with a ledger entry.
 *
 * - `pendingMinor`     earnings still inside the hold window
 * - `availableMinor`   withdrawable now
 * - `withdrawingMinor` requested, waiting for the bank transfer
 * - `recoveryDueMinor` refunds of already-released earnings, taken from future earnings
 */
export const ProviderWalletSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    userId: id("User", { required: true }),
    pendingMinor: { type: Number, default: 0 },
    availableMinor: { type: Number, default: 0 },
    withdrawingMinor: { type: Number, default: 0 },
    recoveryDueMinor: { type: Number, default: 0 },
    lifetimeEarnedMinor: { type: Number, default: 0 },
    lifetimeWithdrawnMinor: { type: Number, default: 0 },
    lifetimePlatformFeeMinor: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
  },
  opts("provider_wallets"),
);
ProviderWalletSchema.index({ providerId: 1 }, { unique: true, name: "ux_pwallet_provider" });
ProviderWalletSchema.index({ userId: 1 }, { name: "ix_pwallet_user" });

/** Append-only statement. `idempotencyKey` stops a retried payment or refund from moving money twice. */
export const ProviderWalletEntrySchema = new Schema(
  {
    walletId: id("ProviderWallet", { required: true }),
    providerId: id("ProviderProfile", { required: true }),
    type: { type: String, enum: WALLET_ENTRY_TYPES, required: true },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    status: { type: String, enum: WALLET_ENTRY_STATUSES, required: true },
    amountMinor: { type: Number, required: true },
    grossMinor: { type: Number, default: 0 },
    platformFeeMinor: { type: Number, default: 0 },
    /** Part of an EARNING_REVERSAL that could not be taken from the balance and became recovery due. */
    recoveryMinor: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    bookingId: id("ProviderBooking", { default: null }),
    bookingNumber: { type: String, default: "" },
    withdrawalId: id("ProviderWithdrawal", { default: null }),
    paymentRef: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    description: { type: String, default: "" },
    availableAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true },
  },
  opts("provider_wallet_entries"),
);
ProviderWalletEntrySchema.index(
  { idempotencyKey: 1 },
  { unique: true, name: "ux_pwallet_entry_idem" },
);
ProviderWalletEntrySchema.index(
  { providerId: 1, createdAt: -1 },
  { name: "ix_pwallet_entry_provider" },
);
/** Release sweep: pending earnings whose hold has run out. */
ProviderWalletEntrySchema.index(
  { status: 1, availableAt: 1 },
  { name: "ix_pwallet_entry_release" },
);
ProviderWalletEntrySchema.index({ bookingId: 1, type: 1 }, { name: "ix_pwallet_entry_booking" });

/**
 * Where a provider's withdrawals go. The account number is AES-GCM encrypted
 * (same key and scheme as ashram payout accounts) and only its last four
 * digits are ever returned to the provider.
 */
export const ProviderPayoutAccountSchema = new Schema(
  {
    providerId: id("ProviderProfile", { required: true }),
    userId: id("User", { required: true }),
    method: { type: String, enum: PAYOUT_METHODS, required: true },
    accountHolderName: { type: String, required: true, trim: true },
    accountNumberCiphertext: { type: String, default: "", select: false },
    accountNumberIv: { type: String, default: "", select: false },
    accountNumberTag: { type: String, default: "", select: false },
    accountNumberLast4: { type: String, default: "" },
    ifsc: { type: String, default: "", uppercase: true },
    bankName: { type: String, default: "" },
    upiId: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  opts("provider_payout_accounts"),
);
ProviderPayoutAccountSchema.index(
  { providerId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: "ux_ppayout_account_active" },
);

/** A provider's request to move available money to their bank account or UPI. */
export const ProviderWithdrawalSchema = new Schema(
  {
    withdrawalNumber: { type: String, required: true, immutable: true },
    providerId: id("ProviderProfile", { required: true }),
    userId: id("User", { required: true }),
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    payoutAccountId: id("ProviderPayoutAccount", { required: true }),
    /** What the account looked like when the request was made (masked; safe to show). */
    destination: { type: SchemaTypes.Mixed, required: true },
    status: { type: String, enum: WITHDRAWAL_STATUSES, default: "REQUESTED" },
    note: { type: String, default: "", maxlength: 300 },
    payoutReference: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    processedBy: id("User", { default: null }),
    processingAt: Date,
    paidAt: Date,
    rejectedAt: Date,
    cancelledAt: Date,
  },
  opts("provider_withdrawals"),
);
ProviderWithdrawalSchema.index(
  { withdrawalNumber: 1 },
  { unique: true, name: "ux_pwithdrawal_number" },
);
ProviderWithdrawalSchema.index(
  { providerId: 1, createdAt: -1 },
  { name: "ix_pwithdrawal_provider" },
);
ProviderWithdrawalSchema.index({ status: 1, createdAt: -1 }, { name: "ix_pwithdrawal_status" });

export const PROVIDER_WALLET_MODELS = [
  { name: "ProviderWallet", schema: ProviderWalletSchema },
  { name: "ProviderWalletEntry", schema: ProviderWalletEntrySchema },
  { name: "ProviderPayoutAccount", schema: ProviderPayoutAccountSchema },
  { name: "ProviderWithdrawal", schema: ProviderWithdrawalSchema },
];
