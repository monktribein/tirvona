import {
  addDays,
  dayOfWeekOf,
  daysBetween,
  isRealIsoDate,
  isValidTimezone,
  localDateOf,
  localTimeOf,
  minutesOfDay,
  zonedToUtc,
} from "./provider-time.util";

describe("provider time helpers", () => {
  describe("isValidTimezone", () => {
    it("accepts IANA names and rejects everything else", () => {
      expect(isValidTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("Mars/Olympus")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
      expect(isValidTimezone("   ")).toBe(false);
      expect(isValidTimezone(undefined as unknown as string)).toBe(false);
    });
  });

  describe("isRealIsoDate", () => {
    it("rejects dates that only look valid", () => {
      expect(isRealIsoDate("2026-02-28")).toBe(true);
      expect(isRealIsoDate("2028-02-29")).toBe(true); // leap year
      expect(isRealIsoDate("2026-02-29")).toBe(false);
      expect(isRealIsoDate("2026-02-30")).toBe(false);
      expect(isRealIsoDate("2026-13-01")).toBe(false);
      expect(isRealIsoDate("26-02-01")).toBe(false);
      expect(isRealIsoDate("2026-2-1")).toBe(false);
    });
  });

  describe("zonedToUtc", () => {
    it("converts wall-clock time in a fixed-offset zone (India has no daylight saving)", () => {
      expect(zonedToUtc("2026-10-12", "10:00", "Asia/Kolkata").toISOString()).toBe("2026-10-12T04:30:00.000Z");
      expect(zonedToUtc("2026-10-12", "00:00", "Asia/Kolkata").toISOString()).toBe("2026-10-11T18:30:00.000Z");
    });

    it("follows daylight saving on either side of the change", () => {
      expect(zonedToUtc("2026-01-15", "09:00", "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z"); // EST
      expect(zonedToUtc("2026-07-15", "09:00", "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z"); // EDT
    });

    it("copes with a half-hour daylight-saving shift", () => {
      const instant = zonedToUtc("2026-10-12", "00:00", "Australia/Lord_Howe");
      expect(localDateOf(instant, "Australia/Lord_Howe")).toBe("2026-10-12");
      expect(localTimeOf(instant, "Australia/Lord_Howe")).toBe("00:00");
    });

    it("resolves a time that never happens to the moment after the gap, and a repeated one to its first occurrence", () => {
      // 2026-03-08 02:30 does not exist in New York: clocks jump 02:00 -> 03:00.
      expect(zonedToUtc("2026-03-08", "02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
      // 2026-11-01 01:30 happens twice; the first one (EDT) wins.
      expect(zonedToUtc("2026-11-01", "01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
    });

    it("round-trips with localDateOf / localTimeOf", () => {
      for (const tz of ["Asia/Kolkata", "America/New_York", "Europe/London", "Australia/Sydney"])
        for (const [date, time] of [["2026-04-05", "08:15"], ["2026-12-31", "23:45"], ["2027-01-01", "00:00"]]) {
          const instant = zonedToUtc(date, time, tz);
          expect(`${localDateOf(instant, tz)} ${localTimeOf(instant, tz)}`).toBe(`${date} ${time}`);
        }
    });
  });

  describe("calendar arithmetic", () => {
    it("adds days across month and year ends", () => {
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
      expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    });
    it("counts days between dates", () => {
      expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
      expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
      expect(daysBetween("2026-03-01", "2026-01-01")).toBe(-59);
    });
    it("names weekdays Monday-first", () => {
      expect(dayOfWeekOf("2026-10-12")).toBe("MONDAY");
      expect(dayOfWeekOf("2026-10-18")).toBe("SUNDAY");
      expect(dayOfWeekOf("2026-10-17")).toBe("SATURDAY");
    });
    it("converts HH:MM to minutes", () => {
      expect(minutesOfDay("00:00")).toBe(0);
      expect(minutesOfDay("08:30")).toBe(510);
      expect(minutesOfDay("23:59")).toBe(1439);
    });
  });
});
