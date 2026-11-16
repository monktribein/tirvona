-- ROLLBACK for migrations/0019_yatra_service_addons.sql
-- Deploy code without partner service add-ons FIRST, then run by hand in a transaction. Drops the add-ons partners entered.
BEGIN;
ALTER TABLE "public"."yatra_tours" DROP COLUMN IF EXISTS "service_add_ons";
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0019_yatra_service_addons.sql';
  END IF;
END $$;
COMMIT;
