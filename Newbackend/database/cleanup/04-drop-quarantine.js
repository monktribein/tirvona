/**
 * Step 4 — PERMANENTLY drop the quarantined tables. Irreversible: restore afterwards is only
 * possible from the NDJSON backup taken before the cleanup.
 *
 *   node database/cleanup/04-drop-quarantine.js                          dry run: prints what would be dropped and every check
 *   node database/cleanup/04-drop-quarantine.js --apply --permanent      drops
 *
 * Refuses to run unless, for every quarantined table:
 *   - it has been in quarantine for at least --min-days days (default 7);
 *   - its row count and content checksum still equal the manifest (nothing wrote to it).
 * Before running: look at the API logs for "relation ... does not exist". If anything still
 * reads a quarantined table, restore it (03-quarantine.js --restore) instead of dropping.
 */
const { connect, redact } = require("../lib");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MIN_DAYS = Number(args.includes("--min-days") ? args[args.indexOf("--min-days") + 1] : 7);
const QUARANTINE = "legacy_quarantine";
const TIRVONA_DB_QUARANTINE = "legacy_quarantine_tirvona_db";
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;

(async () => {
  const c = await connect("tirvona-cleanup-04-drop");
  try {
    await c.query("SET TIME ZONE 'UTC'");
    await c.query("BEGIN");
    const manifest = (await c.query(`SELECT * FROM ${QUARANTINE}._manifest ORDER BY quarantined_as`).catch(() => ({ rows: [] }))).rows;
    if (!manifest.length) {
      console.log("Nothing is quarantined.");
      await c.query("ROLLBACK");
      return;
    }
    const problems = [];
    let rows = 0;
    for (const m of manifest) {
      const inTirvona = m.source_schema === "tirvona_db";
      const T = inTirvona ? `${TIRVONA_DB_QUARANTINE}.${qi(m.source_table)}` : `${QUARANTINE}.${qi(m.quarantined_as)}`;
      const ageDays = (Date.now() - new Date(m.moved_at).getTime()) / 86_400_000;
      const cs = (await c.query(`SELECT count(*)::bigint n, coalesce(md5(string_agg(md5(x::text), '' ORDER BY md5(x::text))), '') h FROM ${T} x`)).rows[0];
      const same = Number(cs.n) === Number(m.row_count) && cs.h === m.checksum;
      rows += Number(cs.n);
      if (ageDays < MIN_DAYS) problems.push(`${m.quarantined_as}: only ${ageDays.toFixed(1)} days in quarantine (need ${MIN_DAYS})`);
      if (!same) problems.push(`${m.quarantined_as}: changed since quarantine (${m.row_count} -> ${cs.n} rows, or content differs)`);
    }
    console.log(`${manifest.length} quarantined tables, ${rows} rows in total.`);
    if (problems.length) {
      console.log("\nSTOP — not safe to drop yet:");
      for (const p of problems) console.log("  -", p);
      await c.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }
    if (!(APPLY && args.includes("--permanent"))) {
      console.log("All checks pass. DRY RUN — nothing dropped. Re-run with --apply --permanent to drop them.");
      await c.query("ROLLBACK");
      return;
    }
    for (const m of manifest.filter((x) => x.source_schema !== "tirvona_db")) await c.query(`DROP TABLE ${QUARANTINE}.${qi(m.quarantined_as)}`);
    if ((await c.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [TIRVONA_DB_QUARANTINE])).rowCount) await c.query(`DROP SCHEMA ${TIRVONA_DB_QUARANTINE} CASCADE`);
    await c.query(`DROP TABLE ${QUARANTINE}._manifest`);
    await c.query(`DROP SCHEMA ${QUARANTINE}`); // fails (and rolls back) if anything unexpected is still inside
    await c.query("COMMIT");
    console.log("DROPPED and committed.");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});
