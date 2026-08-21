import {
  aartiSlug,
  combineDateAndTime,
  deriveStreamEmbed,
  hashAartiQr,
  isClockTime,
  isStreamLive,
  normalizeGateCode,
  openAartiQr,
  runsOnDate,
  sealAartiQr,
  toDateKey,
} from "./aarti.utils";

describe("aarti clock and schedule", () => {
  it("accepts 24-hour times and rejects everything else", () => {
    expect(isClockTime("18:30")).toBe(true);
    expect(isClockTime("00:00")).toBe(true);
    expect(isClockTime("23:59")).toBe(true);
    expect(isClockTime("24:00")).toBe(false);
    expect(isClockTime("6:30")).toBe(false);
    expect(isClockTime("18:60")).toBe(false);
  });

  it("reads the clock as India time, not UTC", () => {
    // 18:30 IST on 14 Mar is 13:00 UTC. Reading it as UTC would push an
    // evening aarti to 00:00 IST the next day, which is the bug this guards.
    const at = combineDateAndTime("2026-03-14T09:12:00.000Z", "18:30");
    expect(at.toISOString()).toBe("2026-03-14T13:00:00.000Z");
    expect(
      at.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    ).toBe("18:30");
  });

  it("honours an explicit timezone", () => {
    expect(
      combineDateAndTime("2026-03-14", "18:30", "UTC").toISOString(),
    ).toBe("2026-03-14T18:30:00.000Z");
    // Kathmandu runs 5:45 ahead.
    expect(
      combineDateAndTime("2026-03-14", "18:30", "Asia/Kathmandu").toISOString(),
    ).toBe("2026-03-14T12:45:00.000Z");
  });

  it("resolves a wall clock across a DST boundary", () => {
    // London moves to BST on 29 Mar 2026, so 18:30 local is 17:30 UTC after
    // the switch and 18:30 UTC before it.
    expect(
      combineDateAndTime("2026-03-28", "18:30", "Europe/London").toISOString(),
    ).toBe("2026-03-28T18:30:00.000Z");
    expect(
      combineDateAndTime("2026-03-30", "18:30", "Europe/London").toISOString(),
    ).toBe("2026-03-30T17:30:00.000Z");
  });

  it("keeps midnight on the requested day", () => {
    expect(
      combineDateAndTime("2026-03-14", "00:00", "Asia/Kolkata").toISOString(),
    ).toBe("2026-03-13T18:30:00.000Z");
  });

  it("normalises any instant on a day to that day's UTC midnight", () => {
    expect(toDateKey("2026-03-14T23:59:59.000Z").toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  it("treats an empty weekday list as running every day", () => {
    expect(runsOnDate({}, "2026-03-14")).toBe(true);
    expect(runsOnDate({ daysOfWeek: [] }, "2026-03-14")).toBe(true);
  });

  it("honours the weekday schedule", () => {
    // 2026-03-14 is a Saturday (6).
    expect(runsOnDate({ daysOfWeek: [6] }, "2026-03-14")).toBe(true);
    expect(runsOnDate({ daysOfWeek: [0, 1] }, "2026-03-14")).toBe(false);
  });

  it("honours the season window", () => {
    const season = {
      daysOfWeek: [],
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
    };
    expect(runsOnDate(season, "2026-03-31")).toBe(false);
    expect(runsOnDate(season, "2026-04-15")).toBe(true);
    expect(runsOnDate(season, "2026-05-01")).toBe(false);
  });
});

describe("aarti pass sealing", () => {
  it("round-trips a payload through seal and open", () => {
    const payload = { b: "abc", r: "TVN-ART-1234", p: 3 };
    const token = sealAartiQr(payload);
    expect(token.startsWith("TVNAR1.")).toBe(true);
    expect(openAartiQr(token)).toMatchObject(payload);
  });

  it("rejects a tampered token instead of returning partial data", () => {
    const token = sealAartiQr({ b: "abc" });
    const parts = token.split(".");
    parts[2] = `${parts[2].slice(0, -2)}AA`;
    expect(openAartiQr(parts.join("."))).toBeNull();
  });

  it("rejects a parking token — the two domains must not share passes", () => {
    expect(openAartiQr("TVNPK1.aaa.bbb.ccc")).toBeNull();
  });

  it("hashes deterministically so a token can be looked up without storing it", () => {
    const token = sealAartiQr({ b: "abc" });
    expect(hashAartiQr(token)).toBe(hashAartiQr(token));
    expect(hashAartiQr(token)).toHaveLength(64);
  });
});

describe("gate code normalisation", () => {
  it("repairs the characters devotees and staff routinely confuse", () => {
    expect(normalizeGateCode("i0l1-o0uv")).toBe("1011-00VV");
  });

  it("accepts a code typed without its separator", () => {
    expect(normalizeGateCode("2345 6789")).toBe("2345-6789");
  });

  it("rejects a code of the wrong length", () => {
    expect(normalizeGateCode("2345-678")).toBeNull();
    expect(normalizeGateCode("")).toBeNull();
  });
});

describe("stream embedding", () => {
  it("derives a YouTube embed and thumbnail from a watch URL", () => {
    const result = deriveStreamEmbed(
      "youtube",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result.thumbnailUrl).toContain("dQw4w9WgXcQ");
  });

  it("handles a youtu.be short link and a /live/ link", () => {
    expect(deriveStreamEmbed("youtube", "https://youtu.be/abc123XYZ").embedUrl).toBe(
      "https://www.youtube.com/embed/abc123XYZ",
    );
    expect(
      deriveStreamEmbed("youtube", "https://www.youtube.com/live/abc123XYZ")
        .embedUrl,
    ).toBe("https://www.youtube.com/embed/abc123XYZ");
  });

  it("falls back to the raw URL for a custom provider", () => {
    const url = "https://stream.example.org/ghat.m3u8";
    expect(deriveStreamEmbed("custom", url).embedUrl).toBe(url);
  });
});

describe("live window", () => {
  const now = new Date("2026-03-14T18:45:00.000Z");

  it("is live between startsAt and endsAt", () => {
    expect(
      isStreamLive(
        {
          startsAt: new Date("2026-03-14T18:30:00.000Z"),
          endsAt: new Date("2026-03-14T19:30:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("is not live before it starts or after it ends", () => {
    expect(
      isStreamLive({ startsAt: new Date("2026-03-14T19:00:00.000Z") }, now),
    ).toBe(false);
    expect(
      isStreamLive(
        {
          startsAt: new Date("2026-03-14T17:00:00.000Z"),
          endsAt: new Date("2026-03-14T18:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("falls back to the manual flag when no schedule is set", () => {
    expect(isStreamLive({ isLive: true }, now)).toBe(true);
    expect(isStreamLive({ isLive: false }, now)).toBe(false);
  });

  it("stays live indefinitely when a start is set but no end is", () => {
    expect(
      isStreamLive({ startsAt: new Date("2026-03-14T18:30:00.000Z") }, now),
    ).toBe(true);
  });
});

describe("slugs", () => {
  it("builds a readable, unique slug from name and city", () => {
    const slug = aartiSlug("Ganga Aarti — Har Ki Pauri", "Haridwar");
    expect(slug).toMatch(/^ganga-aarti-har-ki-pauri-haridwar-[0-9a-z]{4}$/);
  });

  it("never produces an empty slug", () => {
    expect(aartiSlug("!!!", "")).toMatch(/^aarti-[0-9a-z]{4}$/);
  });
});
