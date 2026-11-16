# Pending issues and unresolved risks

Nothing below is hidden by a passing build. Items marked **Before production** must be closed or
explicitly accepted by the owner before production approval.

## A. Blocked verification (needs credentials or an environment this audit did not have)

| # | Item | Why blocked | What closes it | When |
|---|---|---|---|---|
| A1 | Real Razorpay end-to-end (order → hosted checkout → signature → `payment.captured` webhook → wallet refund) | The configured Razorpay keys are live and no real payment was authorised. Logic is covered with demo payments and test-secret HMAC unit tests. | One real checkout through the existing configuration, which needs the owner's explicit authorisation of one minimum-value payment and its wallet refund (or test keys supplied through the same variable names in an isolated environment) | Before production |
| A2 | Razorpay settlement reconciliation against the real API | Same as A1 (fake client used in tests) | Run Finance Center → Razorpay reconciliation by hand once the migrations are approved, then for the first pilot days | Before enabling `YATRA_RECONCILIATION_ENABLED` |
| A3 | Cloudinary authenticated upload and signed view of KYC and proof files | A fake store was used. Code reviewed: `type: authenticated` + `private_download_url`, 5-minute expiry, on the existing Cloudinary configuration. | After the migrations are approved, upload and view one organiser document, one ride partner document and one payout proof through the app; confirm the plain URL is not public | Before production |
| A4 | Resend customer emails | Flag off; not sent in tests. The existing Resend configuration is used. | Send one of each email through the app, then set `YATRA_EMAIL_ENABLED=true` | Before enabling emails |
| A5 | Migrations 0015 and 0016 on the real Supabase database | Owner approval required; replayed only on embedded PostgreSQL 17 | Owner approval → deploy (the pipeline runs `db:migrate` + `db:verify`) | Before production |

## B. Not implemented (by decision)

| # | Item | Notes |
|---|---|---|
| B1 | WhatsApp notifications | Templates that need Meta approval are listed in `docs/yatra/notifications.md` |
| B2 | SMS notifications | Needs DLT template registration if added |
| B3 | Incident resolution notice to the reporter | Ops must call or message the reporter (documented in the SOP) |
| B4 | Admin "complete ride" / "start ride" override | A ride the partner never completes posts no earning; use cancel or an adjustment |
| B5 | Per-document review for ride partners | Partner approval verifies all submitted documents together |
| B6 | Four-eyes rule on payouts (approver ≠ transfer recorder) | Optional control for large payouts |
| B7 | Full Hindi coverage | Sidebar, headings and key labels are translated; most body text is still English |

## C. Known risks (accepted for a pilot, revisit before scale)

| # | Risk | Impact | Recommendation |
|---|---|---|---|
| C1 | No database foreign keys or CHECK constraints | Same as all Tirvona tables; integrity is enforced in services and tests | Keep the scoped-lookup pattern; add DB checks only if the platform adopts them |
| C2 | Finance dashboard computes each payee's balance separately (2 queries per payee); "bookings without a rule" scans up to 5,000 bookings | Slow page with many organisers | Add an aggregated balance query before ~50 payees |
| C3 | A refund after a payout can leave a payee balance negative | Finance must settle it with an adjustment | Documented in the payout SOP |
| C4 | A proof file is uploaded before the transfer transaction; a failed transaction (for example a duplicate UTR) leaves an unused private file | Storage clutter only | Optional cleanup job |
| C5 | A failed or skipped daily Razorpay reconciliation is not retried automatically | Finance re-runs it from the Finance Center | Documented in the reconciliation SOP |
| C6 | Rate limits verified as configuration, not by load test | — | Optional load test on staging |
| C7 | No frontend unit-test runner in the project | UI verified by headless-browser smoke tests only | Consider adding Vitest for shared UI helpers |

## D. Repository and process items

| # | Item | Owner action |
|---|---|---|
| D1 | Branch `fix/booking-payment-gaps` holds Yatra **and** the earlier uncommitted booking-payment-gap fixes. Three files are shared: `payments.module.ts`, `App.tsx`, `DashboardLayout.tsx`. | Decide the commit plan (one branch, or split by hunk) |
| D2 | Nothing is committed, pushed or deployed | Explicit go-ahead needed |
| D3 | Duplicate older worktree `D:\desktop\tirvona-main\tirvona-yatra` (P0–P4 only) still exists | Approve its deletion, or keep it |
| D4 | The local API in `Newbackend/dist` runs against the shared database and will not include Yatra until the migrations are approved | No action until A5 |
| D5 | Pre-existing invalid DOM nesting on the Pandit Withdrawals admin page (`AdminPanditWithdrawalsPage.tsx:179`) | Optional one-line fix, separate from Yatra |
| D6 | `PublicLayout.tsx` (shared site footer) gained a "Tirvona Yatra" link that renders **only** when `YATRA_ENABLED=true`. The homepage page component itself was not modified. | Accept, or remove the footer link before launch |
