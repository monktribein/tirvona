import { createHash } from "crypto";
import type { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";

/**
 * A restaurant's bank account number is stored encrypted ("enc:" + base64 JSON
 * with the last four digits kept beside it for display). Values saved before
 * encryption was added are plain digits and still read correctly.
 */
const PREFIX = "enc:";

export const encodeAccountNumber = (
  crypto: BankAccountCrypto,
  plain: string,
): string =>
  PREFIX +
  Buffer.from(
    JSON.stringify({ ...crypto.encrypt(plain), last4: plain.slice(-4) }),
  ).toString("base64");

export const decodeAccountNumber = (
  crypto: BankAccountCrypto,
  stored?: string | null,
): string => {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const { ciphertext, iv, tag } = JSON.parse(
    Buffer.from(stored.slice(PREFIX.length), "base64").toString("utf8"),
  );
  return crypto.decrypt({ ciphertext, iv, tag });
};

export const accountLast4 = (stored?: string | null): string => {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored.slice(-4);
  try {
    return String(
      JSON.parse(Buffer.from(stored.slice(PREFIX.length), "base64").toString("utf8"))
        .last4 ?? "",
    );
  } catch {
    return "";
  }
};

/** Short fingerprint of the payout destination, to know when saved provider ids are stale. */
export const bankFingerprint = (
  account: string,
  ifsc: string,
  holder: string,
): string =>
  createHash("sha256")
    .update(`${account}|${ifsc.toUpperCase()}|${holder.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);

export const hasBankDetails = (vendor: any): boolean =>
  Boolean(
    vendor?.bankAccountNumber &&
      vendor?.bankIfscCode &&
      vendor?.bankAccountHolderName,
  );
