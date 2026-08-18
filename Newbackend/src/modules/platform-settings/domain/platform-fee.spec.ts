import {
  DEFAULT_PLATFORM_FEE_SCOPES,
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
    // The regression: a booking_policies row used to be consulted first, so a
    // ₹200 stay kept attracting a fee while the console read "Disabled".
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
