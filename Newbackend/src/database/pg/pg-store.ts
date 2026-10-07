/**
 * MongoClient / Db look-alikes over a Postgres pool. Mongoose's own
 * connection and collection classes sit on top of these unchanged.
 */
import { EventEmitter } from "events";
import { PgCollection } from "./pg-collection";
import { PgSession } from "./pg-session";
import type { PgPool } from "./pool";
import type { Registry } from "./registry";
import { RegistryIndex, PG_TYPES } from "./registry";
import { qi } from "./sql-filter";

export class PgStore {
  readonly registry: RegistryIndex;
  private readonly cache = new Map<string, PgCollection>();

  constructor(
    readonly pool: PgPool,
    registry: Registry,
  ) {
    this.registry = new RegistryIndex(registry);
  }

  collection(dbName: string, name: string, schema = this.registry.schemaForDb(dbName)): PgCollection {
    const key = `${schema}.${name}`;
    let c = this.cache.get(key);
    if (!c) {
      c = new PgCollection(this, dbName, name, schema);
      this.cache.set(key, c);
    }
    return c;
  }

  private schemaChecked: Promise<void> | null = null;

  /**
   * Fails fast when the database does not have the layout this driver was
   * generated for (sql/0001_app_schema.sql): a missing table/column, a
   * different column type, or text columns without COLLATE "C" (string sort and
   * range semantics would silently differ from MongoDB). Runs once per process.
   */
  verifySchema(): Promise<void> {
    this.schemaChecked ??= this.checkSchema().catch((e) => {
      this.schemaChecked = null;
      throw e;
    });
    return this.schemaChecked;
  }

  private async checkSchema(): Promise<void> {
    const tables = this.registry.registry.tables;
    const { rows } = await this.pool.query(
      `SELECT n.nspname s, c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) typ, coalesce(co.collname, '') coll
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_collation co ON co.oid = a.attcollation AND a.attcollation <> 0
        WHERE n.nspname = ANY($1::text[]) AND a.attnum > 0 AND NOT a.attisdropped`,
      [[...new Set(tables.map((t) => t.schema))]],
    );
    const actual = new Map((rows as { s: string; t: string; col: string; typ: string; coll: string }[]).map((r) => [`${r.s}.${r.t}.${r.col}`, r]));
    const typeName: Record<string, string> = { timestamptz: "timestamp with time zone", "timestamptz[]": "timestamp with time zone[]" };
    const problems: string[] = [];
    for (const t of tables) {
      const expected = [
        { column: "id", type: "text" },
        { column: "_nulls", type: "text[]" },
        { column: "_extra", type: "jsonb" },
        ...t.columns.map((c) => ({ column: c.column, type: PG_TYPES[c.kind] })),
      ];
      for (const e of expected) {
        const a = actual.get(`${t.schema}.${t.table}.${e.column}`);
        const want = typeName[e.type] ?? e.type;
        if (!a) problems.push(`${t.schema}.${t.table}.${e.column} missing`);
        else if (a.typ !== want) problems.push(`${t.schema}.${t.table}.${e.column} is ${a.typ}, expected ${want}`);
        else if ((want === "text" || want === "text[]") && e.column !== "_nulls" && a.coll !== "C") {
          problems.push(`${t.schema}.${t.table}.${e.column} must be COLLATE "C"`);
        }
      }
    }
    if (problems.length) {
      throw new Error(
        `Postgres schema does not match the Tirvona driver (${problems.length} problem(s)); ` +
          `run npm run db:verify / npm run db:migrate. First: ${problems.slice(0, 5).join("; ")}`,
      );
    }
  }

  /**
   * Replaces MongoDB TTL indexes: deletes rows whose TTL date is older than
   * expireAfterSeconds. MongoDB's TTL monitor runs every 60 seconds too.
   */
  async sweepExpired(): Promise<number> {
    let deleted = 0;
    for (const t of this.registry.registry.tables) {
      for (const idx of t.indexes) {
        if (idx.expireAfterSeconds === undefined || !idx.enforced) continue;
        const field = Object.keys(idx.keys)[0];
        const col = t.columns.find((c) => c.field === field);
        if (!col || PG_TYPES[col.kind] !== "timestamptz") continue;
        const r = await this.pool.query(
          `DELETE FROM ${qi(t.schema)}.${qi(t.table)} WHERE ${qi(col.column)} < now() - make_interval(secs => $1::double precision)`,
          [idx.expireAfterSeconds],
        );
        deleted += r.rowCount ?? 0;
      }
    }
    return deleted;
  }
}

export class PgDb {
  constructor(
    private readonly store: PgStore,
    readonly databaseName: string,
  ) {}

  get namespace() {
    return this.databaseName;
  }

  collection(name: string): PgCollection {
    return this.store.collection(this.databaseName, name);
  }

  async createCollection(name: string): Promise<PgCollection> {
    return this.collection(name);
  }

  async listCollections(filter: Record<string, unknown> = {}) {
    const schema = this.store.registry.schemaForDb(this.databaseName);
    const names = this.store.registry.registry.tables
      .filter((t) => t.schema === schema && (!filter.name || filter.name === t.collection))
      .map((t) => ({ name: t.collection, type: "collection" }));
    return { toArray: async () => names };
  }

  async collections(): Promise<PgCollection[]> {
    const list = await (await this.listCollections()).toArray();
    return list.map((c) => this.collection(c.name));
  }

  admin() {
    return {
      ping: async () => {
        await this.store.pool.query("SELECT 1");
        return { ok: 1 };
      },
      command: async (cmd: Record<string, unknown>) => {
        if ("ping" in cmd) return this.admin().ping();
        throw new Error(`admin command ${Object.keys(cmd)[0]} is not supported by the Postgres driver`);
      },
      listDatabases: async () => ({
        databases: Object.keys(this.store.registry.registry.databases).map((name) => ({ name })),
      }),
    };
  }

  async command(cmd: Record<string, unknown>) {
    return this.admin().command(cmd);
  }
}

export class PgMongoClient extends EventEmitter {
  private readonly dbs = new Map<string, PgDb>();
  private ttlTimer: NodeJS.Timeout | null = null;
  /** Mongoose reads these when wiring a client into a connection. */
  readonly topology = { description: { type: "Single" } };
  readonly s: { options: { dbName: string | undefined; hosts: { host: string; port: number }[] } };
  _closeCalled = false;

  constructor(
    readonly store: PgStore,
    defaultDbName: string | undefined,
    private readonly options: { ttlSweep?: boolean; verifySchema?: boolean } = {},
  ) {
    super();
    this.setMaxListeners(0);
    this.s = { options: { dbName: defaultDbName, hosts: [{ host: "postgres", port: 5432 }] } };
  }

  async connect(): Promise<this> {
    await this.store.pool.query("SELECT 1");
    if (this.options.verifySchema !== false) await this.store.verifySchema();
    if (this.options.ttlSweep && !this.ttlTimer) {
      this.ttlTimer = setInterval(() => {
        this.store.sweepExpired().catch((e: Error) => {
          console.warn(`[postgres-driver] TTL sweep failed: ${e.message}`);
        });
      }, 60_000);
      this.ttlTimer.unref();
    }
    return this;
  }

  db(name?: string): PgDb {
    const key = name ?? this.s.options.dbName ?? "";
    let db = this.dbs.get(key);
    if (!db) {
      db = new PgDb(this.store, key);
      this.dbs.set(key, db);
    }
    return db;
  }

  startSession(options: Record<string, unknown> = {}): PgSession {
    return new PgSession(this.store.pool, options);
  }

  async withSession<T>(fn: (session: PgSession) => Promise<T>): Promise<T> {
    const session = this.startSession();
    try {
      return await fn(session);
    } finally {
      await session.endSession();
    }
  }

  async close(): Promise<void> {
    this._closeCalled = true;
    if (this.ttlTimer) clearInterval(this.ttlTimer);
    this.ttlTimer = null;
  }
}
