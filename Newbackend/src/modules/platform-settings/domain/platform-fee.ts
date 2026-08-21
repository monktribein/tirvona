
export const PLATFORM_FEE_SCOPES = {
  ashram_booking: "Ashram Bookings",
  parking_booking: "Parking Bookings",
  marketplace_order: "Marketplace Orders",
} as const;

export type PlatformFeeScope = keyof typeof PLATFORM_FEE_SCOPES;

export const PLATFORM_FEE_SCOPE_VALUES = Object.keys(
  PLATFORM_FEE_SCOPES,
) as PlatformFeeScope[];

export const DEFAULT_PLATFORM_FEE_SCOPES: PlatformFeeScope[] = [
  "ashram_booking",
];

export const DEFAULT_PLATFORM_FEE_VALUE = 49;

export interface PlatformFeeSettings {
  enabled?: boolean;
  type?: "flat" | "percentage";
  value?: number;
  label?: string;
  appliesTo?: unknown;
}

export const platformFeeScopesOf = (
  settings?: PlatformFeeSettings | null,
): PlatformFeeScope[] => {
  const configured = settings?.appliesTo;
  if (!Array.isArray(configured)) return DEFAULT_PLATFORM_FEE_SCOPES;
  return configured.filter((scope): scope is PlatformFeeScope =>
    PLATFORM_FEE_SCOPE_VALUES.includes(scope as PlatformFeeScope),
  );
};

export const platformFeeAppliesTo = (
  settings: PlatformFeeSettings | null | undefined,
  scope: PlatformFeeScope,
): boolean => {
  if (settings?.enabled === false) return false;
  return platformFeeScopesOf(settings).includes(scope);
};

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
