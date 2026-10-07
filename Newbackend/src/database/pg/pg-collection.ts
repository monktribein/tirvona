/**
 * A MongoDB Collection look-alike backed by one Postgres table.
 *
 * Mongoose calls these methods with already-cast filters and updates, exactly
 * as it would call the MongoDB driver. Reads narrow candidates in SQL and
 * confirm every match with mingo. Writes lock their candidate rows
 * (SELECT … FOR UPDATE), apply the update in JavaScript with mingo, and write
 * the row back — all inside one Postgres transaction, so conditional updates
 * such as "increment heldCount only if capacity remains" stay atomic.
 */
import mongoose from "mongoose";
import { Aggregator, Query } from "mingo";
import { update as mingoUpdate, updateOne as mingoUpdateOne } from "mingo";
import { docToRow, isObjectId, rowToDoc } from "./codec";
import type { Row } from "./codec";
import { PgDriverUnsupportedError, translatePgError } from "./errors";
import { applyNear, extractNear, getPath, pointOf, setPath } from "./geo";
import type { PgSession } from "./pg-session";
import type { PooledClient, Queryable } from "./pool";
import type { ColumnDef, TableDef } from "./registry";
import { PG_TYPES } from "./registry";
import { compactParams, FilterTranslator, qi, sortToSql } from "./sql-filter";
import type { PgStore } from "./pg-store";

const { ObjectId } = mongoose.Types;
const { EJSON } = mongoose.mongo.BSON;
type Doc = Record<string, any>;
type Filter = Record<string, any>;
type Opts = Record<string, any> & { session?: PgSession };

const MINGO_OPTIONS = { idKey: "_id" } as const;

function normalizeSort(sort: unknown): Record<string, number> | undefined {
  if (sort == null) return undefined;
  if (sort instanceof Map) return Object.fromEntries(sort);
  if (Array.isArray(sort)) {
    if (sort.length === 2 && typeof sort[0] === "string" && !Array.isArray(sort[1])) return { [sort[0]]: sort[1] as number };
    return Object.fromEntries(sort.map((p) => (Array.isArray(p) ? p : [p, 1])));
  }
  if (typeof sort === "string") return { [sort]: 1 };
  return sort as Record<string, number>;
}

function stripComment(filter: Filter | undefined): Filter {
  if (!filter) return {};
  if (!("$comment" in filter)) return filter;
  const rest = { ...filter };
  delete rest.$comment;
  return rest;
}

const canonical = (v: unknown) => EJSON.stringify(v as any, { relaxed: false });

/** Key-order-insensitive serialization (jsonb does not keep key order). */
function stable(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (v instanceof Date) return `"D:${v.toISOString()}"`;
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

class PgCursor<T = Doc> {
  private buffer: T[] | null = null;
  private position = 0;
  private closed = false;
  private transforms: ((d: any) => any)[] = [];

  constructor(private readonly exec: () => Promise<T[]>) {}

  private async load(): Promise<T[]> {
    if (!this.buffer) {
      let docs: any[] = await this.exec();
      for (const t of this.transforms) docs = docs.map(t);
      this.buffer = docs;
    }
    return this.buffer;
  }
  async toArray(): Promise<T[]> {
    const all = await this.load();
    const rest = all.slice(this.position);
    this.position = all.length;
    return rest;
  }
  async next(): Promise<T | null> {
    const all = await this.load();
    return this.position < all.length ? all[this.position++] : null;
  }
  async tryNext(): Promise<T | null> {
    return this.next();
  }
  async hasNext(): Promise<boolean> {
    const all = await this.load();
    return this.position < all.length;
  }
  async forEach(fn: (doc: T) => unknown): Promise<void> {
    for (let d = await this.next(); d !== null; d = await this.next()) {
      if ((await fn(d)) === false) break;
    }
  }
  map<U>(fn: (doc: T) => U): PgCursor<U> {
    this.transforms.push(fn);
    return this as unknown as PgCursor<U>;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
  get killed() {
    return this.closed;
  }
  rewind(): void {
    this.position = 0;
  }
  batchSize(): this {
    return this;
  }
  addCursorFlag(): this {
    return this;
  }
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (let d = await this.next(); d !== null; d = await this.next()) yield d;
  }
  stream(): NodeJS.ReadableStream {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Readable } = require("stream");
    return Readable.from(this[Symbol.asyncIterator]());
  }
}

interface Selected {
  row: Row;
  doc: Doc;
}

/**
 * MongoDB defines {$count: f} as {$group: {_id: null, f: {$sum: 1}}} +
 * {$project: {_id: 0}}, so it emits nothing for empty input; mingo emits
 * {f: 0}. Rewrites $count (also inside $facet/$lookup/$unionWith) to the
 * MongoDB definition.
 */
function rewriteCount(stages: Doc[]): Doc[] {
  return stages.flatMap((stage): Doc[] => {
    if (!stage || typeof stage !== "object") return [stage];
    if (typeof stage.$count === "string") return [{ $group: { _id: null, [stage.$count]: { $sum: 1 } } }, { $project: { _id: 0 } }];
    if (stage.$facet && typeof stage.$facet === "object") {
      const facets = Object.fromEntries(Object.entries(stage.$facet as Doc).map(([k, p]) => [k, Array.isArray(p) ? rewriteCount(p) : p]));
      return [{ ...stage, $facet: facets }];
    }
    for (const key of ["$lookup", "$unionWith"]) {
      const spec = stage[key] as Doc | undefined;
      if (spec && typeof spec === "object" && Array.isArray(spec.pipeline)) return [{ ...stage, [key]: { ...spec, pipeline: rewriteCount(spec.pipeline as Doc[]) } }];
    }
    return [stage];
  });
}

type IncludeTree = Map<string, IncludeTree | true>;

/**
 * A pure inclusion projection ({a: 1, "b.c": 1}, optionally _id: 0) as a
 * path tree, or null for anything else (exclusions, operators, literals),
 * which mingo handles.
 */
function inclusionTree(projection: Doc): { tree: IncludeTree; withId: boolean } | null {
  const tree: IncludeTree = new Map();
  let withId = true;
  for (const [path, v] of Object.entries(projection)) {
    if (path === "_id" && (v === 0 || v === false)) {
      withId = false;
      continue;
    }
    if (!(v === 1 || v === true) || path.includes("$")) return null;
    const parts = path.split(".");
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const cur = node.get(parts[i]);
      if (last) node.set(parts[i], true);
      else if (cur === true) break;
      else {
        const next: IncludeTree = cur ?? new Map();
        node.set(parts[i], next);
        node = next;
      }
    }
  }
  if (!tree.size) return null;
  return { tree, withId };
}

const isPlainObject = (v: unknown): v is Doc => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * MongoDB inclusion projection: keeps the document's own field order, keeps
 * an embedded document whose selected children are absent as {}, applies a
 * sub-path to each object in an array and drops non-objects there.
 */
function includeFields(doc: Doc, tree: IncludeTree, withId: boolean): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === "_id" && withId && !tree.has("_id")) {
      out._id = v;
      continue;
    }
    const spec = tree.get(k);
    if (!spec) continue;
    if (spec === true) out[k] = v;
    else if (isPlainObject(v)) out[k] = includeFields(v, spec, false);
    else if (Array.isArray(v)) out[k] = projectArray(v, spec);
  }
  return out;
}

function projectArray(arr: unknown[], spec: IncludeTree): unknown[] {
  const out: unknown[] = [];
  for (const el of arr) {
    if (isPlainObject(el)) out.push(includeFields(el, spec, false));
    else if (Array.isArray(el)) out.push(projectArray(el, spec));
  }
  return out;
}

/** Answers the read queries of a collection without a table: no rows. */
const EMPTY_TABLE: Queryable = {
  async query(text: string) {
    if (/count\(\*\)/i.test(text)) return { rows: [{ n: 0 }], rowCount: 1 } as any;
    if (/SELECT EXISTS/i.test(text)) return { rows: [{ x: false }], rowCount: 1 } as any;
    return { rows: [], rowCount: 0 } as any;
  },
};

export class PgCollection {
  readonly table: TableDef;
  private readonly columns: Map<string, ColumnDef>;
  readonly qualified: string;
  private readonly insertColumns: string[];
  private readonly insertCasts: string[];
  /**
   * The collection has no table. MongoDB reads a collection that does not
   * exist as empty and only creates it on the first write; here reads are
   * empty and writes fail, since tables are owned by SQL migrations.
   */
  readonly missing: Error | null = null;

  constructor(
    private readonly store: PgStore,
    readonly dbName: string,
    readonly collectionName: string,
    schema: string,
  ) {
    try {
      this.table = store.registry.table(schema, collectionName);
    } catch (e) {
      this.missing = e as Error;
      this.table = { database: dbName, collection: collectionName, schema, table: collectionName, idKind: "objectId", columns: [], indexes: [] };
    }
    this.columns = new Map(this.table.columns.map((c) => [c.field, c]));
    this.qualified = `${qi(this.table.schema)}.${qi(this.table.table)}`;
    this.insertColumns = ["id", ...this.table.columns.map((c) => c.column), "_nulls", "_extra"];
    this.insertCasts = ["text", ...this.table.columns.map((c) => PG_TYPES[c.kind]), "text[]", "jsonb"];
  }

  get namespace(): string {
    return `${this.dbName}.${this.collectionName}`;
  }

  // ---------------------------------------------------------------- plumbing

  private async run<T>(session: PgSession | undefined, write: boolean, fn: (q: Queryable) => Promise<T>): Promise<T> {
    if (this.missing) {
      if (write) throw this.missing;
      return fn(EMPTY_TABLE);
    }
    try {
      if (session && session.inTransaction()) return await fn(await session.txClient());
      if (!write) return await fn(this.store.pool);
      const client: PooledClient = await this.store.pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        client.release();
        return result;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        client.release();
        throw e;
      }
    } catch (e) {
      throw translatePgError(e, this.table);
    }
  }

  private rowParams(row: Row): unknown[] {
    return this.insertColumns.map((col, i) => {
      const v = row[col];
      if (v === null || v === undefined) return null;
      return this.insertCasts[i] === "jsonb" ? JSON.stringify(v) : v;
    });
  }

  private async insertRows(q: Queryable, rows: Row[]): Promise<void> {
    if (!rows.length) return;
    const width = this.insertColumns.length;
    const params: unknown[] = [];
    const tuples = rows.map((row) => {
      const p = this.rowParams(row);
      const placeholders = p.map((v, i) => {
        params.push(v);
        return `$${params.length}::${this.insertCasts[i % width]}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await q.query(`INSERT INTO ${this.qualified} (${this.insertColumns.map(qi).join(",")}) VALUES ${tuples.join(",")}`, params);
  }

  private async writeRow(q: Queryable, oldId: string, row: Row): Promise<void> {
    const params = this.rowParams(row);
    const sets = this.insertColumns.map((c, i) => `${qi(c)} = $${i + 1}::${this.insertCasts[i]}`);
    params.push(oldId);
    await q.query(`UPDATE ${this.qualified} SET ${sets.join(", ")} WHERE id = $${params.length}::text`, params);
  }

  private async hasExtra(q: Queryable, fields: string[]): Promise<boolean> {
    if (!fields.length) return false;
    const r = await q.query(`SELECT EXISTS (SELECT 1 FROM ${this.qualified} WHERE _extra IS NOT NULL AND _extra ?| $1::text[]) AS x`, [fields]);
    return Boolean(r.rows[0]?.x);
  }

  private toDoc(row: Row): Doc {
    return rowToDoc(this.table, row);
  }

  /**
   * Returns the documents matching `filter`, honouring sort/skip/limit.
   * Pushes the whole query down to SQL when that is provably exact;
   * otherwise selects a superset and finishes in JavaScript.
   */
  private async select(q: Queryable, rawFilter: Filter | undefined, opts: { sort?: unknown; skip?: number; limit?: number; forUpdate?: boolean } = {}): Promise<Selected[]> {
    const filter = stripComment(rawFilter);
    const tr = new FilterTranslator(this.table, this.columns);
    const where = tr.translate(filter);
    const sort = normalizeSort(opts.sort);
    const sortSql = sortToSql(sort, this.table, this.columns);
    const skip = opts.skip && opts.skip > 0 ? opts.skip : 0;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;

    let sortPush = sortSql !== null;
    let limitPush = where.exact && sortPush && (skip > 0 || limit > 0);
    if (sortSql && sortSql.fields.length && (await this.hasExtra(q, sortSql.fields))) {
      sortPush = false;
      limitPush = false;
    }
    if (limitPush && (await this.hasExtra(q, [...tr.referencedFields]))) limitPush = false;

    const params = tr.params;
    let sql = `SELECT * FROM ${this.qualified} WHERE ${where.sql}`;
    // MongoDB returns unsorted results in insertion order; ObjectId order is the
    // closest stable equivalent (heap order changes on every UPDATE). A sort
    // finished in JavaScript is stable, so it keeps this order for equal keys.
    sql += sortPush && sortSql && sortSql.sql ? ` ORDER BY ${sortSql.sql}` : ` ORDER BY "id" COLLATE "C" ASC`;
    if (limitPush) {
      if (limit) sql += ` LIMIT ${params.add(limit, "bigint")}`;
      if (skip) sql += ` OFFSET ${params.add(skip, "bigint")}`;
    }
    if (opts.forUpdate) sql += " FOR UPDATE";

    const compact = compactParams(sql, params.values);
    const r = await q.query(compact.sql, compact.values);
    const matcher = new Query(filter, MINGO_OPTIONS as any);
    let out: Selected[] = [];
    for (const row of r.rows as Row[]) {
      const doc = this.toDoc(row);
      if (matcher.test(doc)) out.push({ row, doc });
    }
    if (sort && !sortPush) {
      const order = new Map(out.map((s) => [s.doc, s]));
      const sorted = new Query({}, MINGO_OPTIONS as any).find(out.map((s) => s.doc)).sort(sort as any).all() as Doc[];
      out = sorted.map((d) => order.get(d)!);
    }
    if (!limitPush && (skip || limit)) out = out.slice(skip, limit ? skip + limit : undefined);
    return out;
  }

  private project(docs: Doc[], projection: unknown): Doc[] {
    if (!projection || typeof projection !== "object" || Object.keys(projection).length === 0) return docs;
    const inclusion = inclusionTree(projection as Doc);
    if (inclusion) return docs.map((d) => includeFields(d, inclusion.tree, inclusion.withId));
    return new Query({}, MINGO_OPTIONS as any).find(docs, projection as any).all() as Doc[];
  }

  private async findDocs(filter: Filter | undefined, options: Opts): Promise<Doc[]> {
    const near = extractNear(filter);
    return this.run(options.session, false, async (q) => {
      if (near) {
        const candidates = (await this.select(q, near.rest)).map((s) => s.doc);
        let docs = applyNear(candidates, near.near).map(([d]) => d);
        const sort = normalizeSort(options.sort);
        if (sort) docs = new Query({}, MINGO_OPTIONS as any).find(docs).sort(sort as any).all() as Doc[];
        const skip = options.skip ?? 0;
        docs = docs.slice(skip, options.limit ? skip + options.limit : undefined);
        return this.project(docs, options.projection);
      }
      const docs = (await this.select(q, filter, { sort: options.sort, skip: options.skip, limit: options.limit })).map((s) => s.doc);
      return this.project(docs, options.projection);
    });
  }

  // ------------------------------------------------------------------ reads

  find(filter: Filter = {}, options: Opts = {}): PgCursor {
    return new PgCursor(() => this.findDocs(filter, options));
  }

  async findOne(filter: Filter = {}, options: Opts = {}): Promise<Doc | null> {
    const docs = await this.findDocs(filter, { ...options, limit: 1 });
    return docs[0] ?? null;
  }

  async countDocuments(filter: Filter = {}, options: Opts = {}): Promise<number> {
    return this.run(options.session, false, async (q) => {
      const tr = new FilterTranslator(this.table, this.columns);
      const where = tr.translate(stripComment(filter));
      if (where.exact && !(await this.hasExtra(q, [...tr.referencedFields]))) {
        let inner = `SELECT 1 FROM ${this.qualified} WHERE ${where.sql}`;
        if (options.limit) inner += ` LIMIT ${tr.params.add(options.limit, "bigint")}`;
        if (options.skip) inner += ` OFFSET ${tr.params.add(options.skip, "bigint")}`;
        const c = compactParams(`SELECT count(*)::bigint AS n FROM (${inner}) AS s`, tr.params.values);
        const r = await q.query(c.sql, c.values);
        return Number(r.rows[0].n);
      }
      return (await this.select(q, filter, { skip: options.skip, limit: options.limit })).length;
    });
  }

  async estimatedDocumentCount(options: Opts = {}): Promise<number> {
    return this.run(options.session, false, async (q) => Number((await q.query(`SELECT count(*)::bigint AS n FROM ${this.qualified}`)).rows[0].n));
  }

  async distinct(key: string, filter: Filter = {}, options: Opts = {}): Promise<unknown[]> {
    const docs = await this.findDocs(filter, options);
    const seen = new Map<string, unknown>();
    const collect = (value: unknown, parts: string[]) => {
      if (value === undefined) return;
      if (parts.length === 0) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) if (v !== undefined) seen.set(canonical({ v }), v);
        return;
      }
      if (Array.isArray(value)) value.forEach((el) => collect(el, parts));
      else if (value && typeof value === "object" && !isObjectId(value) && !(value instanceof Date)) collect((value as Doc)[parts[0]], parts.slice(1));
    };
    for (const d of docs) collect(d, key.split("."));
    return [...seen.values()];
  }

  aggregate(pipeline: Doc[] = [], options: Opts = {}): PgCursor {
    return new PgCursor(() => this.runAggregate(pipeline, options));
  }

  private async runAggregate(pipeline: Doc[], options: Opts): Promise<Doc[]> {
    for (const stage of pipeline) {
      if ("$out" in stage || "$merge" in stage) throw new PgDriverUnsupportedError("$out/$merge");
    }
    return this.run(options.session, false, async (q) => {
      const stages = [...pipeline];
      let docs: Doc[];
      if (stages[0] && "$geoNear" in stages[0]) {
        const spec = stages.shift()!.$geoNear as Doc;
        const field = spec.key ?? this.geoField();
        const point = pointOf(spec.near);
        if (!point) throw new Error("$geoNear requires a GeoJSON point");
        const candidates = (await this.select(q, spec.query ?? {})).map((s) => s.doc);
        const near = applyNear(candidates, { field, point, maxDistance: spec.maxDistance, minDistance: spec.minDistance });
        const mult = typeof spec.distanceMultiplier === "number" ? spec.distanceMultiplier : 1;
        docs = near.map(([d, dist]) => {
          const out = { ...d };
          if (spec.distanceField) setPath(out, spec.distanceField, dist * mult);
          if (spec.includeLocs) setPath(out, spec.includeLocs, getPath(d, field));
          return out;
        });
      } else {
        const first = stages[0];
        const match = first && "$match" in first ? (first.$match as Filter) : undefined;
        docs = (await this.select(q, match ?? {})).map((s) => s.doc);
      }
      const resolver = await this.lookupResolver(q, stages);
      return new Aggregator(rewriteCount(stages) as any, { ...MINGO_OPTIONS, collectionResolver: resolver } as any).run(docs) as Doc[];
    });
  }

  private geoField(): string {
    for (const idx of this.table.indexes) {
      for (const [k, v] of Object.entries(idx.keys)) if (v === "2dsphere" || v === "2d") return k;
    }
    throw new Error(`$geoNear on ${this.collectionName} needs a 2dsphere field`);
  }

  private async lookupResolver(q: Queryable, stages: Doc[]): Promise<(name: string) => Doc[]> {
    const names = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object" && !isObjectId(node) && !(node instanceof Date)) {
        for (const [k, v] of Object.entries(node as Doc)) {
          if ((k === "$lookup" || k === "$graphLookup") && v && typeof (v as Doc).from === "string") names.add((v as Doc).from);
          if (k === "$unionWith") names.add(typeof v === "string" ? v : (v as Doc).coll);
          walk(v);
        }
      }
    };
    walk(stages);
    const loaded = new Map<string, Doc[]>();
    for (const name of names) {
      const other = this.store.collection(this.dbName, name, this.table.schema);
      if (other.missing) continue; // MongoDB joins a nonexistent collection as empty
      const r = await q.query(`SELECT * FROM ${other.qualified} ORDER BY "id" COLLATE "C" ASC`);
      loaded.set(name, (r.rows as Row[]).map((row) => rowToDoc(other.table, row)));
    }
    return (name: string) => loaded.get(name) ?? [];
  }

  // ----------------------------------------------------------------- writes

  async insertOne(doc: Doc, options: Opts = {}): Promise<{ acknowledged: true; insertedId: unknown }> {
    if (doc._id === undefined) doc._id = new ObjectId();
    const row = docToRow(this.table, this.columns, doc);
    await this.run(options.session, true, (q) => this.insertRows(q, [row]));
    return { acknowledged: true, insertedId: doc._id };
  }

  async insertMany(docs: Doc[], options: Opts = {}): Promise<{ acknowledged: true; insertedCount: number; insertedIds: Record<number, unknown> }> {
    docs.forEach((d) => {
      if (d._id === undefined) d._id = new ObjectId();
    });
    const insertedIds: Record<number, unknown> = {};
    if (options.session?.inTransaction() || options.ordered !== false) {
      // Ordered: MongoDB keeps the documents inserted before a failure.
      for (let i = 0; i < docs.length; i++) {
        await this.run(options.session, true, (q) => this.insertRows(q, [docToRow(this.table, this.columns, docs[i])]));
        insertedIds[i] = docs[i]._id;
      }
    } else {
      let firstError: unknown = null;
      for (let i = 0; i < docs.length; i++) {
        try {
          await this.run(options.session, true, (q) => this.insertRows(q, [docToRow(this.table, this.columns, docs[i])]));
          insertedIds[i] = docs[i]._id;
        } catch (e) {
          firstError = firstError ?? e;
        }
      }
      if (firstError) throw firstError;
    }
    return { acknowledged: true, insertedCount: Object.keys(insertedIds).length, insertedIds };
  }

  /** Applies an update document / pipeline / replacement to `doc` in place-ish; returns the new doc. */
  private applyUpdate(doc: Doc, update: Doc | Doc[], filter: Filter, options: Opts, isInsert: boolean): Doc {
    const originalId = doc._id;
    let next: Doc;
    if (Array.isArray(update)) {
      const arr = [doc];
      mingoUpdateOne(arr, {}, update as any, {}, MINGO_OPTIONS as any);
      next = arr[0];
    } else if (Object.keys(update).some((k) => k.startsWith("$"))) {
      const modifier: Doc = { ...update };
      if (modifier.$setOnInsert) {
        if (isInsert) modifier.$set = { ...(modifier.$set ?? {}), ...modifier.$setOnInsert };
        delete modifier.$setOnInsert;
      }
      for (const op of Object.keys(modifier)) {
        if (!["$set", "$unset", "$inc", "$mul", "$min", "$max", "$push", "$pull", "$pullAll", "$addToSet", "$pop", "$rename", "$currentDate", "$bit"].includes(op)) {
          throw new PgDriverUnsupportedError(`Update operator ${op}`);
        }
        if (!modifier[op] || Object.keys(modifier[op]).length === 0) delete modifier[op];
      }
      next = doc;
      if (Object.keys(modifier).length) mingoUpdate(next, modifier as any, options.arrayFilters, filter as any, { cloneMode: "deep" } as any);
    } else {
      next = { _id: originalId, ...update };
      if (update._id === undefined) next._id = originalId;
    }
    if (!isInsert && canonical({ v: next._id }) !== canonical({ v: originalId })) {
      const { MongoServerError } = mongoose.mongo;
      throw new MongoServerError({ message: "Performing an update on the path '_id' would modify the immutable field '_id'", code: 66, codeName: "ImmutableField" } as any);
    }
    return next;
  }

  private upsertSeed(filter: Filter, update: Doc | Doc[], options: Opts): Doc {
    const seed: Doc = {};
    const addEqualities = (f: Filter) => {
      for (const [k, v] of Object.entries(f ?? {})) {
        if (k === "$and" && Array.isArray(v)) v.forEach(addEqualities);
        else if (k.startsWith("$")) continue;
        else if (v instanceof RegExp) continue;
        else if (v && typeof v === "object" && !Array.isArray(v) && !isObjectId(v) && !(v instanceof Date) && Object.keys(v).some((x) => x.startsWith("$"))) {
          if ("$eq" in v) setPath(seed, k, (v as Doc).$eq);
        } else setPath(seed, k, v);
      }
    };
    addEqualities(filter);
    const isReplacement = !Array.isArray(update) && !Object.keys(update).some((k) => k.startsWith("$"));
    let doc: Doc = isReplacement ? { ...(seed._id !== undefined ? { _id: seed._id } : {}), ...(update as Doc) } : seed;
    if (!isReplacement) doc = this.applyUpdate(doc, update, {}, options, true);
    if (doc._id === undefined) doc = { _id: new ObjectId(), ...doc };
    return doc;
  }

  private async updateImpl(
    filter: Filter,
    update: Doc | Doc[],
    options: Opts,
    mode: { multi: boolean; returnDoc?: "before" | "after" },
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId: unknown; upsertedCount: number; value: Doc | null; updatedExisting: boolean }> {
    return this.run(options.session, true, async (q) => {
      for (let attempt = 0; ; attempt++) {
        const selected = await this.select(q, filter, { forUpdate: true, sort: options.sort, limit: mode.multi ? undefined : 1 });
        if (selected.length === 0) {
          if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedId: null, upsertedCount: 0, value: null, updatedExisting: false };
          const doc = this.upsertSeed(filter, update, options);
          const row = docToRow(this.table, this.columns, doc);
          // A concurrent upsert may insert the same key first; MongoDB retries
          // the update in that case, so do the same once.
          await q.query("SAVEPOINT pg_driver_upsert");
          try {
            await this.insertRows(q, [row]);
            await q.query("RELEASE SAVEPOINT pg_driver_upsert");
          } catch (e) {
            await q.query("ROLLBACK TO SAVEPOINT pg_driver_upsert");
            if ((e as { code?: string }).code === "23505") {
              // Inside a snapshot transaction the winner is invisible: report a
              // write conflict so withTransaction() retries, as MongoDB does.
              if (options.session?.inTransaction()) throw Object.assign(e as object, { code: "40001" });
              if (attempt === 0) continue;
            }
            throw e;
          }
          return { matchedCount: 0, modifiedCount: 0, upsertedId: doc._id, upsertedCount: 1, value: mode.returnDoc === "after" ? this.toDoc(row) : null, updatedExisting: false };
        }
        let modified = 0;
        let value: Doc | null = null;
        for (const { row, doc } of selected) {
          const before = mode.returnDoc === "before" ? this.toDoc(row) : null;
          const next = this.applyUpdate(doc, update, filter, options, false);
          const newRow = docToRow(this.table, this.columns, next);
          if (this.insertColumns.some((c) => stable(newRow[c]) !== stable(row[c]))) {
            await this.writeRow(q, row.id, newRow);
            modified++;
          }
          if (mode.returnDoc) value = mode.returnDoc === "before" ? before : this.toDoc(newRow);
        }
        return { matchedCount: selected.length, modifiedCount: modified, upsertedId: null, upsertedCount: 0, value, updatedExisting: true };
      }
    });
  }

  async updateOne(filter: Filter, update: Doc | Doc[], options: Opts = {}) {
    const r = await this.updateImpl(filter, update, options, { multi: false });
    return { acknowledged: true, matchedCount: r.matchedCount, modifiedCount: r.modifiedCount, upsertedId: r.upsertedId, upsertedCount: r.upsertedCount };
  }

  async updateMany(filter: Filter, update: Doc | Doc[], options: Opts = {}) {
    const r = await this.updateImpl(filter, update, options, { multi: true });
    return { acknowledged: true, matchedCount: r.matchedCount, modifiedCount: r.modifiedCount, upsertedId: r.upsertedId, upsertedCount: r.upsertedCount };
  }

  async replaceOne(filter: Filter, replacement: Doc, options: Opts = {}) {
    if (Object.keys(replacement).some((k) => k.startsWith("$"))) throw new Error("Replacement document must not contain atomic operators");
    return this.updateOne(filter, replacement, options);
  }

  private modifyResult(r: { value: Doc | null; updatedExisting: boolean; upsertedId: unknown; matchedCount: number; upsertedCount: number }, options: Opts) {
    const value = r.value ? this.project([r.value], options.projection)[0] : null;
    if (!options.includeResultMetadata) return value;
    return {
      value,
      ok: 1,
      lastErrorObject: { n: r.matchedCount + r.upsertedCount, updatedExisting: r.updatedExisting, ...(r.upsertedId != null ? { upserted: r.upsertedId } : {}) },
    };
  }

  async findOneAndUpdate(filter: Filter, update: Doc | Doc[], options: Opts = {}) {
    const returnDoc = options.returnDocument === "after" || options.returnOriginal === false || options.new === true ? "after" : "before";
    const r = await this.updateImpl(filter, update, options, { multi: false, returnDoc });
    return this.modifyResult(r, options);
  }

  async findOneAndReplace(filter: Filter, replacement: Doc, options: Opts = {}) {
    return this.findOneAndUpdate(filter, replacement, options);
  }

  private async deleteImpl(filter: Filter, options: Opts, multi: boolean): Promise<Doc[]> {
    return this.run(options.session, true, async (q) => {
      const selected = await this.select(q, filter, { forUpdate: true, sort: options.sort, limit: multi ? undefined : 1 });
      if (selected.length) await q.query(`DELETE FROM ${this.qualified} WHERE id = ANY($1::text[])`, [selected.map((s) => s.row.id)]);
      return selected.map((s) => s.doc);
    });
  }

  async deleteOne(filter: Filter = {}, options: Opts = {}) {
    return { acknowledged: true, deletedCount: (await this.deleteImpl(filter, options, false)).length };
  }

  async deleteMany(filter: Filter = {}, options: Opts = {}) {
    return { acknowledged: true, deletedCount: (await this.deleteImpl(filter, options, true)).length };
  }

  async findOneAndDelete(filter: Filter, options: Opts = {}) {
    const docs = await this.deleteImpl(filter, options, false);
    const value = docs[0] ? this.project([docs[0]], options.projection)[0] : null;
    if (!options.includeResultMetadata) return value;
    return { value, ok: 1, lastErrorObject: { n: value ? 1 : 0 } };
  }

  async bulkWrite(operations: Doc[], options: Opts = {}) {
    const result = {
      ok: 1,
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      insertedIds: {} as Record<number, unknown>,
      upsertedIds: {} as Record<number, unknown>,
      isOk: () => true,
      hasWriteErrors: () => false,
      getWriteErrorCount: () => 0,
      getWriteErrors: () => [] as unknown[],
    };
    const ordered = options.ordered !== false;
    let firstError: unknown = null;
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const sub: Opts = { session: options.session };
      try {
        if (op.insertOne) {
          const doc = op.insertOne.document ?? op.insertOne;
          await this.insertOne(doc, sub);
          result.insertedCount++;
          result.insertedIds[i] = doc._id;
        } else if (op.updateOne || op.updateMany) {
          const spec = op.updateOne ?? op.updateMany;
          const r = await (op.updateOne ? this.updateOne : this.updateMany).call(this, spec.filter, spec.update, { ...sub, upsert: spec.upsert, arrayFilters: spec.arrayFilters, sort: spec.sort });
          result.matchedCount += r.matchedCount;
          result.modifiedCount += r.modifiedCount;
          if (r.upsertedId != null) {
            result.upsertedCount++;
            result.upsertedIds[i] = r.upsertedId;
          }
        } else if (op.replaceOne) {
          const r = await this.replaceOne(op.replaceOne.filter, op.replaceOne.replacement, { ...sub, upsert: op.replaceOne.upsert });
          result.matchedCount += r.matchedCount;
          result.modifiedCount += r.modifiedCount;
          if (r.upsertedId != null) {
            result.upsertedCount++;
            result.upsertedIds[i] = r.upsertedId;
          }
        } else if (op.deleteOne || op.deleteMany) {
          const spec = op.deleteOne ?? op.deleteMany;
          const r = await (op.deleteOne ? this.deleteOne : this.deleteMany).call(this, spec.filter, sub);
          result.deletedCount += r.deletedCount;
        } else {
          throw new PgDriverUnsupportedError(`bulkWrite operation ${Object.keys(op)[0]}`);
        }
      } catch (e) {
        if (ordered || options.session?.inTransaction()) throw e;
        firstError = firstError ?? e;
      }
    }
    if (firstError) throw firstError;
    return result;
  }

  // ------------------------------------------------------ indexes & metadata

  async createIndex(keys: Doc, options: Doc = {}): Promise<string> {
    return options.name ?? Object.entries(keys).map(([k, v]) => `${k}_${v}`).join("_");
  }
  async createIndexes(specs: Doc[]): Promise<string[]> {
    return specs.map((s) => s.name ?? Object.entries(s.key).map(([k, v]) => `${k}_${v}`).join("_"));
  }
  async dropIndex(): Promise<void> {}
  async dropIndexes(): Promise<void> {}
  listIndexes(): PgCursor {
    return new PgCursor(async () => this.indexList());
  }
  async indexes(): Promise<Doc[]> {
    return this.indexList();
  }
  async indexInformation(): Promise<Doc> {
    return Object.fromEntries(this.indexList().map((i) => [i.name, Object.entries(i.key)]));
  }
  async indexExists(names: string | string[]): Promise<boolean> {
    const have = new Set(this.indexList().map((i) => i.name));
    return (Array.isArray(names) ? names : [names]).every((n) => have.has(n));
  }
  private indexList(): Doc[] {
    return [
      { v: 2, key: { _id: 1 }, name: "_id_" },
      ...this.table.indexes.map((i) => ({
        v: 2,
        key: i.keys,
        name: i.name,
        ...(i.unique ? { unique: true } : {}),
        ...(i.sparse ? { sparse: true } : {}),
        ...(i.partialFilterExpression ? { partialFilterExpression: i.partialFilterExpression } : {}),
        ...(i.expireAfterSeconds !== undefined ? { expireAfterSeconds: i.expireAfterSeconds } : {}),
      })),
    ];
  }

  watch(): never {
    throw new PgDriverUnsupportedError("Change streams");
  }

  async drop(): Promise<never> {
    throw new PgDriverUnsupportedError("Dropping a collection");
  }
}
