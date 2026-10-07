/**
 * DDL for registry tables. Shared by the schema generator
 * (migration/supabase/03-generate-sql.js) and the driver tests, so tests run
 * against exactly the table layout production gets.
 *
 * Constraint policy (keeps production behaviour unchanged):
 *  - unique indexes only where marked `enforced` in the registry,
 *    NULLS NOT DISTINCT unless sparse (MongoDB indexes a missing key as null);
 *  - no foreign keys (the models never enforced references);
 *  - text columns COLLATE "C" (MongoDB compares strings bytewise).
 */
import { createHash } from "crypto";
import type { ColumnDef, ColumnKind, TableDef } from "./registry";
import { PG_TYPES } from "./registry";

const qi = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

export function columnType(kind: ColumnKind): string {
  const t = PG_TYPES[kind];
  return t === "text" || t === "text[]" ? `${t} COLLATE "C"` : t;
}

function shortName(table: string, suffix: string, payload: string): string {
  const h = createHash("sha1").update(payload).digest("hex").slice(0, 8);
  return `${`${table}_${suffix}`.slice(0, 53)}_${h}`;
}

interface KeyExpr {
  sql: string;
  kind: ColumnKind;
  nested?: boolean;
}

function keyExpr(t: TableDef, cols: Map<string, ColumnDef>, key: string): KeyExpr | null {
  if (key === "_id") return { sql: qi("id"), kind: t.idKind };
  const [top, ...rest] = key.split(".");
  const col = cols.get(top);
  if (!col) return null;
  if (rest.length === 0) return { sql: qi(col.column), kind: col.kind };
  if (col.kind !== "json") return null;
  return { sql: `(${qi(col.column)} #> ${lit(`{${rest.join(",")}}`)})`, kind: "json", nested: true };
}

/** Translates a model partialFilterExpression into SQL, or null if unsupported. */
function partialToSql(t: TableDef, cols: Map<string, ColumnDef>, pfe: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const [key, cond] of Object.entries(pfe)) {
    const e = keyExpr(t, cols, key);
    if (!e) return null;
    const isOps = cond && typeof cond === "object" && !Array.isArray(cond) && Object.keys(cond).every((k) => k.startsWith("$"));
    const ops = (isOps ? cond : { $eq: cond }) as Record<string, unknown>;
    for (const [op, v] of Object.entries(ops)) {
      if (op === "$exists") parts.push(v ? `${e.sql} IS NOT NULL` : `${e.sql} IS NULL`);
      else if (op === "$type") {
        if (e.nested) {
          const jt = ({ string: "string", number: "number", bool: "boolean", object: "object", array: "array" } as Record<string, string>)[String(v)];
          if (!jt) return null;
          parts.push(`jsonb_typeof(${e.sql}) = ${lit(jt)}`);
        } else {
          const expected = ({ string: ["string"], objectId: ["objectId"], date: ["date"], bool: ["boolean"], double: ["number"], number: ["number"] } as Record<string, string[]>)[String(v)];
          if (!expected || !expected.includes(e.kind)) return null;
          parts.push(`${e.sql} IS NOT NULL`);
        }
      } else if (op === "$eq") {
        if (v === null) parts.push(`${e.sql} IS NULL`);
        else if (typeof v === "boolean" && e.kind === "boolean") parts.push(`${e.sql} = ${v}`);
        else if (typeof v === "string" && (e.kind === "string" || e.kind === "objectId")) parts.push(`${e.sql} = ${lit(v)}`);
        else if (typeof v === "number" && e.kind === "number") parts.push(`${e.sql} = ${v}`);
        else return null;
      } else if (op === "$in") {
        if (!Array.isArray(v) || !v.every((x) => typeof x === "string") || e.kind !== "string") return null;
        parts.push(`${e.sql} IN (${v.map((x) => lit(x)).join(", ")})`);
      } else if (op === "$gt" && v === "" && e.nested) parts.push(`(${e.sql} #>> '{}') > ''`);
      else if (op === "$gt" && v === "" && e.kind === "string") parts.push(`${e.sql} > ''`);
      else return null;
    }
  }
  return parts.length ? parts.join(" AND ") : "TRUE";
}

/** CREATE TABLE + RLS + indexes for one registry table. `warnings` collects skipped indexes. */
export function tableDdl(t: TableDef, warnings: string[] = []): string {
  const cols = new Map(t.columns.map((c) => [c.field, c]));
  const fq = `${qi(t.schema)}.${qi(t.table)}`;
  const lines: string[] = [];
  const colLines = [`  ${qi("id")} text COLLATE "C" PRIMARY KEY`];
  for (const c of t.columns) colLines.push(`  ${qi(c.column)} ${columnType(c.kind)}`);
  colLines.push(`  ${qi("_nulls")} text[]`, `  ${qi("_extra")} jsonb`);
  lines.push(`CREATE TABLE ${fq} (\n${colLines.join(",\n")}\n);`);
  lines.push(`COMMENT ON TABLE ${fq} IS ${lit(`Tirvona model collection ${t.collection}. Layout: src/database/pg/registry.generated.ts`)};`);
  for (const c of t.columns) if (c.column !== c.field) lines.push(`COMMENT ON COLUMN ${fq}.${qi(c.column)} IS ${lit(`model field: ${c.field}`)};`);
  lines.push(`ALTER TABLE ${fq} ENABLE ROW LEVEL SECURITY;`);
  lines.push(`CREATE INDEX ${qi(shortName(t.table, "extra", t.schema + t.table))} ON ${fq} USING gin (${qi("_extra")}) WHERE ${qi("_extra")} IS NOT NULL;`);

  const made = new Set<string>();
  for (const idx of t.indexes) {
    const keys = Object.entries(idx.keys);
    if (keys.some(([, v]) => v !== 1 && v !== -1)) continue; // geo/text: handled in the driver
    const exprs = keys.map(([k, dir]) => ({ e: keyExpr(t, cols, k), dir }));
    if (exprs.some((x) => !x.e)) {
      warnings.push(`${t.schema}.${t.table}: index ${idx.name} skipped (a key field has no column: the collection has no data and no typed model)`);
      continue;
    }
    const isUnique = Boolean(idx.unique && idx.enforced);
    const arrayKey = exprs.some((x) => x.e!.kind.endsWith("[]"));
    if (isUnique && arrayKey) warnings.push(`${t.schema}.${t.table}: unique ${idx.name} is on an array field (multikey) — created as a plain index`);
    let where: string | null = null;
    if (idx.partialFilterExpression) {
      where = partialToSql(t, cols, idx.partialFilterExpression);
      if (where === null) {
        warnings.push(`${t.schema}.${t.table}: partial filter of ${idx.name} not translatable${isUnique ? " — UNIQUE NOT ENFORCED" : ""}`);
        if (isUnique) continue;
      }
    } else if (idx.sparse) {
      where = exprs.map((x) => `${x.e!.sql} IS NOT NULL`).join(" OR ");
    }
    const unique = isUnique && !arrayKey;
    const using = arrayKey && exprs.length === 1 ? "gin" : "btree";
    const colSql = using === "gin" ? exprs[0].e!.sql : exprs.map((x) => `${x.e!.sql}${x.dir === -1 ? " DESC NULLS LAST" : ""}`).join(", ");
    const sig = JSON.stringify([unique, using, colSql, where]);
    if (made.has(sig)) continue;
    made.add(sig);
    const name = shortName(t.table, unique ? "uq" : "ix", sig);
    const nnd = unique && !idx.sparse ? " NULLS NOT DISTINCT" : "";
    lines.push(`CREATE ${unique ? "UNIQUE " : ""}INDEX ${qi(name)} ON ${fq} USING ${using} (${colSql})${nnd}${where ? ` WHERE ${where}` : ""};`);
  }
  return lines.join("\n");
}

/** Full schema DDL. `revoke` adds the Supabase API-role revokes (omit for plain Postgres). */
/**
 * REVOKE from PUBLIC plus Supabase's API roles (anon, authenticated) where
 * they exist, so the same SQL also runs on a plain Postgres.
 */
export function revokeDdl(target: string): string {
  const inner = `REVOKE ALL ON ${target} FROM %s`.replace(/'/g, "''");
  return (
    `REVOKE ALL ON ${target} FROM PUBLIC;\n` +
    `DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP ` +
    `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('${inner}', r); END IF; END LOOP; END $$;`
  );
}

export function schemaDdl(tables: TableDef[], options: { revoke?: boolean } = {}, warnings: string[] = []): string {
  const schemas = [...new Set(tables.map((t) => t.schema))].filter((s) => s !== "public");
  const out: string[] = [];
  for (const s of schemas) {
    out.push(`CREATE SCHEMA IF NOT EXISTS ${qi(s)};`);
    if (options.revoke) out.push(revokeDdl(`SCHEMA ${qi(s)}`));
  }
  for (const t of tables) {
    out.push(tableDdl(t, warnings));
    if (options.revoke) out.push(revokeDdl(`${qi(t.schema)}.${qi(t.table)}`));
  }
  return out.join("\n\n");
}
