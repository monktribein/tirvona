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
