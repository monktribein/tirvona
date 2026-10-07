/**
 * npm run db:verify — read-only check that Supabase has every table and
 * column the code expects, with the right types and COLLATE "C" (the same
 * check the API runs at startup), and that no migration is pending.
 */
const path = require("path");
const { BACKEND_DIR, loadEnv, registerTypeScript, redact, migrationFiles, connect } = require("./lib");

registerTypeScript();
const { REGISTRY } = require(path.join(BACKEND_DIR, "src/database/pg/registry.generated.ts"));
const { PgStore } = require(path.join(BACKEND_DIR, "src/database/pg/pg-store.ts"));
const { nodePgPool } = require(path.join(BACKEND_DIR, "src/database/pg/pool.ts"));

(async () => {
  const url = loadEnv().SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set");
  const pool = nodePgPool(url, { max: 1, applicationName: "tirvona-db-verify" });
  try {
    await new PgStore(pool, REGISTRY).verifySchema();
    console.log(`schema OK: ${REGISTRY.tables.length} tables, ${REGISTRY.tables.reduce((a, t) => a + t.columns.length, 0)} columns`);
  } finally {
    await pool.end();
  }
  const c = await connect("tirvona-db-verify");
  try {
    const ledger = (await c.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t !== null;
    const applied = new Set(ledger ? (await c.query("SELECT name FROM public.schema_migrations")).rows.map((r) => r.name) : []);
    const pending = migrationFiles().filter((f) => !applied.has(f) && !(f.startsWith("0001_") && !ledger));
    if (pending.length) {
      console.log(`PENDING migrations: ${pending.join(", ")} — run npm run db:migrate`);
      process.exitCode = 2;
    } else console.log("migrations OK: nothing pending");
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});
