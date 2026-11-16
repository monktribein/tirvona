-- ROLLBACK for migrations/0017_yatra_ratings.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you are sure the Yatra
-- trip ratings and reviews should go.
--
--   1. Deploy code without the ratings feature (yatra-rating.service.ts, the YatraRating schema and its
--      uses in the public departure view, search and the booking rating endpoints) FIRST: the API refuses
--      to start when a registered model has no table.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0017_yatra_ratings.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: every rating and review pilgrims have given. Export it first.

BEGIN;

DROP TABLE IF EXISTS "public"."yatra_ratings";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0017_yatra_ratings.sql';
  END IF;
END $$;

COMMIT;
