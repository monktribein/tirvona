-- ROLLBACK for migrations/0015_yatra_module.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you
-- are sure the Tirvona Yatra records should go.
--
--   1. Deploy code without the Yatra module (src/modules/yatra and its imports in
--      app.module.ts and payments.module.ts) FIRST: the API refuses to start when a
--      registered model has no table.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0015_yatra_module.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: organisers, their KYC document references, vehicles, tours,
-- departures, seats, bookings, payments, the Yatra money ledger and journeys.
-- Export it first. Wallet credits already made for Yatra refunds stay in
-- pilgrim_wallet_transactions (module "yatra") and are NOT removed by this script.

BEGIN;

DROP TABLE IF EXISTS "public"."yatra_service_requests";
DROP TABLE IF EXISTS "public"."yatra_journey_links";
DROP TABLE IF EXISTS "public"."yatra_journeys";
DROP TABLE IF EXISTS "public"."yatra_ledger_entries";
DROP TABLE IF EXISTS "public"."yatra_payments";
DROP TABLE IF EXISTS "public"."yatra_seats";
DROP TABLE IF EXISTS "public"."yatra_bookings";
DROP TABLE IF EXISTS "public"."yatra_booking_links";
DROP TABLE IF EXISTS "public"."yatra_departures";
DROP TABLE IF EXISTS "public"."yatra_tours";
DROP TABLE IF EXISTS "public"."yatra_vehicles";
DROP TABLE IF EXISTS "public"."yatra_documents";
DROP TABLE IF EXISTS "public"."yatra_operator_members";
DROP TABLE IF EXISTS "public"."yatra_operators";
DROP TABLE IF EXISTS "public"."yatra_settings";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0015_yatra_module.sql';
  END IF;
END $$;

COMMIT;
