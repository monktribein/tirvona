/**
 * Test-only in-memory stand-in for a Mongoose model, used by the marketplace
 * specs so business flows run end-to-end without a database.
 *
 * - Documents are cast + defaulted through the REAL schema (a disconnected
 *   Mongoose instance), so schema defaults/enums behave as in production.
 * - Filters are matched with `sift` (MongoDB query semantics).
 * - findOneAndUpdate / updateOne / updateMany apply atomically (no await
 *   between match and write), mirroring MongoDB's single-document atomicity,
 *   which is what the inventory/lock/idempotency code relies on.
 * - Unique indexes listed in `unique` throw `{ code: 11000 }` like MongoDB.
 * - ObjectIds are normalised to hex strings on both sides of every match.
 */
import mongoose, { Types, type Schema } from "mongoose";
import sift from "sift";

const isOid = (v: unknown): v is Types.ObjectId =>
  v instanceof Types.ObjectId || (typeof v === "object" && v !== null && (v as any)._bsontype === "ObjectId");

// Dates can come from another realm under Jest, so `instanceof Date` is unreliable.
const isDate = (v: unknown): v is Date => Object.prototype.toString.call(v) === "[object Date]";

export function normalize(value: any): any {
  if (isOid(value)) return value.toHexString();
  if (isDate(value)) return new Date(value.getTime());
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

const clone = <T>(v: T): T => normalize(structuredClone(stripFns(v)));
function stripFns(v: any): any {
  if (isDate(v)) return new Date(v.getTime());
  if (v === null || typeof v !== "object") return v;
  if (isOid(v)) return v;
  if (Array.isArray(v)) return v.map(stripFns);
  const out: any = {};
  for (const [k, val] of Object.entries(v)) if (typeof val !== "function") out[k] = stripFns(val);
  return out;
}

const getPath = (obj: any, path: string) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let o = obj;
  for (const p of parts.slice(0, -1)) {
    if (o[p] === undefined || o[p] === null || typeof o[p] !== "object") o[p] = {};
    o = o[p];
  }
  o[parts[parts.length - 1]] = value;
}
function unsetPath(obj: any, path: string) {
  const parts = path.split(".");
  const parent = parts.length > 1 ? getPath(obj, parts.slice(0, -1).join(".")) : obj;
  if (parent) delete parent[parts[parts.length - 1]];
}

function applyUpdate(doc: any, update: any, isInsert = false) {
  const ops = Object.keys(update).some((k) => k.startsWith("$")) ? update : { $set: update };
  for (const [k, v] of Object.entries(ops.$set ?? {})) setPath(doc, k, normalize(v));
  for (const [k, v] of Object.entries(ops.$inc ?? {})) setPath(doc, k, (Number(getPath(doc, k)) || 0) + Number(v));
  for (const k of Object.keys(ops.$unset ?? {})) unsetPath(doc, k);
  if (isInsert) for (const [k, v] of Object.entries(ops.$setOnInsert ?? {})) setPath(doc, k, normalize(v));
}

// Evaluates the small aggregation-expression subset the services use.
function evalExpr(expr: any, doc: any): any {
  if (typeof expr === "string" && expr.startsWith("$")) return getPath(doc, expr.slice(1));
  if (expr === null || typeof expr !== "object" || isDate(expr)) return expr;
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, doc));
  const [op] = Object.keys(expr);
  const args = (expr as any)[op];
  const a = Array.isArray(args) ? args.map((x: any) => evalExpr(x, doc)) : evalExpr(args, doc);
  const cmp = (x: any) => (isDate(x) ? x.getTime() : x);
  switch (op) {
    case "$and": return a.every(Boolean);
    case "$or": return a.some(Boolean);
    case "$ne": return (a[0] ?? null) !== (a[1] ?? null);
    case "$eq": return (a[0] ?? null) === (a[1] ?? null);
    case "$lte": return a[0] != null && cmp(a[0]) <= cmp(a[1]);
    case "$lt": return a[0] != null && cmp(a[0]) < cmp(a[1]);
    case "$gte": return a[0] != null && cmp(a[0]) >= cmp(a[1]);
    case "$ifNull": return a[0] ?? a[1];
    default: {
      const out: any = {};
      for (const [k, v] of Object.entries(expr)) out[k] = evalExpr(v, doc);
      return out;
    }
  }
}

export interface InMemoryModelOptions {
  /** Unique indexes: each entry is a list of fields forming one unique key. */
  unique?: string[][];
}

export function createInMemoryModel(name: string, schema: Schema, opts: InMemoryModelOptions = {}) {
  const m = new mongoose.Mongoose();
  const Real = m.model(`${name}_${Math.random().toString(36).slice(2)}`, schema.clone());
  const store = new Map<string, any>();

  const matcher = (filter: any) => sift(normalize(filter ?? {}));
  const all = () => [...store.values()];

  function assertUnique(doc: any, selfId?: string) {
    for (const fields of opts.unique ?? []) {
      const values = fields.map((f) => getPath(doc, f));
      if (values.some((v) => v === undefined || v === null)) continue;
      const clash = all().find((o) => o._id !== selfId && fields.every((f, i) => getPath(o, f) === values[i]));
      if (clash) throw Object.assign(new Error(`E11000 duplicate key ${name} ${fields.join(",")}`), { code: 11000 });
    }
  }

  function hydrate(raw: any): any {
    const doc = clone(raw);
    Object.defineProperties(doc, {
      save: { value: async () => { const plain = clone(doc); assertUnique(plain, plain._id); store.set(plain._id, plain); return doc; } },
      toObject: { value: () => clone(doc) },
      markModified: { value: () => undefined },
    });
    return doc;
  }

  function cast(data: any): any {
    const d = new Real(data);
    const err = d.validateSync();
    if (err) throw err;
    return normalize(d.toObject({ depopulate: true }));
  }

  class Query<T> implements PromiseLike<T> {
    private _sort?: Record<string, 1 | -1>;
    private _skip = 0;
    private _limit = 0;
    private _lean = false;
    constructor(private readonly exec: () => any[], private readonly single: boolean) {}
    sort(s: Record<string, 1 | -1>) { this._sort = s; return this; }
    skip(n: number) { this._skip = n; return this; }
    limit(n: number) { this._limit = n; return this; }
    select() { return this; }
    populate() { return this; }
    session() { return this; }
    lean() { this._lean = true; return this as unknown as Query<any>; }
    private run(): any {
      let rows = this.exec();
      if (this._sort) {
        const entries = Object.entries(this._sort);
        rows = [...rows].sort((x, y) => {
          for (const [k, dir] of entries) {
            const a = getPath(x, k), b = getPath(y, k);
            if (a === b) continue;
            return (a > b ? 1 : -1) * dir;
          }
          return 0;
        });
      }
      rows = rows.slice(this._skip, this._limit ? this._skip + this._limit : undefined);
      const out = rows.map((r) => (this._lean ? clone(r) : hydrate(r)));
      return this.single ? out[0] ?? null : out;
    }
    then<A, B>(ok?: (v: T) => A | PromiseLike<A>, bad?: (e: any) => B | PromiseLike<B>): Promise<A | B> {
      return Promise.resolve().then(() => this.run()).then(ok, bad);
    }
  }

  const Model: any = function (this: any, data: any) {
    const plain = cast(data);
    return hydrate(plain);
  };

  Object.assign(Model, {
    store,
    modelName: name,
    collection: { name },
    async create(input: any, _opts?: any) {
      const many = Array.isArray(input);
      const docs = (many ? input : [input]).map((d: any) => {
        const plain = cast(d);
        assertUnique(plain);
        store.set(plain._id, plain);
        return hydrate(plain);
      });
      return many ? docs : docs[0];
    },
    find(filter?: any) { const f = matcher(filter); return new Query(() => all().filter(f), false); },
    findOne(filter?: any) { const f = matcher(filter); return new Query(() => all().filter(f).slice(0, 1), true); },
    findById(id: any) { return Model.findOne({ _id: id }); },
    async exists(filter: any) { const f = matcher(filter); const hit = all().find(f); return hit ? { _id: hit._id } : null; },
    async countDocuments(filter?: any) { const f = matcher(filter); return all().filter(f).length; },
    async distinct(field: string, filter?: any) { const f = matcher(filter); return [...new Set(all().filter(f).map((d) => getPath(d, field)))]; },
    findOneAndUpdate(filter: any, update: any, options: any = {}) {
      return new Query(() => {
        const f = matcher(filter);
        const hit = all().find(f);
        if (!hit) {
          if (!options.upsert) return [];
          const created: any = cast({ ...normalizeEq(filter), ...(update?.$setOnInsert ?? {}) });
          applyUpdate(created, update, true);
          store.set(created._id, created);
          return [created];
        }
        const before = clone(hit);
        const next = clone(hit);
        applyUpdate(next, update);
        assertUnique(next, next._id);
        store.set(next._id, next);
        return [options.new ? next : before];
      }, true);
    },
    findByIdAndUpdate(id: any, update: any, options: any = {}) { return Model.findOneAndUpdate({ _id: id }, update, options); },
    async updateOne(filter: any, update: any, options: any = {}) {
      const f = matcher(filter);
      const hit = all().find(f);
      if (!hit) {
        if (options.upsert) {
          const created: any = cast({ ...normalizeEq(filter) });
          applyUpdate(created, update, true);
          store.set(created._id, created);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      }
      const next = clone(hit);
      applyUpdate(next, update);
      store.set(next._id, next);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter: any, update: any) {
      const f = matcher(filter);
      const hits = all().filter(f);
      for (const h of hits) { const next = clone(h); applyUpdate(next, update); store.set(next._id, next); }
      return { matchedCount: hits.length, modifiedCount: hits.length };
    },
    async aggregate(pipeline: any[]) {
      let rows: any[] = all().map(clone);
      for (const stage of pipeline) {
        if (stage.$match) rows = rows.filter(matcher(stage.$match));
        else if (stage.$group) {
          const { _id, ...acc } = stage.$group;
          const groups = new Map<string, { key: any; rows: any[] }>();
          for (const r of rows) {
            const key = evalExpr(_id, r);
            const k = JSON.stringify(key);
            if (!groups.has(k)) groups.set(k, { key, rows: [] });
            groups.get(k)!.rows.push(r);
          }
          rows = [...groups.values()].map(({ key, rows: rs }) => {
            const out: any = { _id: key };
            for (const [field, spec] of Object.entries<any>(acc)) {
              const [op] = Object.keys(spec);
              const vals = rs.map((r) => (spec[op] === 1 ? 1 : Number(evalExpr(spec[op], r)) || 0));
              out[field] = op === "$avg" ? vals.reduce((s, v) => s + v, 0) / (vals.length || 1) : vals.reduce((s, v) => s + v, 0);
            }
            return out;
          });
        }
      }
      return rows;
    },
    async createIndexes() { return undefined; },
    db: { model: () => { throw new Error("not supported in tests"); } },
  });
  return Model;
}

function normalizeEq(filter: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(filter ?? {})) if (!k.startsWith("$") && (typeof v !== "object" || v === null)) out[k] = v;
  return out;
}
