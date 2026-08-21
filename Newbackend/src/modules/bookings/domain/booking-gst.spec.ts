import {
  PLATFORM_FEE_GST_PERCENT,
  platformFeeGst,
  roundMoney,
} from "./booking.utils";

describe("booking GST is levied on the platform fee only", () => {
  const total = (
    stay: number,
    platformFee: number,
    percent = PLATFORM_FEE_GST_PERCENT,
  ) => {
    const gst = platformFeeGst(platformFee, percent);
    return { gst, total: roundMoney(stay + platformFee + gst) };
  };

  it("charges 1059 for a 1000 room with a 50 platform fee", () => {
    const { gst, total: payable } = total(1000, 50);
    expect(gst).toBe(9);
    expect(payable).toBe(1059);
  });

  it("does not tax the stay, however large it is", () => {
    expect(total(100_000, 50).gst).toBe(9);
    expect(total(100_000, 50).total).toBe(100_059);
  });

  it("charges no GST when the platform fee is waived", () => {
    const { gst, total: payable } = total(1000, 0);
    expect(gst).toBe(0);
    expect(payable).toBe(1000);
  });

  it("keeps fractional GST to paise rather than losing it", () => {
    expect(platformFeeGst(49)).toBe(8.82);
    expect(total(1000, 49).total).toBe(1057.82);
  });

  it("converts to exact integer paise for the gateway", () => {
    for (let fee = 0; fee <= 500; fee += 1) {
      const gst = platformFeeGst(fee);
      const payable = roundMoney(1000 + fee + gst);
      const paise = Math.round(payable * 100);
      expect(Number.isInteger(paise)).toBe(true);
      expect(paise / 100).toBe(payable);
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
    for (const fee of [49, 50, 33, 7, 123.45]) {
      const gst = platformFeeGst(fee);
      const cgst = roundMoney(gst / 2);
      const sgst = roundMoney(gst - cgst);
      expect(roundMoney(cgst + sgst)).toBe(gst);
    }
  });
});
