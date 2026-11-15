# Production readiness: Tirvona Yatra P0–P6

Audit date: 2026-11-14.

Scope: the uncommitted working tree on branch `fix/booking-payment-gaps` in `tirvona-main`.

Constraints respected throughout:
- no deployment;
- no production migration;
- no feature flag switched on outside throwaway test processes;
- no real payment or refund;
- no production data.

## Blocker checklist

| # | Critical blocker | Result | Evidence |
|---|---|---|---|
| 1 | Double booking | **Not present.** 100 simultaneous attempts on 40 seats sold exactly 40. Customer-vs-organiser race: one winner in each of 10 rounds. DB unique `(departure_id, seat_no)`. | `seat-inventory-concurrency-report.md` |
| 2 | Incorrect payments | **Not present** in the tested paths. Only verified (HMAC) or non-production demo payments confirm; order/booking mismatch refused; second payment refunded. | `payment-refund-audit.md` |
| 3 | Duplicate refunds | **Not present.** One wallet transaction per refund key; repeat approval `409`. | same |
| 4 | Incorrect wallet balances | **Not present.** Balance = Σ transactions; exact refund amounts. | same |
| 5 | Incorrect organiser payable | **Not present.** Hand calculation = ledger rows = API balance (including a 50% refund reversal and the DIRECT-channel rule). | `finance-payout-audit.md` |
| 6 | Duplicate payouts | **Not present.** One open payout per payee under 5-way concurrency; one transfer per payout under 3-way concurrency; unique UTR. | same |
| 7 | Unauthorised organiser access | **Not present.** Cross-organiser, cross-partner and cross-pilgrim attempts refused. | `organizer-security-report.md` |
| 8 | Unapproved tours becoming public | **Not present.** Draft, pending, unpublished and suspended-organiser tours are hidden from search and departure pages and cannot be booked. | `yatra-qa` visibility test |
| 9 | Public KYC documents | **Not present in code.** Authenticated Cloudinary storage; 5-minute signed links; audit-logged. *Real Cloudinary not exercised (A3).* | `organizer-security-report.md` |
| 10 | Broken existing modules | **None found.** 198 existing unit suites and 19 existing Postgres suites pass; dark-deploy page smoke passes except one pre-existing Pandit page warning unrelated to Yatra. | `existing-module-regression-report.md` |
| 11 | Unreconciled financial records | **Controls in place.** Payout reconciliation (differences recorded), Razorpay settlement reconciliation (re-runnable). *Real Razorpay reconciliation not exercised (A2).* | `finance-payout-audit.md` |
| 12 | Critical security vulnerabilities | **None found.** One medium hardening issue (missing per-route rate limits on issue reports and payout requests) was fixed. | `organizer-security-report.md`, `bugs-fixed.md` |

No critical blocker is marked passed without a test that ran. Items 9 and 11 are passed in code but still need the staging confirmations listed below.

## Test totals (final runs)

| Check | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Backend unit suite (all modules), 201 suites | 2,515 | 0 | 0 | 0 |
| — of which Yatra (3 suites) | 20 | 0 | 0 | 0 |
| Backend Postgres suite (all modules), 22 suites | 364 | 0 | 0 | 0 |
| — of which Yatra (3 suites) | 64 | 0 | 0 | 0 |
| Yatra UI smoke (3 viewports) | 98 | 0 | 0 | 0 |
| Dark-deploy regression smoke (flags off) | 35 | 1 (pre-existing, not Yatra) | 0 | 0 |
| Migration replay (apply, verify, idempotent, rollback 0016, rollback all, re-apply) | 6 steps | 0 | 0 | 0 |
| Swagger / full-app boot | 182 operations = 182 routes | 0 | 0 | 0 |
| Backend typecheck / lint | clean / clean | 0 | — | — |
| Frontend typecheck / lint / route check / build | clean / 0 errors (88 pre-existing warnings) / OK / OK | 0 | — | — |
| Real Razorpay, Cloudinary, Resend, Supabase migration | — | — | — | 5 (A1–A5) |

## What must happen before production approval

1. Owner approves migrations 0015 and 0016 (additive, `yatra_*` only, rollback tested).
2. On staging, with **test** credentials:
   - A1: one Razorpay test-mode booking, webhook and wallet refund;
   - A3: one Cloudinary authenticated upload and signed view each for organiser KYC, ride partner KYC and payout proof;
   - A4: one Resend email;
   - A2: a manual Razorpay reconciliation run.
3. Owner decides the commit plan for the mixed branch (D1) and authorises commit, push and deploy.
4. Commission rules and Yatra settings entered before the first booking (pilot checklist).
5. Deploy dark (all flags `false`), confirm existing modules, then follow `docs/yatra/launch-and-rollback.md`.

## FINAL VERDICT

**READY FOR STAGING.**

The code passes every executed functional, concurrency, financial, security and regression check, and the defects found were fixed with regression tests. It is **not yet ready for production approval** because:
- the real Razorpay, Cloudinary, Resend and Supabase-migration steps (A1–A5) could not be executed here without test credentials or approval;
- WhatsApp and SMS are not implemented;
- the branch mixes Yatra with other uncommitted work.

None of these is a code defect. They must be closed on staging, and the commit plan decided, before production approval.
