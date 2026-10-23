/**
 * Attendance rules. Dates are IST calendar days ("YYYY-MM-DD"), the convention the rest of
 * Tirvona uses, so "today" rolls over at Indian midnight.
 *
 * Attendance only records what was entered (check-in / check-out, or a status HR marked).
 * Task activity is never treated as proof that someone was at work.
 */
import { addDays, istDateString } from "../../day-stay/domain/day-stay-time";

export { addDays, istDateString };

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && DATE_KEY.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

export const todayIst = (now = new Date()) => istDateString(now);

/** 0 = Sunday … 6 = Saturday, for an IST date key. */
export const weekdayOf = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();

/** Inclusive number of calendar days from `from` to `to`. */
export const daySpan = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Do two inclusive date ranges share at least one day? */
export const rangesOverlap = (aFrom: string, aTo: string, bFrom: string, bTo: string) => aFrom <= bTo && bFrom <= aTo;

export interface AttendanceSummaryInput {
  from: string;
  to: string;
  /** Today in IST: days after it are not counted yet. */
  today: string;
  joiningDate?: string | null;
  weeklyOffDays: number[];
  /** One entry per recorded day. */
  records: Array<{ date: string; status: string }>;
  /** Approved leave ranges. */
  leaves: Array<{ fromDate: string; toDate: string }>;
}

export interface AttendanceSummary {
  /** Days in the range the employee was expected at work: after joining, up to today, not weekly offs. */
  workingDays: number;
  present: number;
  halfDay: number;
  /** Working days covered by approved leave (and not recorded as present). */
  leaveDays: number;
  /** Working days HR recorded as absent. */
  absent: number;
  /** Working days with no attendance record and no approved leave. */
  notMarked: number;
}

/**
 * Per-employee summary for a date range. A day with a check-in counts as present even on a
 * weekly off; leave only counts on working days.
 */
export function summariseAttendance(input: AttendanceSummaryInput): AttendanceSummary {
  const start = input.joiningDate && input.joiningDate > input.from ? input.joiningDate : input.from;
  const end = input.to < input.today ? input.to : input.today;
  const result: AttendanceSummary = { workingDays: 0, present: 0, halfDay: 0, leaveDays: 0, absent: 0, notMarked: 0 };
  if (start > end) return result;
  const byDate = new Map(input.records.map((r) => [r.date, r.status]));
  const off = new Set(input.weeklyOffDays);
  for (const day of eachDay(start, end)) {
    const status = byDate.get(day);
    const working = !off.has(weekdayOf(day));
    if (working) result.workingDays += 1;
    if (status === "present") {
      result.present += 1;
      continue;
    }
    if (status === "half_day") {
      result.halfDay += 1;
      continue;
    }
    if (!working) continue;
    if (input.leaves.some((l) => l.fromDate <= day && day <= l.toDate)) result.leaveDays += 1;
    else if (status === "absent") result.absent += 1;
    else result.notMarked += 1;
  }
  return result;
}
