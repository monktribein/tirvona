import {
  type AvailabilityRuleError,
  availableWeekdays,
  flattenWeeklyRules,
  freeWindowsOn,
  groupWeeklyRules,
  isWithinRules,
  mergeIntervals,
  overlaps,
  rruleDays,
  subtractIntervals,
  weeklyRrule,
  type RuleRecord,
} from "./availability.util";
import { zonedToUtc } from "./provider-time.util";

const TZ = "Asia/Kolkata";
const at = (date: string, time: string) => zonedToUtc(date, time, TZ);
const iv = (date: string, from: string, to: string) => ({ start: at(date, from), end: at(date, to) });
const rule = (rrule: string, startTime: string, endTime: string): RuleRecord => ({
  rrule,
  timezone: TZ,
  window: { startTime, endTime },
  status: "ACTIVE",
});
// 2026-10-12 is a Monday.
const MON = "2026-10-12";
const TUE = "2026-10-13";
const SAT = "2026-10-17";

describe("availability rules", () => {
  describe("rrule handling", () => {
    it("writes and reads the weekly shape this module stores", () => {
      expect(weeklyRrule("MONDAY")).toBe("FREQ=WEEKLY;BYDAY=MO");
      expect(rruleDays("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toEqual(["MONDAY", "WEDNESDAY", "FRIDAY"]);
      expect(rruleDays("RRULE:FREQ=WEEKLY;BYDAY=SU")).toEqual(["SUNDAY"]);
      expect(rruleDays("FREQ=DAILY")).toHaveLength(7);
    });
    it("fails closed on anything it does not understand", () => {
      expect(rruleDays(null)).toEqual([]);
      expect(rruleDays("")).toEqual([]);
      expect(rruleDays("FREQ=MONTHLY;BYMONTHDAY=1")).toEqual([]);
      expect(rruleDays("FREQ=WEEKLY")).toEqual([]);
      expect(rruleDays("FREQ=WEEKLY;BYDAY=XX")).toEqual([]);
    });
  });

  describe("flattenWeeklyRules", () => {
    it("flattens available days into one rule per slot, sorted, and skips unavailable days", () => {
      const flat = flattenWeeklyRules([
        { dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "14:00", endTime: "18:00" }, { startTime: "08:00", endTime: "12:00" }] },
        { dayOfWeek: "TUESDAY", isAvailable: false },
      ]);
      expect(flat).toEqual([
        { dayOfWeek: "MONDAY", window: { startTime: "08:00", endTime: "12:00" } },
        { dayOfWeek: "MONDAY", window: { startTime: "14:00", endTime: "18:00" } },
      ]);
    });

    const code = (rules: Parameters<typeof flattenWeeklyRules>[0]) => {
      try {
        flattenWeeklyRules(rules);
      } catch (error) {
        return (error as AvailabilityRuleError).code;
      }
      return null;
    };

    it("refuses invalid schedules with a stable code", () => {
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [] }])).toBe("AVAILABILITY_SLOT_REQUIRED");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true }])).toBe("AVAILABILITY_SLOT_REQUIRED");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "12:00", endTime: "12:00" }] }])).toBe("AVAILABILITY_INVALID_SLOT");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "13:00", endTime: "09:00" }] }])).toBe("AVAILABILITY_INVALID_SLOT");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "9:00", endTime: "10:00" }] }])).toBe("AVAILABILITY_INVALID_TIME");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "12:00" }, { startTime: "11:59", endTime: "14:00" }] }])).toBe("AVAILABILITY_OVERLAPPING_SLOTS");
      expect(code([{ dayOfWeek: "FUNDAY" as never, isAvailable: false }])).toBe("AVAILABILITY_INVALID_DAY");
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: false }, { dayOfWeek: "MONDAY", isAvailable: false }])).toBe("AVAILABILITY_DUPLICATE_DAY");
      const seven = Array.from({ length: 7 }, (_, i) => ({ startTime: `0${i}:00`, endTime: `0${i}:30` }));
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: seven }])).toBe("AVAILABILITY_TOO_MANY_SLOTS");
    });

    it("allows slots that touch", () => {
      expect(code([{ dayOfWeek: "MONDAY", isAvailable: true, slots: [{ startTime: "08:00", endTime: "12:00" }, { startTime: "12:00", endTime: "14:00" }] }])).toBeNull();
    });
  });

  describe("groupWeeklyRules", () => {
    it("always returns Monday to Sunday and marks days with no rule unavailable", () => {
      const grouped = groupWeeklyRules([rule("FREQ=WEEKLY;BYDAY=MO", "08:00", "12:00"), rule("FREQ=WEEKLY;BYDAY=MO", "14:00", "18:00"), { ...rule("FREQ=WEEKLY;BYDAY=TU", "08:00", "09:00"), status: "INACTIVE" }]);
      expect(grouped.map((d) => d.dayOfWeek)).toEqual(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
      expect(grouped[0]).toMatchObject({ isAvailable: true, slots: [{ startTime: "08:00", endTime: "12:00" }, { startTime: "14:00", endTime: "18:00" }] });
      expect(grouped[1]).toMatchObject({ isAvailable: false, slots: [] }); // inactive rules do not count
    });
  });

  describe("interval maths", () => {
    it("detects overlap but not touching intervals", () => {
      expect(overlaps(iv(MON, "08:00", "10:00"), iv(MON, "09:00", "11:00"))).toBe(true);
      expect(overlaps(iv(MON, "08:00", "10:00"), iv(MON, "10:00", "12:00"))).toBe(false);
    });
    it("merges overlapping and touching intervals", () => {
      const merged = mergeIntervals([iv(MON, "12:00", "14:00"), iv(MON, "08:00", "10:00"), iv(MON, "09:00", "12:00")]);
      expect(merged).toEqual([iv(MON, "08:00", "14:00")]);
      expect(mergeIntervals([iv(MON, "08:00", "09:00"), iv(MON, "10:00", "11:00")])).toHaveLength(2);
    });
    it("subtracts blocks from windows, including blocks that straddle the edges", () => {
      const result = subtractIntervals([iv(MON, "08:00", "18:00")], [iv(MON, "07:00", "09:00"), iv(MON, "12:00", "13:00"), iv(MON, "17:00", "19:00")]);
      expect(result).toEqual([iv(MON, "09:00", "12:00"), iv(MON, "13:00", "17:00")]);
      expect(subtractIntervals([iv(MON, "08:00", "10:00")], [iv(MON, "06:00", "20:00")])).toEqual([]);
      expect(subtractIntervals([iv(MON, "08:00", "10:00")], [])).toEqual([iv(MON, "08:00", "10:00")]);
    });
  });

  describe("freeWindowsOn", () => {
    const rules = [rule("FREQ=WEEKLY;BYDAY=MO,TU", "08:00", "12:00"), rule("FREQ=WEEKLY;BYDAY=MO", "14:00", "18:00")];
    const past = new Date("2020-01-01T00:00:00Z");

    it("returns rule windows on matching weekdays only", () => {
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules, blocks: [], now: past })).toEqual([iv(MON, "08:00", "12:00"), iv(MON, "14:00", "18:00")]);
      expect(freeWindowsOn({ date: TUE, timezone: TZ, rules, blocks: [], now: past })).toEqual([iv(TUE, "08:00", "12:00")]);
      expect(freeWindowsOn({ date: SAT, timezone: TZ, rules, blocks: [], now: past })).toEqual([]);
    });
    it("removes blocked time and windows shorter than the requested duration", () => {
      const blocks = [iv(MON, "09:00", "11:30")];
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules, blocks, now: past })).toEqual([iv(MON, "08:00", "09:00"), iv(MON, "11:30", "12:00"), iv(MON, "14:00", "18:00")]);
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules, blocks, now: past, minDurationMinutes: 90 })).toEqual([iv(MON, "14:00", "18:00")]);
    });
    it("never offers time that has already passed", () => {
      const now = at(MON, "10:00");
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules, blocks: [], now })).toEqual([iv(MON, "10:00", "12:00"), iv(MON, "14:00", "18:00")]);
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules, blocks: [], now: at(MON, "19:00") })).toEqual([]);
    });
    it("ignores inactive rules", () => {
      expect(freeWindowsOn({ date: MON, timezone: TZ, rules: [{ ...rules[0], status: "INACTIVE" }], blocks: [], now: past })).toEqual([]);
    });
  });

  describe("isWithinRules", () => {
    const rules = [rule("FREQ=WEEKLY;BYDAY=MO", "08:00", "12:00"), rule("FREQ=WEEKLY;BYDAY=MO", "12:00", "18:00")];
    it("accepts a window inside the schedule, including across touching slots", () => {
      expect(isWithinRules({ start: at(MON, "09:00"), end: at(MON, "10:30"), timezone: TZ, rules })).toBe(true);
      expect(isWithinRules({ start: at(MON, "11:00"), end: at(MON, "13:00"), timezone: TZ, rules })).toBe(true);
    });
    it("rejects windows that start early, end late, fall on another day or have no length", () => {
      expect(isWithinRules({ start: at(MON, "07:30"), end: at(MON, "09:00"), timezone: TZ, rules })).toBe(false);
      expect(isWithinRules({ start: at(MON, "17:00"), end: at(MON, "18:30"), timezone: TZ, rules })).toBe(false);
      expect(isWithinRules({ start: at(TUE, "09:00"), end: at(TUE, "10:00"), timezone: TZ, rules })).toBe(false);
      expect(isWithinRules({ start: at(MON, "09:00"), end: at(MON, "09:00"), timezone: TZ, rules })).toBe(false);
    });
    it("is false when there is no schedule at all", () => {
      expect(isWithinRules({ start: at(MON, "09:00"), end: at(MON, "10:00"), timezone: TZ, rules: [] })).toBe(false);
    });
  });

  it("lists the distinct weekdays any active rule covers, Monday first", () => {
    expect(availableWeekdays([rule("FREQ=WEEKLY;BYDAY=SA", "08:00", "10:00"), rule("FREQ=WEEKLY;BYDAY=MO", "08:00", "10:00"), { ...rule("FREQ=WEEKLY;BYDAY=TU", "08:00", "10:00"), status: "INACTIVE" }])).toEqual(["MONDAY", "SATURDAY"]);
  });
});
