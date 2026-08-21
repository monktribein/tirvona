import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { eventQrSecretFromEnvironment } from "../../../config/environment";

export const DEFAULT_EVENT_TIMEZONE = "Asia/Kolkata";

export const toDateKey = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

/** How far the named zone runs ahead of UTC at a given instant. */
const zoneOffsetMs = (timeZone: string, at: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour") % 24,
      value("minute"),
      value("second"),
    ) - at.getTime()
  );
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isClockTime = (value: string): boolean => HHMM.test(value);

/**
 * The UTC instant a wall-clock event time refers to.
 *
 * `startTime` is the time on the ashram's notice board, so it is read in the
 * event's own timezone. Treating it as UTC would shift an evening mahotsav into
 * the small hours for every viewer in India.
 */
export const combineDateAndTime = (
  date: Date | string,
  clock: string,
  timeZone: string = DEFAULT_EVENT_TIMEZONE,
): Date => {
  const match = HHMM.exec(clock);
  if (!match) throw new Error(`Invalid clock time: ${clock}`);
  const day = toDateKey(date);
  const wallClockAsUtc =
    day.getTime() + Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000;
  const guess = wallClockAsUtc - zoneOffsetMs(timeZone, new Date(wallClockAsUtc));
  return new Date(wallClockAsUtc - zoneOffsetMs(timeZone, new Date(guess)));
};

/** Every day the event runs, inclusive of both ends, capped at a year. */
export const datesInRange = (
  start: Date | string,
  end: Date | string,
): Date[] => {
  const result: Date[] = [];
  const last = toDateKey(end);
  for (
    let cursor = toDateKey(start);
    cursor <= last;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    result.push(cursor);
    if (result.length >= 366) break;
  }
  return result;
};

export const runsOnDate = (
  event: { startDate?: Date | string; endDate?: Date | string },
  date: Date | string,
): boolean => {
  const day = toDateKey(date);
  if (event.startDate && day < toDateKey(event.startDate)) return false;
  if (event.endDate && day > toDateKey(event.endDate)) return false;
  return true;
};

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomCode = (length: number): string =>
  Array.from(
    randomBytes(length),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");

export const eventRegistrationReference = (): string =>
  `TVN-EVT-${randomCode(8)}`;
export const eventDisplayCode = (): string =>
  `${randomCode(4)}-${randomCode(4)}`;

export const normalizeGateCode = (value: string): string | null => {
  const cleaned = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
  if (cleaned.length !== 8) return null;
  if (![...cleaned].every((character) => ALPHABET.includes(character)))
    return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
};

export const eventSlug = (name: string, city = ""): string =>
  `${
    [name, city]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event"
  }-${randomCode(4).toLowerCase()}`;

const qrKey = (): Buffer =>
  scryptSync(eventQrSecretFromEnvironment(), "tirvona.event.qr.v1", 32);

export const sealEventQr = (payload: Record<string, unknown>): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", qrKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    "TVNEV1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
};

export const openEventQr = (token: string): Record<string, unknown> | null => {
  try {
    const [prefix, iv, encrypted, tag] = token.split(".");
    if (prefix !== "TVNEV1" || !tag) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      qrKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const hashEventQr = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
