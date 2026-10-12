-- ROLLBACK for migrations/0003_providers_foundation.sql
--
-- Not applied by `npm run db:migrate` (that tool is forward-only and never reads this
-- folder). Run it by hand, in a transaction, only when you are sure you want the Pandit /
-- provider data gone.
--
--   1. Deploy code that no longer contains the ProvidersModule FIRST. The API refuses to
--      start against a database that is missing tables its registry expects, and the
--      registry is generated from the models.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0003_providers_foundation.down.sql
--   3. Revert src/database/pg/registry.generated.ts and src/database/drizzle/schema.generated.ts
--      to the commit before this migration (or `npm run db:generate -- --prune`).
--
-- This drops DATA. Take a backup or export first (the tables hold provider profiles,
-- verification evidence metadata, bookings and consultations). Nothing else in the
-- database references these tables: the platform creates no foreign keys.

BEGIN;

DROP TABLE IF EXISTS "public"."provider_booking_state_history";
DROP TABLE IF EXISTS "public"."provider_bookings";
DROP TABLE IF EXISTS "public"."consultation_messages";
DROP TABLE IF EXISTS "public"."expert_consultations";
DROP TABLE IF EXISTS "public"."calendar_blocks";
DROP TABLE IF EXISTS "public"."availability_rules";
DROP TABLE IF EXISTS "public"."verification_evidence";
DROP TABLE IF EXISTS "public"."verification_cases";
DROP TABLE IF EXISTS "public"."provider_offerings";
DROP TABLE IF EXISTS "public"."provider_private_profiles";
DROP TABLE IF EXISTS "public"."provider_profiles";
DROP TABLE IF EXISTS "public"."ritual_variants";
DROP TABLE IF EXISTS "public"."rituals";
DROP TABLE IF EXISTS "public"."idempotency_keys";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0003_providers_foundation.sql';
  END IF;
END $$;

COMMIT;
