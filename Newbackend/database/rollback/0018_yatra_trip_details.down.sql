-- ROLLBACK for migrations/0018_yatra_trip_details.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you are sure the
-- trip-details feature (dropping points, rest stops, other policies, live location, full-bus requests,
-- rating tags) should go.
--
--   1. Deploy code without those features FIRST: the API refuses to start when a registered model has
--      no table, and the new columns are read by the booking, departure and tour code.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0018_yatra_trip_details.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: every full-bus request, the last shared bus positions, and what organisers entered for
-- dropping points, rest stops and policies. Export it first.

BEGIN;

DROP TABLE IF EXISTS "public"."yatra_charter_requests";
DROP TABLE IF EXISTS "public"."yatra_trip_locations";

ALTER TABLE "public"."yatra_bookings" DROP COLUMN IF EXISTS "dropping_point_id";
ALTER TABLE "public"."yatra_bookings" DROP COLUMN IF EXISTS "dropping_point_name";
ALTER TABLE "public"."yatra_departures" DROP COLUMN IF EXISTS "dropping_points";
ALTER TABLE "public"."yatra_departures" DROP COLUMN IF EXISTS "rest_stops";
ALTER TABLE "public"."yatra_departures" DROP COLUMN IF EXISTS "charter_enabled";
ALTER TABLE "public"."yatra_departures" DROP COLUMN IF EXISTS "seat_fares";
ALTER TABLE "public"."yatra_ratings" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "public"."yatra_tours" DROP COLUMN IF EXISTS "other_policies";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0018_yatra_trip_details.sql';
  END IF;
END $$;

COMMIT;
