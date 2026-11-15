# Backend API report

Method:
- the controllers were read;
- the final build was booted on a throwaway database and its generated Swagger document (`/api/docs-json`) inspected;
- the integration suites call the APIs over HTTP (supertest on a real Nest app with the real guards, pipes and filters).

## Inventory

| Swagger tag | Operations | Guard |
|---|---|---|
| Yatra · Public | 7 | none (read-only catalogue, config, signed link summaries) |
| Yatra · Pilgrim | 25 | JWT, own records |
| Yatra · Organiser | 51 | JWT, own organiser, staff role permissions |
| Yatra · Super Admin | 39 | JWT + `super_admin` |
| Yatra · Ride Partner | 22 | JWT, own partner account |
| Yatra · Pilgrim rides | 8 | JWT, own journeys and rides |
| Yatra · Finance | 21 | JWT + `super_admin` / `finance_manager` |
| Yatra · Destination Ops | 9 | JWT + `super_admin` / `hr` / `executive`, office-city scope |
| **Total** | **182** | |

Every route is also behind `YatraEnabledGuard`: `404` while `YATRA_ENABLED=false`, except `GET /config`.

## Results

| # | Requirement | Expected | Actual | Method | Status |
|---|---|---|---|---|---|
| 1 | API specification matches the actual API | Swagger generated from the controllers | 182 operations in Swagger = 182 route decorators in the 4 controller files | boot + docs-json | PASS |
| 2 | Only intended endpoints are public | Catalogue and config only | 7 public, all GET: `config`, `search`, `filters`, `departures/{code}`, `departures/{code}/seats`, `links/{code}`, `payment-links/{token}` (summary of a signed link) | docs-json security check | PASS |
| 3 | Authentication | `401` without a token | `401` (bookings, finance, ride partner) | `yatra-qa` | PASS |
| 4 | Authorization | Role and ownership checks | See `super-admin-permissions-report.md` (48 role checks) and the IDOR tests | `yatra-qa`, `yatra-p5`, `yatra.http` | PASS |
| 5 | Validation | Whitelist + forbid unknown fields; typed DTOs; id pipe | Unknown field, bad id, out-of-range numbers → `400` | `yatra-qa` | PASS |
| 6 | Error format | Shared `ApiExceptionFilter`; stable `code` on business errors | `SEAT_TAKEN`, `PARTNER_NOT_APPROVED`, `DUPLICATE_UTR`, `RECONCILIATION_DIFFERENCE`, `ORDER_MISMATCH`, `AMOUNT_MISMATCH`, … asserted in tests | suites | PASS |
| 7 | Idempotency of money endpoints | Repeats are safe | Confirm-payment, webhook, refund decision, transfer, payout request: repeats are no-ops or `409` | `yatra-qa`, `yatra.http` | PASS |
| 8 | Rate limiting | Write endpoints limited | Global throttler + 17 per-route limits on Yatra writes (5 added in this audit) | unit metadata test | PASS |
| 9 | Pagination | List endpoints paged | `page`/`limit` with `total` on admin, finance, ops, organiser lists | suites + UI smoke | PASS |
| 10 | Whole app boots with Yatra | API starts and serves | Final build booted on a migrated throwaway DB (UI smoke and Swagger check) | boot | PASS |
| 11 | Background jobs | Off by default; idempotent | Sweep only with `YATRA_MAINTENANCE_ENABLED`; reminders and ride releases run once; reconciliation once per day | `yatra-p5` | PASS |

## Counts (Yatra backend tests, final run)

| Suite | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Yatra unit (3 suites) | 20 | 0 | 0 | 0 |
| `yatra.http.pg-spec.ts` (P0–P4) | 34 | 0 | 0 | 0 |
| `yatra-p5.http.pg-spec.ts` (P5) | 18 | 0 | 0 | 0 |
| `yatra-qa.http.pg-spec.ts` (final QA) | 12 | 0 | 0 | 0 |
| **Yatra total** | **84** | **0** | **0** | **0** |

## Remaining risk

- **Untested HTTP runtime config.** The test app uses the real Nest pipes, guards and filters but a test auth guard in place of JWT parsing. JWT parsing is the existing shared guard; it is covered by its own tests and was exercised in the UI smoke with real signed tokens.
- **External calls not exercised.** Razorpay, Cloudinary and Resend were not called (see `pending-issues.md`).
