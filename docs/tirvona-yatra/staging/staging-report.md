# Tirvona Yatra: staging verification report

Date: 2026-11-15.

Branch `fix/booking-payment-gaps`: 6 code commits plus 1 documentation commit, all local, **not pushed**.

Production safety rules held throughout:
- no production migration;
- no deployment;
- no live payment;
- no production environment change;
- no production flag change;
- live credentials not used, copied or printed.

## Verdict

**NOT READY.** The staging checks are **blocked, not failed**.

This machine has no staging Supabase database and no Razorpay test, Cloudinary test or Resend staging credentials. The only credentials present (`Newbackend/.env`, `leadTirvona/.env`) are **live** (`rzp_live_…` and the shared database), and the rules forbid using them. Everything that does not need those credentials is done, and the staging kit is ready to run the blocked checks as soon as `Newbackend/.env.staging` exists.

## Status by instruction

| # | Instruction | Status | Evidence |
|---|---|---|---|
| 1 | Separate staging Supabase; review SQL and rollbacks; apply 0015/0016 to staging; verify and roll back / re-apply | **Review done. Staging run BLOCKED** (no staging project; one must be created in your Supabase account). | `migration-review.md`: both files add only `yatra_*` objects (0 DROP/UPDATE/DELETE, 0 non-Yatra targets); both rollbacks reviewed. Full replay on PostgreSQL 17 passed (`../final-qa-report/database-integrity-report.md`). `tools/yatra-staging-check.mjs db` runs the same sequence on staging. |
| 2 | Razorpay TEST, Cloudinary test, Resend staging; complete the 5 blocked checks | **BLOCKED** (no test credentials). Kit ready; safety guard verified. | `tools/yatra-staging-check.mjs services` and `e2e`. Guard test: the kit refused a staging file reusing the production database (same host, or another host of the same Supabase project), live keys, the production Cloudinary cloud or key, and the production Resend key. It passed only fully separate values (fake values used; no live secret touched). |
| 3 | Separate, traceable commits; review status and diff before each; no push | **DONE** | 6 commits, below. Each was staged explicitly after reviewing `git status` and the diff. The three files shared between workstreams were split hunk by hunk. Commits 2 and 4 were typechecked in isolation in a temporary worktree (backend and frontend: 0 errors). |
| 4 | Compare worktrees; do not delete | **DONE, nothing deleted** | `worktree-comparison.md`: the old worktree has no unique work, and its branch adds no code. Waiting for your approval. |
| 5 | Leave the Pandit issue; report it separately | **DONE** (untouched) | `separate-issue-pandit-withdrawals.md` |
| 6 | WhatsApp and SMS documented as pending | **DONE** | `docs/yatra/notifications.md` now says "pending, not operational" and explains that the organiser "Share on WhatsApp" buttons are only `wa.me` share links. Every other mention already said "not implemented". |
| 7 | Complete staging verification | **Local re-verification DONE. Staging-specific checks BLOCKED.** | below |

## Commits (local only)

| # | Commit | Scope |
|---|---|---|
| 1 | `23d6352` chore(deps): bump mongoose 9.9.1 → 9.11.4 | `package.json`, lockfile (mongoose subtree only) |
| 2 | `b84847b` fix(payments): refund payments that cannot become a booking; Payment Issues page | The earlier booking-payment fixes (stays, aarti, parking, food, Payment Issues page). Only the payment hunks of `payments.module.ts`, `App.tsx` and `DashboardLayout.tsx`. |
| 3 | `d70d80c` fix(auth): stop the 401 polling loop in a tab whose login ended elsewhere | `api.ts`, `AuthContext.tsx` |
| 4 | `2a7fd3c` feat(yatra): Tirvona Yatra P0–P6 (all flags off) | The whole Yatra module in its pre-QA-fix state: migrations, rollbacks, docs, shared-file hunks |
| 5 | `7650192` fix(yatra): final-QA fixes, regression tests and QA reports | The 8 fixes in `bugs-fixed.md`, the QA test suites, `docs/tirvona-yatra/final-qa-report/` |
| 6 | `347f685` fix(yatra): treat a Resend rejection as a failed customer email | New finding while preparing the email check (below) |

| 7 | (this documentation commit) docs(yatra): staging verification kit, reports and pending-notification note | `docs/tirvona-yatra/staging/` and the clarification in `docs/yatra/notifications.md`. Documentation and kit only; no application code. |

Deliberately **not** committed and left untouched: `docs/seo/publishing/`. It holds two superseded drafts of the 2026-11-03 SEO migration, never committed and each marked "SUPERSEDED … never run this copy". It is not part of this work.

## New finding, fixed (commit 6)

| Defect | Root cause | Fix | Test |
|---|---|---|---|
| A Yatra customer email that Resend **rejected** (for example an unverified sender) was reported as sent, with nothing logged | Resend SDK 6.x returns `{ data, error }` instead of throwing; `emailCustomer` ignored `error` | Read `error`; log a warning without the recipient address; return false | `yatra-notifier.spec.ts`: accepted, rejected, thrown, disabled (4/4) |

## Checks

| Area | Check | Status | Evidence |
|---|---|---|---|
| Yatra tests | Unit (4 suites) | PASS 24/24 | after commit 6 |
| Yatra tests | Postgres (3 suites) | PASS 64/64 | on committed code (HEAD) |
| All modules | Unit suite (202 suites) | 2,517 PASS, **2 FAIL: pre-existing, not Yatra** | After commit 6. The 2 failures are 30-second timeouts in `smart-contact/application/qr.service.spec.ts` (see below). Earlier full runs today: 2,515/2,515. |
| All modules | Postgres suite | PASS 364/364 | identical code before the commits; Yatra suites re-run after |
| Flags OFF | Existing-module page regression (homepage at 3 widths, stays, ashrams, pandits, food, restaurants, parking, marketplace, aarti, events, temples, circuits, destinations, login, profile, wallet, admin, finance, HR, restaurant and vendor consoles); Yatra APIs 404 | PASS 35, FAIL 1 (pre-existing Pandit warning, reported separately) | dark-deploy smoke |
| Flags ON | All Yatra pages at desktop, tablet and mobile | PASS 98/98 | Yatra UI smoke |
| Permissions | Customer, organiser (owner and staff), Super Admin, Finance Manager, HR and Executive (city scope), ride partner ("driver/partner" in your list) | PASS (48 role checks + IDOR suite) | `yatra-qa.http.pg-spec.ts` |
| Seat concurrency, expiry, confirmation | 100 vs 40 seats; customer vs organiser race; hold expiry; duplicate confirms | PASS | `seat-inventory-concurrency-report.md` |
| Payments (logic) | Signatures, duplicate and late webhooks, refunds, wallet credits, ledger, payout reconciliation | PASS (demo payments + test-secret HMAC) | `payment-refund-audit.md`, `finance-payout-audit.md` |
| Staging | 0015/0016 on a real staging Supabase; verify; rollback and re-apply | **BLOCKED** | needs `STAGING_SUPABASE_DB_URL` |
| Staging | Razorpay TEST: real order, real hosted checkout, duplicate and late webhooks for a real payment, refund to wallet, ledger, Razorpay reconciliation | **BLOCKED** | needs Razorpay test keys |
| Staging | Cloudinary test: authenticated upload, signed link opens, unsigned URL refused, KYC upload through the app | **BLOCKED** | needs a Cloudinary test account |
| Staging | Resend staging: test email and the Yatra booking email | **BLOCKED** | needs a staging Resend key and a mailbox |
| Notifications | WhatsApp, SMS | NOT IMPLEMENTED (documented as pending) | `docs/yatra/notifications.md` |

## Pre-existing issues observed (not Yatra, documented separately, not changed)

- `separate-issue-smart-contact-qr-timeouts.md`: two load-sensitive 30-second timeouts in the Smart Contact QR unit tests.
- `separate-issue-pandit-withdrawals.md`: invalid HTML nesting on the Pandit Withdrawals admin page.

## What I need from you (nothing goes in chat)

1. Create a **new Supabase project** for staging (free tier is enough).
2. In Razorpay, switch to **Test Mode** and create API keys (`rzp_test_…`).
3. Create a **separate Cloudinary** account or product environment.
4. Create a **Resend staging API key** with a verified sender, and choose a mailbox you can read.
5. Copy `docs/tirvona-yatra/staging/env.staging.example` to `Newbackend/.env.staging` (already ignored by git) and fill it in on this machine.
6. Tell me "staging file ready". I will run `preflight` → `db` → `services` → `e2e`. In `e2e` you make **one** Razorpay TEST checkout in your browser (test card; no real money). I will then report every result with evidence and give the final verdict.

## Deployment prerequisites (after staging passes)

1. All staging checks PASS (or are explicitly accepted by you).
2. Your explicit approval to apply 0015/0016 to production. They are applied by the deploy pipeline when the code reaches `main`, so the code and the migrations ship together.
3. Your approval to push the branch and open a PR. CI must pass: lint, typecheck, unit, Postgres, audit, build, route check.
4. Deploy with **all Yatra flags off**, confirm existing modules, then follow `docs/yatra/launch-and-rollback.md`.
5. WhatsApp and SMS remain pending; launch with in-app notifications and, after staging email passes, email.
