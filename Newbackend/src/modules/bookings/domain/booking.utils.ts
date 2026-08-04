import { randomInt, randomUUID } from "node:crypto";

export const eachNight = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  for (
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    cursor < end;
    cursor = new Date(cursor.getTime() + 86_400_000)
  )
    dates.push(cursor);
  return dates;
};
export const bookingReference = (): string =>
  `TRV-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 5).toUpperCase()}`;
export const reservationReference = (): string =>
  `RES-${randomInt(10_000_000, 99_999_999)}`;
export const checkinCode = (): string =>
  randomInt(100_000, 1_000_000).toString();
export const financialReference = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;

/**
 * Resolve an add-on from server-owned catalogs.
 *
 * Older ashrams store add-ons as embedded subdocuments while the current owner
 * module stores them in booking_addons. Both IDs remain valid during the
 * migration period, but client-provided names and prices are never trusted.
 */
export const resolveBookingAddon = (
  catalog: any[],
  legacyCatalog: any[],
  requestedId: unknown,
): any | undefined => {
  const id = String(requestedId ?? "");
  if (!id) return undefined;
  return [...catalog, ...legacyCatalog].find(
    (addon) => addon?.enabled !== false && String(addon?._id) === id,
  );
};

/**
 * Round a money amount to paise.
 *
 * INR is quoted to two decimals and Razorpay charges in integer paise, so every
 * stored amount has to land on a paise boundary. Charging GST on a fee produces
 * fractions (18% of 49 is 8.82), and accumulating those in raw floats lets the
 * gateway amount drift from the invoice. The epsilon nudge keeps values that
 * are exactly halfway — 8.825 — from rounding down through binary
 * representation error.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * GST rate charged on the Tirvona platform fee, as a percentage.
 *
 * An ashram stay is accommodation supplied by the trust, so no GST is added to
 * the room, add-on services or the donation. Tirvona's own service — the
 * platform fee — is what carries tax.
 *
 * Worked example: a 1000 room with a 50 platform fee is charged
 * 1000 + 50 + 9.00 GST = 1059.00.
 */
export const PLATFORM_FEE_GST_PERCENT = 18;

/** GST due on a platform fee, rounded to paise. */
export const platformFeeGst = (
  platformFee: number,
  percent: number = PLATFORM_FEE_GST_PERCENT,
): number => roundMoney((Math.max(0, platformFee) * percent) / 100);
