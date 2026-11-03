import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  areaLabelForCity,
  assertInLocation,
  assertWritableInLocation,
  locationFilter,
  locationMatches,
  placeTermsForCity,
  withLocation,
  type LocationScope,
} from "./location-scope";

const vrindavan: LocationScope = { city: "Vrindavan", officeName: "Braj Office", terms: placeTermsForCity("Vrindavan") };
const haridwar: LocationScope = { city: "Haridwar", officeName: "Haridwar Office", terms: placeTermsForCity("Haridwar") };
const noOffice: LocationScope = { city: "", officeName: "", terms: [] };

describe("HR location scope", () => {
  it("treats Vrindavan and Mathura as one area, in either direction and any spelling", () => {
    expect(placeTermsForCity("Vrindavan")).toEqual(expect.arrayContaining(["vrindavan", "mathura", "vrindaban"]));
    expect(placeTermsForCity("  MATHURA ")).toEqual(placeTermsForCity("Vrindavan"));
    expect(placeTermsForCity("Haridwar")).toEqual(["haridwar"]);
    expect(placeTermsForCity("")).toEqual([]);
    expect(areaLabelForCity("mathura")).toBe("Vrindavan & Mathura");
    expect(areaLabelForCity("haridwar")).toBe("Haridwar");
  });

  it("matches addresses written in many shapes", () => {
    expect(locationMatches(vrindavan, "Raman Reti, Vrindavan, UP 281121")).toBe(true);
    expect(locationMatches(vrindavan, "near Bankey Bihari, VRINDABAN")).toBe(true);
    expect(locationMatches(vrindavan, null, undefined, "Mathura Junction")).toBe(true);
    expect(locationMatches(vrindavan, ["Delhi", "Mathura"])).toBe(true);
    expect(locationMatches(vrindavan, "Har Ki Pauri, Haridwar")).toBe(false);
    expect(locationMatches(haridwar, "Raman Reti, Vrindavan")).toBe(false);
  });

  it("is a no-op for roles that are not location-restricted", () => {
    expect(locationMatches(null, "anywhere")).toBe(true);
    expect(locationFilter(null, ["address"])).toEqual({});
    expect(withLocation({ status: "active" }, null, ["address"])).toEqual({ status: "active" });
  });

  it("shows nothing to an HR login without an office", () => {
    expect(locationMatches(noOffice, "Vrindavan")).toBe(false);
    expect(locationFilter(noOffice, ["address"])).toEqual({ _id: { $in: [] } });
    expect(() => assertWritableInLocation(noOffice, "Vrindavan")).toThrow(/no office assigned/);
  });

  it("builds a case-insensitive filter and keeps an existing $or intact", () => {
    const filter = withLocation({ $or: [{ name: /a/ }] }, haridwar, ["address", "city"]) as any;
    expect(filter.$and[0]).toEqual({ $or: [{ name: /a/ }] });
    expect(filter.$and[1].$or).toHaveLength(2);
    expect(filter.$and[1].$or[0].address.test("HARIDWAR")).toBe(true);
  });

  it("hides out-of-area records as not found and refuses out-of-area writes", () => {
    expect(() => assertInLocation(haridwar, "Temple", "Vrindavan")).toThrow(NotFoundException);
    expect(() => assertInLocation(haridwar, "Temple", "Haridwar")).not.toThrow();
    expect(() => assertWritableInLocation(haridwar, "Vrindavan")).toThrow(ForbiddenException);
  });
});
