# Seat inventory and concurrency report

Scope: P2 central seat inventory (the highest-priority area). All tests ran against a real
PostgreSQL 17 test database created for the run (embedded, thrown away afterwards). No shared or
production database was used. Payments ran in demo mode, with no real money.

## How the inventory works (verified in code)

- **One row per seat.** Each seat is one `yatra_seats` row, with a unique index on `(departure_id, seat_no)`. Website, organiser link and organiser-assisted bookings all call `YatraInventoryService.holdSeats`; there is no second inventory.
- **Claiming a seat.** A seat is claimed with a conditional update (`status = available`, or an expired hold) inside a REPEATABLE READ transaction. The Postgres driver retries serialization failures (40001), and a conflict ends as `409 SEAT_TAKEN`.
- **Expired holds.** An expired hold is reclaimed at the next checkout, or by the sweep when `YATRA_MAINTENANCE_ENABLED` is on.
- **Counting booked seats.** `booked_seats` on the departure is changed only inside the confirming transaction.

## Results

| # | Requirement | Expected | Actual | Test method | Status | Evidence |
|---|---|---|---|---|---|---|
| A | 100 simultaneous attempts for 40 seats | ≤ 40 confirmed | Exactly 40 holds; 60 × `409`; 40 confirmed payments. DB: 40 booked rows, 40 distinct seats, 40 distinct bookings; `booked_seats = 40` | `yatra-p5.http.pg-spec.ts` › "100 concurrent attempts on 40 seats" | PASS | DB query `count(*), count(DISTINCT seat_no), count(DISTINCT booking_id)` = 40/40/40 |
| A2 | 100 simultaneous attempts on 19 seats (choose and automatic seat modes) | each seat sold once | Each seat sold once in both modes | `yatra.http.pg-spec.ts` › "never oversells…" (2 tests) | PASS | seat rows checked |
| B | Customer and organiser try the same seat at the same moment | exactly one succeeds | 10 rounds, one per seat: every round exactly one `201` and one `409 SEAT_TAKEN`. The seat row holds the winner's booking id. Organiser-source bookings in the DB equal the organiser wins | `yatra-qa.http.pg-spec.ts` › "Scenario B" | PASS | `yatra_seats` row per round; count of `source = 'ORGANIZER'` |
| C1 | Hold expires without payment | seat available again | Booking moves `payment_pending` → `expired` via the sweep. Seat row becomes `available`, `booking_id = null`. The organiser re-sells the seat at once | `yatra-qa` › "Scenario C"; `yatra.http` › "expired seat holds" (2 tests) | PASS | seat row before/after |
| C2 | Payment abandoned or failed | seat available again | Release → booking `cancelled`, seat `available`; `booked_seats` unchanged (0) | `yatra-qa` › "Scenario C"; `yatra.http` › "handles a failed or abandoned payment" | PASS | seat and departure rows |
| C3 | Late payment after the seat went to someone else | money never kept | Late payer refunded in full to the wallet (`PAYMENT_REFUNDED_TO_WALLET`); the seat stays with the new holder | `yatra.http` › "lets another customer take a seat whose hold lapsed" | PASS | wallet balance and seat row |
| D1 | Same customer submits the same booking 3 times at once | one hold | 1 × `201`, 2 × `409` | `yatra-qa` › "Scenario D" | PASS | responses |
| D2 | 4 confirm calls plus 2 webhooks for the same payment, all at once | one confirmed booking | 1 confirmed booking, 1 `booking_payment` ledger row, 1 journey, 1 organiser earning; seat `booked`; `booked_seats + 1` exactly | `yatra-qa` › "Scenario D" | PASS | DB rows for each table |
| D3 | A second, different payment for the same booking | refunded, never double-booked | Second payment refunded to the wallet once (`unapplied_payment` / `unapplied_refund` pair) | `yatra.http` › "returns a second, different payment…" | PASS | ledger types |
| E | Departure creation, capacity, layout, live availability | as configured | Seat map statuses (available / unavailable / blocked) match the DB; invalid seat → 400; blocked seat → 409 | `yatra.http` › "holds the chosen seats…", departures tests | PASS | seat map |
| F | Seat release on booking cancellation (refund) | seats freed | Seats 1 and 2 `available` after approval | `yatra.http` › "quotes the policy…" | PASS | seat rows |
| G | Unpublished or suspended tour | no new holds | Hold refused (404/409) while unpublished; departure page 404 | `yatra-qa` › "unapproved, unpublished or suspended tours" | PASS | responses |

## Counts (concurrency and inventory tests in this report)

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 13 | 0 | 0 | 0 |

## Remaining risk

- The races ran on one API process against one Postgres. Production runs a single PM2 API process, which matches. If the API is ever scaled horizontally, the guarantees still hold, because they live in Postgres (unique index plus conditional update), not in process memory.
- No soak test beyond 100 concurrent requests was run.
