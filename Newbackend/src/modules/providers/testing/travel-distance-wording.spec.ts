import { validateTravelDistance, validateShiftTravelFeasibility } from "../domain/travel-distance.util";

describe("Travel distance messages state straight-line distance", () => {
  const mentionsStraightLine = (m?: string) => /straight[- ]line/i.test(m ?? "");

  it("over-limit message says straight line, not road distance", () => {
    const r = validateTravelDistance("Noida", "Agra", 50);
    expect(r.valid).toBe(false);
    expect(mentionsStraightLine(r.reason)).toBe(true);
    expect(r.reason).toMatch(/not road distance/i);
  });

  it("unresolvable coordinates message says straight-line distance", () => {
    const r = validateTravelDistance("Noida", "Nowhereville", 50);
    expect(r.valid).toBe(false);
    expect(r.distanceKm).toBeNull();
    expect(mentionsStraightLine(r.reason)).toBe(true);
  });

  it("buffer-shortfall message labels the km as straight-line", () => {
    const r = validateShiftTravelFeasibility({
      priorEndAt: new Date("2026-11-01T12:00:00Z"),
      newStartAt: new Date("2026-11-01T12:30:00Z"),
      priorLocation: { city: "Noida" },
      newLocation: { city: "Gurugram" },
      maxRadiusKm: 50,
    });
    expect(r.feasible).toBe(false);
    expect(mentionsStraightLine(r.reason)).toBe(true);
  });

  it("over-limit shift message keeps the straight-line wording", () => {
    const r = validateShiftTravelFeasibility({
      priorEndAt: new Date("2026-11-01T06:00:00Z"),
      newStartAt: new Date("2026-11-01T14:00:00Z"),
      priorLocation: { city: "Noida" },
      newLocation: { city: "Agra" },
      maxRadiusKm: 50,
    });
    expect(r.feasible).toBe(false);
    expect(mentionsStraightLine(r.reason)).toBe(true);
  });
});
