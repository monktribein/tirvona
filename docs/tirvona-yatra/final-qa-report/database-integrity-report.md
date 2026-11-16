# Database integrity report

Method:
- the two migrations were read;
- they were replayed on a throwaway embedded PostgreSQL 17 using the repository's own `migrate` and `verify` tools;
- both rollback scripts were run, then everything was re-applied.

No migration was run against the shared or production database.

## Migrations

| File | New tables | Unique indexes (partial) | Other indexes | RLS enabled | Touches non-Yatra objects | DROP / UPDATE / DELETE |
|---|---|---|---|---|---|---|
| `0015_yatra_module.sql` | 15 | 18 (3) | 47 | 15/15 | No | None |
| `0016_yatra_rides_finance_ops.sql` | 7 (plus `ADD COLUMN IF NOT EXISTS` on `yatra_*` tables only) | 10 (3) | 25 | 7/7 | No | None |

## Results

| # | Requirement | Expected | Actual | Method | Status |
|---|---|---|---|---|---|
| 1 | Migrations apply on a clean DB | All pending applied | 0012 → 0016 applied; `verify`: "schema OK: 247 tables, 4223 columns", nothing pending | `db-replay` on embedded PG17 | PASS |
| 2 | Idempotent | Second run is a no-op | "Database is up to date." | replay | PASS |
| 3 | Schema matches the code models | `verify` passes | Passes (the API refuses to start otherwise) | replay + full-app boot in the UI smoke | PASS |
| 4 | Reversible | Rollback restores the previous state | 0016 rollback → 15 Yatra tables, 0016 un-recorded. 0016 + 0015 rollback → 0 Yatra tables, both un-recorded, every other table untouched. Re-apply → verified again. | replay | PASS |
| 5 | Existing module schemas not modified | No change outside `yatra_*` | Confirmed by grepping every CREATE / ALTER / INDEX target in both files | review | PASS |
| 6 | No double-sold seat at DB level | Unique `(departure_id, seat_no)` | Present; proven under 100-way concurrency | schema + tests | PASS |
| 7 | No duplicate money rows | Unique idempotency keys | `yatra_ledger_entries.idempotency_key`, `yatra_payee_entries.idempotency_key`, unique gateway `orderId` and `paymentId` on `yatra_payments` | schema + tests | PASS |
| 8 | One active commission rule per scope | Partial unique index | `rule_key WHERE status = 'active'`, plus unique `(rule_key, version)` | schema + test | PASS |
| 9 | One open payout per payee; UTR unique | Partial unique indexes | `payee_id WHERE status IN (pending, under_review, approved)`; unique `transfer.reference` | schema + concurrency test | PASS |
| 10 | One journey per booking; one organiser per owner; one ride-partner account per user | Unique | Present | schema | PASS |
| 11 | One reconciliation per day | Unique `(kind, period_date)` | Present; re-run upserts | schema + test | PASS |
| 12 | Foreign keys | Relationships enforced | **No database FOREIGN KEY constraints.** This matches the whole Tirvona schema: the baseline `0001_app_schema.sql` has none, and ids are app-generated text ObjectIds. Relationships are enforced in the services: every lookup is scoped and checked, and money writes happen inside transactions. | review | PASS (by convention), risk noted |
| 13 | Enum constraints | Valid statuses only | Enforced in code (DTO `IsIn` and state-transition tables). No DB CHECK constraints, as everywhere else in Tirvona. | review | PASS (by convention), risk noted |
| 14 | Row-level security | Same as other tables | RLS enabled on all 22 tables (the API uses the service connection, as every module does) | review | PASS |
| 15 | Ledger tables are append-only | No update or delete paths | No service updates or deletes `yatra_ledger_entries`, `yatra_payee_entries` or the audit log (grep) | review | PASS |
| 16 | Applied to shared or production DB | Must not happen without approval | **Not applied.** Awaiting owner approval. | — | (by design) |

## Counts

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 15 | 0 | 0 | 0 |

Item 16 is a deliberate hold, not a test.

## Remaining risk

- **No database-level foreign keys or CHECK constraints** (Tirvona-wide design). A bug in a service could, in principle, write an orphan id. The tests found none.
- **Not yet run on Supabase.** The replay ran on embedded PostgreSQL 17 (the same major version as Supabase). The first real application should be on a staging copy, or with `npm run db:migrate -- --plan` reviewed first.
- **Rollback deletes data.** The rollback scripts drop data. Export first, and follow the order in `docs/yatra/launch-and-rollback.md`.
