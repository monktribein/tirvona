# Providers module (Pandit / Purohit / Acharya / Jyotishi)

Backend for the Tirvona Puja + Jyotish provider domain: ritual catalogue, provider profiles, offerings with pricing, availability and calendar, verification, puja bookings and expert consultations. Implements the provider-side of the manager's **SRS v2.0, Technical Architecture v2.0, Data Dictionary v2.0 and OpenAPI v2.0** (see [Contract decisions](#contract-decisions-that-need-sign-off) for every place the repository forced a difference).

Everything lives in this folder. Outside it there are only these wiring changes: `app.module.ts` (register `ProvidersModule`), `users/.../user.schema.ts` (two roles), `main.ts` (allow the `Idempotency-Key` CORS header), `tsconfig.build.json` (keep the test harness out of the production build), `database/generate.js` (a one-line array-type fix, see below), `package.json` (one script) and the generated registry/migration.

## Scope

| In this module | Not here (owned by later phases / other modules) |
|---|---|
| Ritual catalogue (rituals, variants, draft→review→approve→publish) | Quote engine, platform fee, tax, discounts (SRS M11) |
| Provider profile with public/private separation | Payments, refunds, settlement, payouts: **reused, not re-implemented** (see below) |
| Offerings: price, currency, duration, team, inclusions/exclusions, travel charge | Institution authorization ledger (M08), team members, matching engine (M09 ranking), reviews |
| Weekly availability, blocked dates, timezone-aware free windows | Sankalp, fulfilment records, Digital Puja Record, Samagri, Travel, Replacement (M14–M17) |
| Verification: cases, evidence metadata, maker-checker review, resubmission, history, expiry | Family/consent/Kundli domains; Jyotish chart access (`chartAccessGrant` is refused) |
| Puja bookings (provider-side aggregate + state machine + calendar hold) | Reschedule command |
| Ask-a-Pandit / Ask-a-Jyotishi consultations | Search engine (OpenSearch): public search runs on a Postgres read model |
| Public directory + server-side search | |

## Integration architecture

* **One backend, one database.** The module is a NestJS module in `Newbackend`, stored in the platform Postgres through the existing model-layer Postgres driver, following the `marketplace` module's conventions (self-contained folder, ownership-scoped onboarding, `audit_logs`, generated migrations). No new database or service was introduced. (The SRS/Data Dictionary predate the move to Supabase; this repository is Postgres. Collection names, fields and indexes follow the dictionary exactly, so the model is traceable.)
* **Frontend: one module in the main app, like marketplace.** All pandit screens live in `frontend/src/modules/pandit/` (`provider/` console, `public/` devotee pages, `admin/` Tirvona admin pages, `services/`, `types/`, `ui.tsx`; alias `@pandit/*`) and are served by the main app on tirvona.com (`/provider/*`, `/pandits`, `/admin/pandits/*`). There is no separate app or subdomain. The old standalone `pandit/frontend` Next.js prototype (localStorage mocks, never deployed) is superseded and can be deleted.
* **Routing.** Every endpoint is served under **`/api/v2`** using Nest URI versioning, which matches the OpenAPI contract, the existing frontend calls (`/api` + `/v2/...`) and the repository's precedent for versioned controllers (`smart-contact` is `/api/v1`). Existing version-neutral routes (`/api/bookings` for stays, etc.) are unaffected: neutral controllers do not answer `/api/v2/*` (verified), so `/api/v2/bookings` is a different, collision-free resource from the stay bookings.

## What is reused

| Need | Reused as-is |
|---|---|
| Login, JWT, `RolesGuard`, `super_admin` bypass | `auth`, `users`, global guards |
| Audit trail | `audit_logs` (`module: "providers"`, action `providers.*`) with request id, IP, user agent |
| Notifications | `InAppNotificationService` (inbox + socket + FCM). No new channel |
| Transactions | `TransactionService` (Postgres `REPEATABLE READ`, retried on conflict) |
| Error envelope, request id, validation | `ApiExceptionFilter`, `RequestIdInterceptor`, global `ValidationPipe` (whitelist + forbid unknown) |
| Phone normalisation, slugs, regex escaping | `canonicalPhone`, `uniqueSlug`, `escapeRegex` |
| File upload | `POST /api/uploads` returns the reference the client passes as `storageKey` |
| Payments / refunds / payouts | **Not touched.** Bookings keep opaque `paymentRefs`; see [Payment hooks](#payment-hooks) |
| Stay `booking_*` tables, `serviceproviders`/`servicebookings` | **Not reused**: the stay aggregate is hotel-specific (`ashramId`, rooms) and `servicebookings` is an unpaid, unvalidated record. Pandit bookings need availability, a state machine and a price snapshot, so `provider_bookings` is the canonical aggregate for this domain |

## Collections (migration `0003_providers_foundation`)

| Collection | Model | Notes |
|---|---|---|
| `rituals` | `ProviderRitual` | Working copy + `publishedContent` snapshot. Public reads use only the snapshot, so a draft never leaks and a revision does not take the live page down |
| `ritual_variants` | `ProviderRitualVariant` | Schema-validated `scope`; unique `(ritualId, code)` |
| `provider_profiles` | `ProviderProfile` | Public data + denormalised search read-model; unique `userId` and `slug`; `calendarSeq` is the booking lock |
| `provider_private_profiles` | `ProviderPrivateProfile` | Legal name, mobile, email, address, KYC evidence ids. Physically separate; only the owner and verification reviewers can read it |
| `provider_offerings` | `ProviderOffering` | Unique live `(provider, variant, fulfilmentType)` (partial index) |
| `verification_cases` | `ProviderVerificationCase` | Bounded embedded `history`; unique open/in-review case per provider+type (partial index) |
| `verification_evidence` | `ProviderVerificationEvidence` | Metadata only. `objectStorageKey` is `select:false` |
| `availability_rules` | `ProviderAvailabilityRule` | One row per weekly slot (`FREQ=WEEKLY;BYDAY=..` + local window + IANA timezone) |
| `calendar_blocks` | `ProviderCalendarBlock` | Holds, bookings, consultations, manual and travel blocks (UTC) |
| `provider_bookings` | `ProviderBooking` | Immutable `serviceSnapshot`, `stateVersion` for optimistic concurrency |
| `provider_booking_state_history` | `ProviderBookingStateHistory` | Append-only: from/to, command, reason, actor, correlation id, version |
| `expert_consultations` | `ProviderConsultation` | `questionSummary` and `expertNotes` are `select:false` |
| `idempotency_keys` | `ProviderIdempotencyKey` | 24 h TTL |

Referential integrity: the platform deliberately creates **no foreign keys**. References are checked by the services inside transactions, and `GET /api/v2/admin/providers/integrity` (super_admin) is a read-only report of any reference that points at nothing (also enforced by tests).

### Migration and rollback

```bash
npm run db:migrate -- --plan        # review what is pending
npm run db:migrate                  # apply 0003_providers_foundation.sql (13 new tables, nothing existing is altered)
npm run db:verify                   # schema matches the code
```

Rollback (manual, drops the data): `database/rollback/0003_providers_foundation.down.sql`, with the steps in its header. `db:migrate` never reads that folder. Both directions, plus a re-apply, are tested against an empty Postgres (`providers.migration.pg-spec.ts`).

> `database/generate.js` had a bug: array element types were not detected, so every new array field was typed `jsonb` (slow, un-indexable search). It now reads `embeddedSchemaType`. Only columns generated from now on are affected; existing registry columns are never altered by the tool.

## Lifecycles

* **Provider**: `ONBOARDING → ACTIVE → INACTIVE`, `SUSPENDED` (admin only; reinstate returns to `INACTIVE`). Going `ACTIVE` needs a valid identity verification. **Publicly listed** = `ACTIVE` + valid (unexpired) identity verification + at least one sellable offering or consultations on + not a dev fixture. Re-checked on every public read; anything else is a 404.
* **Verification** (`IDENTITY → PROFESSIONAL / INSTITUTION → TRUST_REVIEW`): provider opens a case, adds evidence, submits; a reviewer claims then decides. Approvals expire (default 365 days); lapsing identity lapses everything above it. Rejection reason codes are an allow-list; fraud/policy/duplicate rejections are final, clerical ones can be resubmitted (max 3). `TRUST_REVIEW` is never openable by a provider and needs `super_admin` as the second approver. A paid plan cannot create a badge: there is no input that could.
* **Ritual**: `DRAFT → DOMAIN_REVIEW → APPROVED → PUBLISHED → ARCHIVED`; `:revise` starts the next version while the published page stays live. The approver must differ from the author/submitter (super_admin may self-approve; that is audited).
* **Offering**: `ACTIVE ⇄ PAUSED → INACTIVE`. Variant and fulfilment type are fixed after creation. `INSTITUTION_AUTHORIZED` is refused until the authorization ledger exists. Jyotishi providers cannot hold ritual offerings (Jyotish stays separate from puja booking).
* **Booking** (`PAYMENT_PENDING → CONFIRMED → PROVIDER_ACCEPTED → PREPARATION_IN_PROGRESS → READY_FOR_FULFILMENT → IN_PROGRESS → COMPLETED → SETTLEMENT_PENDING → CLOSED`, plus `PAYMENT_FAILED`, `CANCELLED_BY_CUSTOMER|PROVIDER|OPS`, `DISPUTED`). State changes are **commands** with a per-state actor allow-list (`BOOKING_TRANSITIONS`), applied as a conditional update on `(status, stateVersion)` with history and calendar effects in one transaction.
* **Consultation**: `REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW`. Unanswered requests release their slot after 24 h.

## API (`/api/v2`)

Conventions: all writes need an **`Idempotency-Key`** header (16–128 chars). The same key + same request replays the first result (`Idempotent-Replay: true`); the same key with a different request is `409 IDEMPOTENCY_KEY_REUSED`; a request that fails releases its key. Errors use the platform envelope `{ success:false, message, code, requestId, timestamp, path }` with a stable `code`. Lists return `{ success, data, meta:{ page, limit, total, hasMore } }`. `:action` paths are literal colons, as in the OpenAPI document.

| Area | Endpoints |
|---|---|
| **Public** | `GET /rituals`, `/rituals/:id`, `/rituals/:id/variants` · `GET /providers`, `/providers/:id` (id or slug), `/providers/:id/offerings` |
| **Provider (own)** | `POST/GET/PATCH /provider/profile`, `PATCH /provider/profile/status` · `GET/POST /provider/offerings`, `GET/PATCH /provider/offerings/:id` · `GET/PUT /provider/availability-rules` · `GET/POST /provider/calendar-blocks`, `DELETE /provider/calendar-blocks/:id` · `GET /provider/bookings/summary` · `GET /provider/consultations` |
| **Availability** | `GET /providers/:id/availability?from&to&durationMinutes` (signed in; free windows only) |
| **Verification** | `POST/GET /verification-cases`, `GET /verification-cases/:id`, `POST .../evidence`, `:submit`, `:resubmit` · reviewers: `:claim`, `:decide` |
| **Bookings** | `POST /bookings`, `GET /bookings[?role=provider]`, `GET /bookings/:id`, `POST /bookings/:id/transitions`, `POST /bookings/:id:cancel`, `GET /bookings/:id/state-history` |
| **Consultations** | `POST/GET /consultations`, `GET /consultations/:id`, `:schedule`, `:start`, `:complete`, `:cancel` |
| **Admin** | `/admin/rituals` (CRUD + `:submit-review :approve :publish :revise :archive` + `/variants`), `PATCH /admin/ritual-variants/:id`, `GET /admin/providers`, `GET /admin/providers/:id`, `:suspend`, `:reinstate`, `GET /admin/providers/integrity`, `GET /admin/provider-bookings` |

The exact route table (60 routes, auth, roles, idempotency) is asserted by `providers.contract.spec.ts`, including that every OpenAPI operation listed there still exists.

### Public search (`GET /providers`)

Server-side filters: `q` (name, declared specialisations and published ritual names), `ritual` (id or slug), `ritualVariantId`, `language`, `providerType`, `fulfilmentType`, `city` (home city or service area), `state`, `minVerification`, `hasConsultation`, `date` + `durationMinutes` (a free window on that local date), `minFeeMinor`/`maxFeeMinor`, `sort` (`relevance|verification|price_asc|price_desc|newest|experience`), `page`, `limit` (≤ 50). It reads the denormalised, search-safe fields on `provider_profiles` (rebuilt by `ProviderProjectionService` whenever an offering, schedule, verification, status or catalogue entry changes). With `date`, availability is evaluated for at most the first 300 candidates. Only listed providers appear; there is no way to reach private, KYC, contact, calendar or financial data from here (asserted by tests that scan every public payload for private keys and values).

## Security model

* **Authorization is ownership, not claims.** Provider endpoints resolve the provider from the signed-in user's id; a `providerId` in a body is never trusted (`PROVIDER_MISMATCH`). Booking and consultation actions derive "customer / provider / ops" from the record itself. Strangers get `404`, not `403`, so existence is not leaked. No role is granted by owning a profile: a customer can onboard as a provider without changing their account role (avoiding privilege escalation and losing customer features).
* **Roles** (added to `USER_ROLES`): `verification_reviewer`, `pandit_provider` (a label for admin-created provider logins; ownership still comes from owning a profile). Reused: `content_manager` (catalogue), `service_manager` (ops), `super_admin`.
* **Separation of duties**: reviewer ≠ provider owner; ritual approver ≠ author; trust review needs `super_admin`; decisions only by the assigned reviewer.
* **Restricted data**: private profile only to owner and reviewers (each reviewer read is audited); evidence `storageKey`/hash only to reviewers; contact and address of a booking are masked for the provider until they accept; consultation question/notes only to the two parties (no admin read). Evidence references must come from the upload service (no arbitrary links).
* **Audit**: ids, status changes and reason codes only. Tests assert that no storage key, hash, phone, email, address, note or question ever appears in `audit_logs`.
* **Logging**: only the Nest `Logger` with ids/messages; request bodies are never logged.

## Concurrency

Overlapping bookings of one provider cannot both commit, although no unique index can express overlap: every claim of provider time increments `calendarSeq` on the provider row inside a transaction, so concurrent claims serialise and the loser re-reads the winner's block (`PROVIDER_TIME_CONFLICT`). A mutation test (remove the lock) makes 4 of 8 parallel bookings succeed; with the lock exactly 1 does. A late payment for a hold that expired and was resold fails with `CALENDAR_HOLD_LOST` instead of double-selling. Holds expire through a worker (not a TTL index) so the booking is cancelled in the same step.

### Background jobs (`@nestjs/schedule`)

`sweepHolds` (every minute: unpaid booking holds, unanswered consultation requests, orphaned expired blocks) and `sweepVerifications` (hourly). Idempotent and safe on several instances. `PROVIDERS_MAINTENANCE_ENABLED=false` disables them.

## Payment hooks

Finance logic stays in the payments/refunds/payouts modules. `ProviderBookingService` exports `confirmPayment(bookingId, paymentRef)`, `failPayment(bookingId, paymentRef?)` and `expireHold(bookingId)` for the payment integration to call; nothing calls them yet (see Known gaps). Cancelling a paid booking records the state and reason only: it does **not** start a refund.

The booking `serviceSnapshot.pricing` is explicitly a **`PROVIDER_ESTIMATE`**: the provider's professional fee plus a flat travel charge, computed on the server from the offering (a client cannot send a price). Platform fee, tax and discounts belong to the quote engine.

## Pandit wallet (migration `0004_provider_wallet`)

Devotees pay Tirvona (Razorpay checkout, which includes the UPI QR, or their Tirvona wallet); the pandit is paid from their **provider wallet**.

* **Credit.** When a booking becomes `CONFIRMED` the pandit's share (professional fee + travel; the devotee's `PLATFORM_FEE` line stays with Tirvona) is credited as a `PENDING` `EARNING`, inside the same transaction as the state change. Idempotent per booking (`earning-<bookingId>`).
* **Hold.** It becomes `AVAILABLE` after `PROVIDER_WALLET_HOLD_HOURS` (72): a sweep runs every 5 minutes, and any wallet read releases what is due first.
* **Refund.** Cancelling a paid booking refunds the devotee in full, so the earning is reversed in the cancellation's transaction: a pending one is voided; a released one is debited from the balance and any shortfall becomes `recoveryDueMinor`, settled from the next released earnings.
* **Withdrawal.** The pandit saves one bank account (number AES-GCM sealed with the payout key, only the last 4 digits ever returned) or UPI id, then requests an amount ≤ available. Finance (`finance_manager`, `service_manager`, `super_admin`) reveals the destination (audited), transfers manually and records the UTR (`:mark-paid`), or rejects it and the money returns to the balance. The provider can cancel while `REQUESTED`. Automatic RazorpayX payouts are not wired.

| Collection | Model |
|---|---|
| `provider_wallets` | `ProviderWallet`: `pendingMinor`, `availableMinor`, `withdrawingMinor`, `recoveryDueMinor`, lifetime totals |
| `provider_wallet_entries` | `ProviderWalletEntry`: append-only ledger, unique `idempotencyKey` |
| `provider_payout_accounts` | `ProviderPayoutAccount`: one active per provider |
| `provider_withdrawals` | `ProviderWithdrawal`: `REQUESTED → PROCESSING → PAID`, or `REJECTED` / `CANCELLED` |

Routes: `GET /provider/wallet`, `GET /provider/wallet/transactions`, `GET|PUT /provider/wallet/payout-account`, `GET|POST /provider/wallet/withdrawals`, `POST /provider/wallet/withdrawals/:id:cancel` · admin `GET /admin/provider-wallets/overview`, `GET /admin/provider-wallets/withdrawals`, `POST .../withdrawals/:id/destination`, `:processing`, `:mark-paid`, `:reject`. Frontend: `/provider/wallet`, `/admin/pandits/withdrawals`.

## Development fixtures

`npm run providers:seed-dev -- --password "…"` creates three clearly named sample providers and a sample ritual, all marked `isDevFixture`. It refuses `NODE_ENV=production`, needs `PROVIDERS_ALLOW_DEV_FIXTURES=true`, prints the target database host and refuses a non-local host without `--allow-remote`. The services hide fixtures from every public read, booking and search unless the process is **not** production **and** the flag is set (so a fixture that reached a production database still cannot appear). `--remove` deletes only fixtures. Nothing else in the module creates demo data or falls back to it.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PROVIDERS_HOLD_MINUTES` | `15` | How long an unpaid booking holds the provider's time |
| `PROVIDERS_MAINTENANCE_ENABLED` | `true` | Background sweeps |
| `PROVIDERS_ALLOW_DEV_FIXTURES` | unset | Dev only (ignored in production) |
| `PROVIDER_WALLET_HOLD_HOURS` | `72` | Hours a booking payment stays on hold before the pandit can withdraw it |
| `PROVIDER_PLATFORM_FEE_BPS` | `1000` | Tirvona platform fee the devotee pays on top of the professional fee, basis points (1000 = 10%; ₹501 → ₹551.10). Snapshotted per booking as a `PLATFORM_FEE` price line; the pandit never sees or pays it |
| `PROVIDER_MIN_WITHDRAWAL_MINOR` | `10000` | Smallest withdrawal, paise |
| `PAYOUT_ENCRYPTION_KEY` | (dev: falls back to `ENCRYPTION_KEY`/`JWT_SECRET`) | Seals pandit bank account numbers; required in production |

## Contract decisions that need sign-off

The repository or the documents themselves forced these. Each is easy to change.

1. **`/api/v2`, not `/api/v1`.** The SRS says `/api/v1`; OpenAPI v2.0 and the existing frontend say `/api/v2`. OpenAPI is the machine contract, so v2 is used.
2. **Error envelope.** Platform standard `{ success, message, code, requestId, … }` instead of OpenAPI's `{ error: { code, message, requestId, fieldErrors } }`, so clients keep one parser. The `code` and `requestId` are present.
3. **Pagination** is `page/limit` (as everywhere in this backend) rather than OpenAPI's cursor.
4. **Quote-less booking.** OpenAPI creates a booking from a quote; there is no quote engine yet, so `POST /bookings` takes an `offeringId` and a start time and snapshots a provider-estimate price.
5. **Public fee.** The dictionary classes the professional fee "Confidential"; the product needs prices on public pages, so offerings expose it as `indicativeFee`.
6. **Statuses.** Consultation statuses are the union of the dictionary (`CONFIRMED`, `NO_SHOW`) and OpenAPI (`REQUESTED`, `SCHEDULED`); verification levels follow the dictionary (`IDENTITY_VERIFIED … TIRVONA_TRUSTED`), not the placeholder names in the old frontend (`BASIC/STANDARD/PREMIUM/TRUSTED`).
7. **Fields not implemented because the target domain does not exist yet**: `traditionIds` (stored as free-text `traditions`), `homeDestinationId` (stored as `homeCity/homeState`), `knowledgeNodeIds`, `samagriTemplateId`, `settlementAccountToken`.
8. **Evidence storage.** The dictionary requires encrypted private storage with malware scanning; the platform's upload service returns public Cloudinary links and has no scanner. The metadata model is in place; real KYC documents should not be accepted in production until private storage exists (see Known gaps).

## Frontend reconciliation (for Phase 2)

The old `pandit.service.ts` already used the contract's paths, so most calls work under `/api` + `/v2/...` once the mock fallbacks are deleted. Differences the frontend must adopt:

| Old call | Now |
|---|---|
| any call failing → `localStorage` mock | removed; real errors with `code` |
| `GET /providers` params | `q, ritual, language, city, providerType, minVerification, date, sort, page, limit`; response `{ data, meta }` |
| `GET /providers/:id` | public view; offerings via `GET /providers/:id/offerings` (price is `indicativeFee`); `verificationLevel` values per dictionary |
| `POST /provider/profile` | adds `Idempotency-Key`; `legalName` optional; `languages` from a controlled list |
| offerings `{ name, description, durationMinutes, tags }` | `{ ritualVariantId, fulfilmentType, title, baseProfessionalFeeMinor, currency, travelCharge, inclusions, exclusions, durationMinutes, … }` (ritual/variant from `GET /rituals`) |
| verification `{ documentType, documentUrl }` | upload via `POST /api/uploads`, then evidence `{ evidenceType, storageKey, sha256, mimeType, sizeBytes }`, then `:submit` |
| `:decide { decision, note }` | `{ decision: APPROVE\|REJECT, reasonCode, providerMessage?, internalNote?, validityDays? }` (no `REQUEST_REVIEW`) |
| availability rules / calendar blocks | unchanged shapes; `GET /provider/availability-rules` and `GET /provider/calendar-blocks` now exist; `GET /providers/:id/availability` needs login |
| bookings | `GET /bookings?role=provider`; `POST /bookings` actually creates a booking |
| client-side role switcher / `ab_token` | server decides: use the platform login; reviewers get the `verification_reviewer` role |

## Known gaps and blockers

* **Payments are not wired.** A booking stays `PAYMENT_PENDING` (and expires) until something calls `confirmPayment`. The existing payment webhook dispatcher serves stays/marketplace only; a payment-intent endpoint and a dispatch branch are the next step. Refund triggers on cancellation are not implemented.
* **No private storage or malware scan for KYC evidence** (see decision 8). `malwareScanStatus` stays `PENDING`; a `REJECTED` scan blocks approval, but nothing sets it.
* **Not implemented**: quotes, reschedule, institution authorization, provider teams, matching ranking, reviews/trust score, acceptance-SLA/replacement, WhatsApp/SMS templates for provider events, support-ticket entity type for provider bookings.
* **The migration has not been applied to any database.** An operator runs `npm run db:migrate` after review, before deploying the code.
* `src/database/pg/pg-driver.pg-spec.ts` has one failing test that is unrelated to this module (`refuses to connect to a database whose schema does not match the registry`: the driver singleton is already active in that file).

## Tests

```bash
npx jest src/modules/providers            # 79 unit + contract tests, no database
npm run test:pg -- providers              # integration on real Postgres 17 (embedded): HTTP API (57), migration/rollback (5), dev fixtures (6)
```

The HTTP suite runs the real controllers, guards, validation, filter, interceptors, services, transactions and the Postgres driver; only authentication (header-injected user) and the notification channel are faked.
