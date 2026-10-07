/**
 * A MongoDB ClientSession look-alike backed by a Postgres transaction.
 *
 * Transactions run at REPEATABLE READ, the closest match to MongoDB's
 * snapshot transactions: a concurrent write to the same row aborts with a
 * serialization failure, which is surfaced as a TransientTransactionError so
 * withTransaction() retries the whole callback — exactly what the MongoDB
 * driver does on WriteConflict.
 */
import { randomUUID } from "crypto";
import { isTransientTransactionError, translatePgError } from "./errors";
import type { PgPool, PooledClient } from "./pool";

type TxState =
  | "NO_TRANSACTION"
  | "STARTING_TRANSACTION"
  | "TRANSACTION_IN_PROGRESS"
  | "TRANSACTION_COMMITTED"
  | "TRANSACTION_ABORTED";

const MAX_RETRY_MS = 120_000;

export class PgSession {
  readonly id = { id: randomUUID() };
  hasEnded = false;
  readonly transaction: { state: TxState; isActive: boolean; options: Record<string, unknown> } = {
    state: "NO_TRANSACTION",
    get isActive() {
      return this.state === "STARTING_TRANSACTION" || this.state === "TRANSACTION_IN_PROGRESS";
    },
    options: {},
  };
  /** Mongoose stores per-session bookkeeping on the session object. */
  [key: symbol]: unknown;

  private client: PooledClient | null = null;
  private clientPromise: Promise<PooledClient> | null = null;

  constructor(
    private readonly pool: PgPool,
    readonly clientOptions: Record<string, unknown> = {},
  ) {}

  inTransaction(): boolean {
    return this.transaction.isActive;
  }

  startTransaction(options: Record<string, unknown> = {}): void {
    if (this.hasEnded) throw new Error("Cannot use a session that has ended");
    if (this.inTransaction()) throw new Error("Transaction already in progress");
    this.transaction.state = "STARTING_TRANSACTION";
    this.transaction.options = options;
  }

  /** Returns the transaction's connection, opening the transaction on first use. */
  async txClient(): Promise<PooledClient> {
    if (!this.inTransaction()) throw new Error("No transaction in progress");
    if (this.client) return this.client;
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const c = await this.pool.connect();
        try {
          await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
        } catch (e) {
          c.release(true);
          throw translatePgError(e);
        }
        this.client = c;
        this.transaction.state = "TRANSACTION_IN_PROGRESS";
        return c;
      })();
    }
    return this.clientPromise;
  }

  private async finish(sql: "COMMIT" | "ROLLBACK", state: TxState): Promise<void> {
    const pending = this.clientPromise;
    this.clientPromise = null;
    const c = this.client ?? (pending ? await pending.catch(() => null) : null);
    this.client = null;
    this.transaction.state = state;
    if (!c) return;
    try {
      await c.query(sql);
      c.release();
    } catch (e) {
      c.release(true);
      if (sql === "COMMIT") {
        this.transaction.state = "TRANSACTION_ABORTED";
        throw translatePgError(e);
      }
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.inTransaction()) {
      if (this.transaction.state === "TRANSACTION_COMMITTED") return;
      throw new Error("No transaction started");
    }
    await this.finish("COMMIT", "TRANSACTION_COMMITTED");
  }

  async abortTransaction(): Promise<void> {
    if (!this.inTransaction()) {
      if (this.transaction.state === "TRANSACTION_ABORTED") return;
      throw new Error("No transaction started");
    }
    await this.finish("ROLLBACK", "TRANSACTION_ABORTED");
  }

  async withTransaction<T>(fn: (session: PgSession) => Promise<T>, options: Record<string, unknown> = {}): Promise<T> {
    const started = Date.now();
    for (;;) {
      this.startTransaction(options);
      let result: T;
      try {
        result = await fn(this);
      } catch (error) {
        if (this.inTransaction()) await this.abortTransaction();
        if (isTransientTransactionError(error) && Date.now() - started < MAX_RETRY_MS) continue;
        throw error;
      }
      if (!this.inTransaction()) return result; // callback committed or aborted explicitly
      try {
        await this.commitTransaction();
        return result;
      } catch (error) {
        if (isTransientTransactionError(error) && Date.now() - started < MAX_RETRY_MS) continue;
        throw error;
      }
    }
  }

  async endSession(): Promise<void> {
    if (this.inTransaction()) await this.abortTransaction();
    this.hasEnded = true;
  }

  /** MongoDB sessions refuse BSON serialization; keep parity. */
  toBSON(): never {
    throw new Error("ClientSession cannot be serialized to BSON.");
  }

  // Read/causal-consistency knobs from the MongoDB API are accepted and ignored.
  advanceClusterTime(): void {}
  advanceOperationTime(): void {}
  equals(other: unknown): boolean {
    return other === this;
  }
}

export function isPgSession(value: unknown): value is PgSession {
  return value instanceof PgSession;
}
