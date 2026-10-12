import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { providerError } from "../domain/provider.errors";

/** Strict 24-hex check. Mongoose's isValidObjectId() also accepts any 12-character string. */
export const isObjectIdString = (value: unknown): value is string =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

export const toObjectId = (value: unknown, label = "id"): Types.ObjectId => {
  if (value instanceof Types.ObjectId) return value;
  if (!isObjectIdString(value))
    throw providerError.badRequest("INVALID_ID", `${label} is not a valid id`);
  return new Types.ObjectId(value);
};

export const idStr = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = (value as { _id?: unknown })._id ?? value;
  return String(raw);
};

export const sameId = (a: unknown, b: unknown): boolean =>
  a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

export interface Paged<T> {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export const paged = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): Paged<T> => ({
  success: true,
  data,
  meta: { page, limit, total, hasMore: page * limit < total },
});

export const uniqueLower = (values: Array<string | undefined | null>): string[] => [
  ...new Set(
    values
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean),
  ),
];

export const providerConfig = () => ({
  /** Dev fixtures are only ever visible outside production and only when explicitly enabled. */
  allowDevFixtures:
    process.env.NODE_ENV !== "production" &&
    process.env.PROVIDERS_ALLOW_DEV_FIXTURES === "true",
  holdMinutes: positive(process.env.PROVIDERS_HOLD_MINUTES, 15),
  maintenanceEnabled: process.env.PROVIDERS_MAINTENANCE_ENABLED !== "false",
});

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Human-readable random token from an alphabet without look-alike characters. */
export const randomBase32 = (length: number): string => {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no I, L, O, U, 0, 1
  let out = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
};
