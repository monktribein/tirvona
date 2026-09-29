import { computeWalletBalance } from "./ledger";
import { FULFILLMENT_TRANSITIONS, PAYOUT_TRANSITIONS, VENDOR_TRANSITIONS, assertTransition } from "./marketplace.constants";
import { percentOf, resolveCommissionPercent, splitCart, toPaise } from "./pricing";

const settings = { defaultGstPercent: 5, shippingFee: 60, freeShippingAbove: 999 };
const line = (over: Partial<Parameters<typeof splitCart>[0][number]> = {}) => ({
  productId: "p1", vendorId: "v1", vendorStoreName: "V1", name: "Item", unitPrice: 100, quantity: 1, commissionPercent: 10, ...over,
});

describe("pricing", () => {
  it("₹1,000 at 10% commission -> ₹100 commission, vendor gross ₹900 (+GST/shipping it collected)", () => {
    const r = splitCart([line({ unitPrice: 1000, gstPercent: 0 })], settings);
    expect(r.vendorOrders[0]).toMatchObject({ subtotal: 1000, commissionAmount: 100, total: 1000, vendorEarning: 900 });
  });

  it("works in paise so sums reconcile exactly", () => {
    const r = splitCart([line({ unitPrice: 33.33, quantity: 3, gstPercent: 18, commissionPercent: 7.5 })], settings);
    const vo = r.vendorOrders[0];
    expect(toPaise(vo.subtotal) + toPaise(vo.gstAmount) + toPaise(vo.shippingFee)).toBe(toPaise(vo.total));
    expect(toPaise(vo.total) - toPaise(vo.commissionAmount)).toBe(toPaise(vo.vendorEarning));
    expect(percentOf(9999, 18)).toBe(1800);
  });

  it("shipping is per vendor order and waived per vendor above the threshold", () => {
    const r = splitCart([line({ vendorId: "a", unitPrice: 1000 }), line({ productId: "p2", vendorId: "b", unitPrice: 100 })], settings);
    expect(r.vendorOrders.map((v) => v.shippingFee)).toEqual([0, 60]);
    expect(r.pricing.shippingFee).toBe(60);
  });

  it("rejects invalid quantities", () => {
    expect(() => splitCart([line({ quantity: 0 })], settings)).toThrow();
    expect(() => splitCart([line({ quantity: 1.5 })], settings)).toThrow();
  });

  it("commission precedence", () => {
    expect(resolveCommissionPercent({ globalDefault: 10 })).toBe(10);
    expect(resolveCommissionPercent({ globalDefault: 10, categoryChain: [null, 12] })).toBe(12);
    expect(resolveCommissionPercent({ globalDefault: 10, categoryChain: [8, 12] })).toBe(8);
    expect(resolveCommissionPercent({ globalDefault: 10, categoryChain: [8], vendorOverride: 0 })).toBe(0);
  });
});

describe("ledger balance", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  it("splits pending vs available by availableAt and tracks payouts", () => {
    const b = computeWalletBalance(
      [
        { type: "sale_credit", amount: 1000, availableAt: new Date("2026-01-01") },
        { type: "commission_debit", amount: 100, availableAt: new Date("2026-01-01") },
        { type: "sale_credit", amount: 500, availableAt: null },
        { type: "commission_debit", amount: 50, availableAt: new Date("2026-02-01") },
        { type: "payout_debit", amount: 400, availableAt: new Date("2026-01-05") },
      ],
      now,
    );
    expect(b).toEqual({ pending: 450, available: 500, lifetimeEarnings: 1350, totalPayoutDebits: 400 });
  });
});

describe("state machines", () => {
  it("allow the documented paths and refuse jumps", () => {
    expect(() => assertTransition(VENDOR_TRANSITIONS, "draft", "pending_verification", "Vendor")).not.toThrow();
    expect(() => assertTransition(VENDOR_TRANSITIONS, "draft", "active", "Vendor")).toThrow();
    expect(() => assertTransition(VENDOR_TRANSITIONS, "deactivated", "active", "Vendor")).toThrow();
    expect(() => assertTransition(FULFILLMENT_TRANSITIONS, "shipped", "cancelled", "Order")).toThrow();
    expect(() => assertTransition(FULFILLMENT_TRANSITIONS, "delivered", "return_requested", "Order")).not.toThrow();
    expect(() => assertTransition(PAYOUT_TRANSITIONS, "paid", "failed", "Payout")).toThrow();
  });
});
