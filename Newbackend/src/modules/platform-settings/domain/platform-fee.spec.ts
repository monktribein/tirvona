import {
  DEFAULT_PLATFORM_FEE_SCOPES,
  calculateTieredPlatformFeePerRoom,
  platformFeeAppliesTo,
  platformFeeScopesOf,
  resolvePlatformFee,
} from "./platform-fee";

const ENABLED_FLAT = {
  enabled: true,
  type: "flat" as const,
  value: 49,
  appliesTo: ["ashram_booking"],
};

describe("the disabled switch beats everything", () => {
  it("charges nothing when the fee engine is off", () =>
    expect(
      resolvePlatformFee({
        settings: { ...ENABLED_FLAT, enabled: false },
        scope: "ashram_booking",
        baseAmount: 200,
      }),
    ).toBe(0));

  it("charges nothing when off even if a booking policy sets a percentage", () => {
    expect(
      resolvePlatformFee({
        settings: { ...ENABLED_FLAT, enabled: false },
        scope: "ashram_booking",
        baseAmount: 200,
        policyPercent: 24.5,
      }),
    ).toBe(0);
  });

  it("charges nothing when off regardless of the pricing model", () => {
    for (const type of ["flat", "percentage"] as const)
      expect(
        resolvePlatformFee({
          settings: { ...ENABLED_FLAT, enabled: false, type },
          scope: "ashram_booking",
          baseAmount: 1000,
        }),
      ).toBe(0);
  });
});

describe("scope gating", () => {
  it("charges only on the systems that are selected", () => {
    const settings = { ...ENABLED_FLAT, appliesTo: ["ashram_booking"] };
    expect(
      resolvePlatformFee({ settings, scope: "ashram_booking", baseAmount: 200 }),
    ).toBe(49);
    expect(
      resolvePlatformFee({ settings, scope: "parking_booking", baseAmount: 200 }),
    ).toBe(0);
  });

  it("supports several systems at once", () => {
    const settings = {
      ...ENABLED_FLAT,
      appliesTo: ["ashram_booking", "marketplace_order"],
    };
    expect(
      resolvePlatformFee({ settings, scope: "ashram_booking", baseAmount: 200 }),
    ).toBe(49);
    expect(
      resolvePlatformFee({
        settings,
        scope: "marketplace_order",
        baseAmount: 200,
      }),
    ).toBe(49);
    expect(
      resolvePlatformFee({ settings, scope: "parking_booking", baseAmount: 200 }),
    ).toBe(0);
  });

  it("treats an empty selection as levy-nowhere, not as unset", () => {
    const settings = { ...ENABLED_FLAT, appliesTo: [] };
    expect(platformFeeScopesOf(settings)).toEqual([]);
    for (const scope of [
      "ashram_booking",
      "parking_booking",
      "marketplace_order",
    ] as const)
      expect(resolvePlatformFee({ settings, scope, baseAmount: 200 })).toBe(0);
  });

  it("keeps a legacy row with no appliesTo charging exactly what it did before", () => {
    const legacy = { enabled: true, type: "flat" as const, value: 49 };
    expect(platformFeeScopesOf(legacy)).toEqual(DEFAULT_PLATFORM_FEE_SCOPES);
    expect(
      resolvePlatformFee({
        settings: legacy,
        scope: "ashram_booking",
        baseAmount: 200,
      }),
    ).toBe(49);
    expect(
      resolvePlatformFee({
        settings: legacy,
        scope: "parking_booking",
        baseAmount: 200,
      }),
    ).toBe(0);
  });

  it("ignores unrecognised scope values", () =>
    expect(platformFeeScopesOf({ appliesTo: ["ashram_booking", "nonsense"] })).toEqual(
      ["ashram_booking"],
    ));

  it("reports applicability directly", () => {
    expect(platformFeeAppliesTo(ENABLED_FLAT, "ashram_booking")).toBe(true);
    expect(platformFeeAppliesTo(ENABLED_FLAT, "parking_booking")).toBe(false);
    expect(
      platformFeeAppliesTo({ ...ENABLED_FLAT, enabled: false }, "ashram_booking"),
    ).toBe(false);
  });
});

describe("the enabled fee amount", () => {
  it("charges the flat rupee value", () =>
    expect(
      resolvePlatformFee({
        settings: ENABLED_FLAT,
        scope: "ashram_booking",
        baseAmount: 200,
      }),
    ).toBe(49));

  it("charges a percentage of the booking value", () =>
    expect(
      resolvePlatformFee({
        settings: { ...ENABLED_FLAT, type: "percentage", value: 2 },
        scope: "ashram_booking",
        baseAmount: 1000,
      }),
    ).toBe(20));

  it("lets a booking policy override the rate inside an enabled scope", () =>
    expect(
      resolvePlatformFee({
        settings: ENABLED_FLAT,
        scope: "ashram_booking",
        baseAmount: 1000,
        policyPercent: 5,
      }),
    ).toBe(50));

  it("takes an updated value immediately", () => {
    for (const [value, expected] of [
      [49, 49],
      [99, 99],
      [0, 0],
    ] as const)
      expect(
        resolvePlatformFee({
          settings: { ...ENABLED_FLAT, value },
          scope: "ashram_booking",
          baseAmount: 200,
        }),
      ).toBe(expected);
  });

  it("falls back to the seeded default when no settings row exists", () =>
    expect(
      resolvePlatformFee({
        settings: null,
        scope: "ashram_booking",
        baseAmount: 200,
      }),
    ).toBe(49));

  it("never returns a negative fee", () => {
    expect(
      resolvePlatformFee({
        settings: { ...ENABLED_FLAT, value: -100 },
        scope: "ashram_booking",
        baseAmount: 200,
      }),
    ).toBe(0);
    expect(
      resolvePlatformFee({
        settings: ENABLED_FLAT,
        scope: "ashram_booking",
        baseAmount: -200,
        policyPercent: 10,
      }),
    ).toBe(0);
  });
});

describe("Phase 16 — Tiered Platform Fee & Charitable Rules", () => {
  const TIERED_SETTINGS = {
    enabled: true,
    type: "tiered" as const,
    appliesTo: ["ashram_booking"],
  };

  it("calculates correct fee for boundary values per room", () => {
    // Below ₹1,000: ₹50
    expect(calculateTieredPlatformFeePerRoom(999)).toBe(50);
    expect(calculateTieredPlatformFeePerRoom(0)).toBe(50);
    expect(calculateTieredPlatformFeePerRoom(500)).toBe(50);

    // ₹1,000 to below ₹2,000: ₹75
    expect(calculateTieredPlatformFeePerRoom(1000)).toBe(75);
    expect(calculateTieredPlatformFeePerRoom(1500)).toBe(75);
    expect(calculateTieredPlatformFeePerRoom(1999)).toBe(75);

    // ₹2,000 and above: ₹100
    expect(calculateTieredPlatformFeePerRoom(2000)).toBe(100);
    expect(calculateTieredPlatformFeePerRoom(2500)).toBe(100);
    expect(calculateTieredPlatformFeePerRoom(10000)).toBe(100);
  });

  it("resolves tiered platform fee for single room across boundaries", () => {
    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 999,
        roomsCount: 1,
      }),
    ).toBe(50);

    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 1000,
        roomsCount: 1,
      }),
    ).toBe(75);

    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 1999,
        roomsCount: 1,
      }),
    ).toBe(75);

    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 2000,
        roomsCount: 1,
      }),
    ).toBe(100);
  });

  it("calculates tiered platform fee correctly for multiple rooms", () => {
    // 2 rooms at ₹1,000 each = ₹2,000 total (₹1,000 per room => ₹75 per room * 2 = ₹150)
    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 2000,
        roomsCount: 2,
      }),
    ).toBe(150);

    // 3 rooms at ₹500 each = ₹1,500 total (₹500 per room => ₹50 per room * 3 = ₹150)
    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 1500,
        roomsCount: 3,
      }),
    ).toBe(150);

    // 2 rooms at ₹2,500 each = ₹5,000 total (₹2,500 per room => ₹100 per room * 2 = ₹200)
    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 5000,
        roomsCount: 2,
      }),
    ).toBe(200);
  });

  it("exempts charitable institutions / trusts from booking commission (₹0 fee)", () => {
    expect(
      resolvePlatformFee({
        settings: TIERED_SETTINGS,
        scope: "ashram_booking",
        baseAmount: 5000,
        roomsCount: 2,
        isCharitable: true,
      }),
    ).toBe(0);

    expect(
      resolvePlatformFee({
        settings: ENABLED_FLAT,
        scope: "ashram_booking",
        baseAmount: 1000,
        isCharitable: true,
      }),
    ).toBe(0);
  });
});

