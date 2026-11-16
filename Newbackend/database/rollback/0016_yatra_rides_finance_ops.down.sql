-- ROLLBACK for migrations/0016_yatra_rides_finance_ops.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you
-- are sure the Tirvona Yatra ride, finance and Destination Ops records should go.
--
--   1. Deploy code WITHOUT the P5 Yatra pieces FIRST (yatra-p5.schemas.ts, the P5
--      services and controllers, and the P5 columns in yatra.schemas.ts): the API
--      refuses to start when a registered model has no table or column.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0016_yatra_rides_finance_ops.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: ride partners, ride requests, commission rules, the payee
-- (organiser / ride partner) ledger, manual payout records with their UTRs,
-- Razorpay reconciliation runs and incidents. Export them first; payout records
-- are financial evidence. Wallet credits already made for ride refunds stay in
-- pilgrim_wallet_transactions (module "yatra"), and ride payments stay in
-- yatra_payments / yatra_ledger_entries rows (only their ride columns go).
--
-- 0015 (the base Yatra tables) is untouched; roll it back separately if needed.

BEGIN;

DROP TABLE IF EXISTS "public"."yatra_issues";
DROP TABLE IF EXISTS "public"."yatra_reconciliations";
DROP TABLE IF EXISTS "public"."yatra_payouts";
DROP TABLE IF EXISTS "public"."yatra_payee_entries";
DROP TABLE IF EXISTS "public"."yatra_commission_rules";
DROP TABLE IF EXISTS "public"."yatra_ride_requests";
DROP TABLE IF EXISTS "public"."yatra_ride_partners";

DROP INDEX IF EXISTS "public"."yatra_documents_ix_221a5202";
DROP INDEX IF EXISTS "public"."yatra_payments_ix_c0522388";

-- Ride partner documents have no organiser; remove them before the column goes.
DELETE FROM "public"."yatra_documents" WHERE "ride_partner_id" IS NOT NULL;

ALTER TABLE "public"."yatra_bookings" DROP COLUMN IF EXISTS "commission_snapshot";
ALTER TABLE "public"."yatra_bookings" DROP COLUMN IF EXISTS "reminder_sent_at";
ALTER TABLE "public"."yatra_documents" DROP COLUMN IF EXISTS "ride_partner_id";
ALTER TABLE "public"."yatra_ledger_entries" DROP COLUMN IF EXISTS "ride_request_id";
ALTER TABLE "public"."yatra_ledger_entries" DROP COLUMN IF EXISTS "ride_partner_id";
ALTER TABLE "public"."yatra_payments" DROP COLUMN IF EXISTS "ride_request_id";
ALTER TABLE "public"."yatra_service_requests" DROP COLUMN IF EXISTS "commission_snapshot";
ALTER TABLE "public"."yatra_settings" DROP COLUMN IF EXISTS "ride_full_refund_hours";
ALTER TABLE "public"."yatra_settings" DROP COLUMN IF EXISTS "ride_partner_response_hours";
ALTER TABLE "public"."yatra_settings" DROP COLUMN IF EXISTS "reminder_hours";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0016_yatra_rides_finance_ops.sql';
  END IF;
END $$;

COMMIT;
