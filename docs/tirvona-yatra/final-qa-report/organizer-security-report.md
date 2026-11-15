# Organiser isolation and security report

Method:
- integration tests with separate test accounts trying each other's records;
- unit tests of the signature code;
- code review of guards, storage, validation and rendering.

No real customer or financial data was used, and none appears in this report.

## Organiser data isolation (P1)

| # | Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|---|
| 1 | One organiser per account; registrant becomes owner | Second registration refused | As expected | `yatra.http` › "registers an organiser once per account" | PASS |
| 2 | KYC required before submission | PAN number and PAN document needed | `400 INCOMPLETE_PROFILE` until both are present | `yatra.http` › "refuses submission until PAN…" | PASS |
| 3 | Legal identity locked after submission | Name and PAN cannot change | As expected | `yatra.http` › "submits, then locks the legal identity" | PASS |
| 4 | Only Super Admin reviews organisers and documents | Others `403` | As expected (support, organiser, finance) | `yatra.http`, `yatra-qa` role matrix | PASS |
| 5 | Organiser suspension | Suspended organiser's tours disappear | Search and departure page hide them; reinstating restores them | `yatra-qa` › visibility test | PASS |
| 6 | Bank details | Encrypted; only the last 4 digits ever shown | AES-encrypted (`PAYOUT_ENCRYPTION_KEY`); API returns last 4 only | `yatra.http` › "stores payout details encrypted…" | PASS |
| 7 | Staff limited by role | Staff cannot do owner actions | As expected | `yatra.http` › "adds an existing Tirvona account as staff…" | PASS |
| 8 | Vehicle permit and insurance verification | RC, insurance and permit needed before verification; admin approves | As expected | `yatra.http` › vehicles | PASS |
| 9 | Unapproved organiser cannot publish | Refused | Organiser cannot publish at all (`403`); Super Admin cannot publish a tour of an unapproved organiser | `yatra.http` › "will not publish a tour of an organiser that is not approved" | PASS |
| 10 | Organiser cannot reach another organiser's records | `403` / `404` | Departures, bookings, assisted booking on a foreign departure (`403`), booking links (foreign codes ignored), payouts and proofs (`404`) | `yatra.http`, `yatra-p5.http`, `yatra-qa` | PASS |
| 11 | KYC documents private | Never public | Cloudinary `type: authenticated` upload; only the storage id is saved; viewing goes through `private_download_url` with a 5-minute expiry; each view is audit-logged. Another organiser gets `404`. | code review + tests | PASS |

## Security audit (whole Yatra module)

| # | Area | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | Authentication | All 70 P5 and all P0–P4 Yatra routes except the public catalogue sit behind the global JWT guard. Unauthenticated calls return `401`. | `yatra-qa` role matrix (`401` checks); controllers have no `@Public` except catalogue and config | PASS |
| S2 | Authorization | Role guards: admin = `super_admin`; finance = `super_admin`, `finance_manager`; ops = `super_admin`, `hr`, `executive`. Self-service routes derive the organiser or partner from the caller. | role-matrix test (7 roles × 4 admin actions, 5 × finance, 5 × ops) | PASS |
| S3 | IDOR | Journeys, rides, ride payments, issues, documents, payouts and proofs looked up by id are always filtered by the caller's own id or role | `yatra-qa` › "keeps each ride partner and each pilgrim to their own records" (12 cross-account attempts, all `404`/`403`) | PASS |
| S4 | Input validation | Global `ValidationPipe` with whitelist + `forbidNonWhitelisted`; entity id pipe; numeric limits | Extra field `400`; bad id `400`; commissionBps 20000 `400`; negative payout `400`; zero adjustment `400` | PASS |
| S5 | SQL / regex injection | Parameterised driver; user text in regex filters is escaped (`escapeRegex`) | `'; DROP TABLE…` and `.*` in search, ops lookup and issue filters → handled as text; table intact | PASS |
| S6 | XSS | React escapes all text; no `dangerouslySetInnerHTML` in Yatra UI (grep); emails use `escapeHtml` for every interpolated value | grep + review; XSS payload stored verbatim as text | PASS |
| S7 | CSRF | Not applicable: the API authenticates with a bearer token in the `Authorization` header, not a cookie | `frontend/src/lib/api.ts` | N/A |
| S8 | Payment webhook verification | HMAC-SHA256 of the raw body with the webhook secret, constant-time compare; invalid → `401` before any module runs | `yatra-qa-security.spec.ts` | PASS |
| S9 | Checkout signature | HMAC of `order|payment`; demo payments impossible in production | `yatra-qa-security.spec.ts` | PASS |
| S10 | Wallet refund authorization | Only Super Admin decides a cancellation refund; Finance Manager and organiser `403`; each refund key credited once | `yatra-qa`, `yatra.http` | PASS |
| S11 | Payout authorization | Only Finance or Super Admin can review, approve and record transfers; organisers and partners can only request or cancel their own | `yatra-qa`, `yatra-p5.http` | PASS |
| S12 | Audit log integrity | Every approval, publish, refund, rule, payout and transfer action is written to the shared `audit_logs`; no Yatra code updates or deletes audit rows | grep + `yatra-qa` audit assertion | PASS |
| S13 | Sensitive data exposure | Bank numbers masked; pilgrim's name and phone hidden from the ride partner until the ride is paid; KYC and proof files private | `yatra-qa` (customer `null` before payment) | PASS |
| S14 | Rate limiting | Global throttler (120/min default) plus per-route limits on Yatra writes. **Fixed in this audit:** pilgrim, partner and organiser issue reports and payout requests had no per-route limit (each issue report notifies every Super Admin). | `yatra-qa-security.spec.ts` (decorator metadata) | PASS (after fix) |
| S15 | Secrets and environment | No keys in code (grep). Four new flags, all default `false`, documented in `.env.example`. Live keys in `Newbackend/.env` were not used. | grep + review | PASS |
| S16 | Feature flag | While `YATRA_ENABLED=false`, every Yatra API except `/config` answers `404` | dark-deploy smoke (5 endpoints `404`) | PASS |
| S17 | HTTP hardening | `helmet` and CORS allow-list apply to Yatra like every module | `main.ts` | PASS |

## Counts

| Passed | Failed | Skipped | Blocked | N/A |
|---|---|---|---|---|
| 27 | 0 | 0 | 0 | 1 |

## Remaining risk

- **Real Cloudinary not exercised.** Storage and signed links ran against a fake store. The authenticated-upload and signed-URL code was reviewed, not executed, so one upload-and-view must be checked on staging.
- **Rate limits not load-tested.** They were verified as configuration only.
