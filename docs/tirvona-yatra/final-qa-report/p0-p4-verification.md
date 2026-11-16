# Pass 1: P0–P4 verification

Every result below comes from a test that actually ran in this audit, or from a code or
migration review where stated. Test environment:
- isolated embedded PostgreSQL 17, created per run and thrown away;
- demo payments (no money);
- fake private storage;
- headless Chrome against the real API build and Vite.

## P0: architecture and database

| Requirement | Expected | Actual | Method | Status | Evidence |
|---|---|---|---|---|---|
| Follows Tirvona conventions | Module inside `Newbackend` and `frontend`, like Pandit or Food | `Newbackend/src/modules/yatra` (domain / application / infrastructure / presentation); `frontend/src/modules/yatra` and `frontend/src/admin/yatra`; shared UI kit, layout, auth, wallet, notifications and HR scope reused | review | PASS | code map in `docs/yatra/README.md` |
| No unnecessary duplicate services | Reuse existing | Reuses WalletService, BankAccountCrypto, TransactionService, InAppNotificationService, Resend email template, HrLocationService and the shared Razorpay webhook. Yatra's own gateway wrapper only creates and verifies orders with Tirvona's keys. | review | PASS | imports in `yatra.module.ts` |
| Relationships, indexes, constraints | Integrity at DB and service level | 22 tables, 28 unique indexes (6 partial), 72 other indexes; no FKs (Tirvona-wide convention) | migration review | PASS (risk noted) | `database-integrity-report.md` |
| Migrations complete and reversible | Apply, verify, roll back, re-apply | All pass on PG17 | replay | PASS | `database-integrity-report.md` |
| Existing schemas not modified | Only `yatra_*` | Confirmed | review | PASS | same |
| API matches the specification | Swagger = code | 182 = 182 | boot + docs-json | PASS | `backend-api-report.md` |
| Authentication and permissions | Guards on every non-public route | Confirmed | tests | PASS | `super-admin-permissions-report.md` |

## P1: organisers and Super Admin

| Requirement | Status | Test |
|---|---|---|
| Registration, KYC submission, legal identity lock | PASS | `yatra.http` (3 tests) |
| Document verification (Super Admin only) | PASS | `yatra.http` › "lets only Super Admin review organisers and documents" |
| Approval, rejection, suspension (suspended tours hidden) | PASS | `yatra.http`, `yatra-qa` visibility test |
| Staff management (role-limited) | PASS | `yatra.http` › organiser staff |
| Vehicle management; permit and insurance verification | PASS | `yatra.http` › vehicles |
| Tour draft, submission, Super Admin approval and publishing | PASS | `yatra.http` › tours (3 tests) |
| An unapproved organiser cannot publish | PASS | `yatra.http` › "will not publish a tour of an organiser that is not approved" |
| An organiser cannot access another organiser's records | PASS | `yatra.http`, `yatra-p5`, `yatra-qa` |
| Organiser UI pages (dashboard, profile, documents, staff, vehicles, tours, departures, bookings, links, earnings, reports, notifications) | PASS | UI smoke |

## P2: central seat inventory and booking (highest priority)

All scenarios A–D passed, with database rows inspected after each. See `seat-inventory-concurrency-report.md`.

| Scenario | Result |
|---|---|
| A: 100 simultaneous attempts on 40 seats | Exactly 40 confirmed; DB 40/40/40 | 
| B: customer and organiser on the same seat | Exactly one wins in each of 10 rounds |
| C: payment fails or hold expires | Seat available again; re-sold |
| D: duplicate booking / confirmation | One confirmed booking, one ledger row, one journey |

## P3: payments and refunds

17 of 18 checks passed; 1 is blocked (a real Razorpay checkout needs the owner's authorisation, because the existing keys are live). See `payment-refund-audit.md`.

## P4: Journey Hub

| Requirement | Status | Test |
|---|---|---|
| One journey per confirmed booking, with ticket, passengers, boarding and itinerary | PASS | `yatra.http` › "creates one journey per confirmed booking…"; UI smoke |
| Ticket QR only for the owner | PASS | `yatra.http` › "issues a ticket with a QR code only to its owner" |
| Cancellation request from the journey | PASS | `yatra.http` › refund test |
| Stay integration (link own stay booking, read-only) | PASS | `yatra.http` › "attaches the pilgrim's own existing stay booking" |
| Parking integration (link own parking booking, read-only) | PASS | `yatra-qa` › "links only the pilgrim's own parking booking" |
| Food add-on (restaurant accepts, customer pays) | PASS | `yatra.http` › food add-on |
| Puja add-on (Tirvona routes to a pandit, who may decline) | PASS | `yatra.http` › puja |
| Marketplace, Stays, Parking, Aarti access | PASS | Journey Hub links to the existing pages (review); those pages render in the regression smoke |
| Journey notifications and reminders | PASS | reminder job once per booking (`yatra-p5`); in-app calls (review) |
| Existing module bookings keep working | PASS | 19 existing-module Postgres suites (300 tests) and the unit suite pass; linked bookings are read-only (row unchanged after linking) |

## Counts (pass 1)

| Source | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| `yatra.http.pg-spec.ts` | 34 | 0 | 0 | 0 |
| P0–P4 scenarios in `yatra-qa.http.pg-spec.ts` (inventory B/C/D, visibility, validation, parking link) | 6 | 0 | 0 | 0 |
| Yatra unit tests (domain + payment security) | 20 | 0 | 0 | 0 |
| Real Razorpay test-mode run | — | — | — | 1 |

## Verdict for pass 1

P0–P4 behave as specified on an isolated database. The only open item is the real-gateway run (blocked, not failed).
