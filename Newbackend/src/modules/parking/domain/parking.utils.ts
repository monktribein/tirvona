import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { parkingQrSecretFromEnvironment } from "../../../config/environment";

export const toDateKey = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export const datesInSpan = (
  start: Date | string,
  end: Date | string,
): Date[] => {
  const result: Date[] = [];
  const last = toDateKey(end);
  for (
    let date = toDateKey(start);
    date <= last;
    date = new Date(date.getTime() + 86_400_000)
  ) {
    result.push(date);
    if (result.length > 400) break;
  }
  return result;
};

export const minutesBetween = (
  start: Date | string,
  end: Date | string,
): number =>
  Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  );

export const billableHours = (
  start: Date | string,
  end: Date | string,
  minimum = 1,
): number => Math.max(minimum, Math.ceil(minutesBetween(start, end) / 60));

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomCode = (length: number): string =>
  Array.from(
    randomBytes(length),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
export const parkingBookingReference = (): string => `TVN-PKG-${randomCode(8)}`;
export const parkingDisplayCode = (): string =>
  `${randomCode(4)}-${randomCode(4)}`;
export const parkingPartnerCode = (): string => `PKP-${randomCode(6)}`;
export const parkingTransactionReference = (): string =>
  `PKTXN-${randomCode(8)}`;
export const parkingPayoutBatchId = (): string =>
  `PKPAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomCode(4)}`;
export const parkingLocationSlug = (name: string, city = ""): string =>
  `${
    [name, city]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "parking"
  }-${randomCode(4).toLowerCase()}`;
export const normalizeVehicleNumber = (value: string): string =>
  value.toUpperCase().replace(/[\s.-]/g, "");

const qrKey = (): Buffer =>
  scryptSync(parkingQrSecretFromEnvironment(), "tirvona.parking.qr.v1", 32);
export const sealParkingQr = (payload: Record<string, unknown>): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", qrKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    "TVNPK1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
};
export const openParkingQr = (
  token: string,
): Record<string, unknown> | null => {
  try {
    const [prefix, iv, encrypted, tag] = token.split(".");
    if (prefix !== "TVNPK1" || !tag) return null;
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
export const hashParkingQr = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
