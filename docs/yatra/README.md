# Tirvona Yatra (bus and group pilgrimage tours)

Verified organisers sell bus and group-tour seats from **one central seat inventory**. Every
customer payment goes to Tirvona's existing Razorpay account. Refunds go to the existing Tirvona
wallet. Only Super Admin approves organisers and publishes tours.

Status: phases P0–P6 are built in code, behind feature flags that are **off by default**. P5 adds
local rides with verified ride partners, versioned commission rules, the organiser / ride partner
ledger, manual payouts, Razorpay settlement reconciliation, the Finance Center and Destination Ops.
WhatsApp and SMS sending are **not** built (see `notifications.md`). Migrations 0015 and 0016 are
written but not applied to any shared database.

More documents:

- `pilot-checklists.md`: onboarding and verification checklists for the pilot.
- `operations-sops.md`: support, refund, payout, reconciliation and incident procedures.
- `launch-and-rollback.md`: the activation and rollback plan.
- `notifications.md`: what is sent, and the WhatsApp templates that need Meta approval.

## Switches

| Variable | Default | Effect |
|---|---|---|
| `YATRA_ENABLED` | `true` (since 2026-11-17) | Set to `false` to switch Yatra off. While false, every `/api/v1/yatra/*` endpoint answers 404 except `GET /api/v1/yatra/config`, and the website shows "not available yet" and hides every Yatra link. |
| `YATRA_MAINTENANCE_ENABLED` | `false` | A once-a-minute sweep that marks lapsed holds `expired` and finished departures `completed`, returns unanswered ride requests to Tirvona, and sends journey reminders. Bookings are correct without it, because an expired hold is reclaimed in place by the next checkout. |
| `YATRA_EMAIL_ENABLED` | `false` | Customer emails (booking confirmed, cancellation, reminder) through the existing Resend setup. |
| `YATRA_RECONCILIATION_ENABLED` | `false` | The sweep also runs the daily Razorpay settlement check for the day before yesterday. |

Other variables Yatra uses already exist: `RAZORPAY_*`, `CLOUDINARY_*`, `JWT_SECRET` (or
`PAYMENT_LINK_SECRET`) for payment links, `PAYOUT_ENCRYPTION_KEY` for organiser bank numbers, and
`FRONTEND_URL` for links.

## Business rules and where they are enforced

| Rule | Where |
|---|---|
| All payments to Tirvona Razorpay; no cash and no organiser collection | `YatraGatewayService` creates Tirvona orders. Organiser-assisted bookings send the customer a signed payment link (`/yatra/pay/:token`). |
| A booking is confirmed only after a verified payment | `YatraBookingService.settle`: the checkout signature, or the shared webhook through `PaymentsWebhookService` → `YatraWebhookService`. The order must belong to that booking. |
| One central inventory; no organiser inventory | One `yatra_seats` row per seat with UNIQUE (departure_id, seat_no). Website and organiser bookings both call `YatraInventoryService.holdSeats`. |
| Never two bookings for one seat | Each seat is claimed with a conditional update inside a REPEATABLE READ transaction. Conflicts retry and then fail with `SEAT_TAKEN`. Tested with 100 parallel checkouts. |
| Eligible refunds go to the Tirvona wallet, exactly once | `decideCancellation` → `WalletService.credit` with key `refund:yatra:<bookingId>`, plus a ledger row with a unique `idempotency_key`. |
| A paid but unusable payment is never kept | Late payment with the seats gone, a second payment, or a cancelled booking: full amount to the payer's wallet (`refund:yatra:unapplied:<paymentId>`) and a ledger pair. |
| Only Super Admin approves organisers and verifies documents and vehicles; only Super Admin approves and publishes tours | `YatraAdminController` has `@Roles("super_admin")`. Organisers can only draft and submit. |
| Every organiser booking records the organiser and staff | `source = ORGANIZER`, `organizerStaffUserId`, `organizerMemberRole` on `yatra_bookings`. |
| Organisers see only their own organisation | Every organiser call goes through `YatraAccessService.require`, which scopes to the caller's membership. |
| Organisers cannot change sold inventory | Time, fare and seats lock once a departure opens. Seat blocking and departure cancellation are admin-only. |
| Commission is configurable, never hard-coded, and a booking keeps the rule it was sold under | `yatra_commission_rules`: versioned per scope, with one active version per scope by partial unique index. `YatraFinanceService.snapshotFor` copies the rule onto each booking, ride and add-on. A booking with no rule earns nothing until Finance applies one. |
| Payouts are manual only, and only Finance records transfers | `YatraFinanceController` allows `super_admin` and `finance_manager`. Payouts go pending → under_review → approved → transfer_recorded (UTR unique, proof private) → reconciled. No code calls a bank. One open payout per payee (partial unique index). |
| An organiser or ride partner sees only their own payable and payouts | The self-service routes derive the payee from the caller (`YatraAccessService` / `partnerIdOf`). Payout and proof lookups are scoped to that payee. |
| Only approved ride partners get ride requests | `assignablePartner` throws `PARTNER_NOT_APPROVED`. |
| Destination Ops sees only its city | `YatraOpsService` uses `HrLocationService.scopeFor`, the same office scope as Leads, Food, Temples and Pandits. |
| Gross collected is not revenue | The Finance Center reports revenue as Tirvona commission only. GST and TDS are shown separately. |
| KYC files are never public | Cloudinary `type: authenticated` uploads. Only the storage id is stored, and viewing goes through a 5-minute signed link that is written to the audit log. |
| All financial records under Tirvona control | Append-only `yatra_ledger_entries` (customer money) and `yatra_payee_entries` (what Tirvona owes each organiser or partner). Each row has a unique idempotency key. Earnings become payable after the journey ends or the ride completes. |

## Code map

Backend: `Newbackend/src/modules/yatra/`

- `domain/`: constants (statuses, roles, permissions), errors, and pure rules (seat layouts,
  refund quote via the shared `refunds/domain/refund-calculator`, sellability) with unit tests.
- `infrastructure/yatra.schemas.ts`: the 15 Yatra tables of P0–P4.
- `infrastructure/yatra-p5.schemas.ts`: ride partners, ride requests, commission rules, payee
  entries, payouts, reconciliations and issues (7 tables).
- `domain/yatra-finance.ts`: pure commission, refund-reversal and balance maths, with unit tests.
- `infrastructure/yatra-ref.schemas.ts`: read-only views of users, pilgrimage circuits and stops,
  stay/parking/aarti bookings, food vendors and pandit profiles. They declare only existing columns,
  so they add nothing to the database.
- `application/`:
  - `yatra-support.service.ts`: access, audit, settings, Razorpay gateway, notifications, private
    document storage.
  - `yatra-operator.service.ts`: registration, profile, payout, KYC, staff, admin review.
  - `yatra-catalog.service.ts`: vehicles and tours, circuit templates, admin review and publishing.
  - `yatra-inventory.service.ts`: departures, seat claims, seat maps, public search.
  - `yatra-booking.service.ts`: bookings, payments, payment links, tickets, cancellations, manifest,
    check-in, expiry.
  - `yatra-journey.service.ts`: journeys, links to existing bookings, food and puja add-ons.
  - `yatra-insights.service.ts`: booking links, earnings, reports, admin overview and finance, the
    webhook entry and the sweep.
  - `yatra-finance.service.ts`: commission rules, the payee ledger, payouts, the finance dashboard
    and reports, and Razorpay reconciliation (behind the `RazorpayReconClient` interface).
  - `yatra-ride.service.ts`: ride partner onboarding and review, ride requests, ride payments and
    refunds, and issue reports.
  - `yatra-ops.service.ts`: Destination Ops dashboard, booking lookup, incidents, area report.
- `presentation/`: DTOs, the feature-flag guard, and the controllers:
  - P0–P4: public, pilgrim, organiser and Super Admin;
  - P5 (`yatra-p5.controller.ts`): ride partner, pilgrim rides, organiser payouts, Finance, ride admin and Destination Ops.

  Swagger tags start with `Yatra ·`.

Changes outside the module, all additive:

- `app.module.ts` imports `YatraModule`.
- `payments.module.ts` and `payments-webhook.service.ts` get one more dispatch branch.
- `wallet.constants.ts` adds `"yatra"` to `WALLET_MODULES`. This is a code enum only, not a DB constraint.
- `config/environment.ts` and `.env.example` add the four flags.
- `seo-route-policy.ts` and `frontend/src/seo/routePolicy.ts` (byte-identical) make `/operator`,
  `/yatra`, `/yatra-partner`, `/ride-partner` and `/ops` private (noindex).
- `yatra.module.ts` imports the existing `HrLocationModule` for the Ops city scope.

Frontend:

- `frontend/src/modules/yatra/`: service, shared UI (seat map, payment runner, flag gate), public and
  journey pages, and the organiser console in `operator/`.
- `frontend/src/modules/yatra/ridePartner/`: the ride partner console.
- `frontend/src/modules/yatra/ops/YatraOpsPage.tsx`: Destination Ops.
- `frontend/src/admin/yatra/`:
  - `AdminYatraPages.tsx`: the Super Admin console;
  - `AdminYatraRidePages.tsx`: ride partners and rides;
  - `YatraFinanceCenterPage.tsx`: the Finance Center.
- Routes are in `App.tsx`. Sidebar groups are in `DashboardLayout.tsx`: `OPERATOR_GROUPS`,
  `RIDE_PARTNER_GROUPS`, `YATRA_ADMIN_GROUP`, `YATRA_FINANCE_GROUP` (Finance Manager),
  `YATRA_OPS_GROUP` (HR / Executive) and `YATRA_SUPPLIER_GROUP`.
- Hindi labels are in `i18n/resources.ts`.
- New top-level paths are in `frontend/vercel.json`, `render.yaml` and `deploy/nginx/tirvona-web.conf`.

| Who | Pages |
|---|---|
| Pilgrim | `/yatra`, `/yatra/departures/:code`, `/yatra/checkout/:bookingId`, `/yatra/go/:code` (organiser link), `/yatra/pay/:token` (organiser payment link), `/profile/journeys`, `/profile/journeys/:id` (with local rides and "Report a problem") |
| Ride partner | `/ride-partner/dashboard`, `profile`, `vehicles`, `documents`, `requests`, `earnings`, `notifications` |
| Finance Manager | `/admin/yatra/finance` (Finance Center) |
| HR / Executive | `/ops/yatra` (own office area only) |
| Organiser | `/yatra-partner`, `/operator/dashboard`, `profile`, `documents`, `staff`, `vehicles`, `tours`, `tours/new`, `tours/:id`, `departures`, `departures/:id` (seats, manifest, check-in), `bookings`, `bookings/new`, `bookings/:id`, `links`, `earnings`, `reports`, `notifications` |
| Restaurant / pandit | `/restaurant/yatra-requests`, `/provider/yatra-requests` |
| Super Admin | `/admin/yatra` overview, `operators`, `documents`, `vehicles`, `tours`, `departures` (global seat inventory, cancel and refund), `bookings`, `cancellations`, `service-requests`, `ride-partners`, `rides`, `finance` (Finance Center), `collections` (collections and ledger), `audit`, `settings`; and `/ops/yatra` for every city |

## Lifecycles

- **Organiser:** draft → submitted → under_review → approved / rejected; approved ↔ suspended.
- **Tour:** draft → pending_review → approved → published ↔ unpublished, or rejected. Organisers
  edit only draft, rejected and unpublished tours; an edit returns the tour to draft.
- **Departure:** draft → scheduled (opened: seat rows created) ↔ sales_closed → completed, or
  cancelled (admin; refunds everyone 100%).
- **Booking:** held → payment_pending → confirmed → completed. A held or pending booking can become
  expired or cancelled. A confirmed booking can become cancellation_requested, then cancelled
  (refund) or confirmed again.
- **Add-on:** requested → supplier_pending → accepted (priced) → confirmed (paid) → fulfilled. It
  can also be rejected or cancelled.
- **Ride partner:** draft → submitted → approved / rejected; approved ↔ suspended.
- **Ride:** requested → partner_pending → accepted (partner's fare) or rejected → confirmed (paid)
  → in_progress → completed. Cancellation by the pilgrim, the partner or Tirvona refunds to the
  wallet (see `operations-sops.md`). A request unanswered for *partner response hours* returns to
  requested.
- **Payout:** pending → under_review → approved → transfer_recorded → reconciled; rejected or
  cancelled before a transfer.
- **Incident:** open → in_progress → resolved → closed.

## Tests

- `domain/yatra.utils.spec.ts` (unit, part of `npx jest`): layouts, permissions, refund quote,
  sellability, journey state, file sniffing, CSV escaping, feature-flag guard.
- `domain/yatra-finance.spec.ts` (unit): commission maths, rule specificity, refund reversal,
  balances, gateway comparison.
- `yatra.http.pg-spec.ts` (`npm run test:pg`, real Postgres 17): 34 end-to-end tests covering
  onboarding, approval, publishing permissions, departures, website and organiser-assisted
  booking, duplicate seats, 100 concurrent checkouts, lapsed holds, webhook idempotency, payment
  failure, wallet refunds, unauthorised access, cross-organiser isolation, journeys and add-ons.
- `yatra-p5.http.pg-spec.ts` (real Postgres 17): 18 tests covering:
  - commission rule versions and booking snapshots;
  - pending vs payable balance, and refund reversal;
  - payout limits, duplicates, privacy, the review / transfer / UTR / proof / reconcile flow;
  - ride partner onboarding and approval;
  - the ride lifecycle, cancellation refunds and issues;
  - add-on referral;
  - Razorpay reconciliation (fake client);
  - Ops city scope and the background jobs;
  - 100 checkouts against 40 seats.

## Launching (owner checklist)

1. Approve migrations `0015_yatra_module.sql` (15 `yatra_*` tables) and
   `0016_yatra_rides_finance_ops.sql` (7 more `yatra_*` tables, plus columns on `yatra_*` tables
   only). Merging to `main` makes the deploy apply them. Rollback scripts are in
   `database/rollback/`. The full plan is in `launch-and-rollback.md`.
2. Leave `YATRA_ENABLED=false` for the first deploy and confirm the site behaves as before.
3. Before switching on, decide:
   - the legal product categories (seat-by-seat sale needs the right permit);
   - the commission and referral rates (Finance Center → Commission rules);
   - the support phone (Admin → Yatra Settings);
   - whether the public `/yatra` pages should be indexed (move them from `PRIVATE_PREFIXES` to
     `STATIC_PAGES` in both route-policy copies).
4. Set `YATRA_ENABLED=true` on the server and restart the API. Set `YATRA_MAINTENANCE_ENABLED=true`
   as well if you want the housekeeping sweep.
