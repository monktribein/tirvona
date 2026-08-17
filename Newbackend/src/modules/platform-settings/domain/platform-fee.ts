/**
 * Platform fee resolution — the one place that decides whether a fee is owed.
 *
 * This used to be an inline conditional inside `BookingPricingService.quote`,
 * and it had the precedence wrong: a `booking_policies` row carrying a
 * `platformFeePercent` was tested *before* the global on/off switch, so a fee
 * kept being charged at checkout while the Super Admin's Fee Engine read
 * "Disabled". Ordering the checks in one shared function is what stops the
 * admin console, the booking page estimate and the server quote from ever
 * disagreeing again.
 */

/** Booking systems a platform fee can be levied on. */
export const PLATFORM_FEE_SCOPES = {
  ashram_booking: "Ashram Bookings",
  parking_booking: "Parking Bookings",
  marketplace_order: "Marketplace Orders",
} as const;

export type PlatformFeeScope = keyof typeof PLATFORM_FEE_SCOPES;

export const PLATFORM_FEE_SCOPE_VALUES = Object.keys(
  PLATFORM_FEE_SCOPES,
) as PlatformFeeScope[];

/**
 * Scopes assumed for a settings row saved before `appliesTo` existed.
 *
 * Ashram booking is the only system that has ever levied the fee, so this
 * leaves every existing deployment charging exactly what it charged before.
 */
export const DEFAULT_PLATFORM_FEE_SCOPES: PlatformFeeScope[] = [
  "ashram_booking",
];

/** Fee used when no settings row exists at all — matches the seeded default. */
export const DEFAULT_PLATFORM_FEE_VALUE = 49;

export interface PlatformFeeSettings {
  enabled?: boolean;
  type?: "flat" | "percentage";
  value?: number;
  label?: string;
  appliesTo?: unknown;
}

/**
 * The scopes a settings row levies the fee on.
 *
 * A missing `appliesTo` is a legacy row and falls back to the default above.
 * An explicitly empty array is *not* the same thing — it means the Super Admin
 * deselected every system, and must be honoured as "nowhere".
 */
export const platformFeeScopesOf = (
  settings?: PlatformFeeSettings | null,
): PlatformFeeScope[] => {
  const configured = settings?.appliesTo;
  if (!Array.isArray(configured)) return DEFAULT_PLATFORM_FEE_SCOPES;
  return configured.filter((scope): scope is PlatformFeeScope =>
    PLATFORM_FEE_SCOPE_VALUES.includes(scope as PlatformFeeScope),
  );
};

/** Whether the fee is levied on one booking system. */
export const platformFeeAppliesTo = (
  settings: PlatformFeeSettings | null | undefined,
  scope: PlatformFeeScope,
): boolean => {
  if (settings?.enabled === false) return false;
  return platformFeeScopesOf(settings).includes(scope);
};

/**
 * The platform fee owed on one transaction, in rupees.
 *
 * Checks run in this order, and the order is the whole point:
 *
 * 1. **Globally disabled wins over everything.** No per-ashram policy, no
 *    percentage override and no legacy row can reintroduce a fee the platform
 *    has switched off.
 * 2. **Scope gate.** A system the fee is not levied on pays nothing.
 * 3. **Policy override.** Only *inside* an enabled scope may a booking policy
 *    substitute its own percentage.
 * 4. **Configured model.** Flat rupees, or a percentage of `baseAmount`.
 */
export const resolvePlatformFee = ({
  settings,
  scope,
  baseAmount,
  policyPercent,
}: {
  settings?: PlatformFeeSettings | null;
  scope: PlatformFeeScope;
  baseAmount: number;
  policyPercent?: number | null;
}): number => {
  if (!platformFeeAppliesTo(settings, scope)) return 0;
  const base = Math.max(0, Number(baseAmount) || 0);
  if (policyPercent != null && Number.isFinite(Number(policyPercent)))
    return Math.max(0, Math.round((base * Number(policyPercent)) / 100));
  if (settings?.type === "percentage")
    return Math.max(0, Math.round((base * Number(settings.value ?? 0)) / 100));
  return Math.max(
    0,
    Math.round(Number(settings?.value ?? DEFAULT_PLATFORM_FEE_VALUE)),
  );
};
