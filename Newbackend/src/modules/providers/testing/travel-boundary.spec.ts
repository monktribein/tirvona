import {
  haversineDistanceKm,
  resolveLocationPoint,
  validateShiftTravelFeasibility,
  validateTravelDistance,
} from "../domain/travel-distance.util";

/** One degree of longitude on the equator, in km, for the 6371 km sphere the util uses. */
const KM_PER_DEGREE = (6371 * Math.PI) / 180;
const at = (km: number) => ({ lat: 0, lng: km / KM_PER_DEGREE });
const origin = { lat: 0, lng: 0 };

describe("50 km straight-line travel rule: boundaries", () => {
  it("measures a known distance (Haridwar - Rishikesh, about 20 km)", () => {
    const d = haversineDistanceKm(29.9457, 78.1642, 30.0869, 78.2676);
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(23);
  });

  it.each([
    [49.9, true],
    [50.0, true], // the limit itself is allowed: the rule rejects only distances over 50 km
    [50.1, false],
    [50.2, false],
    [0, true],
  ])("%p km from the first booking is eligible: %p", (km, eligible) => {
    const r = validateTravelDistance(origin, at(km), 50);
    expect(r.valid).toBe(eligible);
    expect(r.distanceKm).toBeCloseTo(km, 1);
    if (!eligible) expect(r.reason).toMatch(/straight line, not road distance/);
  });

  it("uses the limit it is given, not a hard-coded 50", () => {
    expect(validateTravelDistance(origin, at(30), 25).valid).toBe(false);
    expect(validateTravelDistance(origin, at(30), 35).valid).toBe(true);
  });

  it("is symmetric: A to B equals B to A", () => {
    const ab = validateTravelDistance(at(10), at(55), 50);
    const ba = validateTravelDistance(at(55), at(10), 50);
    expect(ab.distanceKm).toBe(ba.distanceKm);
    expect(ab.valid).toBe(ba.valid);
  });

  describe("missing or invalid coordinates fail closed", () => {
    it.each([
      ["nothing", undefined],
      ["null", null],
      ["an empty object", {}],
      ["an unknown city", { city: "Zzyzx" }],
      ["NaN coordinates and no city", { lat: NaN, lng: NaN }],
      ["infinite coordinates", { lat: Infinity, lng: 0 }],
      ["latitude out of range", { lat: 95, lng: 10 }],
      ["longitude out of range", { lat: 10, lng: 200 }],
      ["a GeoJSON point out of range", { coordinates: { coordinates: [300, 10] } }],
    ])("%s is never eligible and never reports a distance", (_label, bad) => {
      const r = validateTravelDistance(bad as any, origin, 50);
      expect(r.valid).toBe(false);
      expect(r.distanceKm).toBeNull();
      expect(r.reason).toMatch(/straight-line distance/);
    });

    it("an unusable coordinate falls back to the city when there is one", () => {
      const p = resolveLocationPoint({ lat: NaN, lng: 5, city: "Haridwar" } as any);
      expect(p).toEqual({ lat: 29.9457, lng: 78.1642 });
      expect(resolveLocationPoint({ lat: 120, lng: 5, city: "Haridwar" } as any)).toEqual({ lat: 29.9457, lng: 78.1642 });
    });

    it("accepts coordinates exactly on the valid edges", () => {
      expect(resolveLocationPoint({ lat: 90, lng: 180 } as any)).toEqual({ lat: 90, lng: 180 });
      expect(resolveLocationPoint({ lat: -90, lng: -180 } as any)).toEqual({ lat: -90, lng: -180 });
    });
  });

  describe("same-day shift feasibility", () => {
    const base = new Date("2026-11-01T06:00:00Z");
    const hours = (n: number) => new Date(base.getTime() + n * 3_600_000);
    const shift = (km: number, gapHours: number) =>
      validateShiftTravelFeasibility({
        priorEndAt: base,
        newStartAt: hours(gapHours),
        priorLocation: origin,
        newLocation: at(km),
        maxRadiusKm: 50,
      });

    it("a nearby evening booking with enough time is feasible", () => expect(shift(20, 6).feasible).toBe(true));
    it("a booking over 50 km is refused however much time there is", () => {
      const r = shift(51, 24);
      expect(r.feasible).toBe(false);
      expect(r.reason).toMatch(/straight/);
    });
    it("a nearby booking without enough buffer is refused, and says the km are straight-line", () => {
      const r = shift(20, 0.5);
      expect(r.feasible).toBe(false);
      expect(r.reason).toMatch(/Insufficient buffer/);
      expect(r.reason).toMatch(/straight-line/);
    });
    it("a booking that starts before the previous one ends is refused", () => expect(shift(1, -1).feasible).toBe(false));
    it("an unlocatable destination is refused", () => {
      const r = validateShiftTravelFeasibility({
        priorEndAt: base, newStartAt: hours(8), priorLocation: origin, newLocation: { city: "Zzyzx" }, maxRadiusKm: 50,
      });
      expect(r.feasible).toBe(false);
    });
  });
});
