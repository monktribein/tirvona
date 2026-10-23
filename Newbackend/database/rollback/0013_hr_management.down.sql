-- ROLLBACK for migrations/0013_hr_management.sql
--
-- Not applied by `npm run db:migrate`. Run by hand, in a transaction, only when you
-- are sure the HR records should go.
--
--   1. Deploy code without the HR module (HrModule and its models) FIRST.
--   2. psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/rollback/0013_hr_management.down.sql
--   3. Revert the registry / Drizzle generated files (or `npm run db:generate -- --prune`).
--
-- This drops DATA: every HR employee profile, office, department, designation, task, task
-- history entry, attendance record, leave and attendance correction. Export them first.
-- It does not touch users, audit_logs or user_notifications.

BEGIN;

DROP TABLE IF EXISTS "public"."hr_task_events";
DROP TABLE IF EXISTS "public"."hr_tasks";
DROP TABLE IF EXISTS "public"."hr_attendance_corrections";
DROP TABLE IF EXISTS "public"."hr_attendance";
DROP TABLE IF EXISTS "public"."hr_leaves";
DROP TABLE IF EXISTS "public"."hr_employees";
DROP TABLE IF EXISTS "public"."hr_designations";
DROP TABLE IF EXISTS "public"."hr_departments";
DROP TABLE IF EXISTS "public"."hr_offices";
DROP TABLE IF EXISTS "public"."hr_settings";

-- Forget that the migration ran, so it can be applied again later.
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM "public"."schema_migrations" WHERE name = '0013_hr_management.sql';
  END IF;
END $$;

COMMIT;
