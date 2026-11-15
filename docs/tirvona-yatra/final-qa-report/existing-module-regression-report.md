# Existing production module regression report

Baseline: the last commit on the branch (`4c3948a`, "feat(lead-tracking): …"). The working tree
also contains the earlier, still-uncommitted booking-payment-gap fixes (a separate workstream), so
every regression run below covers **both** sets of changes together.

## 1. Automated suites (all modules)

| Suite | Scope | Passed | Failed | Skipped |
|---|---|---|---|---|
| Backend unit (`npx jest`), 198 non-Yatra suites | Auth, users, bookings, stays, food, pandit and providers, parking, aarti, events, marketplace, wallet, refunds, payments and webhook, payouts, notifications, HR, leads, SEO, smart contact, … | 2,495 | 0 | 0 |
| Backend Postgres (`npm run test:pg`), 19 non-Yatra suites | pg driver, ashrams, food (HR location, unpaid expiry, wallet), HR (accounts, executive accounts, HTTP, migration), payment refunds, platform settings, providers (HR location, fixtures, HTTP, migration), SEO (pages migration, publishing, HTTP), users | 300 | 0 | 0 |
| Frontend build | `check:routes` + `tsc -b` + `vite build` + smart-contact build | OK | — | — |

## 2. Dark-deploy browser smoke (all Yatra flags `false`)

This is the state the site would be in right after a deploy.

| Check | Result |
|---|---|
| `GET /api/v1/yatra/config` reports `enabled: false` | PASS |
| Search, finance, ops, ride-partner and organiser APIs return `404` | PASS (5/5) |
| Homepage at desktop, tablet and mobile | PASS (no "Tirvona Yatra" text) |
| Stays, Ashrams, Pandits, Food, Restaurants, Parking, Marketplace, Aarti, Events, Temples, Pilgrimage Circuits, Destinations, Login | PASS (13/13: no runtime errors, no API 5xx) |
| `/yatra`, `/yatra-partner`, `/ride-partner`, `/operator` show "not available yet" | PASS (4/4) |
| Pilgrim profile without "My Journeys"; wallet page | PASS |
| Super Admin dashboard without any Yatra menu (desktop and mobile) | PASS |
| Finance Manager refunds and wallets without a Yatra menu | PASS |
| Finance Manager → Pandit Withdrawals | **FAIL: pre-existing.** React reports `<div>` inside `<p>` at `AdminPanditWithdrawalsPage.tsx:179` (loading skeleton). The file is unchanged since 5 weeks ago and not touched by this work. |
| HR area dashboard without a Yatra menu | PASS |
| Restaurant and vendor consoles | PASS |

Totals: 35 passed, 1 failed (pre-existing, outside Yatra).

## 3. Existing files modified by Yatra, and their effect

| File | Change | Effect on existing behaviour |
|---|---|---|
| `Newbackend/src/app.module.ts` | Imports `YatraModule` | API refuses to start until migrations 0015/0016 exist (by design) |
| `payments/payments.module.ts`, `payments-webhook.service.ts` | Webhook tries Yatra **last**, after every existing module | None for existing orders: each order id belongs to exactly one module, and earlier modules match first. Existing webhook tests pass; the spec constructor gained one argument. |
| `wallet/domain/wallet.constants.ts` | Adds `"yatra"` to the module list | Code-only enum; wallet suites pass |
| `config/environment.ts`, `.env.example` | 4 new flags, default `false` | None |
| `seo-route-policy.ts` + `frontend/src/seo/routePolicy.ts` (byte-identical) | `/operator`, `/yatra`, `/yatra-partner`, `/ride-partner`, `/ops` private (noindex) | SEO tests pass; route check OK |
| `frontend/vercel.json`, `render.yaml`, `deploy/nginx/tirvona-web.conf` | New top-level segments in the SPA rewrite lists | Needed for those paths; other paths unchanged |
| `frontend/src/App.tsx` | New lazy routes | Existing routes unchanged |
| `DashboardLayout.tsx` | New sidebar groups, shown only while `YATRA_ENABLED`; role label "Ride Partner" on `/ride-partner` | With the flag off the menus are identical (smoke) |
| `PublicLayout.tsx` | Footer "Tirvona Yatra" link only while the flag is on | No change while off; the homepage component itself is unmodified |
| `ProfileMainPage.tsx` | "My Journeys" item only while the flag is on | No change while off |
| `i18n/resources.ts` | New Hindi entries | "From"/"To" wording corrected so existing date filters are not mistranslated |
| `Newbackend/test/jest-pg.json` | `isolatedModules: true` for ts-jest | Postgres suites no longer run out of memory; all 22 suites pass |
| `Newbackend/tsconfig.build.json` | Excludes the Yatra test harness | Production build unchanged except for the new module |
| `database/pg/registry.generated.ts`, `drizzle/schema.generated.ts` | Generated for the new tables | Verified by `db:verify` in the replay |

**Unintended modifications found:** none in existing business logic. Two regressions that this work introduced were found and fixed: Hindi "From"/"To", and the KYC queue's interaction with partner documents.

## Remaining risk

- The existing payment flows (stays, food, pandit, parking, aarti, events, marketplace) were regression-tested by their automated suites and page smoke, not by a real Razorpay run. The same staging run (A1) should include one existing-module payment.
- **Commit split.** The branch's other workstream (booking-payment gaps) is not part of this audit's scope but is in the same working tree. Commit splitting must keep `payments.module.ts`, `App.tsx` and `DashboardLayout.tsx` consistent.
