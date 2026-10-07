/**
 * Translates a MongoDB filter into a SQL WHERE clause that selects a SUPERSET
 * of the matching rows. Every candidate is re-checked with mingo (a MongoDB
 * query engine), so the SQL never decides correctness on its own — it only
 * narrows the scan.
 *
 * `exact` is true when the SQL selects exactly the matching rows, provided no
 * row holds a referenced field in _extra (checked at query time). Only then
 * may sort/skip/limit/count be pushed down to Postgres.
 */
import type { ColumnDef, ScalarKind, TableDef } from "./registry";
import { PG_TYPES } from "./registry";
import { isObjectId } from "./codec";

export interface SqlFragment {
  sql: string;
  exact: boolean;
}

export class SqlParams {
  readonly values: unknown[] = [];
  add(value: unknown, cast: string): string {
    this.values.push(value);
    return "$" + String(this.values.length) + "::" + cast;
  }
}

/**
 * Drops parameters that ended up unused (a branch that fell back to mingo
 * still registered its values) and renumbers the rest, so the placeholder
 * count always matches the bound values.
 */
export function compactParams(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
  const map = new Map<number, number>();
  const out: unknown[] = [];
  const text = sql.replace(/\$(\d+)(?=::)/g, (_m, n: string) => {
    const i = Number(n);
    if (!map.has(i)) {
      out.push(values[i - 1]);
      map.set(i, out.length);
    }
    return "$" + String(map.get(i));
  });
  return { sql: text, values: out };
}

const TRUE: SqlFragment = { sql: "TRUE", exact: false };
const exact = (sql: string): SqlFragment => ({ sql, exact: true });
export const qi = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

const OPERATOR_KEYS = new Set([
  "$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$exists",
  "$regex", "$options", "$not", "$elemMatch", "$size", "$all", "$type",
  "$mod", "$near", "$nearSphere", "$geoWithin", "$geoIntersects",
  "$maxDistance", "$minDistance", "$bitsAllSet", "$bitsAnySet",
  "$bitsAllClear", "$bitsAnyClear", "$jsonSchema",
]);

function isOperatorObject(v: unknown): v is Record<string, unknown> {
  if (v == null || typeof v !== "object" || Array.isArray(v) || v instanceof Date || v instanceof RegExp || isObjectId(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

/** Converts a query value into a SQL parameter for a scalar column, or undefined if the type can never match. */
function scalarParam(kind: ScalarKind, v: unknown): unknown {
  switch (kind) {
    case "objectId":
      return isObjectId(v) ? v.toHexString() : undefined;
    case "string":
      return typeof v === "string" ? v : undefined;
    case "number":
      return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
    case "date":
      return v instanceof Date && !Number.isNaN(v.getTime()) ? v : undefined;
    case "boolean":
      return typeof v === "boolean" ? v : undefined;
  }
}

function regexToLike(re: RegExp): { pattern: string; insensitive: boolean } | null {
  const flags = re.flags.replace(/[gu]/g, "");
  if (flags !== "" && flags !== "i") return null;
  let src = re.source;
  let anchoredStart = false;
  let anchoredEnd = false;
  if (src.startsWith("^")) { anchoredStart = true; src = src.slice(1); }
  if (src.endsWith("$") && !src.endsWith("\\$")) { anchoredEnd = true; src = src.slice(0, -1); }
  let literal = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") {
      const next = src[i + 1];
      if (next === undefined || /[A-Za-z0-9]/.test(next)) return null; // \d, \s, \b … are not literals
      literal += next;
      i++;
      continue;
    }
    if (/[.*+?()[\]{}|^$]/.test(ch)) return null;
    literal += ch;
  }
  const escaped = literal.replace(/[\\%_]/g, (m) => "\\" + m);
  return {
    pattern: `${anchoredStart ? "" : "%"}${escaped}${anchoredEnd ? "" : "%"}`,
    insensitive: flags === "i",
  };
}

export class FilterTranslator {
  /** Fields whose exactness depends on them not appearing in _extra. */
  readonly referencedFields = new Set<string>();

  constructor(
    private readonly table: TableDef,
    private readonly columns: Map<string, ColumnDef>,
    readonly params: SqlParams = new SqlParams(),
  ) {}

  translate(filter: Record<string, unknown> | undefined | null): SqlFragment {
    if (!filter || Object.keys(filter).length === 0) return exact("TRUE");
    return this.and(Object.entries(filter).map(([k, v]) => this.clause(k, v)));
  }

  private and(parts: SqlFragment[]): SqlFragment {
    const useful = parts.filter((p) => p.sql !== "TRUE");
    const isExact = parts.every((p) => p.exact);
    if (useful.length === 0) return { sql: "TRUE", exact: isExact };
    return { sql: useful.map((p) => `(${p.sql})`).join(" AND "), exact: isExact };
  }

  private or(parts: SqlFragment[]): SqlFragment {
    if (parts.some((p) => p.sql === "TRUE")) return { sql: "TRUE", exact: parts.some((p) => p.sql === "TRUE" && p.exact) };
    if (parts.length === 0) return exact("FALSE");
    return { sql: parts.map((p) => `(${p.sql})`).join(" OR "), exact: parts.every((p) => p.exact) };
  }

  private clause(key: string, value: unknown): SqlFragment {
    if (key === "$and") return Array.isArray(value) ? this.and(value.map((f) => this.translate(f))) : TRUE;
    if (key === "$or") return Array.isArray(value) ? this.or(value.map((f) => this.translate(f))) : TRUE;
    if (key === "$nor") {
      if (!Array.isArray(value)) return TRUE;
      const inner = this.or(value.map((f) => this.translate(f)));
      return inner.exact ? exact(`NOT (${inner.sql})`) : TRUE;
    }
    if (key === "$comment") return exact("TRUE");
    if (key.startsWith("$")) return TRUE; // $expr, $where, $text, …: evaluated by mingo

    if (key === "_id") return this.fieldCondition(this.idColumn(), value);
    if (key.includes(".")) return TRUE; // nested paths: evaluated by mingo
    const col = this.columns.get(key);
    if (!col) return TRUE; // field only ever lives in _extra
    return this.fieldCondition(col, value);
  }

  private idColumn(): ColumnDef {
    return { field: "_id", column: "id", kind: this.table.idKind };
  }

  private fieldCondition(col: ColumnDef, cond: unknown): SqlFragment {
    this.referencedFields.add(col.field);
    let inner: SqlFragment;
    if (cond instanceof RegExp) inner = this.op(col, "$regex", cond, {});
    else if (isOperatorObject(cond)) {
      const keys = Object.keys(cond);
      inner = keys.some((k) => !OPERATOR_KEYS.has(k))
        ? TRUE
        : this.and(keys.filter((k) => k !== "$options").map((k) => this.op(col, k, cond[k], cond)));
    } else inner = this.op(col, "$eq", cond, {});
    if (inner.sql === "TRUE") return inner;
    // A value that did not fit its column lives in _extra; keep such rows as
    // candidates so mingo can judge them. Exact mode is only used after
    // checking that no row has this field in _extra.
    return {
      sql: `coalesce((${inner.sql}), FALSE) OR (_extra ? ${this.params.add(col.field, "text")})`,
      exact: inner.exact,
    };
  }

  private nullsHas(field: string): string {
    return `${this.params.add(field, "text")} = ANY(coalesce(_nulls, '{}'))`;
  }

  private op(col: ColumnDef, op: string, v: unknown, all: Record<string, unknown>): SqlFragment {
    if (col.kind === "json") return this.jsonOp(col, op, v);
    const c = qi(col.column);
    const isArray = col.kind.endsWith("[]");
    const kind = (isArray ? col.kind.slice(0, -2) : col.kind) as ScalarKind;
    const cast = PG_TYPES[kind];
    const collate = kind === "string" || kind === "objectId" ? ' COLLATE "C"' : "";

    switch (op) {
      case "$exists": {
        if (col.field === "_id") return exact(v ? "TRUE" : "FALSE");
        return v
          ? exact(`${c} IS NOT NULL OR ${this.nullsHas(col.field)}`)
          : exact(`${c} IS NULL AND NOT (${this.nullsHas(col.field)})`);
      }
      case "$eq": {
        if (v === null || v === undefined) {
          return isArray ? exact(`${c} IS NULL OR array_position(${c}, NULL) IS NOT NULL`) : exact(`${c} IS NULL`);
        }
        if (Array.isArray(v)) {
          if (!isArray) return exact("FALSE");
          const vals = v.map((x) => (x == null ? null : scalarParam(kind, x)));
          if (vals.some((x) => x === undefined)) return exact("FALSE");
          return exact(`${c} = ${this.params.add(vals, `${cast}[]`)}`);
        }
        const p = scalarParam(kind, v);
        if (p === undefined) return isOperatorObject(v) || (typeof v === "object" && !(v instanceof Date)) ? TRUE : exact("FALSE");
        return isArray ? exact(`${c} @> ARRAY[${this.params.add(p, cast)}]`) : exact(`${c} = ${this.params.add(p, cast)}`);
      }
      case "$ne": {
        const eq = this.op(col, "$eq", v, all);
        if (!eq.exact) return TRUE;
        return exact(`NOT coalesce((${eq.sql}), FALSE)`);
      }
      case "$in": {
        if (!Array.isArray(v)) return TRUE;
        if (v.some((x) => x instanceof RegExp || Array.isArray(x))) return TRUE;
        const hasNull = v.some((x) => x === null || x === undefined);
        const vals = v.filter((x) => x !== null && x !== undefined).map((x) => scalarParam(kind, x)).filter((x) => x !== undefined);
        const parts: string[] = [];
        if (vals.length) {
          const arr = this.params.add(vals, `${cast}[]`);
          parts.push(isArray ? `${c} && ${arr}` : `${c} = ANY(${arr})`);
        }
        if (hasNull) parts.push(isArray ? `${c} IS NULL OR array_position(${c}, NULL) IS NOT NULL` : `${c} IS NULL`);
        return exact(parts.length ? parts.map((p) => `(${p})`).join(" OR ") : "FALSE");
      }
      case "$nin": {
        const inn = this.op(col, "$in", v, all);
        if (!inn.exact) return TRUE;
        return exact(`NOT coalesce((${inn.sql}), FALSE)`);
      }
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte": {
        const sym = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op]!;
        if (v === null) return op === "$gte" || op === "$lte" ? this.op(col, "$eq", null, all) : exact("FALSE");
        const p = scalarParam(kind, v);
        if (p === undefined) return typeof v === "object" ? TRUE : exact("FALSE");
        const param = this.params.add(p, cast);
        return isArray
          ? exact(`EXISTS (SELECT 1 FROM unnest(${c}) AS e WHERE e${collate} ${sym} ${param})`)
          : exact(`${c}${collate} ${sym} ${param}`);
      }
      case "$size": {
        if (!isArray || typeof v !== "number") return TRUE;
        return exact(`cardinality(${c}) = ${this.params.add(v, "integer")}`);
      }
      case "$all": {
        if (!isArray || !Array.isArray(v) || v.length === 0) return TRUE;
        const vals = v.map((x) => scalarParam(kind, x));
        if (vals.some((x) => x === undefined)) return TRUE;
        return exact(`${c} @> ${this.params.add(vals, `${cast}[]`)}`);
      }
      case "$regex": {
        if (kind !== "string") return TRUE;
        const re = v instanceof RegExp ? v : typeof v === "string" ? safeRegExp(v, String(all.$options ?? "")) : null;
        if (!re) return TRUE;
        const like = regexToLike(re);
        if (!like) return TRUE;
        const p = this.params.add(like.pattern, "text");
        const cmp = like.insensitive ? "ILIKE" : "LIKE";
        // Case folding of ILIKE differs from JavaScript for some scripts, so this is only a superset filter.
        return isArray
          ? { sql: `EXISTS (SELECT 1 FROM unnest(${c}) AS e WHERE e ${cmp} ${p})`, exact: !like.insensitive }
          : { sql: `${c} ${cmp} ${p}`, exact: !like.insensitive };
      }
      default:
        return TRUE;
    }
  }

  private jsonOp(col: ColumnDef, op: string, v: unknown): SqlFragment {
    const c = qi(col.column);
    if (op === "$exists") {
      return v
        ? exact(`${c} IS NOT NULL OR ${this.nullsHas(col.field)}`)
        : exact(`${c} IS NULL AND NOT (${this.nullsHas(col.field)})`);
    }
    if (op === "$eq" && (v === null || v === undefined)) {
      // null also matches arrays containing null; let mingo decide those.
      return { sql: `${c} IS NULL OR jsonb_typeof(${c}) = 'array'`, exact: false };
    }
    if (op === "$ne" && (v === null || v === undefined)) return { sql: `${c} IS NOT NULL`, exact: false };
    return TRUE;
  }
}

function safeRegExp(src: string, options: string): RegExp | null {
  try {
    return new RegExp(src, options.replace(/[^imsux]/g, "").replace("x", ""));
  } catch {
    return null;
  }
}

/** ORDER BY for a Mongo sort spec when every key is a scalar column, else null. */
export function sortToSql(sort: Record<string, unknown> | undefined, table: TableDef, columns: Map<string, ColumnDef>): { sql: string; fields: string[] } | null {
  if (!sort || Object.keys(sort).length === 0) return { sql: "", fields: [] };
  const parts: string[] = [];
  const fields: string[] = [];
  for (const [field, dirRaw] of Object.entries(sort)) {
    const dir = dirRaw === -1 || dirRaw === "desc" || dirRaw === "descending" ? -1 : dirRaw === 1 || dirRaw === "asc" || dirRaw === "ascending" ? 1 : null;
    if (dir === null) return null;
    let column: string;
    let kind: string;
    if (field === "_id") {
      column = "id";
      kind = table.idKind;
    } else {
      const col = columns.get(field);
      if (!col || col.kind === "json" || col.kind.endsWith("[]")) return null;
      column = col.column;
      kind = col.kind;
      fields.push(field);
    }
    const collate = kind === "string" || kind === "objectId" ? ' COLLATE "C"' : "";
    // MongoDB orders null/missing before every value ascending, after every value descending.
    parts.push(`${qi(column)}${collate} ${dir === 1 ? "ASC NULLS FIRST" : "DESC NULLS LAST"}`);
  }
  parts.push(`"id" COLLATE "C" ASC`);
  return { sql: parts.join(", "), fields };
}
