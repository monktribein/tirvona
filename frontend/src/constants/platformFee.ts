/**
 * Platform fee scopes — mirrors `Newbackend/src/modules/platform-settings/
 * domain/platform-fee.ts`.
 *
 * The server is the authority on what is actually charged; this exists so the
 * admin console and the booking page's first-paint estimate gate the fee the
 * same way the quote does, rather than showing a fee the checkout will not ask
 * for.
 */

export type PlatformFeeScope =
  | "ashram_booking"
  | "parking_booking"
  | "marketplace_order";

export interface PlatformFeeScopeOption {
  value: PlatformFeeScope;
  label: string;
  description: string;
  /**
   * Whether this system has a fee path today.
   *
   * Only ashram booking levies a platform fee at present. The other two are
   * selectable so the choice is recorded and enforced from the moment a fee is
   * wired into them, but selecting one changes no price yet and the console
   * says so rather than implying otherwise.
   */
  levied: boolean;
}

export const PLATFORM_FEE_SCOPE_OPTIONS: PlatformFeeScopeOption[] = [
  {
    value: "ashram_booking",
    label: "Ashram Bookings",
    description: "Stay checkouts across every ashram, dharamshala and homestay",
    levied: true,
  },
  {
    value: "parking_booking",
    label: "Parking Bookings",
    description: "Smart parking slot reservations",
    levied: false,
  },
  {
    value: "marketplace_order",
    label: "Marketplace Orders",
    description: "Sacred merchandise and puja item orders",
    levied: false,
  },
];

/** Scopes assumed for a settings row saved before `appliesTo` existed. */
export const DEFAULT_PLATFORM_FEE_SCOPES: PlatformFeeScope[] = [
  "ashram_booking",
];

/**
 * The scopes a settings payload levies the fee on.
 *
 * A missing `appliesTo` is a legacy row and means ashram bookings only. An
 * explicitly empty array means the Super Admin deselected everything — the two
 * are different and must not be collapsed.
 */
export const platformFeeScopesOf = (settings?: {
  appliesTo?: unknown;
}): PlatformFeeScope[] => {
  const configured = settings?.appliesTo;
  if (!Array.isArray(configured)) return DEFAULT_PLATFORM_FEE_SCOPES;
  return configured.filter((scope): scope is PlatformFeeScope =>
    PLATFORM_FEE_SCOPE_OPTIONS.some((option) => option.value === scope),
  );
};

/** Whether the fee is levied on one booking system. */
export const platformFeeAppliesTo = (
  settings: { enabled?: boolean; appliesTo?: unknown } | undefined,
  scope: PlatformFeeScope,
): boolean => {
  if (settings?.enabled === false) return false;
  return platformFeeScopesOf(settings).includes(scope);
};
