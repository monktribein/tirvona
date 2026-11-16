# Finance and manual payout audit (P5)

Method:
- integration tests on an isolated PostgreSQL 17 database;
- an independent hand calculation compared against the stored ledger rows;
- code review of `yatra-finance.service.ts` and `domain/yatra-finance.ts`.

## Commission and ledger

The rule used in the recalculation test: 10% commission, 18% GST on the commission, 1% TDS on the gross. The booking was 2 seats × ₹1,500 = ₹3,000; Super Admin then approved a 50% refund.

| Line | Hand calculation | Stored row (`yatra_payee_entries`) | Status |
|---|---|---|---|
| Gross collected | 3,000.00 | `gross_earning` credit 3,000 | PASS |
| Commission 10% | 300.00 | `commission` debit 300 | PASS |
| GST 18% of commission | 54.00 | `tax_on_commission` debit 54 | PASS |
| TDS 1% of gross | 30.00 | `tds` debit 30 | PASS |
| Organiser net | 2,616.00 | Σ = 2,616 | PASS |
| Refund 50% | 1,500.00 | `refund_deduction` debit 1,500 | PASS |
| Commission reversed (50%) | 150.00 | `commission_reversal` credit 150 | PASS |
| GST reversed | 27.00 | `tax_reversal` credit 27 | PASS |
| TDS reversed | 15.00 | `tds_reversal` credit 15 | PASS |
| Organiser net after refund | 1,308.00 | Σ = 1,308 | PASS |
| Customer wallet | +1,500.00 once | one `credit 1500` transaction; balance = Σ transactions | PASS |
| Organiser balance | 1,308 (this booking) + 1,308 (another ₹1,500 booking) = 2,616 pending, 0 payable before the journey ends | API summary: `pending 2616`, `available 0`; equals the SQL Σ of the payee rows | PASS |

| # | Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|---|
| 1 | Commission never hard-coded | Only Finance or Super Admin create rules; no rule → no commission assumed | Booking without a rule waits in "Bookings without a commission rule"; Finance applies the current rule later | `yatra-p5.http` › rules tests | PASS |
| 2 | Historical snapshot | A booking keeps the rule it was sold under | Booking sold at v1 (10%) keeps 10% after v2 (12%) is created; snapshot stored on `yatra_bookings.commission_snapshot` | `yatra-p5.http` › "keeps the commission rule…"; `yatra-qa` snapshot check | PASS |
| 3 | Single active rule per scope | One active version | Partial unique index `ruleKey` where status = active | DB schema + test | PASS |
| 4 | Earnings payable only after delivery | Pending until the journey ends | `eligibleAt = journey end`; refund reversals inherit it | `yatra-p5.http` › "holds earnings as pending…" | PASS |
| 5 | Adjustments | Credit or debit with a reason, audited | Recorded; visible in the statement | `yatra-p5.http`, `yatra-qa` | PASS |
| 6 | Ledger consistency | Balance = Σ rows; idempotent | Unique `idempotency_key` on every row; API balance equals the SQL sum | `yatra-qa` | PASS |
| 7 | Add-on referral | Organiser's referral share credited once | ₹30 on a delivered add-on | `yatra-p5.http` › referral test | PASS |
| 8 | Ride partner earning | Fare − 8% − GST, payable at completion | As expected | `yatra-p5.http` ride lifecycle | PASS |

## Manual payout

| # | Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|---|
| 9 | Pending payable | Only delivered balance can be requested | Amount > payable → refused; requestable shown | `yatra-p5.http` › "lets an organiser request up to…" | PASS |
| 10 | One open request, also under concurrency | 1 open payout per payee | 5 simultaneous requests → 1 × `201`, 4 × `409` (partial unique index on payee for open statuses) | `yatra-qa` › payouts | PASS |
| 11 | Finance review and approval | pending → under_review → approved; approval re-checks the balance | As expected; `AMOUNT_ABOVE_PAYABLE` if a refund reduced the balance | `yatra-p5.http` | PASS |
| 12 | Organiser cannot approve or transfer | `403` | `403` on review and transfer; no organiser route exists for either | `yatra-qa`, `yatra-p5.http` | PASS |
| 13 | No automatic payout | Nothing moves without Finance | Payout stays `pending` and no transfer row appears after the background jobs run. No code calls a bank or payout API (code review: no Razorpay X / payout SDK). | `yatra-qa` + review | PASS |
| 14 | Transfer only after approval | `409` before approval | `409` | `yatra-qa` | PASS |
| 15 | Manual transfer recording, UTR and proof | Method, date, UTR, amount equal to the approved amount, proof file (private) | Wrong amount → `400 AMOUNT_MISMATCH`; proof stored privately; signed 5-minute link | `yatra-p5.http` | PASS |
| 16 | Duplicate transfer prevention | One transfer per payout; UTR unique across payouts | 3 simultaneous recordings → 1 × `201`, 2 × `409`; exactly 1 `transfer` ledger row. Re-used UTR → `409 DUPLICATE_UTR` | `yatra-qa`, `yatra-p5.http` | PASS |
| 17 | Reconciliation | Bank amount compared; a difference needs a note and stays visible | `400 RECONCILIATION_DIFFERENCE` without a note; with a note → `reconciled`, difference −10 recorded | `yatra-qa`, `yatra-p5.http` | PASS |
| 18 | Remaining payable balance | Balance reduced by exactly the transfer | 5,000 credit − 1,000 transfer → available 4,000, requestable 4,000 | `yatra-qa` | PASS |
| 19 | Privacy | Organiser or partner sees only their own payouts and proofs | Other organiser `404` on cancel and proof; other partner sees `[]`; organiser `404` on a partner payout | `yatra-qa`, `yatra-p5.http` | PASS |
| 20 | Audit | Each money action audited | `payout.transfer_recorded` entry present for the payout | `yatra-qa` | PASS |

## Super Admin finance dashboard

| # | Requirement | Actual | Test | Status |
|---|---|---|---|---|
| 21 | Total collection, refunds, commission (revenue), GST, TDS, organiser and partner payables, pending and completed payouts, Razorpay settlement runs, bookings without a rule | All shown. Gross is labelled "not revenue"; revenue = commission | UI smoke (desktop, tablet, mobile) + `yatra-p5.http` dashboard assertions | PASS |
| 22 | Reports and CSV export | Date-wise report; CSV with formula-injection-safe cells (unit-tested escaping); export audited | `yatra-p5.http` + unit tests | PASS |
| 23 | Finance Manager access | Finance Center reachable by `finance_manager` and `super_admin` only | UI smoke + role matrix test | PASS |

## Counts

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 23 | 0 | 0 | 0 |

## Remaining risk

- **Scale.** The dashboard computes payee balances one payee at a time (two queries each), and the "bookings without a rule" check scans up to 5,000 recent bookings. That is fine for a pilot with a few organisers. Before tens of organisers, add a summary query.
- **Refund after payout.** A refund after a payout can make a payee's balance negative. It is shown and must be settled by Finance with an adjustment; there is no automatic recovery.
- **Orphaned proof files.** A proof file is uploaded before the transfer transaction. If the transaction fails (for example a duplicate UTR), the uploaded file stays in private storage unused. This is harmless but untidy.
