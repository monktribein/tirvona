# Migration review: 0015 and 0016 (Tirvona Yatra)

Reviewed 2026-11-15. Complete SQL of both migrations and both rollback scripts. **Not applied to the production/shared database.**

## `0015_yatra_module.sql` (701 lines)

| Statement | Count | Targets |
|---|---|---|
| `CREATE TABLE` | 15 | `yatra_booking_links`, `yatra_bookings`, `yatra_departures`, `yatra_documents`, `yatra_journey_links`, `yatra_journeys`, `yatra_ledger_entries`, `yatra_operator_members`, `yatra_operators`, `yatra_payments`, `yatra_seats`, `yatra_service_requests`, `yatra_settings`, `yatra_tours`, `yatra_vehicles` |
| `CREATE UNIQUE INDEX` | 18 (3 partial) | only on the tables above |
| `CREATE INDEX` | 47 | only on the tables above |
| `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | 15 | one per new table |
| `DO $$ … REVOKE ALL … FROM anon, authenticated` | 15 | one per new table (Supabase public roles get no access) |
| `DROP` / `DELETE` / `UPDATE` / `TRUNCATE` | **0** | — |
| Statements on any non-`yatra_*` object | **0** | — |

## `0016_yatra_rides_finance_ops.sql` (387 lines)

| Statement | Count | Targets |
|---|---|---|
| `CREATE TABLE` | 7 | `yatra_commission_rules`, `yatra_issues`, `yatra_payee_entries`, `yatra_payouts`, `yatra_reconciliations`, `yatra_ride_partners`, `yatra_ride_requests` |
| `ALTER TABLE … ADD COLUMN IF NOT EXISTS` | 10 | `yatra_bookings` (commission_snapshot, reminder_sent_at), `yatra_documents` (ride_partner_id), `yatra_ledger_entries` (ride_request_id, ride_partner_id), `yatra_payments` (ride_request_id), `yatra_service_requests` (commission_snapshot), `yatra_settings` (ride_full_refund_hours, ride_partner_response_hours, reminder_hours). All nullable, no defaults, no rewrite of existing rows. |
| `CREATE UNIQUE INDEX` | 10 (3 partial) | only on `yatra_*` tables |
| `CREATE INDEX` | 25 | only on `yatra_*` tables (2 on 0015 tables: `yatra_documents`, `yatra_payments`) |
| RLS + `REVOKE` blocks | 7 + 7 | one per new table |
| `DROP` / `DELETE` / `UPDATE` / `TRUNCATE` | **0** | — |
| Statements on any non-`yatra_*` object | **0** | — |

Requires 0015 (it alters 0015 tables). `migrate.js` applies files in order, each in its own transaction, so a failure rolls back that file only.

## Rollback scripts (manual, never run by `db:migrate`)

| Script | What it does | Data loss |
|---|---|---|
| `rollback/0016_yatra_rides_finance_ops.down.sql` | `BEGIN`; drops the 7 P5 tables; drops 2 P5 indexes; deletes ride partner rows from `yatra_documents`; drops the 10 P5 columns; removes `0016` from `schema_migrations`; `COMMIT` | P5 data: ride partners, rides, commission rules, payee ledger, payouts and their UTRs, reconciliations, incidents |
| `rollback/0015_yatra_module.down.sql` | `BEGIN`; drops the 15 P0–P4 tables; removes `0015` from `schema_migrations`; `COMMIT` | All Yatra data. Wallet credits already given stay in `pilgrim_wallet_transactions`. |

Order: deploy code without Yatra first (the API refuses to start without its tables), then 0016 rollback, then 0015 rollback.

## Conventions match existing migrations

- Same generator output as 0013 (HR) and 0014 (SEO): text ids with `COLLATE "C"`, `_nulls`/`_extra` columns, RLS enabled, and anon/authenticated revoked.
- No foreign keys, as in all Tirvona tables (the baseline `0001` has none).

## Verification already done (embedded PostgreSQL 17, not Supabase)

The steps were: apply 0012 → 0016 → `db:verify` OK (247 tables, 4,223 columns) → idempotent re-run → rollback 0016 (15 Yatra tables remain) → re-apply → rollback 0016 + 0015 (0 Yatra tables; other tables untouched) → re-apply → verify OK.

## Conclusion

Both migrations add only Yatra objects. They cannot modify or break an existing production module's schema. What remains is applying them to the existing Tirvona database through the normal deploy after the owner's explicit approval (see `staging-report.md`). No other database is involved.
