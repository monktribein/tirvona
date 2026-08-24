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

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const PLATFORM_FEE_GST_PERCENT = 18;

export const platformFeeGst = (
  platformFee: number,
  percent: number = PLATFORM_FEE_GST_PERCENT,
): number => roundMoney((Math.max(0, platformFee) * percent) / 100);

export const BOOKING_SOURCES = ["tirvona", "self"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];
export const SELF_BOOKING_SOURCE: BookingSource = "self";
export const TIRVONA_BOOKING_SOURCE: BookingSource = "tirvona";

export const OFFLINE_PAYMENT_METHODS = ["cash", "upi", "cards"] as const;
export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];
