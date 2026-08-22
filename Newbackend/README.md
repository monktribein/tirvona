# Tirvona NestJS backend

This directory is the replacement backend for Tirvona. It is deliberately independent from the legacy `backend` and keeps parking and ashram booking as separate business domains that share only authentication and infrastructure.

## Runtime

- Node.js 20+
- MongoDB replica set (transactions are required for inventory and finance correctness)
- Redis 7+ (BullMQ notification delivery)
- Optional Razorpay, Cloudinary, Resend, MSG91, and Google credentials
- Optional provider-neutral WhatsApp integration using the AK NEXUS text API.
  It is disabled/dry-run by default; see `.env.example` for activation and
  credentials.

Copy `.env.example` to `.env`, configure the services, then run:

```bash
npm install
npm run build
npm run start:prod
```

Development uses `npm run start:dev`. All frontend-compatible routes remain under `/api`. Swagger is available at `/api/docs` in development and is disabled by default in production; set `SWAGGER_ENABLED=true` only for a deliberately protected environment.

Production startup accepts MongoDB's default database when neither `MONGODB_DB_NAME` nor a URI pathname is supplied, matching the temporary legacy deployment behavior. Set an explicit database name as soon as the existing database is identified. Production still requires non-wildcard `CORS_ORIGINS`, Redis, JWT and parking QR secrets, and production upload storage. Use `/api/health/live` for process liveness and `/api/health/ready` for deployment readiness. The readiness endpoint returns 503 until MongoDB and Redis both respond.

## Architecture

The request path is controller → validated DTO → authentication/role/capability guard → application service → repository → MongoDB. Multi-document inventory, payment, commission, ledger, settlement, coupon, and status changes execute in MongoDB transactions.

Parking owns only `parking_*` collections. Ashram booking owns `booking_*` collections, including daily availability, inventory holds, bookings, payment events, transactions, ledger entries, commissions, settlements, refunds, invoices, receipts, taxes, notifications, reviews, operations, reports, and audit history. Neither domain reads or writes the other domain's financial records.

Authorization is layered: JWT identity, platform role/permission, domain capability, owner/employer scope, resource ownership, then business-state validation. `super_admin` bypasses platform scope but does not bypass booking state-machine or financial invariants.

## Reliability notes

- Availability is reserved with conditional atomic updates for every hotel night `[checkIn, checkOut)`.
- Payment converts held inventory to booked inventory; it never locks the same capacity twice.
- Expired booking and parking holds are released by scheduled, idempotent maintenance jobs.
- Payment signatures, idempotency keys, unique provider event IDs, optimistic concurrency, and immutable financial references protect retry paths.
- Notifications are persisted first and dispatched through BullMQ to in-app/Socket.IO, Resend, or MSG91 channels.
- Cloudinary is the production upload destination; development returns data URLs when credentials are absent, matching the legacy local workflow.

## Aarti booking and Live Pooja

Aarti is a self-contained domain alongside parking and stay booking. It owns
only `aarti_*` collections — sessions, pass types, availability, bookings,
payments, transactions, commissions, QR codes, scan logs, reviews,
notifications, streams, settings, and gate staff — and never reads or writes
another domain's financial records.

An aarti belongs to an ashram, so scope is derived from ashram ownership rather
than a separate partner entity: an `ashram_owner` manages only their own
ashrams' aartis, an `ashram_admin`/`stay_admin` manages all of them, and
`super_admin` additionally approves listings and streams. Gate staff are granted
scan-only capabilities through `aarti_staff`.

Sessions and Live Pooja streams are created as drafts, submitted for review, and
reach the public site only once `super_admin` approves them. Editing an approved
listing's ritual details — or a stream's source URL — returns it to the queue.

Seats are reserved with the same conditional atomic update parking uses, per
pass type per date. Payment converts the hold into a confirmed booking, issues an
AES-GCM sealed QR pass plus an 8-character gate code, and records the commission
and ledger entries in one transaction. A sankalp donation is deliberately
excluded from the refundable base.

Set `AARTI_QR_SECRET` to a dedicated 32+ character value in production; it falls
back to `PARKING_QR_SECRET`, then `ENCRYPTION_KEY`, then `JWT_SECRET`.

## Events & festivals

Events are a self-contained domain owning only `event_*` collections. An ashram
publishes a festival with a date range, a daily start time, optional per-day
capacity, and a programme; a devotee reserves a **free** place for one day and
receives an AES-GCM sealed QR pass plus an 8-character gate code. There is no
payment, commission or refund path — entry is free by design — so the module
carries no financial collections at all.

One live registration per devotee per event day is enforced by a partial unique
index, so a cancelled row never blocks re-registering. A `dailyCapacity` of 0
means uncapped and the conditional capacity guard is skipped entirely.

Set `EVENT_QR_SECRET` to a dedicated 32+ character value in production; it falls
back to `PARKING_QR_SECRET`, then `ENCRYPTION_KEY`, then `JWT_SECRET`.

## Pilgrimage circuits and the itinerary planner

Pilgrimage owns only `pilgrimage_*` collections. An ashram publishes a circuit —
an ordered route of stops across a number of days, each stop carrying its type,
city, leg distance and dwell time. `stopCount` and `totalDistanceKm` are
denormalised onto the circuit so the public list renders without loading stops.

Approved circuits that opt into `usableAsPlannerTemplate` feed the public
itinerary planner. The planner preserves the ashram's own day assignment
whenever the requested trip is at least as long as the published circuit, and
only re-buckets stops when the pilgrim has fewer days — pace then decides how
many stops sit in each day rather than truncating the route. Nothing here is
bookable; pilgrims save an itinerary to their account instead.

## RazorpayX payouts

Payouts are isolated in the `payouts` module and remain disabled until
`RAZORPAYX_PAYOUT_ENABLED=true`. Configure the Razorpay API keys, the RazorpayX
source account number, a separate payout webhook secret, and a base64-encoded
32-byte payout encryption key from `.env.example`. Never reuse the encryption
key as a webhook or API secret.

Configure the RazorpayX webhook URL as
`POST /api/payouts/webhooks/razorpayx` and subscribe to payout status events.
RazorpayX requires the production server's outbound IP to be allowlisted. A
payout must not be enabled until that IP allowlist and webhook signature test
both pass. Payout requests reserve one ashram's eligible commissions in a MongoDB
transaction; provider retries reuse the same `X-Payout-Idempotency` value, and
terminal status reconciliation updates the payout and commission balance in one
transaction.

## Verification

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm audit --omit=dev --audit-level=critical
```

The end-to-end suite requires MongoDB and Redis. Before first production traffic, run `npm run db:indexes` from the built release to create all declared indexes without dropping data.
