-- ROLLBACK for migrations/0006_booking_live_stream.sql
-- Run by hand only after deploying code without the booking live-stream field:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0006_booking_live_stream.down.sql
-- Drops each booking's YouTube live link.

BEGIN;

ALTER TABLE IF EXISTS "public"."provider_bookings" DROP COLUMN IF EXISTS "live_stream";

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0006_booking_live_stream.sql';
  END IF;
END $$;

COMMIT;
