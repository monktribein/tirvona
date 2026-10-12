import { earningOf, platformFeeMinor, providerPlatformFeeBps } from "./platform-fee";

describe("pandit booking platform fee", () => {
  const saved = process.env.PROVIDER_PLATFORM_FEE_BPS;
  afterEach(() => {
    if (saved === undefined) delete process.env.PROVIDER_PLATFORM_FEE_BPS;
    else process.env.PROVIDER_PLATFORM_FEE_BPS = saved;
  });

  it("is 10% by default and adds to the devotee's price: ₹501 + ₹50.10 = ₹551.10", () => {
    delete process.env.PROVIDER_PLATFORM_FEE_BPS;
    expect(providerPlatformFeeBps()).toBe(1000);
    expect(platformFeeMinor(50100)).toBe(5010);
  });

  it("follows the configured rate, clamped to 0..100%, and can be switched off", () => {
    process.env.PROVIDER_PLATFORM_FEE_BPS = "500";
    expect(platformFeeMinor(50100)).toBe(2505);
    process.env.PROVIDER_PLATFORM_FEE_BPS = "0";
    expect(platformFeeMinor(50100)).toBe(0);
    process.env.PROVIDER_PLATFORM_FEE_BPS = "99999";
    expect(providerPlatformFeeBps()).toBe(10_000);
    process.env.PROVIDER_PLATFORM_FEE_BPS = "not-a-number";
    expect(providerPlatformFeeBps()).toBe(1000);
  });

  it("credits the pandit everything except Tirvona's fee line", () => {
    const pricing = {
      totalMinor: 55110,
      lines: [
        { code: "PROVIDER_SERVICE", amountMinor: 50100 },
        { code: "TRAVEL", amountMinor: 0 },
        { code: "PLATFORM_FEE", amountMinor: 5010 },
      ],
    };
    expect(earningOf(pricing)).toEqual({ grossMinor: 55110, platformFeeMinor: 5010, netMinor: 50100 });
  });

  it("credits the whole total for bookings made before the fee existed", () => {
    expect(earningOf({ totalMinor: 50100, lines: [{ code: "PROVIDER_SERVICE", amountMinor: 50100 }] })).toEqual({
      grossMinor: 50100,
      platformFeeMinor: 0,
      netMinor: 50100,
    });
    expect(earningOf(undefined)).toEqual({ grossMinor: 0, platformFeeMinor: 0, netMinor: 0 });
  });
});
