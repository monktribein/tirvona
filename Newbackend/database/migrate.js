/**
 * npm run db:migrate            apply pending database/migrations/*.sql to Supabase
 * npm run db:migrate -- --plan  list what would run, change nothing
 *
 * Applied files are recorded in public.schema_migrations. Each file runs in
 * its own transaction; on error that file is rolled back and nothing after it
 * runs. 0001_app_schema.sql is the baseline: on a database that already has
 * the application tables it is recorded as applied without running.
 */
const fs = require("fs");
const path = require("path");
const { MIGRATIONS_DIR, connect, redact, migrationFiles } = require("./lib");

const plan = process.argv.includes("--plan");

(async () => {
  const c = await connect("tirvona-db-migrate");
  try {
    const hasLedger = (await c.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t !== null;
    const applied = new Set(hasLedger ? (await c.query("SELECT name FROM public.schema_migrations")).rows.map((r) => r.name) : []);
    const baselinePresent = (await c.query("SELECT to_regclass('public.users') AS t")).rows[0].t !== null;
    const pending = migrationFiles().filter((f) => !applied.has(f));
    if (!pending.length) {
      console.log("Database is up to date.");
      return;
    }
    for (const f of pending) console.log(`${plan ? "pending" : "apply  "} ${f}${f.startsWith("0001_") && baselinePresent ? " (baseline already present: record only)" : ""}`);
    if (plan) return;

    if (!hasLedger) {
      await c.query("CREATE TABLE public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
      await c.query("ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY");
    }
    for (const f of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8").replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");
      await c.query("BEGIN");
      try {
        if (!(f.startsWith("0001_") && baselinePresent)) await c.query(sql);
        await c.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [f]);
        await c.query("COMMIT");
        console.log(`applied ${f}`);
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw new Error(`${f} failed and was rolled back: ${e.message}`);
      }
    }
    console.log("Done. Restart the API so it loads the new layout.");
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});
