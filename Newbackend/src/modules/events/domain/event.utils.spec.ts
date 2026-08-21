import {
  combineDateAndTime,
  datesInRange,
  eventSlug,
  hashEventQr,
  isClockTime,
  normalizeGateCode,
  openEventQr,
  runsOnDate,
  sealEventQr,
  toDateKey,
} from "./event.utils";

describe("event clock and range", () => {
  it("accepts 24-hour times and rejects everything else", () => {
    expect(isClockTime("09:00")).toBe(true);
    expect(isClockTime("23:59")).toBe(true);
    expect(isClockTime("24:00")).toBe(false);
    expect(isClockTime("9:00")).toBe(false);
  });

  it("reads the clock as India time, not UTC", () => {
    // 09:00 IST is 03:30 UTC. Reading it as UTC would move a morning
    // mahotsav to mid-afternoon for every viewer in India.
    expect(
      combineDateAndTime("2026-03-14", "09:00").toISOString(),
    ).toBe("2026-03-14T03:30:00.000Z");
  });

  it("honours an explicit timezone and DST", () => {
    expect(combineDateAndTime("2026-03-14", "09:00", "UTC").toISOString()).toBe(
      "2026-03-14T09:00:00.000Z",
    );
    expect(
      combineDateAndTime("2026-03-30", "09:00", "Europe/London").toISOString(),
    ).toBe("2026-03-30T08:00:00.000Z");
  });

  it("lists every day the event runs, inclusive of both ends", () => {
    const days = datesInRange("2026-03-14", "2026-03-17");
    expect(days).toHaveLength(4);
    expect(days[0].toISOString()).toBe("2026-03-14T00:00:00.000Z");
    expect(days[3].toISOString()).toBe("2026-03-17T00:00:00.000Z");
  });

  it("returns a single day when the event starts and ends together", () => {
    expect(datesInRange("2026-03-14", "2026-03-14")).toHaveLength(1);
  });

  it("returns nothing when the range is inverted", () => {
    expect(datesInRange("2026-03-17", "2026-03-14")).toHaveLength(0);
  });

  it("caps a runaway range at a year rather than looping", () => {
    expect(datesInRange("2020-01-01", "2030-01-01").length).toBeLessThanOrEqual(
      366,
    );
  });

  it("knows which dates fall inside the event window", () => {
    const event = { startDate: "2026-03-14", endDate: "2026-03-17" };
    expect(runsOnDate(event, "2026-03-13")).toBe(false);
    expect(runsOnDate(event, "2026-03-14")).toBe(true);
    expect(runsOnDate(event, "2026-03-17")).toBe(true);
    expect(runsOnDate(event, "2026-03-18")).toBe(false);
  });

  it("normalises any instant on a day to that day's UTC midnight", () => {
    expect(toDateKey("2026-03-14T23:59:59.000Z").toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });
});

describe("event pass sealing", () => {
  it("round-trips a payload through seal and open", () => {
    const payload = { r: "abc", ref: "TVN-EVT-1234", s: 3 };
    const token = sealEventQr(payload);
    expect(token.startsWith("TVNEV1.")).toBe(true);
    expect(openEventQr(token)).toMatchObject(payload);
  });

  it("rejects a tampered token", () => {
    const token = sealEventQr({ r: "abc" });
    const parts = token.split(".");
    parts[2] = `${parts[2].slice(0, -2)}AA`;
    expect(openEventQr(parts.join("."))).toBeNull();
  });

  it("rejects an aarti or parking token — domains must not share passes", () => {
    expect(openEventQr("TVNAR1.aaa.bbb.ccc")).toBeNull();
    expect(openEventQr("TVNPK1.aaa.bbb.ccc")).toBeNull();
  });

  it("hashes deterministically for lookup without storing the token", () => {
    const token = sealEventQr({ r: "abc" });
    expect(hashEventQr(token)).toBe(hashEventQr(token));
    expect(hashEventQr(token)).toHaveLength(64);
  });
});

describe("gate code normalisation", () => {
  it("repairs the characters staff routinely confuse", () => {
    expect(normalizeGateCode("i0l1-o0uv")).toBe("1011-00VV");
  });

  it("rejects a code of the wrong length", () => {
    expect(normalizeGateCode("2345-678")).toBeNull();
  });
});

describe("slugs", () => {
  it("builds a readable, unique slug", () => {
    expect(eventSlug("Janmashtami Mahotsav", "Mathura")).toMatch(
      /^janmashtami-mahotsav-mathura-[0-9a-z]{4}$/,
    );
  });

  it("never produces an empty slug", () => {
    expect(eventSlug("!!!", "")).toMatch(/^event-[0-9a-z]{4}$/);
  });
});
