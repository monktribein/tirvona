/**
 * Mongoose storage driver for Postgres (Supabase).
 *
 * enablePostgresDriver() must run before any Mongoose connection is created
 * (configureDatabase() in main.ts). Every Mongoose connection the app opens —
 * main, lead-collection, smart-contact — stores its data in Postgres.
 * Schemas, hooks, validation, casting and populate work unchanged.
 * The connection string Mongoose passes is a placeholder and is ignored.
 */
import mongoose from "mongoose";
import { PgStore, PgMongoClient } from "./pg-store";
import type { PgPool } from "./pool";
import { nodePgPool } from "./pool";
import type { Registry } from "./registry";

/* eslint-disable @typescript-eslint/no-require-imports */
const NativeConnection = require("mongoose/lib/drivers/node-mongodb-native/connection");
const NativeCollection = require("mongoose/lib/drivers/node-mongodb-native/collection");
const BulkWriteResult = require("mongoose/lib/drivers/node-mongodb-native/bulkWriteResult");
const STATES = require("mongoose/lib/connectionState");
/* eslint-enable @typescript-eslint/no-require-imports */

export interface PostgresDriverOptions {
  /** Postgres connection string (Supabase pooler URL). Ignored when `pool` is given. */
  connectionString?: string;
  /** Pre-built pool, e.g. PGlite in tests. */
  pool?: PgPool;
  registry: Registry;
  poolMax?: number;
  /** Run the TTL sweeper that replaces MongoDB TTL indexes (default true). */
  ttlSweep?: boolean;
}

let activeStore: PgStore | null = null;

export function activePostgresStore(): PgStore | null {
  return activeStore;
}

export function enablePostgresDriver(options: PostgresDriverOptions, instance: typeof mongoose = mongoose): PgStore {
  if (activeStore) return activeStore;
  const pool = options.pool ?? nodePgPool(requireString(options.connectionString), { max: options.poolMax });
  const store = new PgStore(pool, options.registry);
  activeStore = store;
  const ttlSweep = options.ttlSweep ?? true;

  function PgConnection(this: any, ...args: unknown[]) {
    NativeConnection.apply(this, args);
  }
  Object.setPrototypeOf(PgConnection.prototype, NativeConnection.prototype);

  PgConnection.prototype.createClient = async function createClient(this: any, uri: string, connectOptions: Record<string, any> = {}) {
    if (typeof uri !== "string") throw new mongoose.Error("The `uri` parameter to `openUri()` must be a string");
    const dbName: string | undefined = connectOptions?.dbName || undefined;
    if (connectOptions?.bufferCommands != null) this.config.bufferCommands = connectOptions.bufferCommands;
    // Indexes and tables are owned by SQL migrations, never created at runtime.
    this.config.autoIndex = false;
    this.config.autoCreate = false;
    this.readyState = STATES.connecting;
    this._connectionString = uri;
    if (dbName != null) this.$dbName = dbName;

    const client = new PgMongoClient(store, dbName, { ttlSweep: ttlSweep && dbName === undefined });
    this.client = client;
    try {
      await client.connect();
    } catch (e) {
      this.readyState = STATES.disconnected;
      throw e;
    }
    this.db = client.db(dbName);
    this.name = dbName ?? "";
    this.host = "postgres";
    this.port = 5432;
    this._closeCalled = false;
    this.onOpen();
    for (const db of this.otherDbs ?? []) {
      db.db = client.db(db.name);
      db.client = client;
      db.onOpen();
    }
    return this;
  };

  PgConnection.prototype.setClient = function setClient() {
    throw new mongoose.Error("setClient() is not supported with the Postgres driver");
  };

  PgConnection.prototype.doClose = async function doClose(this: any) {
    if (this.client) await this.client.close();
    return this;
  };

  instance.setDriver({
    Collection: NativeCollection,
    Connection: PgConnection,
    BulkWriteResult,
  } as any);
  return store;
}

/** Closes the shared pool. Call on application shutdown. */
export async function closePostgresDriver(): Promise<void> {
  if (activeStore) await activeStore.pool.end();
  activeStore = null;
}

function requireString(v: string | undefined): string {
  if (!v) throw new Error("SUPABASE_DB_URL is required");
  return v;
}

export { PgMongoClient };
