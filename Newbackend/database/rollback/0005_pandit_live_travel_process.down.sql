-- ROLLBACK for migrations/0005_pandit_live_travel_process.sql
--
-- Not applied by `npm run db:migrate`. Run by hand only after deploying code that no
-- longer has these fields (the API refuses to start when its columns are missing):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0005_pandit_live_travel_process.down.sql
-- Drops: the per-ritual puja process guide, the pandit "live online" switch, each
-- booking's delivery mode, and the marketplace "show on pandit pages" switch.

BEGIN;

ALTER TABLE IF EXISTS "public"."rituals" DROP COLUMN IF EXISTS "process";
ALTER TABLE IF EXISTS "public"."rituals" DROP COLUMN IF EXISTS "process_updated_at";
ALTER TABLE IF EXISTS "public"."rituals" DROP COLUMN IF EXISTS "process_updated_by";
ALTER TABLE IF EXISTS "public"."provider_profiles" DROP COLUMN IF EXISTS "live_online";
ALTER TABLE IF EXISTS "public"."provider_bookings" DROP COLUMN IF EXISTS "delivery_mode";
ALTER TABLE IF EXISTS "public"."marketplaceproducts" DROP COLUMN IF EXISTS "show_on_pandit_pages";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0005_pandit_live_travel_process.sql';
  END IF;
END $$;

COMMIT;
