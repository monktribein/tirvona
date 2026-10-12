/**
 * Timezone-aware date helpers built on the platform `Intl` implementation, so
 * the module needs no date library. Instants are always stored in UTC; the
 * provider's IANA timezone only decides how recurring local times (08:00 on
 * Mondays) are interpreted (Architecture 20: "Store UTC plus original
 * timezone semantics").
 */
import { DAYS_OF_WEEK, type DayOfWeek } from "./provider.constants";

export const isValidTimezone = (timezone: string): boolean => {
  if (typeof timezone !== "string" || !timezone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const minutesOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** True for a real calendar date such as 2026-02-28 (rejects 2026-02-30). */
export const isRealIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

const partsFormatter = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  let formatter = partsFormatter.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatter.set(timezone, formatter);
  }
  return formatter;
};

/** Offset (ms) of `timezone` from UTC at the given instant. */
const offsetAt = (instant: Date, timezone: string): number => {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(instant))
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/**
 * The UTC instant at which the wall clock in `timezone` reads `date` `time`.
 *
 * Two passes find the offset that applies at the answer rather than at the
 * guess, which matters on daylight-saving days. Two edge cases are handled
 * explicitly: a wall time that happens twice (clocks going back) resolves to
 * its first occurrence, and one that never happens (clocks jumping forward)
 * resolves to the same moment shifted forward past the gap.
 */
export const zonedToUtc = (
  date: string,
  time: string,
  timezone: string,
): Date => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const first = naive - offsetAt(new Date(naive), timezone);
  const second = naive - offsetAt(new Date(first), timezone);
  const reads = (ms: number): boolean => {
    const instant = new Date(ms);
    return (
      localDateOf(instant, timezone) === date &&
      localTimeOf(instant, timezone) === time
    );
  };
  if (reads(second)) return new Date(second);
  if (reads(first)) return new Date(first);
  return new Date(Math.max(first, second));
};

/** `YYYY-MM-DD` of the instant as seen on the wall clock of `timezone`. */
export const localDateOf = (instant: Date, timezone: string): string => {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timezone).formatToParts(instant))
    if (part.type !== "literal") parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** `HH:MM` of the instant on the wall clock of `timezone`. */
export const localTimeOf = (instant: Date, timezone: string): string => {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timezone).formatToParts(instant))
    if (part.type !== "literal") parts[part.type] = part.value;
  return `${parts.hour}:${parts.minute}`;
};

export const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
};

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), inclusive of `from` only. */
export const daysBetween = (from: string, to: string): number => {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
};

/** Day of week of a calendar date (the date itself has no timezone). */
export const dayOfWeekOf = (date: string): DayOfWeek => {
  const [y, m, d] = date.split("-").map(Number);
  const index = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return DAYS_OF_WEEK[(index + 6) % 7];
};
