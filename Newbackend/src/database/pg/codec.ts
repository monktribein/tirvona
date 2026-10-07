/**
 * Lossless conversion between a MongoDB document (as the MongoDB driver
 * returns it) and a Postgres row in the registry layout.
 *
 * Rules:
 *  - A value that fits its column type is stored in the column.
 *  - An explicit null is recorded in _nulls (a missing field is simply absent).
 *  - Anything else — a value of the wrong type, or a field the registry does
 *    not know — is stored in _extra as relaxed Extended JSON, so ObjectIds,
 *    dates and other BSON types survive the round trip.
 */
import mongoose from "mongoose";
import type { ColumnDef, ColumnKind, ScalarKind, TableDef } from "./registry";

const { EJSON } = mongoose.mongo.BSON;
const ObjectId = mongoose.Types.ObjectId;

export type Row = Record<string, unknown> & {
  id: string;
  _nulls: string[] | null;
  _extra: Record<string, unknown> | null;
};

export const isObjectId = (v: unknown): v is mongoose.Types.ObjectId =>
  v != null && typeof v === "object" && (v as any)._bsontype === "ObjectId";

const isValidDate = (v: unknown): v is Date =>
  v instanceof Date && !Number.isNaN(v.getTime());

type Encoded = { ok: true; value: unknown } | { ok: false };
const NO: Encoded = { ok: false };

function encodeScalar(kind: ScalarKind, v: unknown): Encoded {
  switch (kind) {
    case "objectId":
      return isObjectId(v) ? { ok: true, value: v.toHexString() } : NO;
    case "string":
      return typeof v === "string" && !v.includes("\u0000")
        ? { ok: true, value: v }
        : NO;
    case "number":
      return typeof v === "number" && !Object.is(v, -0)
        ? { ok: true, value: v }
        : NO;
    case "date":
      return isValidDate(v) ? { ok: true, value: v } : NO;
    case "boolean":
      return typeof v === "boolean" ? { ok: true, value: v } : NO;
  }
}

/**
 * jsonb stores object keys in its own canonical order (shorter keys first, then
 * bytewise), but MongoDB keeps insertion order and code iterates it
 * (Object.keys/entries). Objects whose order differs from jsonb's carry their
 * key order under KEY_ORDER, which is removed again on decode.
 */
export const KEY_ORDER = "\u0001keys";

function jsonbKeyCompare(a: string, b: string): number {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length - bb.length || Buffer.compare(ba, bb);
}

function keepKeyOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(keepKeyOrder);
  if (v === null || typeof v !== "object") return v;
  const keys = Object.keys(v);
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = keepKeyOrder((v as Record<string, unknown>)[k]);
  if (keys.length > 1 && keys.some((k, i) => i > 0 && jsonbKeyCompare(keys[i - 1], k) > 0)) out[KEY_ORDER] = keys;
  return out;
}

function restoreKeyOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(restoreKeyOrder);
  if (v === null || typeof v !== "object") return v;
  const src = v as Record<string, unknown>;
  const order = Array.isArray(src[KEY_ORDER]) ? (src[KEY_ORDER] as string[]) : [];
  const out: Record<string, unknown> = {};
  for (const k of order) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = restoreKeyOrder(src[k]);
  for (const k of Object.keys(src)) if (k !== KEY_ORDER && !Object.prototype.hasOwnProperty.call(out, k)) out[k] = restoreKeyOrder(src[k]);
  return out;
}

export function toEjson(v: unknown): unknown {
  return keepKeyOrder((EJSON.serialize({ v }, { relaxed: true }) as { v: unknown }).v);
}

export function fromEjson(v: unknown): unknown {
  return (EJSON.deserialize({ v: restoreKeyOrder(v) } as any, { relaxed: true }) as { v: unknown }).v;
}

/** Encodes a value for a column; { ok:false } means "does not fit, use _extra". */
export function encodeForKind(kind: ColumnKind, v: unknown): Encoded {
  if (kind === "json") {
    const value = toEjson(v);
    return JSON.stringify(value).includes("\\u0000") ? NO : { ok: true, value };
  }
  if (kind.endsWith("[]")) {
    if (!Array.isArray(v)) return NO;
    const el = kind.slice(0, -2) as ScalarKind;
    const out: unknown[] = [];
    for (const item of v) {
      if (item === null || item === undefined) {
        out.push(null);
        continue;
      }
      const e = encodeScalar(el, item);
      if (!e.ok) return NO;
      out.push(e.value);
    }
    return { ok: true, value: out };
  }
  return encodeScalar(kind as ScalarKind, v);
}

export function decodeForKind(kind: ColumnKind, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (kind === "json") return fromEjson(raw);
  if (kind === "objectId") return new ObjectId(raw as string);
  if (kind === "objectId[]")
    return (raw as (string | null)[]).map((x) => (x == null ? null : new ObjectId(x)));
  if (kind === "date") return raw instanceof Date ? raw : new Date(raw as string);
  if (kind === "date[]")
    return (raw as unknown[]).map((x) =>
      x == null ? null : x instanceof Date ? x : new Date(x as string),
    );
  if (kind === "number") return typeof raw === "number" ? raw : Number(raw);
  if (kind === "number[]")
    return (raw as unknown[]).map((x) => (x == null ? null : Number(x)));
  return raw;
}

export function encodeId(table: TableDef, id: unknown): { id: string; extra?: unknown } {
  if (isObjectId(id)) return table.idKind === "objectId" ? { id: id.toHexString() } : { id: id.toHexString(), extra: toEjson(id) };
  if (typeof id === "string") return table.idKind === "string" ? { id } : { id, extra: id };
  const text = JSON.stringify(EJSON.serialize({ v: id }, { relaxed: true }).v);
  return { id: text, extra: toEjson(id) };
}

export function decodeId(table: TableDef, row: Row): unknown {
  if (row._extra && Object.prototype.hasOwnProperty.call(row._extra, "_id")) {
    return fromEjson(row._extra._id);
  }
  return table.idKind === "objectId" ? new ObjectId(row.id) : row.id;
}

/** Converts a MongoDB document into a row. The document must have an _id. */
export function docToRow(table: TableDef, columnsByField: Map<string, ColumnDef>, doc: Record<string, unknown>): Row {
  if (doc._id === undefined || doc._id === null) {
    throw new Error(`Document for ${table.collection} has no _id`);
  }
  const { id, extra: idExtra } = encodeId(table, doc._id);
  const row: Row = { id, _nulls: null, _extra: null };
  const nulls: string[] = [];
  const extra: Record<string, unknown> = {};
  if (idExtra !== undefined) extra._id = idExtra;
  for (const c of table.columns) row[c.column] = null;

  for (const [field, raw] of Object.entries(doc)) {
    if (field === "_id") continue;
    const value = raw === undefined ? null : raw; // BSON stores undefined as null
    const col = columnsByField.get(field);
    if (value === null) {
      if (col) nulls.push(field);
      else extra[field] = null;
      continue;
    }
    if (col) {
      const enc = encodeForKind(col.kind, value);
      if (enc.ok) {
        row[col.column] = enc.value;
        continue;
      }
    }
    extra[field] = toEjson(value);
  }
  if (nulls.length) row._nulls = nulls;
  if (Object.keys(extra).length) row._extra = extra;
  return row;
}

/** Converts a row back into the document MongoDB would have returned. */
export function rowToDoc(table: TableDef, row: Row): Record<string, unknown> {
  const doc: Record<string, unknown> = { _id: decodeId(table, row) };
  const nulls = new Set(row._nulls ?? []);
  for (const c of table.columns) {
    const raw = row[c.column];
    if (raw !== null && raw !== undefined) doc[c.field] = decodeForKind(c.kind, raw);
    else if (nulls.has(c.field)) doc[c.field] = null;
  }
  if (row._extra) {
    for (const [k, v] of Object.entries(row._extra)) {
      if (k === "_id") continue;
      doc[k] = fromEjson(v);
    }
  }
  return doc;
}
