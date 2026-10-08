# Database cleanup report (2026-10-08)

Supabase project `cwojgmztaggqmoedidqm`. Supersedes `CLEANUP_PLAN.md`.

**Status: stage A is done on production. Two steps are intentionally pending: the retired
tables can only be moved after the new backend is deployed, and only dropped after a 7-day soak.**
Everything pending was rehearsed end to end on a restored copy of production.

## 1. Safety net

| Item | Result |
|---|---|
| Backup | `D:\desktop\tirvona-backups\2026-10-08-prewrite` (taken minutes before the first write; an earlier one is in `2026-10-08`). Outside the repo, owner-only folder permissions. 667 tables, 33,531 rows |
| Restore proof | Restored into PostgreSQL 17: 6 schemas, 628 tables, 33,287 rows, 7,096 columns, 1,021 indexes, 627 constraints. Every table's row count and content checksum identical; spot-checked records identical. **0 discrepancies** |
| Source snapshot | `D:\desktop\tirvona-backups\source-before-cleanup-2026-10-08.tar` (no secrets, no node_modules) |
| Rehearsal | Every step run on clones of the restored copy first, including rollback and the permanent drop |

## 2. What was done on production

| Action | Result |
|---|---|
| Deleted duplicate `leads.leads` rows | **17** (PREM RATAN RESIDENCY 8, RADHA PALACE 6, Hotel Krishna Anandam 2, HOTEL RADHA SNEH 1). Each kept row already held everything the deleted rows held; nothing referenced the deleted rows. 6 other name groups kept (different phone / agent / capture date) |
| Deleted duplicate `usermemories` row | **1** (`6a9bf328f54803489f8f2afb`; same session, same second, anonymous) |
| Copied `auditlogs` → `audit_logs` | 332 rows (CMS/booking/auth history preserved; `timestamp` filled from `created_at` where empty) |
| Copied `notification_campaigns` → `push_campaigns` | 3 rows, same ids, so the **271** `user_notifications` that referenced them now resolve (orphans 271 → 0) |
| Added index | `booking_bookings(customer_id)` (migration `0002`); created `public.schema_migrations` |
| Quarantined schema `tirvona_db` | Renamed to `legacy_quarantine_tirvona_db` (93 tables, 6 rows). Only Supabase dashboard browsing had ever touched it |
| Diff against the pre-write backup | Only `leads.leads`, `audit_logs`, `push_campaigns` changed by design. `users`, `platform_settings`, `usermemories` differ only through live traffic. 93 `tirvona_db` tables identical |
| Production health after each step | `api.tirvona.com/api/health/ready` = ready (database + redis) |

## 3. Code changes (this repo; deploy to take effect)

* Community "verified stay": `CommunityBooking` now reads `booking_bookings` (was the frozen `bookings`).
* CMS audit entries: written to `audit_logs` through the shared `AuditLog` model (`ContentAuditLog` removed).
* Retired the first-generation marketplace order flow (`marketplace_orders`, `marketplace_payments`): removed from the Razorpay webhook dispatcher, the analytics marketplace tile now reads `marketplace_master_orders` and counts **paid** orders only (it used to count abandoned checkouts). The address book is kept (`MarketplaceAddressService`). Old files are in `Newbackend/retired-source/` for you to delete.
* Registry: 190 → **172** tables (18 removed, regenerated with the new `db:generate -- --prune`). `registry == models == database`.
* `PushCampaign.audienceType` enum now includes `"all"` (the API already accepted it, the model rejected it).
* New `common/phone` helper: staff, admin-created, walk-in guest, parking-staff and ashram-owner creation now detect an existing account whatever format the phone was typed in (`+91…`, `0…`, `91…`, bare) and store the canonical 10-digit form. The login path already did. This stops new duplicate accounts like the 5 that exist.
* New `npm run db:duplicates` (read-only duplicate report).

## 4. Tests

| Check | Result |
|---|---|
| Unit tests (full) | 151 suites, **2,016 tests pass** (new: phone helper, address book, registry guard) |
| `typecheck`, `lint` | clean (0 errors) |
| Backend build + real boot against the cleaned copy | boots, registry validates (`db:verify`: 172 tables OK) |
| HTTP smoke test of the new backend on the cleaned copy | **39 / 39 pass**: public content, events/pilgrimage, marketplace store + checkout list, address book CRUD, verified-stay list from `booking_bookings` (4 stays, ashram populated), creating a Verified Stay article, legacy booking id rejected with 404, CMS action lands in `audit_logs`, analytics (5 endpoints), campaign history, inbox, admin users, Razorpay webhook (valid signature ignored cleanly for an unknown order, bad signature rejected), support, coupons |
| `db:verify` of the new registry against **production today** | OK (172 tables) |
| Rollback rehearsal | `--restore` returned all 111 tables identical to the backup |
| Permanent-drop rehearsal | final state: 172 registry tables, `db:verify` OK |
| Source scan for the retired names | zero references (only my regression test and the unrelated vendor-marketplace webhook alias) |
| `test:pg` driver suite | 24/25. One test fails on `main` code too: the driver files and its spec are byte-identical to the pre-cleanup snapshot, so it is unrelated |
| Not testable here | Redis-backed queues/background jobs and real payment gateways (no Redis locally; no provider credentials were used on purpose). Jobs were exercised only as far as boot/outbox polling |

## 5. Pending (needs you)

| Step | When |
|---|---|
| Deploy the new backend to Render | now |
| `03-quarantine.js --legacy-tables --confirm-code-deployed --apply` (moves 18 retired tables) | right after the deploy is healthy (re-run `02-copy-data.js --apply` first) |
| `04-drop-quarantine.js --apply --permanent` | at least 7 days after that, with no `relation ... does not exist` in the logs |
| Delete `Newbackend/retired-source/` | after the above |

See `Newbackend/database/cleanup/README.md`.

## 6. Intentionally left untouched

| Item | Why |
|---|---|
| 5 duplicate-phone accounts | Each has live bookings, payments or tickets (~670 rows). A unique index on normalized phone would break existing data. They are visible in `db:duplicates`; merging needs a person who knows whether they are the same people |
| 10 same-night bookings; 3 duplicate-name room pairs | Not duplicates (inventory 40 / 10 booked; differing price, inventory, capacity) |
| `eventfestivals` (2), `pilgrimagecircuits` (3), `tripitineraries` (22), `plannertemplates` (1) | Platform-curated content with no owning ashram. The new events/pilgrimage modules require an ashram owner, so importing would mean inventing one. They remain the canonical store for platform content and still back `/services/*`, `/planner/*` and the featured-banner event links |
| `marketplaceorders` (3 paid, ₹1,198 / ₹199 / ₹499) | Only record of those paid orders; not moved into vendor orders (needs a vendor and would trigger settlements). Still read by the admin screen |
| `mongo_raw` | No independent MongoDB source or backup confirmed. It stays |
| `bizinvite` | Another application |
| The 6 other lead groups | Different phone/agent/day: possible re-captures, not duplicates |
| 4 `supporttickets`, 216 `payments`, 244 `bookings`, 149 `reviews`, etc. | Moved to quarantine later (not deleted); archived in the backup. 209 payments are `TXN-SEED`, 7 point at bookings that exist nowhere |
| Extra unique indexes | Existing data supports unique `parking_payments.transaction_id` and case-insensitive promo codes, but I did not add them without being sure payment retries never reuse a transaction id. Listed here for a decision |

## 7. Final state

| | Now (production) | After pending steps |
|---|---|---|
| Schemas | 17 | 15 |
| Tables | 669 | 557 |
| Registry tables | 172 (all present) | 172 |
| `public` / `leads` tables | 181 / 6 | 164 / 5 |

Retired tables are not deleted today; they are protected by the backup, the quarantine step, and the soak.
