# Tirvona NestJS backend

This directory is the replacement backend for Tirvona. It is deliberately independent from the legacy `backend` and keeps parking and ashram booking as separate business domains that share only authentication and infrastructure.

## Runtime

- Node.js 20+
- MongoDB replica set (transactions are required for inventory and finance correctness)
- Redis 7+ (BullMQ notification delivery)
- Optional Razorpay, Cloudinary, Resend, MSG91, and Google credentials

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
