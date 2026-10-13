-- ROLLBACK for migrations/0007_lead_shift_distance.sql
-- Run by hand only after deploying code without the saved shift distance:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0007_lead_shift_distance.down.sql
-- Drops each attendance shift's saved distance (km, point count, measured-at).

BEGIN;

ALTER TABLE IF EXISTS "leads"."lead_attendances" DROP COLUMN IF EXISTS "distance_km";
ALTER TABLE IF EXISTS "leads"."lead_attendances" DROP COLUMN IF EXISTS "tracked_points";
ALTER TABLE IF EXISTS "leads"."lead_attendances" DROP COLUMN IF EXISTS "distance_measured_at";

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0007_lead_shift_distance.sql';
  END IF;
END $$;

COMMIT;
