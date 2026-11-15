# Payment and refund audit (P3)

Method:
- integration tests on an isolated PostgreSQL 17 database, with demo payments;
- unit tests of the real HMAC code paths, using **test secrets only**;
- code review of the existing Tirvona Razorpay integration.

No real customer payment or refund was made. The Razorpay keys in `Newbackend/.env` are live keys and were deliberately **not** used.

## Where the money goes (code review)

| Rule | Where it is enforced | Status |
|---|---|---|
| All customer payments go to Tirvona's central Razorpay account | `YatraGatewayService.createOrder` creates orders only with Tirvona's `RAZORPAY_KEY_ID`/`SECRET` (the same config the other modules use). There is no field anywhere for an organiser's own gateway or UPI. Organiser-assisted bookings send the customer a signed Tirvona payment link (`/yatra/pay/:token`). | PASS (review + tests) |
| No cash or external collection | No "mark paid", "cash" or "offline" endpoint exists for Yatra bookings, rides or add-ons. Confirmation needs a verified Razorpay payment (or a demo payment outside production). | PASS (review) |
| Demo payments can never be used in production | `verifySignature` and `createOrder` refuse demo orders when `NODE_ENV=production` or when keys are configured. | PASS (unit test) |
| Eligible refunds go to the existing Tirvona Wallet | `WalletService.credit` (module `"yatra"`) with idempotency keys `refund:yatra:<bookingId>`, `refund:yatra:ride:<rideId>`, `refund:yatra:unapplied:<paymentId>`. No Razorpay refund API is called by Yatra. | PASS (tests) |

## Results

| # | Requirement | Expected | Actual | Test method | Status |
|---|---|---|---|---|---|
| 1 | Customer payment (checkout signature) | Only Razorpay's HMAC-SHA256 of `order|payment` confirms | Valid HMAC accepted. Wrong payment id, wrong secret, short or empty signature all rejected | `yatra-qa-security.spec.ts` (unit, test secret) | PASS |
| 2 | Forged payment, or a payment for someone else's booking | Rejected | `400` forged; `404` other user | `yatra.http` › "rejects a forged payment…" | PASS |
| 3 | Organiser-assisted payment | Paid through Tirvona; only the claimer can pay | Link claimed by the first signed-in payer; a second account gets `409`; confirmed booking keeps organiser and staff attribution | `yatra.http` › "lets the customer claim and pay through the link…" | PASS |
| 4 | Payment success | Booking confirmed, journey created, seat booked | As expected | `yatra.http`, `yatra-qa` Scenario D | PASS |
| 5 | Payment failure or abandonment | Seat released, nothing charged | Release → seat available; order mismatch → `400 ORDER_MISMATCH` | `yatra.http`, `yatra-qa` Scenario C | PASS |
| 6 | Payment pending | Booking `payment_pending`, seat stays held until the hold lapses | As expected; after lapse, seat freed | `yatra-qa` Scenario C | PASS |
| 7 | Duplicate webhook | Processed once | Webhook retries and repeated confirms → 1 ledger row, 1 journey. The shared webhook also dedupes by event id (existing test). | `yatra.http`, `yatra-qa` D2, `payments-webhook.service.spec.ts` | PASS |
| 8 | Invalid webhook signature | Rejected before any module runs | `401 UnauthorizedException`; Yatra handler not called. Tampered body, wrong signature and missing secret all fail verification. | `yatra-qa-security.spec.ts` (unit) | PASS |
| 9 | Webhook routing to Yatra | Captured Yatra order confirmed with the captured amount | Routed to Yatra with `amountPaise`; event saved as `processed / yatra` | `yatra-qa-security.spec.ts` | PASS |
| 10 | Payment reconciliation (Razorpay) | Each captured payment checked against Razorpay and settlement, separately from payouts | Mismatches recorded; re-run replaces the day | `yatra-p5.http` › "checks each captured payment against Razorpay…" (fake gateway client) | PASS (logic) |
| 11 | Cancellation policy calculation | Policy tiers applied | 90% quote at 10 days out; Super Admin can override with a note | `yatra.http` › "quotes the policy…"; unit tests of the refund calculator | PASS |
| 12 | Eligible refund to wallet | Exact amount, once | ₹2,700 (90%) and ₹1,500 (50%) credited exactly. Second approval → `409`; balance unchanged | `yatra.http`, `yatra-qa` recalculation test | PASS |
| 13 | Duplicate refund prevention | One wallet transaction per refund key | One row per `refund:yatra:<id>` | DB query on `pilgrim_wallet_transactions` | PASS |
| 14 | Wallet balance correctness | Balance = Σ(credits) − Σ(debits) | Equal | `yatra-qa` (SQL sum vs `pilgrim_wallets.balance`) | PASS |
| 15 | Ledger entries | One `booking_payment` per booking, one `booking_refund` per refund | As expected | DB queries | PASS |
| 16 | Departure cancelled by Tirvona | 100% refund to every paid traveller, unpaid holds freed | As expected | `yatra.http` › "Super Admin cancels a departure" | PASS |
| 17 | Ride payment and refund | Paid ride refunded 100% when cancelled early, by the partner, or by Tirvona | As expected | `yatra-p5.http` ride tests | PASS |
| 18 | Real Razorpay test-mode payment end to end | Order → checkout → webhook | **Not executed.** No Razorpay test keys are available in this environment, and the live keys must not be used. | — | BLOCKED |

## Counts

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 17 | 0 | 0 | 1 |

## Remaining risk

- Item 18 must run on staging with Razorpay **test** keys and the webhook secret before production approval:
  - order creation;
  - hosted checkout;
  - signature verification;
  - `payment.captured` webhook;
  - one refund-to-wallet.
- Razorpay settlement reconciliation has only run against a fake client. Its first real runs should be done by hand (Finance Center → Razorpay reconciliation) before `YATRA_RECONCILIATION_ENABLED` is switched on.
