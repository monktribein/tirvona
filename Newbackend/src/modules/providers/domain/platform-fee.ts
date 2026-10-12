/**
 * Tirvona's platform fee on pandit bookings. The devotee pays it on top of the
 * pandit's professional fee (e.g. ₹501 + 10% = ₹551.10); the pandit receives
 * their full fee and travel charge, and Tirvona keeps the fee.
 *
 * Separate from the platform-settings fee (one flat/percentage value shared by
 * stays, parking and marketplace) because pandit bookings carry their own rate.
 * Configured with PROVIDER_PLATFORM_FEE_BPS in basis points: 1000 = 10%,
 * 0 = no fee.
 */
export const PLATFORM_FEE_LINE = "PLATFORM_FEE";
export const PLATFORM_FEE_LABEL = "Tirvona platform fee";
export const DEFAULT_PROVIDER_PLATFORM_FEE_BPS = 1000;

export const providerPlatformFeeBps = (): number => {
  const raw = process.env.PROVIDER_PLATFORM_FEE_BPS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_PROVIDER_PLATFORM_FEE_BPS;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(10_000, Math.max(0, Math.floor(value))) : DEFAULT_PROVIDER_PLATFORM_FEE_BPS;
};

/** The fee in paise on a professional fee in paise. */
export const platformFeeMinor = (professionalMinor: number, bps = providerPlatformFeeBps()): number =>
  Math.round((Math.max(0, Number(professionalMinor) || 0) * bps) / 10_000);

/**
 * How a booking's payment divides: what the devotee paid, Tirvona's fee, and
 * the pandit's share. Read from the price snapshot, so a booking made before
 * the fee existed (no fee line) credits the pandit its whole total.
 */
export const earningOf = (pricing: any) => {
  const grossMinor = Math.max(0, Math.round(Number(pricing?.totalMinor ?? 0)));
  const fee = (pricing?.lines ?? []).find((line: any) => line?.code === PLATFORM_FEE_LINE);
  const platformFeeMinor = Math.min(grossMinor, Math.max(0, Math.round(Number(fee?.amountMinor ?? 0))));
  return { grossMinor, platformFeeMinor, netMinor: grossMinor - platformFeeMinor };
};
