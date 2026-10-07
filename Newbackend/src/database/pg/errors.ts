/**
 * Maps Postgres errors onto the MongoDB driver errors the application and
 * Mongoose already understand, so existing error handling keeps working:
 *  - unique violation      -> MongoServerError code 11000 (duplicate key)
 *  - serialization/deadlock -> WriteConflict (112) labelled TransientTransactionError,
 *                              which session.withTransaction() retries.
 */
import mongoose from "mongoose";
import type { TableDef } from "./registry";

const { MongoServerError } = mongoose.mongo;

export function translatePgError(error: unknown, table?: TableDef): unknown {
  const e = error as { code?: string; message?: string; detail?: string; constraint?: string };
  if (!e || typeof e !== "object" || typeof e.code !== "string") return error;

  if (e.code === "23505") {
    const keyValue: Record<string, unknown> = {};
    const m = /Key \((.+)\)=\((.*)\) already exists/.exec(e.detail ?? "");
    if (m) {
      const cols = m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      const vals = m[2].split(",").map((s) => s.trim());
      cols.forEach((c, i) => {
        const field = c === "id" ? "_id" : table?.columns.find((x) => x.column === c)?.field ?? c;
        keyValue[field] = vals[i];
      });
    }
    const keyPattern = Object.fromEntries(Object.keys(keyValue).map((k) => [k, 1]));
    const err = new MongoServerError({
      message:
        `E11000 duplicate key error collection: ${table ? `${table.database}.${table.collection}` : "unknown"} ` +
        `index: ${e.constraint ?? "unknown"} dup key: ${JSON.stringify(keyValue)}`,
      code: 11000,
      codeName: "DuplicateKey",
      keyPattern,
      keyValue,
    } as any);
    return err;
  }

  if (e.code === "40001" || e.code === "40P01" || e.code === "55P03") {
    const err = new MongoServerError({
      message: `WriteConflict: ${e.message ?? "concurrent update"}`,
      code: 112,
      codeName: "WriteConflict",
    } as any);
    err.addErrorLabel("TransientTransactionError");
    return err;
  }
  return error;
}

export function isTransientTransactionError(error: unknown): boolean {
  const e = error as { hasErrorLabel?: (label: string) => boolean };
  return typeof e?.hasErrorLabel === "function" && e.hasErrorLabel("TransientTransactionError");
}

export class PgDriverUnsupportedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not supported by the Postgres storage driver`);
    this.name = "PgDriverUnsupportedError";
  }
}
