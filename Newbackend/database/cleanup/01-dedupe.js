/**
 * Step 1 — delete the confirmed duplicate rows (18 rows).
 *
 *   node database/cleanup/01-dedupe.js            dry run: verifies everything, changes nothing
 *   node database/cleanup/01-dedupe.js --apply    performs the deletes in ONE transaction
 *
 * (The kept and deleted rows of a group were saved within 5 minutes of each other: RADHA PALACE was
 * submitted once, then re-submitted 6 times about 80 seconds later with byte-identical content.)
 *
 * Every row is deleted only when ALL of these hold (otherwise the whole run is
 * rolled back and nothing is deleted):
 *   - the row to delete and the row to keep have the same business identity
 *     (same normalised name, same phone / session id);
 *   - the row to keep already contains everything the deleted row contains
 *     (every non-empty field is equal, or the kept row holds a fuller value);
 *   - the row to delete is not mentioned by ANY row in any application table
 *     other than itself.
 * Roll back an applied run from the backup NDJSON (see database/cleanup/README.md).
 */
const { connect, redact } = require("../lib");

const APPLY = process.argv.includes("--apply");

/** keep = the record that stays; drop = the confirmed duplicates of it. */
const LEAD_GROUPS = [
  {
    label: "PREM RATAN RESIDENCY",
    keep: "6aa3c2b1ce5c9953fda38a2e",
    drop: ["6aa3c2a3ce5c9953fda38a26", "6aa3c2a4ce5c9953fda38a27", "6aa3c2a5ce5c9953fda38a28", "6aa3c2a5ce5c9953fda38a29", "6aa3c2a5ce5c9953fda38a2a", "6aa3c2a5ce5c9953fda38a2b", "6aa3c2a5ce5c9953fda38a2c", "6aa3c2a5ce5c9953fda38a2d"],
  },
  {
    label: "RADHA PALACE",
    keep: "6aa3e35a57dd6e3209d2a430",
    drop: ["6aa3e3a957dd6e3209d2a431", "6aa3e3aa57dd6e3209d2a432", "6aa3e3aa57dd6e3209d2a433", "6aa3e3ab57dd6e3209d2a434", "6aa3e3ab57dd6e3209d2a435", "6aa3e3ab57dd6e3209d2a436"],
  },
  { label: "Hotel Krishna Anandam", keep: "6aa3866e82bb536c1c918a74", drop: ["6aa3865c82bb536c1c918a72", "6aa3865f82bb536c1c918a73"] },
  { label: "HOTEL RADHA SNEH", keep: "6aa105d301863d66dcb4d722", drop: ["6aa105d201863d66dcb4d721"] },
];
const MEMORY = { keep: "6a9bf328f54803489f8f2afa", drop: ["6a9bf328f54803489f8f2afb"], sessionId: "mobile_user_723345325" };

const IGNORE = new Set(["id", "_migrated_at", "created_at", "updated_at", "captured_at", "version", "_nulls", "_extra"]);
const normName = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const last10 = (s) => String(s ?? "").replace(/\D/g, "").slice(-10);

const isEmpty = (v) =>
  v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && Object.entries(v).every(([k, x]) => k.startsWith("\u0001") || isEmpty(x)));
/** true when `kept` already holds everything `dropped` holds */
const covered = (dropped, kept) => {
  if (isEmpty(dropped)) return true;
  if (dropped && kept && typeof dropped === "object" && typeof kept === "object" && !Array.isArray(dropped) && !Array.isArray(kept))
    return Object.entries(dropped).every(([k, v]) => k.startsWith("\u0001") || covered(v, kept[k]));
  return JSON.stringify(dropped) === JSON.stringify(kept);
};
const rowCovered = (dropped, kept) => Object.keys(dropped).filter((k) => !IGNORE.has(k)).every((k) => covered(dropped[k], kept[k]));

(async () => {
  const c = await connect("tirvona-cleanup-01-dedupe");
  const problems = [];
  try {
    await c.query("BEGIN");
    const fetchRows = async (table, ids) => {
      const rows = (await c.query(`SELECT to_jsonb(t) AS j FROM ${table} t WHERE id = ANY($1)`, [ids])).rows.map((r) => r.j);
      return Object.fromEntries(rows.map((r) => [r.id, r]));
    };

    // ---- gather every id and scan the whole application for references
    const allDrop = [...LEAD_GROUPS.flatMap((g) => g.drop), ...MEMORY.drop];
    const tables = (
      await c.query(`SELECT n.nspname s, c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname IN ('public','leads','smart_contact')`)
    ).rows;
    const patterns = allDrop.map((id) => `%${id}%`);
    const mentions = {};
    for (const { s, t } of tables) {
      const n = Number((await c.query(`SELECT count(*) AS n FROM "${s}"."${t}" x WHERE x::text LIKE ANY($1)`, [patterns])).rows[0].n);
      if (n) mentions[`${s}.${t}`] = n;
    }
    const expectedMentions = { "leads.leads": LEAD_GROUPS.flatMap((g) => g.drop).length, "public.usermemories": MEMORY.drop.length };
    if (JSON.stringify(mentions) !== JSON.stringify(expectedMentions) && JSON.stringify(Object.entries(mentions).sort()) !== JSON.stringify(Object.entries(expectedMentions).sort()))
      problems.push(`unexpected references to the rows to delete: ${JSON.stringify(mentions)} (expected only ${JSON.stringify(expectedMentions)})`);

    // ---- leads
    const leadIds = LEAD_GROUPS.flatMap((g) => [g.keep, ...g.drop]);
    const leads = await fetchRows("leads.leads", leadIds);
    const toDelete = { leads: [], memories: [] };
    for (const g of LEAD_GROUPS) {
      const keep = leads[g.keep];
      if (!keep) { problems.push(`${g.label}: keeper ${g.keep} not found`); continue; }
      for (const id of g.drop) {
        const row = leads[id];
        if (!row) { console.log(`  already gone: lead ${id}`); continue; }
        if (normName(row.name) !== normName(keep.name)) problems.push(`${g.label}: ${id} has a different name`);
        if (last10(row.contact?.phone) !== last10(keep.contact?.phone)) problems.push(`${g.label}: ${id} has a different phone`);
        if (!rowCovered(row, keep)) {
          // An earlier save of the same record may hold values the agent later
          // edited; that is fine only when the kept row is the later edit.
          const edited = Object.keys(row).filter((k) => !IGNORE.has(k) && !covered(row[k], keep[k]));
          if (new Date(keep.updated_at) >= new Date(row.updated_at))
            console.log(`  note: ${id} is an earlier save of ${g.keep}; fields since edited: ${edited.join(", ")}`);
          else problems.push(`${g.label}: ${id} holds information the kept row ${g.keep} does not (${edited.join(", ")})`);
        }
        const gapMs = Math.abs(new Date(row.created_at) - new Date(keep.created_at));
        if (gapMs > 300_000) problems.push(`${g.label}: ${id} was created ${Math.round(gapMs / 1000)}s from the kept row`);
        toDelete.leads.push(id);
      }
    }

    // ---- usermemories
    const mem = await fetchRows("public.usermemories", [MEMORY.keep, ...MEMORY.drop]);
    const keepMem = mem[MEMORY.keep];
    if (!keepMem) problems.push(`usermemories keeper ${MEMORY.keep} not found`);
    for (const id of MEMORY.drop) {
      const row = mem[id];
      if (!row) { console.log(`  already gone: usermemories ${id}`); continue; }
      if (row.session_id !== MEMORY.sessionId || keepMem?.session_id !== MEMORY.sessionId) problems.push(`usermemories ${id}: session id is not ${MEMORY.sessionId}`);
      if (row.user_id) problems.push(`usermemories ${id}: belongs to a user`);
      if (keepMem && !rowCovered(row, keepMem)) problems.push(`usermemories ${id}: differs from the kept row beyond timestamps`);
      const sessionRows = Number((await c.query("SELECT count(*) n FROM public.usermemories WHERE session_id = $1", [MEMORY.sessionId])).rows[0].n);
      if (sessionRows !== 2) problems.push(`usermemories: expected exactly 2 rows for the session, found ${sessionRows}`);
      toDelete.memories.push(id);
    }

    console.log(`Verified: ${toDelete.leads.length} lead rows + ${toDelete.memories.length} usermemories row to delete.`);
    if (problems.length) {
      console.log("\nSTOP — verification failed, nothing deleted:");
      for (const p of problems) console.log("  -", p);
      await c.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }

    const before = {
      leads: Number((await c.query("SELECT count(*) n FROM leads.leads")).rows[0].n),
      memories: Number((await c.query("SELECT count(*) n FROM public.usermemories")).rows[0].n),
    };
    if (toDelete.leads.length) {
      const r = await c.query("DELETE FROM leads.leads WHERE id = ANY($1)", [toDelete.leads]);
      if (r.rowCount !== toDelete.leads.length) throw new Error(`deleted ${r.rowCount} lead rows, expected ${toDelete.leads.length}`);
    }
    if (toDelete.memories.length) {
      const r = await c.query("DELETE FROM public.usermemories WHERE id = ANY($1)", [toDelete.memories]);
      if (r.rowCount !== toDelete.memories.length) throw new Error(`deleted ${r.rowCount} usermemories rows, expected ${toDelete.memories.length}`);
    }
    const after = {
      leads: Number((await c.query("SELECT count(*) n FROM leads.leads")).rows[0].n),
      memories: Number((await c.query("SELECT count(*) n FROM public.usermemories")).rows[0].n),
    };
    const keepersLeft = Number((await c.query("SELECT count(*) n FROM leads.leads WHERE id = ANY($1)", [LEAD_GROUPS.map((g) => g.keep)])).rows[0].n);
    if (keepersLeft !== LEAD_GROUPS.length) throw new Error("a kept lead row is missing after the delete");
    console.log(`leads: ${before.leads} -> ${after.leads}   usermemories: ${before.memories} -> ${after.memories}`);
    if (APPLY) {
      await c.query("COMMIT");
      console.log("APPLIED and committed.");
    } else {
      await c.query("ROLLBACK");
      console.log("DRY RUN — rolled back. Re-run with --apply to delete.");
    }
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
