import {
  haversineDistanceKm,
  resolveLocationPoint,
  validateTravelDistance,
  validateShiftTravelFeasibility,
} from "./travel-distance.util";

describe("travel-distance.util", () => {
  describe("haversineDistanceKm", () => {
    it("returns 0 for the same coordinates", () => {
      expect(haversineDistanceKm(28.5355, 77.391, 28.5355, 77.391)).toBe(0);
    });

    it("calculates accurate distance between Noida and Delhi (~21 km)", () => {
      const d = haversineDistanceKm(28.5355, 77.391, 28.6139, 77.209);
      expect(d).toBeGreaterThan(18);
      expect(d).toBeLessThan(25);
    });

    it("calculates accurate distance between Mathura and Vrindavan (~10-12 km)", () => {
      const d = haversineDistanceKm(27.4924, 77.6737, 27.5806, 77.7007);
      expect(d).toBeGreaterThan(8);
      expect(d).toBeLessThan(15);
    });

    it("calculates distance between Noida and Mathura as over 120 km", () => {
      const d = haversineDistanceKm(28.5355, 77.391, 27.4924, 77.6737);
      expect(d).toBeGreaterThan(115);
    });
  });

  describe("resolveLocationPoint", () => {
    it("resolves city string case-insensitively", () => {
      const pt = resolveLocationPoint("Noida");
      expect(pt).toEqual({ lat: 28.5355, lng: 77.391 });
    });

    it("resolves structured service location with explicit coordinates", () => {
      const pt = resolveLocationPoint({
        city: "Custom Location",
        lat: 28.5,
        lng: 77.4,
      });
      expect(pt).toEqual({ lat: 28.5, lng: 77.4 });
    });

    it("resolves structured location with GeoJSON coordinates", () => {
      const pt = resolveLocationPoint({
        coordinates: { coordinates: [77.391, 28.5355] },
      });
      expect(pt).toEqual({ lat: 28.5355, lng: 77.391 });
    });

    it("returns null for unknown city without coordinates", () => {
      expect(resolveLocationPoint("UnknownFarawayVillageXYZ123")).toBeNull();
    });
  });

  describe("validateTravelDistance", () => {
    it("accepts same-day locations within 50 km (e.g. Noida to Delhi)", () => {
      const result = validateTravelDistance("Noida", "Delhi", 50);
      expect(result.valid).toBe(true);
      expect(result.distanceKm).toBeLessThan(50);
    });

    it("rejects same-day locations exceeding 50 km (e.g. Noida to Mathura)", () => {
      const result = validateTravelDistance("Noida", "Mathura", 50);
      expect(result.valid).toBe(false);
      expect(result.distanceKm).toBeGreaterThan(100);
      expect(result.reason).toContain("exceeding the maximum allowed travel radius");
    });

    it("fails when location cannot be geocoded", () => {
      const result = validateTravelDistance("Noida", "NonExistentCity999", 50);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Unable to determine the straight-line distance");
    });
  });

  describe("validateShiftTravelFeasibility", () => {
    it("permits evening booking with sufficient transit and prep time", () => {
      const priorEnd = new Date("2026-10-25T12:00:00.000Z"); // Morning service finishes at 12:00 PM
      const newStart = new Date("2026-10-25T17:00:00.000Z"); // Evening service starts at 5:00 PM (5 hours buffer)
      const res = validateShiftTravelFeasibility({
        priorEndAt: priorEnd,
        newStartAt: newStart,
        priorLocation: { city: "Noida" },
        newLocation: { city: "Delhi" },
        maxRadiusKm: 50,
      });
      expect(res.feasible).toBe(true);
      expect(res.distanceKm).toBeLessThan(50);
    });

    it("rejects evening booking when time buffer is insufficient for travel", () => {
      const priorEnd = new Date("2026-10-25T12:00:00.000Z");
      const newStart = new Date("2026-10-25T12:30:00.000Z"); // Only 30 mins buffer for a 20 km trip!
      const res = validateShiftTravelFeasibility({
        priorEndAt: priorEnd,
        newStartAt: newStart,
        priorLocation: { city: "Noida" },
        newLocation: { city: "Delhi" },
        maxRadiusKm: 50,
      });
      expect(res.feasible).toBe(false);
      expect(res.reason).toContain("Insufficient buffer time");
    });
  });
});
