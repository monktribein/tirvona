import {
  PLATFORM_FEE_GST_PERCENT,
  platformFeeGst,
  roundMoney,
} from "./booking.utils";

/**
 * GST is charged on the Tirvona platform fee only. An ashram stay is
 * accommodation supplied by the trust, so the room, add-on services,
 * extra-guest charge and donation are never taxed here.
 */
describe("booking GST is levied on the platform fee only", () => {
  /** The total a guest is charged, mirroring BookingPricingService.quote. */
  const total = (
    stay: number,
    platformFee: number,
    percent = PLATFORM_FEE_GST_PERCENT,
  ) => {
    const gst = platformFeeGst(platformFee, percent);
    return { gst, total: roundMoney(stay + platformFee + gst) };
  };

  it("charges 1059 for a 1000 room with a 50 platform fee", () => {
    // The worked example this rule was specified with.
    const { gst, total: payable } = total(1000, 50);
    expect(gst).toBe(9);
    expect(payable).toBe(1059);
  });

  it("does not tax the stay, however large it is", () => {
    // A 100x more expensive room adds no GST at all — only the fee is taxed.
    expect(total(100_000, 50).gst).toBe(9);
    expect(total(100_000, 50).total).toBe(100_059);
  });

  it("charges no GST when the platform fee is waived", () => {
    const { gst, total: payable } = total(1000, 0);
    expect(gst).toBe(0);
    expect(payable).toBe(1000);
  });

  it("keeps fractional GST to paise rather than losing it", () => {
    // 18% of the 49 default fee is 8.82 — rounding to a whole rupee would
    // overcharge and make the invoice disagree with the gateway amount.
    expect(platformFeeGst(49)).toBe(8.82);
    expect(total(1000, 49).total).toBe(1057.82);
  });

  /**
   * Razorpay is charged in integer paise, so the total has to convert exactly.
   *
   * `gst * 100` is NOT reliably an integer in binary floating point — 4.14 * 100
   * is 413.99999999999994, and 62 of the first 501 whole-rupee fees land like
   * that. The value is still a true paise amount; it is the multiplication that
   * is lossy. This pins that `Math.round(total * 100)`, which is what
   * `paymentOrder` sends, recovers the exact paise for every one of them —
   * truncating instead would undercharge by a paise on a third of all fees.
   */
  it("converts to exact integer paise for the gateway", () => {
    for (let fee = 0; fee <= 500; fee += 1) {
      const gst = platformFeeGst(fee);
      const payable = roundMoney(1000 + fee + gst);
      const paise = Math.round(payable * 100);
      expect(Number.isInteger(paise)).toBe(true);
      // Round-trips back to the rupee amount the invoice shows.
      expect(paise / 100).toBe(payable);
      // And the lossy form really can disagree, which is why rounding matters.
      expect(Math.abs(payable * 100 - paise)).toBeLessThan(1e-6);
    }
  });

  it("honours a platform-configured rate", () => {
    expect(platformFeeGst(50, 0)).toBe(0);
    expect(platformFeeGst(50, 5)).toBe(2.5);
    expect(platformFeeGst(50, 18)).toBe(9);
  });

  it("treats a negative fee as zero rather than crediting tax", () => {
    expect(platformFeeGst(-50)).toBe(0);
  });

  it("splits GST into CGST and SGST without losing a paise", () => {
    // The invoice halves the tax; an odd paise must not vanish.
    for (const fee of [49, 50, 33, 7, 123.45]) {
      const gst = platformFeeGst(fee);
      const cgst = roundMoney(gst / 2);
      const sgst = roundMoney(gst - cgst);
      expect(roundMoney(cgst + sgst)).toBe(gst);
    }
  });
});
