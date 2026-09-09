import { filterFixes, metresBetween, summariseDay } from "./lead-tracking";

/**
 * A phone's GPS is noisy in exactly the ways that inflate a day's distance, so
 * these pin the rules that decide what counts as real movement. Getting them
 * wrong shows up as a supervisor being told an agent drove 40km sitting still.
 */
const at = (minutes: number): Date =>
  new Date(Date.UTC(2026, 8, 9, 9, 0, 0) + minutes * 60_000);

const fix = (
  lat: number,
  lng: number,
  minutes: number,
  accuracy = 8,
): { lat: number; lng: number; accuracy: number; recordedAt: Date } => ({
  lat,
  lng,
  accuracy,
  recordedAt: at(minutes),
});

// Roughly 111m of latitude per 0.001 degree.
const NORTH = 0.001;

describe("metresBetween", () => {
  it("keeps sub-kilometre resolution the shared helper rounds away", () => {
    // The platform's haversineDistance rounds to 0.1km, which would report
    // this 111m walk as either 0.1 or 0. Summing legs needs the real figure.
    const metres = metresBetween(27.4924, 77.6737, 27.4924 + NORTH, 77.6737);

    expect(metres).toBeGreaterThan(105);
    expect(metres).toBeLessThan(120);
  });

  it("returns zero for the same point", () => {
    expect(metresBetween(27.49, 77.67, 27.49, 77.67)).toBe(0);
  });
});

describe("filterFixes", () => {
  it("accepts a clean walk and measures each leg", () => {
    const { accepted, rejected } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(27.49 + NORTH, 77.67, 2),
      fix(27.49 + NORTH * 2, 77.67, 4),
    ]);

    expect(rejected).toHaveLength(0);
    expect(accepted).toHaveLength(3);
    expect(accepted[0].metresFromPrevious).toBe(0);
    expect(accepted[1].metresFromPrevious).toBeGreaterThan(100);
  });

  it("drops a fix whose accuracy radius is too wide to place", () => {
    const { accepted, rejected } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(27.49 + NORTH, 77.67, 2, 500),
    ]);

    expect(accepted).toHaveLength(1);
    expect(rejected[0].reason).toBe("inaccurate");
  });

  it("drops the null island a device reports when it has no fix", () => {
    const { accepted, rejected } = filterFixes([fix(0, 0, 0)]);

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe("null_island");
  });

  it("drops a jump nothing on the ground could have made", () => {
    // ~111km in two minutes is 3300km/h.
    const { accepted, rejected } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(28.49, 77.67, 2),
    ]);

    expect(accepted).toHaveLength(1);
    expect(rejected[0].reason).toBe("impossible_speed");
  });

  it("treats standing-still jitter as idle rather than distance", () => {
    // Three fixes a couple of metres apart: a stationary phone drifting.
    const { accepted, rejected } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(27.490_01, 77.670_01, 2),
      fix(27.490_02, 77.67, 4),
    ]);

    expect(accepted).toHaveLength(1);
    expect(rejected.every((row) => row.reason === "not_moved")).toBe(true);
  });

  it("never lets a rejected fix become the baseline for the next one", () => {
    // The middle fix is inaccurate; the third must be measured from the first,
    // otherwise a bad reading silently shifts the whole rest of the route.
    const { accepted } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(27.6, 77.67, 2, 900),
      fix(27.49 + NORTH, 77.67, 4),
    ]);

    expect(accepted).toHaveLength(2);
    expect(accepted[1].metresFromPrevious).toBeLessThan(150);
  });

  it("continues from the day's last stored fix so a batch is not a jump", () => {
    const { accepted } = filterFixes(
      [fix(27.49 + NORTH, 77.67, 10)],
      { lat: 27.49, lng: 77.67, recordedAt: at(8) },
    );

    expect(accepted[0].metresFromPrevious).toBeGreaterThan(100);
  });

  it("sorts an out-of-order batch before measuring", () => {
    const { accepted } = filterFixes([
      fix(27.49 + NORTH * 2, 77.67, 4),
      fix(27.49, 77.67, 0),
      fix(27.49 + NORTH, 77.67, 2),
    ]);

    expect(accepted.map((f) => f.recordedAt.getTime())).toEqual([
      at(0).getTime(),
      at(2).getTime(),
      at(4).getTime(),
    ]);
  });

  it("rejects a repeated timestamp rather than dividing by no elapsed time", () => {
    const { rejected } = filterFixes([
      fix(27.49, 77.67, 0),
      fix(27.49 + NORTH, 77.67, 0),
    ]);

    expect(rejected[0].reason).toBe("out_of_order");
  });
});

describe("summariseDay", () => {
  const stored = (
    lat: number,
    lng: number,
    minutes: number,
    metresFromPrevious = 0,
  ) => ({ lat, lng, recordedAt: at(minutes), metresFromPrevious });

  it("reports an empty day without inventing a location", () => {
    const summary = summariseDay("2026-09-09", []);

    expect(summary).toMatchObject({
      fixes: 0,
      totalKm: 0,
      startLocation: null,
      endLocation: null,
      latest: null,
    });
    expect(summary.route).toEqual([]);
  });

  it("totals the day from the legs already measured on write", () => {
    const summary = summariseDay("2026-09-09", [
      stored(27.49, 77.67, 0),
      stored(27.491, 77.67, 5, 1100),
      stored(27.492, 77.67, 10, 1100),
    ]);

    expect(summary.totalKm).toBe(2.2);
    expect(summary.fixes).toBe(3);
  });

  it("reports the first and last fix as the day's start and end", () => {
    const summary = summariseDay("2026-09-09", [
      stored(27.49, 77.67, 0),
      stored(27.5, 77.68, 30, 1400),
    ]);

    expect(summary.startLocation).toEqual({ lat: 27.49, lng: 77.67 });
    expect(summary.endLocation).toEqual({ lat: 27.5, lng: 77.68 });
    expect(summary.latest?.recordedAt).toEqual(at(30));
    expect(summary.trackedMinutes).toBe(30);
  });

  it("records a lingering cluster as a visited place and as idle time", () => {
    // Twenty minutes inside a small radius, then a move away.
    const summary = summariseDay("2026-09-09", [
      stored(27.49, 77.67, 0),
      stored(27.4901, 77.6701, 10, 14),
      stored(27.4902, 77.6702, 20, 14),
      stored(27.5, 77.68, 40, 1400),
    ]);

    expect(summary.visited).toHaveLength(1);
    expect(summary.visited[0].minutes).toBe(20);
    expect(summary.idleMinutes).toBeGreaterThanOrEqual(20);
  });

  it("builds a timeline of moves and stops in order", () => {
    const summary = summariseDay("2026-09-09", [
      stored(27.49, 77.67, 0),
      stored(27.4901, 77.6701, 12, 14),
      stored(27.5, 77.68, 30, 1400),
    ]);

    expect(summary.timeline.length).toBeGreaterThan(0);
    expect(summary.timeline[0].kind).toBe("stop");
    expect(summary.timeline.at(-1)?.kind).toBe("move");
    for (const leg of summary.timeline)
      expect(leg.endedAt.getTime()).toBeGreaterThanOrEqual(
        leg.startedAt.getTime(),
      );
  });

  it("does not count a long tracking gap as either moving or idle", () => {
    // Three hours between fixes: the phone was off, not crawling.
    const summary = summariseDay("2026-09-09", [
      stored(27.49, 77.67, 0),
      stored(27.5, 77.68, 180, 1400),
    ]);

    expect(summary.movingMinutes).toBe(0);
    expect(summary.idleMinutes).toBe(0);
    expect(summary.trackedMinutes).toBe(180);
  });

  it("returns the route in time order for the map to draw", () => {
    const summary = summariseDay("2026-09-09", [
      stored(27.5, 77.68, 30, 1400),
      stored(27.49, 77.67, 0),
    ]);

    expect(summary.route.map((point) => point.lat)).toEqual([27.49, 27.5]);
  });
});
