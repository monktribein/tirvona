# Tirvona database cleanup: plan for approval

> **Superseded by [CLEANUP_REPORT.md](CLEANUP_REPORT.md)**, which records what was actually done. Kept for the audit trail; where it differs, the report wins.

Status (at the time this plan was written): PLAN ONLY. Nothing had been changed. Every query run so far was read-only.
Target: Supabase project `cwojgmztaggqmoedidqm` (labelled PRODUCTION, Free plan), schemas `public`, `leads`, `smart_contact`, plus the redundant `tirvona_db`.
Basis: the structure audit, plus the deeper checks below (dated 2026-10-08).

## 0. Corrections to the audit

The deeper per-record checks changed several audit conclusions. Use these numbers, not the audit's.

| Audit said | Deeper check found |
|---|---|
| 9 duplicate lead groups, 24 extra rows | **4 groups are true double-submissions: 17 extra rows.** 6 other groups are NOT duplicates (different phone, agent, or capture day) and stay |
| `rooms`: 3 duplicate-name pairs | **None are duplicates.** Each pair differs in price, inventory, capacity or status. Keep all |
| 10 same-night bookings may be duplicates | **Not duplicates.** The room has `total_inventory` 40 and `booked_count` 10, which matches. They are ₹1 test payments by 2 accounts. Keep all, report only |
| `offers`: codes still "active" only in the old table | **Both expired** (WEEKEND500 on 2026-08-26, KUMBH2026 on 2026-09-25), 0 redemptions. No migration needed |
| 14 marketplace orders = real orders | **Only 3 are paid** (`marketplaceorders`, July). The 11 in `marketplace_orders` are abandoned checkouts, all unpaid |
| 5 duplicate user accounts | **All 5 have live references** (about 670 rows across 38 tables). They cannot be deleted without a re-point |
| `payments` = seed data | 209 are `TXN-SEED` (₹685,420). The other 7 (₹200 to ₹1,550, `TXN-DEMO-*` or random IDs) point at bookings that exist in **neither** bookings table |
| New events/pilgrimage tables are the replacement | They are **empty**. The only public festival, circuit and itinerary content (2, 3, 22, 1 rows) is in the old tables. A content decision is needed |

## 1. Decisions I need from you before Stage 2

| # | Decision | My recommendation |
|---|---|---|
| D1 | Are the 5 duplicate-phone accounts your own test accounts? (A `pilgrim@tirvona.com`, B `Guest Pilgrim 7101`, C `nktechipl@gmail.com`; D `satyamkumarpandey4567@gmail.com`, E `wivibif947@aminavin.com`) | Merge only B into A and E into D, and only if you confirm same person. Leave C alone (a different name). Otherwise do not merge; just normalize phones going forward |
| D2 | 3 paid legacy marketplace orders (₹1,198, ₹199, ₹499; customers Kushal Pandey, "yayaya", Satyam Pandey) | Keep the `marketplaceorders` table untouched for now (it is the only record of paid orders). Export it to the archive. Revisit later |
| D3 | Legacy festivals (2), circuits (3), itineraries (22), planner template (1): migrate into the new modules, or discard as July seed content? | Discard after archiving, if you do not need them. Their shapes differ from the new modules (27% to 46% column overlap), so a migration is a manual re-entry job |
| D4 | The 7 non-seed `payments` rows (orphaned, no booking exists) and the 209 `TXN-SEED` rows | Confirm they are test data. They are archived either way |
| D5 | Does the original MongoDB (or a backup) still exist? (You had MongoDB Compass and an Atlas login open) | If yes, I archive `mongo_raw` and drop it later. If unknown, it stays |
| D6 | Legacy `supporttickets` (4 July test tickets) | Archive only, do not migrate |
| D7 | How does code reach Render and Vercel? The local folder is not a git repo | I need that to plan the deploy order (section 4). I will `git init` a baseline snapshot before editing code, if you agree |

## 2. Stage 0: backup and rehearsal (non-destructive)

1. **Backup reality check.** Supabase Free has no backups or point-in-time recovery, and I cannot confirm any other backup exists. There is no `pg_dump`, `psql` or Docker on this machine. So I will build the backup myself:
   - a Node script that exports every table in the 6 application schemas as NDJSON, with a manifest of row counts and a per-table checksum
   - the schema DDL: `0001_app_schema.sql` for the 190 registry tables, and DDL generated from the catalog for the rest
   - output to a folder outside the repo, for example `D:\desktop\tirvona-backups\2026-10-08\`. It contains password hashes, reset tokens and personal data, so it must not go in the repo or any shared folder.
2. **Restore proof.** Restore the backup into the embedded Postgres 17 that is already in `Newbackend/node_modules` (`embedded-postgres`). Then compare every table's row count and checksum with the manifest. Backup is "confirmed" only if all 667 tables match.
3. **Source snapshot.** Zip or `git init` the source (excluding `node_modules` and `dist`) before editing any code.
4. **Rehearsal.** Run the entire cleanup against the restored copy first. Then run `db:verify`, the full test suite and a smoke test of the API against that copy. Production is touched only after the rehearsal passes.
5. Save the pre-cleanup row counts and the code-reference list per table (already generated in the audit folder).

If step 2 fails or you do not approve storing a PII dump locally, I stop here.

## 3. Exact destructive operations (final list)

### 3a. Rows (Stage 2, after backup and decisions)

| Table | Delete | Keep | Reason |
|---|---|---|---|
| `leads.leads` PREM RATAN RESIDENCY | 8 rows: `6aa3c2a3ce5c9953fda38a26`, `…a27`, `…a28`, `…a29`, `…a2a`, `…a2b`, `…a2c`, `…a2d` (identical, created over 2 seconds) | `6aa3c2b1ce5c9953fda38a2e` (same data plus `meeting` info) | double-submit; no other table references leads |
| `leads.leads` RADHA PALACE | 6 rows: `6aa3e3a957dd6e3209d2a431`, `…a432`, `…a433`, `…a434`, `…a435`, `…a436` | `6aa3e35a57dd6e3209d2a430` (oldest; all 7 identical) | double-submit |
| `leads.leads` Hotel Krishna Anandam | 2 rows: `6aa3865c82bb536c1c918a72`, `…a73` (identical subsets) | `6aa3866e82bb536c1c918a74` (has images, agent, verification) | double-submit |
| `leads.leads` Hotel Radha Sneh | 1 row: `6aa105d201863d66dcb4d721` | `6aa105d301863d66dcb4d722` (has `last_updated_by`) | double-submit, 1 second apart |
| `public.usermemories` | 1 row: `6a9bf328f54803489f8f2afb` | `6a9bf328f54803489f8f2afa` | same session, same second, anonymous; only timestamps differ |
| `public.users` | **0 rows until D1 is answered** | | each account has live bookings, payments or tickets |

Not deleted and only reported: 6 lead groups with differing phones/dates (kirti seva sadan, shree gopal niketan, tamoli dharamshala, radhika raman ashram, raghuleela dham, shri radhika dham), the 10 same-night bookings, all 6 `rooms` rows.

### 3b. Tables and schemas

**Safety step used for every table below: quarantine, then drop.** First `ALTER TABLE … SET SCHEMA legacy_quarantine` (instant, reversible, no data loss). After a 7-day soak with no errors in the API logs, the drop runs in a single transaction as migration `0002`.

| Group | Tables | Rows | Gate before quarantine |
|---|---|---|---|
| **G1: no code uses them** | `payments` 216, `reviews` 149, `roomavailabilities` 6,939, `roomunits` 1,496, `offers` 2, `supporttickets` 4, `platformsettings` 1, `marketplace_products` 12, `marketplace_categories` 6 | 8,825 | export to archive, plus D4 and D6 |
| **G2: stubs** | `otps` 0, `notificationpreferences` 0, `notificationtemplates` 0, `leads.lead_attendance` 0 | 0 | registry entries and the `otps` TTL sweep removed in code, then deployed |
| **G3: after data move** | `notification_campaigns` 3 | 3 | first copy the 3 rows into `push_campaigns` (same IDs, so the 271 `user_notifications` links stay valid) |
| **G4: after code migration** | `bookings` 244, `auditlogs` 332, `eventfestivals` 2, `pilgrimagecircuits` 3, `tripitineraries` 22, `plannertemplates` 1, `marketplace_orders` 11, `marketplace_payments` 11 | 626 | the per-table code migration in section 4 deployed and verified |
| **Schema `tirvona_db`** | all 93 tables | 6 | export; no external user confirmed; the 6 `usermemories` rows also exist in `mongo_raw` |
| **Held, not dropped** | `marketplaceorders` (D2), `mongo_raw` (D5), `bizinvite` (never), duplicate user accounts (D1) | | |

For `DROP SCHEMA tirvona_db`, I will list the 93 tables and confirm each is still empty (apart from `usermemories`) at the moment of the drop.

### 3c. Per-table safety record (required before each drop)

| Table | Records | Canonical replacement | Code references (before) | Data references | Backup verified | Migration done | Risk | Safe to delete |
|---|---|---|---|---|---|---|---|---|
| `payments` | 216 | `booking_payments` (no overlap) | none | 209 → seed `bookings`, 7 → no booking | NO | n/a (archive) | Medium: financial records | NO until D4 and backup |
| `reviews` | 149 | `booking_reviews` | none | 149 → seed `bookings` | NO | n/a | Low | NO until backup |
| `roomavailabilities` | 6,939 | `booking_daily_availability` | none | 540 point at deleted rooms | NO | n/a | Low | NO until backup |
| `roomunits` | 1,496 | none (feature unused) | none | 85 point at deleted rooms | NO | n/a | Low | NO until backup |
| `offers` | 2 | `booking_coupons` | none | none | NO | not needed (expired) | Low | NO until backup |
| `supporttickets` | 4 | `booking_support_tickets` | none | none | NO | n/a (D6) | Low | NO until backup |
| `platformsettings` | 1 | `platform_settings` (fee ₹0, commission 10%; old: ₹49) | none | none | NO | not needed | Low | NO until backup |
| `marketplace_products` / `_categories` | 12 / 6 | `marketplaceproducts` / `marketplacecategories` | none | products → categories only | NO | not needed | Low | NO until backup |
| `notification_campaigns` | 3 | `push_campaigns` | none | 271 `user_notifications` | NO | NOT YET | Medium | NO until copied |
| `otps`, `notificationpreferences`, `notificationtemplates`, `lead_attendance` | 0 | none | registry only (`otps` also TTL sweep) | none | NO | n/a | Low | NO until registry change deployed |
| `bookings` | 244 (239 seed, 5 real) | `booking_bookings` | community "verified stay" (`community.service.ts`, community repository, `CommunityBooking` model) | 1 article, 149 reviews, 209 payments | NO | NOT YET | Medium | NO until code migrated |
| `auditlogs` | 332 | `audit_logs` (superset of columns) | content module (`ContentAuditLog`) | none | NO | NOT YET | Low–Medium | NO until code migrated |
| `eventfestivals`, `pilgrimagecircuits`, `tripitineraries`, `plannertemplates` | 2, 3, 22, 1 | `event_festivals`, `pilgrimage_circuits`, `pilgrimage_itineraries` (all empty) | content module `/services/*`, `/planner/*`; governance admin screens | none | NO | NOT YET (D3) | Medium | NO until D3 and code migrated |
| `marketplace_orders`, `marketplace_payments` | 11, 11 | `marketplace_master_orders`, `marketplace_vendor_orders` | commerce `MarketplaceOrderService` (still called by the payment webhook) | payments → orders | NO | n/a (all unpaid) | Medium | NO until webhook code migrated |
| `tirvona_db` (93 tables) | 6 | `public` | none | none | NO | n/a | Low | NO until backup |

## 4. Stage 3: code migration (deploy BEFORE any table is dropped)

Order matters: the API checks at startup that every registry table exists, and a running old instance would throw on queries against a dropped table. So: change code, test, deploy, confirm healthy, **then** quarantine.

| Item | Change | Test |
|---|---|---|
| Community "verified stay" | Point `CommunityBooking` to `booking_bookings`; map the field names (`bookingId`→`booking_id`, `checkInDate`, `checkOutDate`, `status` values `completed`/`checked_out`); keep the 1 existing article's link as history | spec for `eligibleBookings` and `createArticle` against booking_bookings |
| Audit | Replace the `ContentAuditLog` model with the existing `AuditLog` model in the content module; import `AuditModule` | CMS approve/reject writes to `audit_logs` |
| Content (events, circuits, planner) | Repoint `/services/events`, `/services/circuits`, `/planner/*` and the governance `Admin_events`, `Admin_circuits`, `Admin_itineraries`, `Admin_templates` to the new-module tables, or remove them (D3). The public site already uses `/events` and `/pilgrimage/*` | `EnterpriseModulePage` events call, admin planner screens |
| Marketplace | Live path confirmed: frontend → `/marketplace/checkout/orders` → `OrderService` → `marketplace_master_orders` + `marketplace_vendor_orders`. Remove the old single-order service from `PaymentsWebhookService` and delete the models `MarketplaceOrder`, `MarketplacePayment`. The governance `Admin_orders` is repointed to `marketplace_master_orders` | existing `marketplace-order.service.spec` replaced; webhook spec |
| Registry | Prune the registry and Drizzle files for every dropped table (the generator never removes entries, so I add a `--prune` option or edit by hand). Add migration `0002_cleanup.sql` | `npm run db:verify`, `typecheck`, `lint`, `test`, `test:pg`, `build` |
| Final scan | `rg` across the repo for every dropped table name and model name | zero hits outside the migration and archive docs |

## 5. Stage 4: users and search accuracy (after D1)

- Add one `normalizePhone()` helper (India: strip non-digits, drop leading `0`/`91`, store as `+91XXXXXXXXXX`) and use it **both** on write and on every login/OTP lookup. The existing 153 phones get a backfill UPDATE in the same deploy. This must be read against the auth code first so login does not break.
- Unique indexes, each added only after a clean-data check:

| Entity | Index | Pre-check |
|---|---|---|
| users | unique normalized phone; unique `lower(email)` | needs D1 first (5 accounts conflict) |
| booking payments | partial unique `transaction_id` where not null | currently 0 duplicates |
| parking payments | same | currently 0 duplicates |
| coupons | unique `upper(promo_code)` | currently 0 duplicates |
| slugs (ashrams, temples, products) | `lower(slug)` | currently 0 duplicates |
| `rooms (ashram, name)` | **not added**: duplicate names are legitimate | |

Booking IDs, reservation numbers, order numbers and invoice numbers already have unique indexes.

## 6. Stage 5: validation

Section 8 of your brief, in full: `db:verify`; registry vs database table diff; canonical-table row counts vs pre-cleanup manifest (only the planned deletions may differ); orphan checks on each re-pointed reference; booking, payment, marketplace, login, coupon, support, notification and admin smoke tests against the rehearsal copy and then production; the 11 background jobs (watch logs for one full cycle); `typecheck`, `lint`, `test`, `test:pg`, `build`; final `rg` scan.

## 7. Rollback

| Stage | Rollback |
|---|---|
| Row deletes | re-insert from backup NDJSON (script generated alongside) |
| Quarantine | `ALTER TABLE legacy_quarantine.x SET SCHEMA public` |
| Drops (after soak) | restore from verified backup only. This is why the soak and the backup come first |
| Code | redeploy the pre-change snapshot |

## 8. Out of scope

`bizinvite` (another app, needs its owner), the Supabase system schemas (`auth`, `storage`, `realtime`, `vault`), and `mongo_raw` unless D5 is answered.

## 9. Known application bugs found (not fixed in this plan)

- The analytics "Smart Contact Profiles" tile queries `public.smart_contact_profiles`, which does not exist (it is in `smart_contact`), so it always shows 0. I can fix this in the code stage if you want.
- The community "verified stay" bug (reads a frozen table) is fixed by section 4.
