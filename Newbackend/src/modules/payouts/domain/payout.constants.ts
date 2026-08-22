export const PAYOUT_PROVIDER = Symbol("PAYOUT_PROVIDER");

export const PAYOUT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_MODES = ["IMPS", "NEFT", "RTGS"] as const;
export type PayoutMode = (typeof PAYOUT_MODES)[number];

export const PAYOUT_LIMITS = {
  // RazorpayX's bank payout API accepts a minimum amount of 100 paise (₹1).
  minimumRupees: 1,
  maximumRupees: 10_000_000,
  impsMaximumRupees: 500_000,
  rtgsMinimumRupees: 200_000,
} as const;
