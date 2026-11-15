/**
 * Yatra money maths. Every amount is computed in paise and returned in rupees
 * with two decimals, like the rest of Tirvona. Nothing here hard-codes a rate:
 * all percentages come from the commission rule snapshot a booking carries.
 */
import type { CommissionAppliesTo, PayeeEntryType } from "./yatra.constants";

const paise = (rupees: number) => Math.round((Number(rupees) || 0) * 100);
const rupees = (p: number) => Math.round(p) / 100;
const share = (amountPaise: number, bps: number) => Math.round((amountPaise * Math.max(0, Number(bps) || 0)) / 10000);

/** The rule fields copied onto a booking / ride / add-on when it is created. */
export interface CommissionSnapshot {
  missing?: boolean;
  ruleId?: string;
  ruleKey?: string;
  version?: number;
  appliesTo?: CommissionAppliesTo;
  channel?: string;
  commissionBps?: number;
  flatFee?: number;
  taxOnCommissionBps?: number;
  tdsBps?: number;
  takenAt: string;
}

export const channelOfSource = (source: string): "MARKETPLACE" | "DIRECT" =>
  source === "MARKETPLACE" ? "MARKETPLACE" : "DIRECT";

export const ruleKeyFor = (appliesTo: string, channel: string, operatorId?: string | null, ridePartnerId?: string | null) =>
  `${appliesTo}:${channel || "any"}:${operatorId || "*"}:${ridePartnerId || "*"}`;

interface RuleLike {
  _id?: unknown;
  ruleKey: string;
  version: number;
  appliesTo: string;
  channel: string;
  operatorId?: unknown;
  ridePartnerId?: unknown;
  commissionBps: number;
  flatFee?: number;
  taxOnCommissionBps?: number;
  tdsBps?: number;
}

/**
 * The most specific active rule wins: this payee and this channel, then this
 * payee on any channel, then everyone on this channel, then everyone.
 */
export const pickRule = <T extends RuleLike>(
  rules: T[],
  q: { appliesTo: string; channel: string; operatorId?: string | null; ridePartnerId?: string | null },
): T | null => {
  const payee = q.operatorId ? String(q.operatorId) : q.ridePartnerId ? String(q.ridePartnerId) : "";
  const payeeOf = (r: T) => (r.operatorId ? String(r.operatorId) : r.ridePartnerId ? String(r.ridePartnerId) : "");
  const candidates = rules.filter((r) => r.appliesTo === q.appliesTo && (!payeeOf(r) || payeeOf(r) === payee));
  const score = (r: T) => (payeeOf(r) ? 2 : 0) + (r.channel === q.channel ? 1 : r.channel === "any" ? 0 : -10);
  const ranked = candidates.filter((r) => score(r) >= 0).sort((a, b) => score(b) - score(a));
  return ranked[0] ?? null;
};

export const snapshotOf = (rule: RuleLike | null, now = new Date()): CommissionSnapshot =>
  rule
    ? {
        ruleId: rule._id ? String(rule._id) : undefined,
        ruleKey: rule.ruleKey,
        version: rule.version,
        appliesTo: rule.appliesTo as CommissionAppliesTo,
        channel: rule.channel,
        commissionBps: rule.commissionBps,
        flatFee: rule.flatFee ?? 0,
        taxOnCommissionBps: rule.taxOnCommissionBps ?? 0,
        tdsBps: rule.tdsBps ?? 0,
        takenAt: now.toISOString(),
      }
    : { missing: true, takenAt: now.toISOString() };

export interface CommissionBreakdown {
  gross: number;
  commission: number;
  taxOnCommission: number;
  tds: number;
  net: number;
}

/**
 * Commission on a gross amount under a snapshot. Tax (GST) is charged on the
 * commission; TDS is withheld on the gross. Commission never exceeds gross.
 */
export const commissionBreakdown = (gross: number, snap: CommissionSnapshot): CommissionBreakdown => {
  const g = paise(gross);
  const commission = Math.min(g, share(g, snap.commissionBps ?? 0) + paise(snap.flatFee ?? 0));
  const tax = share(commission, snap.taxOnCommissionBps ?? 0);
  const tds = share(g, snap.tdsBps ?? 0);
  return {
    gross: rupees(g),
    commission: rupees(commission),
    taxOnCommission: rupees(tax),
    tds: rupees(tds),
    net: rupees(g - commission - tax - tds),
  };
};

/**
 * What a refund takes back from a payee: the refunded amount, with the
 * matching share of commission, tax and TDS returned to the payee. A 100%
 * refund leaves the payee's net for that booking at exactly zero.
 */
export const refundReversal = (original: CommissionBreakdown, refundAmount: number) => {
  const g = paise(original.gross);
  const r = Math.min(g, paise(refundAmount));
  if (!g || !r) return { refundDeduction: 0, commissionReversal: 0, taxReversal: 0, tdsReversal: 0 };
  const ratio = r / g;
  const full = r === g;
  const part = (amount: number) => (full ? paise(amount) : Math.round(paise(amount) * ratio));
  return {
    refundDeduction: rupees(r),
    commissionReversal: rupees(part(original.commission)),
    taxReversal: rupees(part(original.taxOnCommission)),
    tdsReversal: rupees(part(original.tds)),
  };
};

const CREDIT_TYPES: PayeeEntryType[] = ["gross_earning", "commission_reversal", "tax_reversal", "tds_reversal", "referral_earning"];

export interface PayeeEntryLike {
  entryType: PayeeEntryType | string;
  direction: "credit" | "debit" | string;
  amount: number;
  eligibleAt?: Date | string | null;
}

export interface PayeeBalance {
  grossEarnings: number;
  commission: number;
  taxOnCommission: number;
  tds: number;
  refundDeductions: number;
  referralEarnings: number;
  adjustments: number;
  transfers: number;
  /** Net owed for services already delivered, after transfers. */
  available: number;
  /** Net for journeys / rides not yet completed. */
  pending: number;
}

/** Sums a payee's ledger. Reversals net against the line they reverse. */
export const payeeBalance = (entries: PayeeEntryLike[], now = new Date()): PayeeBalance => {
  const t = { gross: 0, commission: 0, tax: 0, tds: 0, refund: 0, referral: 0, adjust: 0, transfer: 0, available: 0, pending: 0 };
  for (const e of entries) {
    const p = paise(e.amount);
    const signed = (e.direction === "credit" ? 1 : -1) * p;
    switch (e.entryType) {
      case "gross_earning": t.gross += p; break;
      case "commission": t.commission += p; break;
      case "commission_reversal": t.commission -= p; break;
      case "tax_on_commission": t.tax += p; break;
      case "tax_reversal": t.tax -= p; break;
      case "tds": t.tds += p; break;
      case "tds_reversal": t.tds -= p; break;
      case "refund_deduction": t.refund += p; break;
      case "referral_earning": t.referral += p; break;
      case "adjustment": t.adjust += signed; break;
      case "transfer": t.transfer += p; break;
    }
    const due = !e.eligibleAt || new Date(e.eligibleAt).getTime() <= now.getTime();
    if (due) t.available += signed;
    else t.pending += signed;
  }
  return {
    grossEarnings: rupees(t.gross),
    commission: rupees(t.commission),
    taxOnCommission: rupees(t.tax),
    tds: rupees(t.tds),
    refundDeductions: rupees(t.refund),
    referralEarnings: rupees(t.referral),
    adjustments: rupees(t.adjust),
    transfers: rupees(t.transfer),
    available: rupees(t.available),
    pending: rupees(t.pending),
  };
};

export const isCreditEntry = (type: string) => CREDIT_TYPES.includes(type as PayeeEntryType);

/** Settlement check for one payment against what Razorpay reports. */
export const compareGatewayPayment = (
  ours: { paymentId: string; amount: number },
  theirs: { status?: string; amount?: number } | null,
): string | null => {
  if (!theirs) return "missing_at_razorpay";
  if (theirs.status && !["captured", "refunded"].includes(theirs.status)) return `razorpay_status_${theirs.status}`;
  if (typeof theirs.amount === "number" && theirs.amount !== paise(ours.amount)) return "amount_mismatch";
  return null;
};
