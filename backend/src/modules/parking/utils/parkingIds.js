import crypto from 'crypto';

// Reference generators for the parking module.
//
// All of them use crypto.randomBytes rather than Math.random: a booking
// reference and a display code are quoted over the phone and typed at a gate, so
// they must not be guessable from a neighbouring booking.

// Crockford base32 minus I, L, O and U — no character pairs a human can confuse
// when reading a code off a phone screen at a dark gate.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** `length` random characters from the unambiguous alphabet. */
const randomCode = (length) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
};

/** Visitor-facing booking reference, e.g. `TVN-PKG-7H2K9QD4`. */
export const generateBookingReference = () => `TVN-PKG-${randomCode(8)}`;

/** Short handle printed under the QR for a spoken read-out, e.g. `P4K2-9XQ7`. */
export const generateDisplayCode = () => `${randomCode(4)}-${randomCode(4)}`;

/** Partner account code, e.g. `PKP-3F9A2C`. */
export const generatePartnerCode = () => `PKP-${randomCode(6)}`;

/** Settlement batch id, e.g. `PKPAY-20260729-4B2E`. */
export const generatePayoutBatchId = (date = new Date()) => {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `PKPAY-${stamp}-${randomCode(4)}`;
};

/** Internal transaction reference, e.g. `PKTXN-9D3A1F0B`. */
export const generateTransactionReference = () => `PKTXN-${randomCode(8)}`;

/**
 * URL slug for a parking location. Appends a short random suffix so two
 * facilities with the same name in the same city cannot collide on the unique
 * slug index.
 */
export const generateLocationSlug = (name, city = '') => {
  const base = [name, city]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'parking'}-${randomCode(4).toLowerCase()}`;
};

export default {
  generateBookingReference,
  generateDisplayCode,
  generatePartnerCode,
  generatePayoutBatchId,
  generateTransactionReference,
  generateLocationSlug,
};
