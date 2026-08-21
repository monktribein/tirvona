
export type PlatformFeeScope =
  | "ashram_booking"
  | "parking_booking"
  | "marketplace_order";

export interface PlatformFeeScopeOption {
  value: PlatformFeeScope;
  label: string;
  description: string;
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

export const DEFAULT_PLATFORM_FEE_SCOPES: PlatformFeeScope[] = [
  "ashram_booking",
];

export const platformFeeScopesOf = (settings?: {
  appliesTo?: unknown;
}): PlatformFeeScope[] => {
  const configured = settings?.appliesTo;
  if (!Array.isArray(configured)) return DEFAULT_PLATFORM_FEE_SCOPES;
  return configured.filter((scope): scope is PlatformFeeScope =>
    PLATFORM_FEE_SCOPE_OPTIONS.some((option) => option.value === scope),
  );
};

export const platformFeeAppliesTo = (
  settings: { enabled?: boolean; appliesTo?: unknown } | undefined,
  scope: PlatformFeeScope,
): boolean => {
  if (settings?.enabled === false) return false;
  return platformFeeScopesOf(settings).includes(scope);
};
