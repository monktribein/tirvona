import {
  bookingReference,
  checkinCode,
  eachNight,
  financialReference,
  reservationReference,
  resolveBookingAddon,
} from "./booking.utils";

describe("booking domain utilities", () => {
  it("uses hotel-night semantics and excludes checkout", () => {
    expect(
      eachNight(
        new Date("2026-08-01T00:00:00.000Z"),
        new Date("2026-08-04T00:00:00.000Z"),
      ).map((d) => d.toISOString().slice(0, 10)),
    ).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("handles UTC boundaries without adding a checkout night", () => {
    expect(
      eachNight(
        new Date("2026-12-31T00:00:00.000Z"),
        new Date("2027-01-01T00:00:00.000Z"),
      ),
    ).toHaveLength(1);
  });

  it("creates stable external reference formats", () => {
    expect(bookingReference()).toMatch(/^TRV-[A-Z0-9]+-[A-Z0-9]{5}$/);
    expect(reservationReference()).toMatch(/^RES-\d{8}$/);
    expect(financialReference("INV")).toMatch(
      /^INV-[A-Z0-9]+-[A-Z0-9]{8}$/,
    );
  });

  it("creates a six digit check-in code", () =>
    expect(checkinCode()).toMatch(/^\d{6}$/));
});

describe("resolveBookingAddon", () => {
  it("resolves a current owner-managed add-on", () => {
    const addon = resolveBookingAddon(
      [{ _id: "managed-id", name: "Meal", price: 100, enabled: true }],
      [],
      "managed-id",
    );

    expect(addon).toMatchObject({ name: "Meal", price: 100 });
  });

  it("keeps legacy embedded ashram add-ons bookable", () => {
    const addon = resolveBookingAddon(
      [],
      [{ _id: "legacy-id", name: "City tour", price: 500, enabled: true }],
      "legacy-id",
    );

    expect(addon).toMatchObject({ name: "City tour", price: 500 });
  });

  it("rejects disabled and unknown add-ons", () => {
    const catalog = [{ _id: "disabled-id", enabled: false }];

    expect(resolveBookingAddon(catalog, [], "disabled-id")).toBeUndefined();
    expect(resolveBookingAddon(catalog, [], "unknown-id")).toBeUndefined();
  });

  it("prefers the current catalog if IDs overlap", () => {
    const addon = resolveBookingAddon(
      [{ _id: "same-id", name: "Current", price: 200, enabled: true }],
      [{ _id: "same-id", name: "Legacy", price: 100, enabled: true }],
      "same-id",
    );

    expect(addon).toMatchObject({ name: "Current", price: 200 });
  });
});
