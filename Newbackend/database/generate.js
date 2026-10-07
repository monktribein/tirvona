/**
 * npm run db:generate [-- name]
 *
 * Brings the database layout in line with the Mongoose models after a model
 * change. Reads every schema in src/, compares it with
 * src/database/pg/registry.generated.ts, and — only when something new was
 * declared — writes:
 *   - database/migrations/NNNN_<name>.sql   CREATE TABLE / ADD COLUMN / CREATE INDEX
 *   - src/database/pg/registry.generated.ts  the driver's table map
 *   - src/database/drizzle/schema.generated.ts
 *
 * Existing tables, columns and their types are never changed or removed: a
 * value that no longer fits its column is stored losslessly in `_extra`, and
 * a removed field simply stops being written. Apply with `npm run db:migrate`.
 * Touches no database.
 */
const fs = require("fs");
const path = require("path");
const { BACKEND_DIR, MIGRATIONS_DIR, registerTypeScript, migrationFiles } = require("./lib");

process.chdir(BACKEND_DIR);
registerTypeScript();
const mongoose = require(path.join(BACKEND_DIR, "node_modules/mongoose"));
const { REGISTRY } = require(path.join(BACKEND_DIR, "src/database/pg/registry.generated.ts"));
const { tableDdl, columnType, revokeDdl } = require(path.join(BACKEND_DIR, "src/database/pg/ddl.ts"));
const { LEAD_DATABASE, SMART_CONTACT_DATABASE } = require(path.join(BACKEND_DIR, "src/database/database.ts"));

const MAIN_DB = "test"; // logical name of the main connection's tables in the registry
const dbForFile = (file) => (file.includes("lead-collection") ? LEAD_DATABASE : file.includes("smart-contact") ? SMART_CONTACT_DATABASE : MAIN_DB);
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const snake = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();

// ----------------------------------------------------------- read models
function schemaFiles() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !/\.(pg-)?spec\.ts$/.test(p)) {
        if (/new Schema\(|SchemaFactory\.createForClass|new mongoose\.Schema\(/.test(fs.readFileSync(p, "utf8"))) out.push(p);
      }
    }
  };
  walk(path.join(BACKEND_DIR, "src"));
  return out.sort();
}

function kindOf(st) {
  if (!st) return "json";
  const inst = st.instance;
  if (inst === "ObjectId") return "objectId";
  if (inst === "String") return "string";
  if (inst === "Number" || inst === "Double" || inst === "Int32") return "number";
  if (inst === "Date") return "date";
  if (inst === "Boolean") return "boolean";
  if (inst === "Array") {
    if (st.schema || st.$isMongooseDocumentArray) return "json";
    const caster = st.caster || st.$embeddedSchemaType;
    const k = caster ? kindOf(caster) : "json";
    return ["objectId", "string", "number", "date", "boolean"].includes(k) ? `${k}[]` : "json";
  }
  return "json";
}

function topLevelFields(schema) {
  const fields = new Map();
  for (const p of Object.keys(schema.paths)) {
    if (p === "_id") continue;
    const top = p.split(".")[0];
    if (p.includes(".")) fields.set(top, "json");
    else if (!fields.has(top)) fields.set(top, kindOf(schema.paths[p]));
  }
  for (const n of Object.keys(schema.nested || {})) if (!n.includes(".")) fields.set(n, "json");
  return { fields, idKind: schema.paths._id && schema.paths._id.instance === "String" ? "string" : "objectId" };
}

function parseDuration(s) {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(s).trim());
  if (!m) throw new Error(`Cannot parse TTL ${s}`);
  const n = Number(m[1]);
  return { ms: n / 1000, s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2] || "s"];
}

function indexesOf(schema) {
  return schema.indexes().map(([keys, opts]) => {
    const o = opts || {};
    const idx = { name: o.name || Object.entries(keys).map(([k, v]) => `${k}_${v}`).join("_"), keys };
    if (o.unique) idx.unique = true;
    if (o.sparse) idx.sparse = true;
    if (o.partialFilterExpression) idx.partialFilterExpression = o.partialFilterExpression;
    const ttl = o.expireAfterSeconds ?? o.expires;
    if (ttl !== undefined) idx.expireAfterSeconds = typeof ttl === "string" ? parseDuration(ttl) : ttl;
    return idx;
  });
}

function loadModels() {
  const defs = [];
  const seen = new Set();
  for (const file of schemaFiles()) {
    const mod = require(file);
    const add = (name, schema) => {
      if (!(schema instanceof mongoose.Schema) || seen.has(schema) || !schema.options.collection) return;
      seen.add(schema);
      defs.push({ file: path.relative(BACKEND_DIR, file).replace(/\\/g, "/"), name, schema, collection: schema.options.collection, db: dbForFile(file), strict: schema.options.strict !== false });
    };
    for (const [name, value] of Object.entries(mod)) {
      if (value instanceof mongoose.Schema) add(name, value);
      else if (Array.isArray(value)) for (const it of value) if (it && it.schema instanceof mongoose.Schema) add(it.name, it.schema);
    }
  }
  return defs;
}

// ------------------------------------------------------------- compare
const indexSig = (i) => JSON.stringify([i.keys, !!i.unique, !!i.sparse, i.partialFilterExpression ?? null, i.expireAfterSeconds ?? null]);

const defs = loadModels();
const tables = REGISTRY.tables.map((t) => ({ ...t, columns: [...t.columns], indexes: [...t.indexes] }));
const byKey = new Map(tables.map((t) => [`${t.database}.${t.collection}`, t]));
const groups = new Map();
for (const d of defs) {
  const k = `${d.db}.${d.collection}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(d);
}

const statements = [];
const summary = [];
for (const [key, mine] of [...groups.entries()].sort()) {
  const ordered = [...mine.filter((d) => d.strict).sort((a, b) => Object.keys(b.schema.paths).length - Object.keys(a.schema.paths).length), ...mine.filter((d) => !d.strict)];
  const fieldKinds = new Map();
  let idKind = "objectId";
  ordered.forEach((d, i) => {
    const { fields, idKind: ik } = topLevelFields(d.schema);
    if (i === 0) idKind = ik;
    for (const [f, k] of fields) if (!fieldKinds.has(f)) fieldKinds.set(f, k);
  });
  const declaredIndexes = new Map();
  for (const d of ordered) for (const idx of indexesOf(d.schema)) declaredIndexes.set(indexSig(idx), idx);

  let table = byKey.get(key);
  const isNew = !table;
  if (isNew) {
    const [db, ...rest] = key.split(".");
    const collection = rest.join(".");
    table = { database: db, collection, schema: REGISTRY.databases[db], table: collection, idKind, columns: [], indexes: [] };
    tables.push(table);
    byKey.set(key, table);
  }

  const used = new Set(["id", "_nulls", "_extra", ...table.columns.map((c) => c.column)]);
  const known = new Set(table.columns.map((c) => c.field));
  const addedCols = [];
  for (const [field, kind] of fieldKinds) {
    if (known.has(field)) continue;
    let base = field === "__v" ? "version" : snake(field) || "field";
    if (base.length > 60) base = base.slice(0, 60);
    let column = base;
    for (let i = 2; used.has(column); i++) column = `${base}_${i}`;
    used.add(column);
    const col = { field, column, kind };
    table.columns.push(col);
    addedCols.push(col);
  }

  const existingSigs = new Set(table.indexes.map(indexSig));
  const usedNames = new Set(table.indexes.map((i) => i.name));
  const addedIdx = [];
  for (const [sig, idx] of declaredIndexes) {
    if (existingSigs.has(sig)) continue;
    let n = idx.name;
    for (let i = 2; usedNames.has(n); i++) n = `${idx.name}_${i}`;
    usedNames.add(n);
    const def = { ...idx, name: n, enforced: true };
    table.indexes.push(def);
    addedIdx.push(def);
  }

  const fq = `${qi(table.schema)}.${qi(table.table)}`;
  if (isNew) {
    statements.push(`-- new table for model collection ${table.collection}`, tableDdl(table));
    statements.push(revokeDdl(fq));
    summary.push(`new table ${table.schema}.${table.table} (${table.columns.length} columns, ${table.indexes.length} indexes)`);
    continue;
  }
  for (const c of addedCols) statements.push(`ALTER TABLE ${fq} ADD COLUMN IF NOT EXISTS ${qi(c.column)} ${columnType(c.kind)};`);
  if (addedIdx.length) {
    // Render the table's DDL with only the new indexes and keep their CREATE INDEX lines.
    const ddl = tableDdl({ ...table, indexes: addedIdx });
    for (const line of ddl.split("\n")) {
      if (/^CREATE (UNIQUE )?INDEX/.test(line) && !/USING gin \("_extra"\)/.test(line)) statements.push(line.replace(/^CREATE (UNIQUE )?INDEX /, (m) => `${m}IF NOT EXISTS `));
    }
  }
  if (addedCols.length || addedIdx.length) {
    summary.push(`${table.schema}.${table.table}: +${addedCols.length} column(s)${addedCols.length ? ` (${addedCols.map((c) => c.field).join(", ")})` : ""}, +${addedIdx.length} index(es)${addedIdx.length ? ` (${addedIdx.map((i) => i.name).join(", ")})` : ""}`);
  }
}

if (!statements.length) {
  console.log("Database layout already matches the models. Nothing to generate.");
  process.exit(0);
}

const next = String(migrationFiles().length + 1).padStart(4, "0");
const name = (process.argv[2] || "model_changes").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "model_changes";
const file = path.join(MIGRATIONS_DIR, `${next}_${name}.sql`);
fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
fs.writeFileSync(file, [`-- Generated by npm run db:generate on ${new Date().toISOString()}`, ...summary.map((s) => `--   ${s}`), "", ...statements, ""].join("\n"));

const registry = { ...REGISTRY, tables };
fs.writeFileSync(
  path.join(BACKEND_DIR, "src/database/pg/registry.generated.ts"),
  "/* eslint-disable */\n// GENERATED by database/generate.js — do not edit by hand.\n" + 'import type { Registry } from "./registry";\n\n' + `export const REGISTRY: Registry = ${JSON.stringify(registry, null, 1)};\n`,
);
require("./drizzle").writeDrizzle(registry);

console.log(summary.join("\n"));
console.log(`migration -> ${path.relative(BACKEND_DIR, file)}  (review it, then: npm run db:migrate)`);
