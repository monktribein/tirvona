/**
 * Step 3 — move retired tables out of the way WITHOUT deleting anything.
 *
 * A table is moved with ALTER TABLE ... SET SCHEMA, so its rows, indexes and constraints stay
 * exactly as they were and `--restore` puts it back instantly. A manifest (row count + content
 * checksum + columns + indexes) is recorded in legacy_quarantine._manifest for each table.
 *
 *   node database/cleanup/03-quarantine.js --tirvona-db [--apply]
 *       Renames the redundant schema tirvona_db (93 empty stubs + 6 rows, referenced by no code)
 *       to legacy_quarantine_tirvona_db. Needs no code deploy.
 *
 *   node database/cleanup/03-quarantine.js --legacy-tables --confirm-code-deployed [--manifest <backup manifest.json>] [--apply]
 *       Moves the 18 retired tables from public/leads into legacy_quarantine.
 *       ONLY run this after the new backend (registry without these tables) is deployed and healthy:
 *       an API instance still running the old code would fail when it touches them.
 *
 *   node database/cleanup/03-quarantine.js --restore [--apply]
 *       Moves everything back to where it came from.
 *
 * Without --apply every mode is a dry run that changes nothing.
 */
const fs = require("fs");
const { connect, redact } = require("../lib");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const LEGACY_TABLES = [
  "public.auditlogs", // history copied into audit_logs (02-copy-data.js)
  "public.bookings",
  "public.payments",
  "public.reviews",
  "public.roomavailabilities",
  "public.roomunits",
  "public.offers",
  "public.supporttickets",
  "public.platformsettings",
  "public.notification_campaigns", // copied into push_campaigns (02-copy-data.js)
  "public.marketplace_orders",
  "public.marketplace_payments",
  "public.marketplace_products",
  "public.marketplace_categories",
  "public.otps",
  "public.notificationpreferences",
  "public.notificationtemplates",
  "leads.lead_attendance",
];
const QUARANTINE = "legacy_quarantine";
const TIRVONA_DB = "tirvona_db";
const TIRVONA_DB_QUARANTINE = "legacy_quarantine_tirvona_db";
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const split = (full) => full.split(".");

async function ensureManifest(c) {
  await c.query(`CREATE SCHEMA IF NOT EXISTS ${QUARANTINE}`);
  await c.query(`CREATE TABLE IF NOT EXISTS ${QUARANTINE}._manifest (
    quarantined_as text PRIMARY KEY, source_schema text NOT NULL, source_table text NOT NULL, row_count bigint NOT NULL, checksum text NOT NULL,
    columns jsonb NOT NULL, indexes jsonb NOT NULL, moved_at timestamptz NOT NULL DEFAULT now(), note text)`);
  await c.query(`ALTER TABLE ${QUARANTINE}._manifest ENABLE ROW LEVEL SECURITY`);
}

async function describe(c, schema, table) {
  const T = `${qi(schema)}.${qi(table)}`;
  const cs = (await c.query(`SELECT count(*)::bigint n, coalesce(md5(string_agg(md5(x::text), '' ORDER BY md5(x::text))), '') h FROM ${T} x`)).rows[0];
  const columns = (await c.query(`SELECT a.attname name, format_type(a.atttypid, a.atttypmod) type FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [T])).rows;
  const indexes = (await c.query(`SELECT indexname name, indexdef def FROM pg_indexes WHERE schemaname = $1 AND tablename = $2 ORDER BY 1`, [schema, table])).rows;
  return { rows: Number(cs.n), checksum: cs.h, columns, indexes };
}

async function exists(c, schema, table) {
  return (await c.query("SELECT to_regclass($1) AS t", [`${qi(schema)}.${qi(table)}`])).rows[0].t !== null;
}

async function main() {
  const c = await connect("tirvona-cleanup-03-quarantine");
  try {
    await c.query("SET TIME ZONE 'UTC'");
    await c.query("BEGIN");

    if (flag("--restore")) {
      const rows = (await c.query(`SELECT * FROM ${QUARANTINE}._manifest ORDER BY quarantined_as`).catch(() => ({ rows: [] }))).rows;
      for (const r of rows.filter((x) => x.source_schema !== TIRVONA_DB)) {
        if (await exists(c, r.source_schema, r.source_table)) throw new Error(`${r.source_schema}.${r.source_table} already exists; refusing to overwrite`);
        console.log(`restore ${QUARANTINE}.${r.quarantined_as} -> ${r.source_schema}.${r.source_table}`);
        await c.query(`ALTER TABLE ${QUARANTINE}.${qi(r.quarantined_as)} SET SCHEMA ${qi(r.source_schema)}`);
        if (r.quarantined_as !== r.source_table) await c.query(`ALTER TABLE ${qi(r.source_schema)}.${qi(r.quarantined_as)} RENAME TO ${qi(r.source_table)}`);
        await c.query(`DELETE FROM ${QUARANTINE}._manifest WHERE quarantined_as = $1`, [r.quarantined_as]);
      }
      const t = await c.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [TIRVONA_DB_QUARANTINE]);
      if (t.rowCount && !(await c.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [TIRVONA_DB])).rowCount) {
        console.log(`restore schema ${TIRVONA_DB_QUARANTINE} -> ${TIRVONA_DB}`);
        await c.query(`ALTER SCHEMA ${TIRVONA_DB_QUARANTINE} RENAME TO ${TIRVONA_DB}`);
        await c.query(`DELETE FROM ${QUARANTINE}._manifest WHERE source_schema = $1`, [TIRVONA_DB]);
      }
    } else if (flag("--tirvona-db")) {
      if (!(await c.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [TIRVONA_DB])).rowCount) {
        console.log("tirvona_db is already quarantined or gone; nothing to do.");
      } else {
        const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY 1", [TIRVONA_DB])).rows.map((r) => r.tablename);
        const others = (await c.query(`SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind NOT IN ('r','i')`, [TIRVONA_DB])).rows;
        const funcs = (await c.query(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [TIRVONA_DB])).rows[0].n;
        if (others.length || funcs) throw new Error(`tirvona_db holds objects other than tables (${others.length} relations, ${funcs} functions); refusing`);
        let rows = 0;
        const nonEmpty = [];
        for (const t of tables) {
          const d = await describe(c, TIRVONA_DB, t);
          rows += d.rows;
          if (d.rows) nonEmpty.push(`${t}=${d.rows}`);
        }
        console.log(`tirvona_db: ${tables.length} tables, ${rows} rows (${nonEmpty.join(", ") || "none"}), no views/functions/sequences`);
        if (tables.length !== 93 || rows > 6) throw new Error("tirvona_db no longer matches what the audit reviewed (93 tables, 6 rows); refusing");
        await ensureManifest(c);
        for (const t of tables) {
          const d = await describe(c, TIRVONA_DB, t);
          await c.query(
            `INSERT INTO ${QUARANTINE}._manifest (quarantined_as, source_schema, source_table, row_count, checksum, columns, indexes, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'schema renamed to ${TIRVONA_DB_QUARANTINE}') ON CONFLICT (quarantined_as) DO NOTHING`,
            [`${TIRVONA_DB}.${t}`, TIRVONA_DB, t, d.rows, d.checksum, JSON.stringify(d.columns), JSON.stringify(d.indexes)],
          );
        }
        console.log(`rename schema ${TIRVONA_DB} -> ${TIRVONA_DB_QUARANTINE}`);
        await c.query(`ALTER SCHEMA ${TIRVONA_DB} RENAME TO ${TIRVONA_DB_QUARANTINE}`);
      }
    } else if (flag("--legacy-tables")) {
      if (!flag("--confirm-code-deployed"))
        throw new Error("refusing: pass --confirm-code-deployed once the backend without these tables is live and healthy");
      const backup = option("--manifest") ? JSON.parse(fs.readFileSync(option("--manifest"), "utf8")) : null;
      // history must already be in the canonical tables
      const audit = Number((await c.query(`SELECT count(*) n FROM public.auditlogs a WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs b WHERE b.id = a.id)`)).rows[0].n);
      const camps = Number((await c.query(`SELECT count(*) n FROM public.notification_campaigns a WHERE NOT EXISTS (SELECT 1 FROM public.push_campaigns b WHERE b.id = a.id)`)).rows[0].n);
      if (audit || camps) throw new Error(`run 02-copy-data.js first: ${audit} audit rows and ${camps} campaigns are not yet in their canonical tables`);
      await ensureManifest(c);
      for (const full of LEGACY_TABLES) {
        const [schema, table] = split(full);
        if (!(await exists(c, schema, table))) {
          console.log(`skip ${full} (not present)`);
          continue;
        }
        const d = await describe(c, schema, table);
        if (backup) {
          const b = backup.tables[full];
          if (!b) throw new Error(`${full} is not in the backup manifest`);
          if (b.rows !== d.rows || b.checksum !== d.checksum)
            throw new Error(`${full} changed since the backup (backup ${b.rows} rows, now ${d.rows}); something is still writing to it — investigate before moving it`);
        }
        const qname = schema === "public" ? table : `${schema}__${table}`;
        console.log(`move ${full} (${d.rows} rows) -> ${QUARANTINE}.${qname}`);
        await c.query(
          `INSERT INTO ${QUARANTINE}._manifest (quarantined_as, source_schema, source_table, row_count, checksum, columns, indexes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [qname, schema, table, d.rows, d.checksum, JSON.stringify(d.columns), JSON.stringify(d.indexes)],
        );
        await c.query(`ALTER TABLE ${qi(schema)}.${qi(table)} SET SCHEMA ${QUARANTINE}`);
        if (qname !== table) await c.query(`ALTER TABLE ${QUARANTINE}.${qi(table)} RENAME TO ${qi(qname)}`);
      }
    } else {
      throw new Error("choose one of --tirvona-db, --legacy-tables --confirm-code-deployed, --restore");
    }

    if (APPLY) {
      await c.query("COMMIT");
      console.log("APPLIED and committed.");
    } else {
      await c.query("ROLLBACK");
      console.log("DRY RUN — rolled back. Re-run with --apply.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});
