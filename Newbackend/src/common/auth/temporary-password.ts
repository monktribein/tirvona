import { randomInt } from "node:crypto";

/** No 0/O, 1/l/I: a temporary password is read out over the phone. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * A strong one-time password an admin can read out to someone who forgot theirs,
 * e.g. "Kx7m-Rp4q-Zt9w" (12 random characters, about 69 bits). The account is
 * marked so its owner chooses their own password at the next sign-in.
 */
export function generateTemporaryPassword(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
    const value = `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /[2-9]/.test(value)) return value;
  }
}
