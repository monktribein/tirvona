import crypto from 'crypto';

// Reference generators for the ashram booking engine.
//
// Both use crypto rather than Math.random: `checkInCode` is the credential a
// guest presents at the reception desk, and `bookingId` is quoted in support
// calls, so neither may be guessable from a neighbouring booking.
//
// Deliberately separate from modules/parking/utils/parkingIds.js. That module
// owns its own collections and its own reference format; keeping the two apart
// means either can change without breaking the other.

// Crockford base32 minus I, L, O and U — no character pairs a human can confuse
// when reading a reference off a screen or over the phone. 32 divides 256
// exactly, so indexing random bytes into it carries no modulo bias.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** `length` cryptographically random characters from the unambiguous alphabet. */
const randomCode = (length) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
};

/** Encode a non-negative integer in the same unambiguous alphabet. */
const encodeBase32 = (value) => {
  let n = value;
  let out = '';
  do {
    out = ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  } while (n > 0);
  return out;
};

/**
 * Customer-facing booking reference, e.g. `TVN-1Y6ND4KX0-7H2KQ`.
 *
 * Time prefix plus random suffix rather than pure randomness, because
 * Booking.bookingId carries a unique index: a birthday collision on eight
 * random base32 characters reaches roughly 45% at a million rows, which would
 * turn the index into a routine failure path. Here two references can only
 * collide when generated in the SAME millisecond AND drawing the same
 * five-character suffix (1 in 33.5M), so the unique index stays a backstop.
 *
 * 19 characters, comfortably inside Razorpay's 40-character `receipt` limit.
 */
export const generateBookingId = () => `TVN-${encodeBase32(Date.now())}-${randomCode(5)}`;

/**
 * Reception-desk check-in code: a six-digit STRING.
 *
 * String rather than Number is load-bearing — verifyCheckin compares it with
 * `!==` against the value the reception form posts, which is always a string.
 * The 100000..999999 range means the code never carries a leading zero for a
 * guest to drop when reading it out, and matches the shape of the codes already
 * seeded on existing bookings.
 */
export const generateCheckInCode = () => String(crypto.randomInt(100000, 1000000));

export default { generateBookingId, generateCheckInCode };
