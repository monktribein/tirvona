import {
  calculateRefund,
  resolveWindow,
  type RefundPolicyInput,
  type RefundSourceInput,
} from "./refund-calculator";

const NOW = new Date("2026-08-06T10:00:00Z");
const in72h = new Date("2026-08-09T10:00:00Z");
const in30h = new Date("2026-08-07T16:00:00Z");
const in2h = new Date("2026-08-06T12:00:00Z");
const passed10d = new Date("2026-07-27T10:00:00Z");

const POLICY: RefundPolicyInput = {
  cancellationWindows: [
    { label: "48h+", hoursBefore: 48, refundPercent: 100 },
    { label: "24h+", hoursBefore: 24, refundPercent: 50 },
  ],
  defaultRefundPercent: 0,
  processingFee: { type: "none" },
  refundAddOns: true,
  refundDonation: false,
  refundPlatformFee: false,
  refundGst: false,
};

/** A ₹5,000 stay: ₹49 platform fee, ₹8.82 GST, ₹300 add-ons, ₹200 donation. */
const SOURCE: RefundSourceInput = {
  amountPaid: 5557.82,
  baseAmount: 5000,
  addOnsAmount: 300,
  donationAmount: 200,
  platformFee: 49,
  gstAmount: 8.82,
  serviceDate: in72h,
};

describe("resolveWindow", () => {
  it("picks the most generous window the request qualifies for", () => {
    expect(resolveWindow(POLICY, 72)?.refundPercent).toBe(100);
    expect(resolveWindow(POLICY, 30)?.refundPercent).toBe(50);
  });

  it("returns nothing when no window is met", () => {
    expect(resolveWindow(POLICY, 2)).toBeNull();
  });

  it("is order-independent — windows are sorted before evaluation", () => {
    const shuffled: RefundPolicyInput = {
      cancellationWindows: [
        { label: "24h+", hoursBefore: 24, refundPercent: 50 },
        { label: "48h+", hoursBefore: 48, refundPercent: 100 },
      ],
    };
    expect(resolveWindow(shuffled, 72)?.refundPercent).toBe(100);
  });
});

describe("calculateRefund", () => {
  it("refunds the eligible components in full inside the 48h window", () => {
    const result = calculateRefund(POLICY, SOURCE, NOW);

    expect(result.refundPercent).toBe(100);
    // base 5000 + add-ons 300; donation, fee and GST retained by this policy.
    expect(result.refundableComponents).toEqual({
      base: 5000,
      addOns: 300,
      donation: 0,
      platformFee: 0,
      gst: 0,
    });
    expect(result.grossRefundable).toBe(5300);
    expect(result.netRefundable).toBe(5300);
    expect(result.nonRefundableAmount).toBe(257.82);
  });

  it("halves the eligible components in the 24h window", () => {
    const result = calculateRefund(POLICY, { ...SOURCE, serviceDate: in30h }, NOW);

    expect(result.refundPercent).toBe(50);
    expect(result.netRefundable).toBe(2650);
  });

  it("refunds nothing once every window has lapsed", () => {
    const result = calculateRefund(POLICY, { ...SOURCE, serviceDate: in2h }, NOW);

    expect(result.refundPercent).toBe(0);
    expect(result.netRefundable).toBe(0);
    expect(result.nonRefundableAmount).toBe(5557.82);
  });

  /**
   * GST on the platform fee is remitted onward, so it can only return with the
   * fee it was charged on — otherwise the platform refunds tax it cannot
   * reclaim.
   */
  it("will not refund GST while the platform fee is retained", () => {
    const result = calculateRefund(
      { ...POLICY, refundGst: true, refundPlatformFee: false },
      SOURCE,
      NOW,
    );

    expect(result.refundableComponents.gst).toBe(0);
    expect(result.notes.join(" ")).toContain("platform fee it was charged on");
  });

  it("refunds fee and GST together when both are enabled", () => {
    const result = calculateRefund(
      { ...POLICY, refundGst: true, refundPlatformFee: true },
      SOURCE,
      NOW,
    );

    expect(result.refundableComponents.platformFee).toBe(49);
    expect(result.refundableComponents.gst).toBe(8.82);
    expect(result.netRefundable).toBe(5357.82);
  });

  it("includes the donation only when the policy allows it", () => {
    const result = calculateRefund({ ...POLICY, refundDonation: true }, SOURCE, NOW);

    expect(result.refundableComponents.donation).toBe(200);
    expect(result.netRefundable).toBe(5500);
  });

  it("excludes add-ons when the policy says they are non-refundable", () => {
    const result = calculateRefund({ ...POLICY, refundAddOns: false }, SOURCE, NOW);

    expect(result.refundableComponents.addOns).toBe(0);
    expect(result.netRefundable).toBe(5000);
  });

  it("deducts a flat processing fee", () => {
    const result = calculateRefund(
      { ...POLICY, processingFee: { type: "flat", value: 100 } },
      SOURCE,
      NOW,
    );

    expect(result.processingFee).toBe(100);
    expect(result.netRefundable).toBe(5200);
  });

  it("deducts a percentage processing fee and honours its cap", () => {
    const uncapped = calculateRefund(
      { ...POLICY, processingFee: { type: "percent", value: 5 } },
      SOURCE,
      NOW,
    );
    expect(uncapped.processingFee).toBe(265);

    const capped = calculateRefund(
      { ...POLICY, processingFee: { type: "percent", value: 5, maxAmount: 150 } },
      SOURCE,
      NOW,
    );
    expect(capped.processingFee).toBe(150);
    expect(capped.netRefundable).toBe(5150);
  });

  /** A fee larger than the refund must not produce a negative payout. */
  it("never lets the processing fee exceed the refund", () => {
    const result = calculateRefund(
      { ...POLICY, processingFee: { type: "flat", value: 99_999 } },
      { ...SOURCE, serviceDate: in30h },
      NOW,
    );

    expect(result.processingFee).toBe(result.grossRefundable);
    expect(result.netRefundable).toBe(0);
  });

  /**
   * The platform must never return more than it took — the usual cause is a
   * partly paid booking.
   */
  it("caps the refund at the amount actually collected", () => {
    const result = calculateRefund(POLICY, { ...SOURCE, amountPaid: 1000 }, NOW);

    expect(result.grossRefundable).toBe(1000);
    expect(result.netRefundable).toBe(1000);
    expect(result.notes.join(" ")).toContain("capped at the amount actually collected");
  });

  it("refunds nothing once the claim window has closed", () => {
    const result = calculateRefund(
      { ...POLICY, claimWindowHours: 48, defaultRefundPercent: 100 },
      { ...SOURCE, serviceDate: passed10d },
      NOW,
    );

    expect(result.netRefundable).toBe(0);
    expect(result.notes.join(" ")).toContain("Claim window");
  });

  /** Goods have no service date, so window rules cannot gate them. */
  it("treats a source with no service date as fully inside every window", () => {
    const result = calculateRefund(
      POLICY,
      { amountPaid: 899, baseAmount: 899, serviceDate: null },
      NOW,
    );

    expect(result.refundPercent).toBe(100);
    expect(result.netRefundable).toBe(899);
  });

  it("rounds to paise so the refund reconciles against the charge", () => {
    const result = calculateRefund(
      { ...POLICY, cancellationWindows: [{ hoursBefore: 0, refundPercent: 33 }] },
      { amountPaid: 100, baseAmount: 100, serviceDate: in72h },
      NOW,
    );

    expect(result.netRefundable).toBe(33);
    expect(Number.isInteger(result.netRefundable * 100)).toBe(true);
  });
});
