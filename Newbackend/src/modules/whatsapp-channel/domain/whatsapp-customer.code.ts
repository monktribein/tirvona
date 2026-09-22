import { randomUUID } from "node:crypto";

/**
 * Public identifier for a WhatsApp-only customer (one with no website
 * account — see `WhatsAppIdentityService.resolveIdentity`).
 *
 * Format: `WAPP-YYYYMMDD-XXXXXX`
 *   - `YYYYMMDD` is the calendar date (UTC) the identity was first created —
 *     immutable, and readable at a glance by support without a lookup.
 *   - `XXXXXX` is a 6-character globally unique suffix. It is not a sequence:
 *     collisions are avoided the same way every other Tirvona reference does
 *     it (see `financialReference` in booking.utils.ts) — generate, and let
 *     the unique index on `wappId` reject a clash so the caller can retry
 *     with a fresh suffix. That keeps this file free of any shared counter
 *     state, so nothing about issuing one WAPP id can contend with issuing
 *     another for a different number.
 *
 * The code is immutable once issued (`immutable: true` on the schema field)
 * and the MongoDB `_id` behind the document is untouched by any of this — it
 * remains an ordinary auto-generated ObjectId, exactly as for every other
 * collection in this codebase.
 *
 * The phone number itself is deliberately NOT the identifier: it is personal
 * data that ends up in owner and admin views, and a carrier can in principle
 * reassign it, whereas this code is stable identity, never reused, and safe
 * to read aloud to a support agent.
 */

export const WHATSAPP_CUSTOMER_CODE_PREFIX = "WAPP";

/** Length of the unique suffix segment. */
export const WHATSAPP_CUSTOMER_SUFFIX_LENGTH = 6;

export const WHATSAPP_CUSTOMER_CODE_PATTERN = /^WAPP-\d{8}-[A-Z0-9]{6}$/;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** `YYYYMMDD` for the given instant, in UTC. */
export const whatsAppCustomerDateStamp = (createdAt: Date): string =>
  `${createdAt.getUTCFullYear()}${pad2(createdAt.getUTCMonth() + 1)}${pad2(createdAt.getUTCDate())}`;

/**
 * A fresh candidate suffix. Not guaranteed unique by construction — the
 * caller is expected to persist it behind the unique index on `wappId` and
 * regenerate on a duplicate-key error, exactly like `financialReference` and
 * `bookingReference` already do elsewhere in this codebase.
 */
export const generateWhatsAppCustomerSuffix = (): string =>
  randomUUID().replace(/-/g, "").slice(0, WHATSAPP_CUSTOMER_SUFFIX_LENGTH).toUpperCase();

/**
 * Renders `WAPP-YYYYMMDD-XXXXXX` from a creation instant and a suffix.
 *
 * Throws on a malformed suffix rather than silently coercing it, so a bug
 * upstream that produces the wrong shape is caught here instead of writing an
 * identifier support cannot trust.
 */
export const formatWhatsAppCustomerCode = (
  createdAt: Date,
  suffix: string,
): string => {
  const normalizedSuffix = String(suffix ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalizedSuffix))
    throw new RangeError(
      `WhatsApp customer suffix must be ${WHATSAPP_CUSTOMER_SUFFIX_LENGTH} alphanumeric characters, received "${suffix}".`,
    );
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime()))
    throw new RangeError("WhatsApp customer creation date is invalid.");
  return `${WHATSAPP_CUSTOMER_CODE_PREFIX}-${whatsAppCustomerDateStamp(createdAt)}-${normalizedSuffix}`;
};

/**
 * Reads the creation date embedded in a code, or null if the code is not
 * shaped like one this system issues, including an impossible calendar date
 * (e.g. `WAPP-20260231-...`) that `Date.UTC` would otherwise silently roll
 * over into March.
 */
export const whatsAppCustomerDateFromCode = (code: unknown): Date | null => {
  const value = String(code ?? "").trim().toUpperCase();
  const match = /^WAPP-(\d{4})(\d{2})(\d{2})-[A-Z0-9]{6}$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date;
};

/** True when `value` is shaped like a code this system could have issued. */
export const isWhatsAppCustomerCode = (value: unknown): boolean =>
  WHATSAPP_CUSTOMER_CODE_PATTERN.test(String(value ?? "").trim().toUpperCase()) &&
  whatsAppCustomerDateFromCode(value) !== null;
