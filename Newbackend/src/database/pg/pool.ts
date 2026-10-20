import { recordQuery } from "../../common/perf/request-perf";

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
    // Idle connections are kept for 5 minutes (was 30 s) so quiet periods do not
    // force a new TLS + pooler-auth handshake on the next request, and TCP
    // keep-alive stops the pooler/NAT from silently dropping them meanwhile.
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 300_000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  // node-postgres reports a broken idle connection on the pool; unhandled, it would crash the process.
  pool.on("error", (error: Error) => console.error(`[pg-pool] idle connection error: ${error.message}`));
  return withQueryTiming(withConnectionRetry(pool as PgPool));
}

/** Feeds per-request query count/time to the opt-in PERF_LOG profiler. No-op unless PERF_LOG=true. */
function withQueryTiming(pool: PgPool): PgPool {
  if (process.env.PERF_LOG !== "true") return pool;
  const timed = async (run: () => Promise<QueryResult>): Promise<QueryResult> => {
    const start = process.hrtime.bigint();
    try {
      return await run();
    } finally {
      recordQuery(Number(process.hrtime.bigint() - start) / 1e6);
    }
  };
  return {
    query: (text, params) => timed(() => pool.query(text, params)),
    connect: async () => {
      const client = await pool.connect();
      return { query: (text, params) => timed(() => client.query(text, params)), release: (e) => client.release(e) };
    },
    end: () => pool.end(),
  };
}

/**
 * Supabase's pooler refuses new sessions while it is at its client limit
 * ("EMAXCONNSESSION ... max clients reached", or Postgres 53300). That is
 * momentary under a burst, so acquiring a connection is retried with a short
 * backoff instead of failing the request. Only connection *acquisition* is
 * retried: the refusal happens before any statement runs, so a retry can
 * never execute a write twice.
 */
const RETRY_DELAYS_MS = [150, 400, 1_000, 2_000];

export const isConnectionLimitError = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "53300" ||
    /EMAXCONNSESSION|max clients reached|too many clients|remaining connection slots are reserved/i.test(
      String(e?.message ?? ""),
    )
  );
};

async function retrying<T>(attempt: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= RETRY_DELAYS_MS.length || !isConnectionLimitError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
    }
  }
}

export function withConnectionRetry(pool: PgPool): PgPool {
  return {
    connect: () => retrying(() => pool.connect()),
    // pool.query acquires, runs and releases in one call; a limit refusal comes from the acquire step.
    query: (text, params) => retrying(() => pool.query(text, params)),
    end: () => pool.end(),
  };
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
