import crypto from 'crypto';
import config from '../../../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking QR token sealing.
//
// A pass must be unforgeable and untamperable in the hands of the person
// holding it, so the payload is sealed with AES-256-GCM: the ciphertext hides
// the contents and the GCM auth tag makes any edit — a flipped byte, a swapped
// booking id, a stretched expiry — fail to open at all.
//
// This is a separate primitive from utils/encryption.js on purpose. That helper
// uses AES-256-CBC, which is unauthenticated: it would decrypt a tampered
// ciphertext into garbage rather than rejecting it. Modifying it to add a tag
// would change behaviour for the government-ID fields that already depend on
// it, so the parking module brings its own and leaves that file untouched.
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;
const TOKEN_PREFIX = 'TVNPK1'; // versioned, so the format can evolve

/**
 * The signing key. Derived from PARKING_QR_SECRET when set, otherwise from the
 * platform JWT secret with a parking-specific salt — that separation means a QR
 * key and a session key are never the same bytes even with one secret set.
 */
const deriveKey = () => {
  const secret = process.env.PARKING_QR_SECRET || config.jwtSecret;
  if (!secret) {
    // Only reachable in non-production, where env.js permits a missing secret.
    throw new Error('Parking QR signing key unavailable: set PARKING_QR_SECRET or JWT_SECRET');
  }
  return crypto.scryptSync(secret, 'tirvona.parking.qr.v1', 32);
};

let cachedKey = null;
const getKey = () => {
  if (!cachedKey) cachedKey = deriveKey();
  return cachedKey;
};

/**
 * Seal a payload into a compact, URL-safe token.
 * Layout: PREFIX.base64url(iv).base64url(ciphertext).base64url(authTag)
 */
export const sealQrPayload = (payload) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
};

/**
 * Open a sealed token.
 *
 * Returns the payload, or `null` for anything that is not a token this server
 * sealed — wrong format, wrong key, or edited in any way. Never throws, so the
 * scan endpoint can treat a bad token as a normal (logged) failure rather than
 * a 500.
 */
export const openQrPayload = (token) => {
  if (typeof token !== 'string' || !token.startsWith(`${TOKEN_PREFIX}.`)) return null;

  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [, ivB64, dataB64, tagB64] = parts;

  try {
    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(dataB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    // `final()` throws here if the tag does not verify — i.e. if the token was
    // altered. That is the tamper-proofing, and it is why GCM is used.
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }
};

/** SHA-256 of a token. Only this digest is persisted — never the token. */
export const hashQrToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * A short, non-reversible fingerprint of a token, safe to write to the scan log
 * on failures. Twelve hex characters identifies a repeat offender without being
 * enough to reconstruct anything.
 */
export const fingerprintQrToken = (token) => {
  if (!token) return '';
  return hashQrToken(token).slice(0, 12);
};

/** Constant-time digest comparison, so a stored hash cannot be probed by timing. */
export const compareTokenHash = (token, storedHash) => {
  const candidate = Buffer.from(hashQrToken(token));
  const expected = Buffer.from(String(storedHash || ''));
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
};

export default {
  sealQrPayload,
  openQrPayload,
  hashQrToken,
  fingerprintQrToken,
  compareTokenHash,
};
