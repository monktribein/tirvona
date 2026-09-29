/**
 * Vendor wallet maths. The wallet has no stored balance: balances are always
 * derived from immutable ledger entries.
 *
 * Every entry has an `availableAt`:
 *  - null / in the future  -> still "pending" (e.g. a sale not yet delivered
 *                             or still inside the settlement hold window)
 *  - <= now                -> counts towards the "available" balance
 *
 * Payout debits are available immediately, so requesting a payout reserves
 * the funds at once; a failed/cancelled payout writes a reversal credit.
 */
import { CREDIT_ENTRY_TYPES, type LedgerEntryType } from "./marketplace.constants";
import { toPaise, toRupees } from "./pricing";

export interface LedgerEntryLike {
  type: LedgerEntryType;
  amount: number; // always positive rupees
  availableAt?: Date | string | null;
}

export interface WalletBalance {
  pending: number;
  available: number;
  /** Net credits ever earned from sales (sale - commission - refunds). */
  lifetimeEarnings: number;
  totalPayoutDebits: number;
}

export const isCredit = (type: LedgerEntryType): boolean => CREDIT_ENTRY_TYPES.includes(type);

export function computeWalletBalance(entries: LedgerEntryLike[], now = new Date()): WalletBalance {
  let pending = 0;
  let available = 0;
  let earnings = 0;
  let payouts = 0;
  for (const e of entries) {
    const signed = (isCredit(e.type) ? 1 : -1) * toPaise(e.amount);
    const at = e.availableAt ? new Date(e.availableAt) : null;
    if (at && at.getTime() <= now.getTime()) available += signed;
    else pending += signed;
    if (e.type === "payout_debit") payouts += toPaise(e.amount);
    else if (e.type === "payout_reversal_credit") payouts -= toPaise(e.amount);
    else earnings += signed;
  }
  return {
    pending: toRupees(pending),
    available: toRupees(available),
    lifetimeEarnings: toRupees(earnings),
    totalPayoutDebits: toRupees(payouts),
  };
}
