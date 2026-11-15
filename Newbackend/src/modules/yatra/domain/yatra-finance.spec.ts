import {
  commissionBreakdown,
  compareGatewayPayment,
  payeeBalance,
  pickRule,
  refundReversal,
  ruleKeyFor,
  snapshotOf,
} from "./yatra-finance";

const rule = (over: Record<string, unknown>) => ({
  ruleKey: "k",
  version: 1,
  appliesTo: "yatra_booking",
  channel: "any",
  commissionBps: 1000,
  flatFee: 0,
  taxOnCommissionBps: 1800,
  tdsBps: 10,
  ...over,
});

describe("yatra finance maths", () => {
  it("computes commission, GST on commission and TDS from the snapshot, never from constants", () => {
    const snap = snapshotOf(rule({}) as any);
    expect(commissionBreakdown(3000, snap)).toEqual({ gross: 3000, commission: 300, taxOnCommission: 54, tds: 3, net: 2643 });
    expect(commissionBreakdown(3000, snapshotOf(rule({ commissionBps: 0, taxOnCommissionBps: 0, tdsBps: 0 }) as any)).net).toBe(3000);
    expect(commissionBreakdown(100, snapshotOf(rule({ commissionBps: 0, flatFee: 500 }) as any)).commission).toBe(100);
    expect(snapshotOf(null)).toMatchObject({ missing: true });
  });

  it("reverses the matching share of commission and taxes on a refund", () => {
    const original = commissionBreakdown(3000, snapshotOf(rule({}) as any));
    expect(refundReversal(original, 2700)).toEqual({ refundDeduction: 2700, commissionReversal: 270, taxReversal: 48.6, tdsReversal: 2.7 });
    const full = refundReversal(original, 3000);
    const net = original.gross - original.commission - original.taxOnCommission - original.tds - full.refundDeduction + full.commissionReversal + full.taxReversal + full.tdsReversal;
    expect(Math.round(net * 100)).toBe(0);
  });

  it("picks the most specific active rule", () => {
    const rules = [
      rule({ ruleKey: ruleKeyFor("yatra_booking", "any"), channel: "any", commissionBps: 1000 }),
      rule({ ruleKey: ruleKeyFor("yatra_booking", "DIRECT"), channel: "DIRECT", commissionBps: 300 }),
      rule({ ruleKey: ruleKeyFor("yatra_booking", "any", "op1"), channel: "any", operatorId: "op1", commissionBps: 500 }),
      rule({ appliesTo: "ride", ruleKey: ruleKeyFor("ride", "any"), commissionBps: 1500 }),
    ];
    expect(pickRule(rules, { appliesTo: "yatra_booking", channel: "MARKETPLACE" })?.commissionBps).toBe(1000);
    expect(pickRule(rules, { appliesTo: "yatra_booking", channel: "DIRECT" })?.commissionBps).toBe(300);
    expect(pickRule(rules, { appliesTo: "yatra_booking", channel: "DIRECT", operatorId: "op1" })?.commissionBps).toBe(500);
    expect(pickRule(rules, { appliesTo: "addon_referral", channel: "any" })).toBeNull();
  });

  it("separates delivered (available) from not-yet-delivered (pending) earnings and nets transfers", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 86_400_000);
    const b = payeeBalance([
      { entryType: "gross_earning", direction: "credit", amount: 3000, eligibleAt: past },
      { entryType: "commission", direction: "debit", amount: 300, eligibleAt: past },
      { entryType: "tax_on_commission", direction: "debit", amount: 54, eligibleAt: past },
      { entryType: "tds", direction: "debit", amount: 3, eligibleAt: past },
      { entryType: "gross_earning", direction: "credit", amount: 1500, eligibleAt: future },
      { entryType: "transfer", direction: "debit", amount: 1000, eligibleAt: past },
      { entryType: "adjustment", direction: "credit", amount: 50, eligibleAt: past },
    ]);
    expect(b).toMatchObject({ grossEarnings: 4500, commission: 300, taxOnCommission: 54, tds: 3, transfers: 1000, adjustments: 50, available: 1693, pending: 1500 });
  });

  it("flags payments Razorpay does not confirm", () => {
    expect(compareGatewayPayment({ paymentId: "p", amount: 1500 }, { status: "captured", amount: 150000 })).toBeNull();
    expect(compareGatewayPayment({ paymentId: "p", amount: 1500 }, { status: "captured", amount: 100000 })).toBe("amount_mismatch");
    expect(compareGatewayPayment({ paymentId: "p", amount: 1500 }, { status: "failed", amount: 150000 })).toBe("razorpay_status_failed");
    expect(compareGatewayPayment({ paymentId: "p", amount: 1500 }, null)).toBe("missing_at_razorpay");
  });
});
