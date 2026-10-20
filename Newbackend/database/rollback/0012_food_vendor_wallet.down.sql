-- ROLLBACK for migrations/0012_food_vendor_wallet.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you
-- are sure the kitchen payment records should go.
--
--   1. Deploy code without the kitchen wallet (FoodWalletService and its model) FIRST.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0012_food_vendor_wallet.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: every payment Tirvona recorded as paid to a kitchen, with its receipt link.
-- Export it first; it is the record of what each kitchen has already been paid.

BEGIN;

DROP TABLE IF EXISTS "public"."food_vendor_payments";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0012_food_vendor_wallet.sql';
  END IF;
END $$;

COMMIT;
