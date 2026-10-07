/**
 * Minimal connection abstraction so the driver runs on node-postgres
 * (Supabase) in production and on PGlite (embedded Postgres) in tests.
 */
export interface QueryResult {
  rows: any[];
  rowCount: number | null;
}

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
}

export interface PooledClient extends Queryable {
  release(error?: Error | boolean): void;
}

export interface PgPool extends Queryable {
  connect(): Promise<PooledClient>;
  end(): Promise<void>;
}

/** Wraps a node-postgres Pool. */
export function nodePgPool(connectionString: string, options: { max?: number; applicationName?: string } = {}): PgPool {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require("pg");
  // Return timestamptz/float8 natively; keep int8/numeric as strings (none are used by the registry).
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName ?? "tirvona-api",
    ssl: /sslmode=disable/.test(connectionString) || /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  return pool as PgPool;
}

/**
 * Wraps a PGlite instance. PGlite has a single session, so connect() hands
 * out a client that holds an exclusive lock until released — transactions
 * are serialized, which is fine for tests.
 */
export function pglitePool(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; affectedRows?: number }>; close?: () => Promise<void> }): PgPool {
  let chain: Promise<void> = Promise.resolve();
  let lockHeld = false;
  const waiting: (() => void)[] = [];
  const run = async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const r = await db.query(text, params as any[]);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  const acquire = () =>
    new Promise<void>((resolve) => {
      if (!lockHeld) {
        lockHeld = true;
        resolve();
      } else waiting.push(resolve);
    });
  const releaseLock = () => {
    const next = waiting.shift();
    if (next) next();
    else lockHeld = false;
  };
  return {
    async query(text, params) {
      // Pool-level queries also wait for any open transaction to finish.
      await acquire();
      try {
        return await run(text, params);
      } finally {
        releaseLock();
      }
    },
    async connect() {
      await acquire();
      let released = false;
      return {
        query: (text: string, params?: unknown[]) => {
          chain = chain.then(() => undefined);
          return run(text, params);
        },
        release: () => {
          if (released) return;
          released = true;
          releaseLock();
        },
      };
    },
    async end() {
      await db.close?.();
    },
  };
}
