/** Where wallet money came from or went to. */
export const WALLET_MODULES = [
  "ashram_booking",
  "day_stay",
  "parking",
  "aarti",
  "marketplace",
  "withdrawal",
  "admin",
] as const;
export type WalletModule = (typeof WALLET_MODULES)[number];

export const WALLET_TXN_CATEGORIES = [
  "refund",
  "admin_credit",
  "payment",
  "withdrawal",
  "withdrawal_reversal",
] as const;
export type WalletTxnCategory = (typeof WALLET_TXN_CATEGORIES)[number];

export const WALLET_HOLD_STATUSES = ["held", "captured", "released"] as const;

export const WITHDRAWAL_METHODS = ["bank", "upi"] as const;
export const WITHDRAWAL_STATUSES = [
  "pending",
  "approved",
  "paid",
  "rejected",
  "cancelled",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** Requests still holding the pilgrim's money. */
export const OPEN_WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["pending", "approved"];

/**
 * How long wallet money stays parked against an unpaid checkout: at least as
 * long as the modules' own reservation holds, short enough that an abandoned
 * checkout hands the money back soon. A payment that still lands after the
 * hold lapsed takes the wallet share from the balance instead.
 */
export const WALLET_HOLD_TTL_MINUTES = 30;

export const WALLET_ADMIN_ROLES = [
  "super_admin",
  "national_admin",
  "finance_manager",
];

export const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

/** Wallet share of a checkout: never more than the total or the balance. */
export const walletShare = (total: number, available: number): number =>
  roundMoney(Math.max(0, Math.min(roundMoney(total), roundMoney(available))));
