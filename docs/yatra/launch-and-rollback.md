# Tirvona Yatra: activation and rollback plan

For the owner and whoever deploys. Each step needs the owner's explicit approval. Nothing here
runs automatically.

## Switches (all default `false`)

| Variable | What it does when `true` |
|---|---|
| `YATRA_ENABLED` | Opens the Yatra API, pages and links. While false, every `/api/v1/yatra/*` endpoint except `/config` answers 404, and the site hides Yatra. |
| `YATRA_MAINTENANCE_ENABLED` | Runs the once-a-minute sweep: it expires lapsed holds, completes finished departures, returns unanswered ride requests to Tirvona, and sends journey reminders. |
| `YATRA_EMAIL_ENABLED` | Sends Yatra customer emails (booking confirmed, cancellation decided, reminder) through the existing Resend setup. In-app notifications are always on. |
| `YATRA_RECONCILIATION_ENABLED` | The sweep also runs the daily Razorpay settlement check (needs `YATRA_MAINTENANCE_ENABLED`). |

No other feature flag was changed or removed.

## Activation plan

1. **Migrations (approval needed).**
   - `0015_yatra_module.sql` creates 15 `yatra_*` tables.
   - `0016_yatra_rides_finance_ops.sql` creates 7 more and adds columns to `yatra_*` tables only.
   - Both are additive and touch no existing non-Yatra table.
   - The deploy pipeline applies them when the code reaches `main`.
   - Because the API refuses to start without the tables, **the code and the migrations must ship together**.
2. **Dark deploy.** Deploy with every flag `false`. Check that:
   - the homepage, stays, pandit, food, temples, parking, aarti, events and the marketplace behave as before;
   - `/yatra` shows "not available yet";
   - `/api/v1/yatra/config` returns `{ enabled: false }`.
3. **Configure (still dark).** Super Admin turns on `YATRA_ENABLED` only on a staging copy, or briefly in production outside peak hours, to:
   - enter commission rules;
   - set Settings (support phone, ride refund window, partner response time, reminder time).
   This data persists when the flag goes off again.
4. **Pilot.**
   - Set `YATRA_ENABLED=true` and `YATRA_MAINTENANCE_ENABLED=true`, then restart the API.
   - Onboard 1–3 organisers and their vehicles, and ride partners for the pilot city (`pilot-checklists.md`).
   - Keep `/yatra` and `/yatra-partner` out of search (they stay in `PRIVATE_PREFIXES`).
   - Do one real low-value booking, cancellation and wallet refund.
5. **Emails.** After checking one email of each kind, set `YATRA_EMAIL_ENABLED=true`.
6. **Reconciliation.**
   - Run Razorpay reconciliation by hand for the first pilot days.
   - Once the results are clean, set `YATRA_RECONCILIATION_ENABLED=true`.
7. **Public launch.**
   - Move `/yatra` and `/yatra-partner` from `PRIVATE_PREFIXES` to `STATIC_PAGES` in **both** route-policy copies (they must stay byte-identical).
   - Then link Yatra from the homepage. This is a separate change; this work did not modify the homepage.

Public booking is never switched on automatically: it needs `YATRA_ENABLED` plus a published tour with an opened departure.

## Rollback plan

Use the smallest step that fixes the problem.

| Problem | Action | Data |
|---|---|---|
| Any Yatra misbehaviour | Set `YATRA_ENABLED=false` and restart the API. Yatra disappears and every other module is unaffected. | Kept. Open holds lapse by themselves, and paid bookings stay confirmed. |
| The sweep misbehaves | Set `YATRA_MAINTENANCE_ENABLED=false`. Bookings stay correct (lapsed holds are reclaimed at checkout), but ride requests are not returned to Tirvona automatically and no reminders go out. | Kept |
| Wrong emails | Set `YATRA_EMAIL_ENABLED=false` | Kept |
| A bad code release | The deploy's normal rollback to the previous release. The P5 migration is additive, so the previous P0–P4 code runs on the P5 schema. | Kept |
| Removing Yatra completely (last resort) | First deploy code without the Yatra module, then run `database/rollback/0016_yatra_rides_finance_ops.down.sql`, then `0015_yatra_module.down.sql`, by hand in that order. | **Dropped**: export first. Wallet credits already given stay in the wallet tables. |

Money safety during a rollback:

- **Payouts in progress.** Finish recording any transfer already made in the bank before switching off. The Finance Center is behind `YATRA_ENABLED`.
- **Customers with confirmed bookings** must still travel or be refunded. With the flag off, Super Admin cannot use the Yatra console. Turn it back on briefly to process refunds, or refund through the wallet admin with a note.
