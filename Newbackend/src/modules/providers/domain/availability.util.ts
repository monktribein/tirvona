/**
 * Pure availability maths: recurring weekly rules (stored as RFC 5545
 * `FREQ=WEEKLY;BYDAY=..` strings with a local-time window) minus calendar
 * blocks, evaluated in the provider's timezone. No I/O, so every rule here is
 * unit tested without a database.
 */
import {
  DAYS_OF_WEEK,
  MAX_SLOTS_PER_DAY,
  RRULE_DAY_CODES,
  type DayOfWeek,
} from "./provider.constants";
import {
  HHMM,
  addDays,
  dayOfWeekOf,
  localDateOf,
  minutesOfDay,
  zonedToUtc,
} from "./provider-time.util";

export interface Interval {
  start: Date;
  end: Date;
}

export interface RuleWindow {
  startTime: string; // HH:MM local to the rule's timezone
  endTime: string;
}

export interface RuleRecord {
  rrule: string | null;
  timezone: string;
  window: RuleWindow;
  status?: string;
}

export interface WeeklyRuleInput {
  dayOfWeek: DayOfWeek;
  isAvailable: boolean;
  slots?: RuleWindow[];
}

export class AvailabilityRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const DAY_FROM_CODE = Object.fromEntries(
  Object.entries(RRULE_DAY_CODES).map(([day, code]) => [code, day]),
) as Record<string, DayOfWeek>;

export const weeklyRrule = (day: DayOfWeek): string =>
  `FREQ=WEEKLY;BYDAY=${RRULE_DAY_CODES[day]}`;

/**
 * Days a stored rule applies to. Only the two shapes this module writes are
 * understood (`FREQ=WEEKLY;BYDAY=..` and `FREQ=DAILY`); anything else yields an
 * empty set, i.e. the rule never makes anyone available (fails closed).
 */
export const rruleDays = (rrule: string | null | undefined): DayOfWeek[] => {
  if (!rrule) return [];
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((part) => part.split("=") as [string, string]),
  ) as Record<string, string>;
  if (parts.FREQ === "DAILY") return [...DAYS_OF_WEEK];
  if (parts.FREQ !== "WEEKLY" || !parts.BYDAY) return [];
  return parts.BYDAY.split(",")
    .map((code) => DAY_FROM_CODE[code])
    .filter((day): day is DayOfWeek => Boolean(day));
};

/** Validates the weekly editor payload and flattens it into one rule per slot. */
export const flattenWeeklyRules = (
  rules: WeeklyRuleInput[],
): Array<{ dayOfWeek: DayOfWeek; window: RuleWindow }> => {
  const seen = new Set<DayOfWeek>();
  const out: Array<{ dayOfWeek: DayOfWeek; window: RuleWindow }> = [];
  for (const rule of rules) {
    if (!DAYS_OF_WEEK.includes(rule.dayOfWeek))
      throw new AvailabilityRuleError(
        "AVAILABILITY_INVALID_DAY",
        `"${rule.dayOfWeek}" is not a day of the week`,
      );
    if (seen.has(rule.dayOfWeek))
      throw new AvailabilityRuleError(
        "AVAILABILITY_DUPLICATE_DAY",
        `${rule.dayOfWeek} appears more than once`,
      );
    seen.add(rule.dayOfWeek);
    if (!rule.isAvailable) continue;
    const slots = rule.slots ?? [];
    if (!slots.length)
      throw new AvailabilityRuleError(
        "AVAILABILITY_SLOT_REQUIRED",
        `${rule.dayOfWeek} is marked available but has no time slot`,
      );
    if (slots.length > MAX_SLOTS_PER_DAY)
      throw new AvailabilityRuleError(
        "AVAILABILITY_TOO_MANY_SLOTS",
        `${rule.dayOfWeek} has more than ${MAX_SLOTS_PER_DAY} slots`,
      );
    const sorted = slots
      .map((slot) => {
        if (!HHMM.test(slot.startTime) || !HHMM.test(slot.endTime))
          throw new AvailabilityRuleError(
            "AVAILABILITY_INVALID_TIME",
            "Slot times must be 24-hour HH:MM",
          );
        if (minutesOfDay(slot.endTime) <= minutesOfDay(slot.startTime))
          throw new AvailabilityRuleError(
            "AVAILABILITY_INVALID_SLOT",
            `${rule.dayOfWeek}: a slot must end after it starts (${slot.startTime}-${slot.endTime})`,
          );
        return { startTime: slot.startTime, endTime: slot.endTime };
      })
      .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));
    for (let i = 1; i < sorted.length; i += 1)
      if (minutesOfDay(sorted[i].startTime) < minutesOfDay(sorted[i - 1].endTime))
        throw new AvailabilityRuleError(
          "AVAILABILITY_OVERLAPPING_SLOTS",
          `${rule.dayOfWeek} has overlapping slots`,
        );
    for (const window of sorted) out.push({ dayOfWeek: rule.dayOfWeek, window });
  }
  return out;
};

/** Stored rules -> the Monday..Sunday editor shape (every day present). */
export const groupWeeklyRules = (
  rules: Array<Pick<RuleRecord, "rrule" | "window" | "status">>,
): WeeklyRuleInput[] =>
  DAYS_OF_WEEK.map((dayOfWeek) => {
    const slots = rules
      .filter((rule) => (rule.status ?? "ACTIVE") === "ACTIVE")
      .filter((rule) => rruleDays(rule.rrule).includes(dayOfWeek))
      .map((rule) => ({
        startTime: rule.window.startTime,
        endTime: rule.window.endTime,
      }))
      .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));
    return { dayOfWeek, isAvailable: slots.length > 0, slots };
  });

// --------------------------------------------------------------- intervals
export const overlaps = (a: Interval, b: Interval): boolean =>
  a.start < b.end && b.start < a.end;

/** Union of intervals as sorted, non-touching intervals. */
export const mergeIntervals = (intervals: Interval[]): Interval[] => {
  const sorted = [...intervals]
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
    } else merged.push({ start: interval.start, end: interval.end });
  }
  return merged;
};

export const subtractIntervals = (
  windows: Interval[],
  blocks: Interval[],
): Interval[] => {
  const blocked = mergeIntervals(blocks);
  const out: Interval[] = [];
  for (const window of windows) {
    let cursor = window.start;
    for (const block of blocked) {
      if (block.end <= cursor) continue;
      if (block.start >= window.end) break;
      if (block.start > cursor) out.push({ start: cursor, end: block.start });
      if (block.end > cursor) cursor = block.end;
    }
    if (cursor < window.end) out.push({ start: cursor, end: window.end });
  }
  return out;
};

/** Rule windows that fall on one local calendar date, as UTC intervals. */
export const ruleWindowsOn = (
  date: string,
  rules: RuleRecord[],
  fallbackTimezone: string,
): Interval[] => {
  const day = dayOfWeekOf(date);
  const out: Interval[] = [];
  for (const rule of rules) {
    if ((rule.status ?? "ACTIVE") !== "ACTIVE") continue;
    if (!rruleDays(rule.rrule).includes(day)) continue;
    const timezone = rule.timezone || fallbackTimezone;
    // The rule's weekday is its own timezone's weekday, which is `date` here
    // because callers pass dates in the provider's timezone.
    out.push({
      start: zonedToUtc(date, rule.window.startTime, timezone),
      end: zonedToUtc(date, rule.window.endTime, timezone),
    });
  }
  return mergeIntervals(out);
};

export interface FreeWindowQuery {
  date: string; // YYYY-MM-DD in `timezone`
  timezone: string;
  rules: RuleRecord[];
  blocks: Interval[];
  now?: Date;
  /** Drop windows shorter than this. */
  minDurationMinutes?: number;
}

/** Bookable windows on one local date: rules minus blocks, minus the past. */
export const freeWindowsOn = (query: FreeWindowQuery): Interval[] => {
  const now = query.now ?? new Date();
  const base = ruleWindowsOn(query.date, query.rules, query.timezone)
    .map((window) => ({
      start: window.start < now ? now : window.start,
      end: window.end,
    }))
    .filter((window) => window.end > window.start);
  const min = (query.minDurationMinutes ?? 0) * 60_000;
  return subtractIntervals(base, query.blocks).filter(
    (window) => window.end.getTime() - window.start.getTime() >= min,
  );
};

export interface CoverageQuery {
  start: Date;
  end: Date;
  timezone: string;
  rules: RuleRecord[];
}

/**
 * True when [start, end) lies entirely inside the provider's recurring
 * availability (ignoring blocks; those are checked as conflicts). The window
 * may span local midnight as long as the rules are contiguous across it.
 */
export const isWithinRules = (query: CoverageQuery): boolean => {
  if (query.end <= query.start) return false;
  const firstDate = localDateOf(query.start, query.timezone);
  const lastDate = localDateOf(new Date(query.end.getTime() - 1), query.timezone);
  const windows: Interval[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1))
    windows.push(...ruleWindowsOn(date, query.rules, query.timezone));
  return mergeIntervals(windows).some(
    (window) => window.start <= query.start && window.end >= query.end,
  );
};

/** Distinct weekdays any active rule makes available (for the public summary). */
export const availableWeekdays = (
  rules: Array<Pick<RuleRecord, "rrule" | "status">>,
): DayOfWeek[] => {
  const days = new Set<DayOfWeek>();
  for (const rule of rules) {
    if ((rule.status ?? "ACTIVE") !== "ACTIVE") continue;
    for (const day of rruleDays(rule.rrule)) days.add(day);
  }
  return DAYS_OF_WEEK.filter((day) => days.has(day));
};
