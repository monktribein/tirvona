/**
 * Provider (pandit) earnings wallet. Amounts are integer paise, like every
 * other money field in the provider domain.
 *
 * A devotee pays Tirvona (Razorpay checkout / UPI QR, or their Tirvona
 * wallet). The pandit's share is credited here as PENDING and becomes
 * AVAILABLE for withdrawal once the hold period has passed.
 */

export const WALLET_ENTRY_TYPES = [
  "EARNING", // booking paid: credit (pending until availableAt)
  "EARNING_REVERSAL", // paid booking cancelled + refunded after the earning was released
  "WITHDRAWAL", // money requested out to the bank / UPI
  "WITHDRAWAL_REVERSAL", // a withdrawal that was rejected or cancelled
] as const;
export type WalletEntryType = (typeof WALLET_ENTRY_TYPES)[number];

export const WALLET_ENTRY_STATUSES = [
  "PENDING", // earning still inside the hold window
  "AVAILABLE", // earning released to the withdrawable balance
  "REVERSED", // earning cancelled before release (booking refunded)
  "POSTED", // every non-earning entry: final as soon as it is written
] as const;
export type WalletEntryStatus = (typeof WALLET_ENTRY_STATUSES)[number];

export const PAYOUT_METHODS = ["BANK", "UPI"] as const;
export type ProviderPayoutMethod = (typeof PAYOUT_METHODS)[number];

export const WITHDRAWAL_STATUSES = [
  "REQUESTED",
  "PROCESSING",
  "PAID",
  "REJECTED",
  "CANCELLED",
] as const;
export type ProviderWithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** Withdrawals that still hold the provider's money. */
export const OPEN_WITHDRAWAL_STATUSES: ProviderWithdrawalStatus[] = ["REQUESTED", "PROCESSING"];

export const WITHDRAWAL_NUMBER_PREFIX = "PWD";

/** Who may run the payout queue. */
export const WALLET_FINANCE_ROLES = ["finance_manager", "service_manager", "super_admin"];

const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

export const providerWalletConfig = () => ({
  /** Hours a paid booking's earning stays pending before it can be withdrawn. */
  holdHours: positiveInt(process.env.PROVIDER_WALLET_HOLD_HOURS, 72),
  /** Smallest withdrawal, in paise. */
  minWithdrawalMinor: positiveInt(process.env.PROVIDER_MIN_WITHDRAWAL_MINOR, 10_000),
});

/** How the devotee paid, from the opaque reference the booking keeps. */
export const paymentMethodOf = (paymentRef?: string | null): string => {
  const ref = String(paymentRef ?? "");
  if (ref.startsWith("pay_")) return "RAZORPAY";
  if (ref.startsWith("WLT-")) return "TIRVONA_WALLET";
  return ref ? "OTHER" : "UNKNOWN";
};
