import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { aartiQrSecretFromEnvironment } from "../../../config/environment";

export const toDateKey = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const minutesBetween = (
  start: Date | string,
  end: Date | string,
): number =>
  Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isClockTime = (value: string): boolean => HHMM.test(value);

export const DEFAULT_AARTI_TIMEZONE = "Asia/Kolkata";

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
  const wallClock = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    // Some ICU builds render midnight as hour 24 under hour12:false.
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return wallClock - at.getTime();
};

/**
 * The UTC instant a wall-clock aarti time refers to.
 *
 * `startTime` is the time printed on the ashram's board — "18:30" means half
 * past six *there*, not in UTC. Treating it as UTC shifts an evening aarti to
 * the small hours of the next day for every viewer in IST, so the session's own
 * timezone resolves the offset before the instant is stored or compared.
 */
export const combineDateAndTime = (
  date: Date | string,
  clock: string,
  timeZone: string = DEFAULT_AARTI_TIMEZONE,
): Date => {
  const match = HHMM.exec(clock);
  if (!match) throw new Error(`Invalid clock time: ${clock}`);
  const day = toDateKey(date);
  const wallClockAsUtc =
    day.getTime() + Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000;
  // Resolved twice so a DST boundary settles on the offset actually in force at
  // the resulting instant rather than the one at the naive first guess.
  const guess = wallClockAsUtc - zoneOffsetMs(timeZone, new Date(wallClockAsUtc));
  return new Date(wallClockAsUtc - zoneOffsetMs(timeZone, new Date(guess)));
};

export const weekdayOf = (date: Date | string): number =>
  toDateKey(date).getUTCDay();

export const runsOnDate = (
  session: { daysOfWeek?: number[]; startDate?: Date; endDate?: Date },
  date: Date | string,
): boolean => {
  const day = toDateKey(date);
  if (session.startDate && day < toDateKey(session.startDate)) return false;
  if (session.endDate && day > toDateKey(session.endDate)) return false;
  if (!session.daysOfWeek?.length) return true;
  return session.daysOfWeek.includes(day.getUTCDay());
};

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomCode = (length: number): string =>
  Array.from(
    randomBytes(length),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");

export const aartiBookingReference = (): string => `TVN-ART-${randomCode(8)}`;
export const aartiDisplayCode = (): string => `${randomCode(4)}-${randomCode(4)}`;
export const aartiTransactionReference = (): string => `ARTXN-${randomCode(8)}`;
export const aartiRefundReference = (): string => `ARREF-${randomCode(8)}`;

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

export const aartiSlug = (name: string, city = ""): string =>
  `${
    [name, city]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "aarti"
  }-${randomCode(4).toLowerCase()}`;

const qrKey = (): Buffer =>
  scryptSync(aartiQrSecretFromEnvironment(), "tirvona.aarti.qr.v1", 32);

export const sealAartiQr = (payload: Record<string, unknown>): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", qrKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    "TVNAR1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
};

export const openAartiQr = (token: string): Record<string, unknown> | null => {
  try {
    const [prefix, iv, encrypted, tag] = token.split(".");
    if (prefix !== "TVNAR1" || !tag) return null;
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

export const hashAartiQr = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

export const deriveStreamEmbed = (
  provider: string,
  url: string,
): { embedUrl: string; thumbnailUrl: string } => {
  if (provider === "youtube") {
    const id = YOUTUBE_ID.exec(url)?.[1];
    if (id)
      return {
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
  }
  if (provider === "facebook")
    return {
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`,
      thumbnailUrl: "",
    };
  if (provider === "vimeo") {
    const id = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url)?.[1];
    if (id)
      return {
        embedUrl: `https://player.vimeo.com/video/${id}`,
        thumbnailUrl: "",
      };
  }
  return { embedUrl: url, thumbnailUrl: "" };
};

export const isStreamLive = (
  stream: { startsAt?: Date | null; endsAt?: Date | null; isLive?: boolean },
  now = new Date(),
): boolean => {
  if (!stream.startsAt) return Boolean(stream.isLive);
  if (now < new Date(stream.startsAt)) return false;
  if (stream.endsAt && now > new Date(stream.endsAt)) return false;
  return true;
};
