-- ROLLBACK for migrations/0014_seo_pages.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction:
--
--   1. Deploy code without the SeoPage model / SEO publishing endpoints FIRST
--      (the renderer and sitemap then use entity status rules only, as before 0014).
--   2. Export the editorial rows:
--        psql "$SUPABASE_DB_URL" -c "\copy public.seo_pages TO 'seo_pages_backup.csv' CSV HEADER"
--   3. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0014_seo_pages.down.sql
--   4. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: every SEO title/description override, verification record,
-- noindex/retired decision and legacy WordPress id mapping. Entity content
-- (ashrams, temples, products, …) lives in its own tables and is untouched.

BEGIN;

DROP TABLE IF EXISTS "public"."seo_pages";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0014_seo_pages.sql';
  END IF;
END $$;

COMMIT;
