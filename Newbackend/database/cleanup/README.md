# Database cleanup (October 2026)

Reviewable, reversible scripts that remove the duplicate / legacy tables found by the
structure audit. Every script is a **dry run unless you pass `--apply`**, runs in one
transaction, and verifies before it writes. They use `SUPABASE_DB_URL` (Newbackend/.env).

| Step | Script | State on production |
|---|---|---|
| 1 | `01-dedupe.js` – delete 17 duplicate `leads.leads` rows + 1 duplicate `usermemories` row | **done** 2026-10-08 |
| 2 | `02-copy-data.js` – copy `auditlogs` → `audit_logs` (332 rows) and `notification_campaigns` → `push_campaigns` (3 rows) | **done** 2026-10-08 (idempotent: safe to run again) |
| – | `npm run db:migrate` – applies `0002_booking_customer_index.sql` | **done** |
| 3a | `03-quarantine.js --tirvona-db` – rename schema `tirvona_db` → `legacy_quarantine_tirvona_db` | **done** |
| 3b | `03-quarantine.js --legacy-tables --confirm-code-deployed` – move 18 retired tables into `legacy_quarantine` | **WAITING for the backend deploy** |
| 4 | `04-drop-quarantine.js --apply --permanent` – permanently drop everything in quarantine | **WAITING ≥ 7 days after 3b** |

## Why 3b must wait for the deploy

The API refuses to start, and queries fail, when a table its registry lists is missing. The
backend running on Render today still lists the 18 retired tables. The code in this repo no
longer does (registry: 172 tables). So:

1. Deploy this backend (Render) and the frontend as usual; confirm `/api/health/ready` is `ready`.
2. Re-run `node database/cleanup/02-copy-data.js --apply` (picks up any audit rows the old
   backend wrote after step 2; it is idempotent).
3. `node database/cleanup/03-quarantine.js --legacy-tables --confirm-code-deployed --apply`
   (add `--manifest <backup>/manifest.json` to also prove nothing changed since a backup; take a
   fresh backup first if you do, because the old backend writes to `auditlogs`).
4. Watch the API logs for a week for `relation "..." does not exist`.
5. `node database/cleanup/04-drop-quarantine.js` (dry run) then `--apply --permanent`.

## Rollback

* Step 3 (either form): `node database/cleanup/03-quarantine.js --restore --apply` moves every
  quarantined table back with its rows and indexes untouched.
* Step 1 and 2: restore the rows from the NDJSON backup taken before the cleanup
  (`D:\desktop\tirvona-backups\2026-10-08-prewrite`, outside the repo).
* After step 4 only the backup can bring tables back.

## Other tools added

* `npm run db:duplicates` – read-only report of accounts sharing a phone number in different
  formats, repeated e-mails, and lead rows submitted twice within a minute.
* `npm run db:generate -- --prune` – removes registry/Drizzle entries whose model no longer exists.
