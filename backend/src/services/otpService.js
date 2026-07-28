import crypto from 'crypto';
import Otp, { OTP_TYPES, EMAIL_OTP_TYPES } from '../models/Otp.js';
import config from '../config/env.js';
import { sendOtpEmail } from './emailService.js';
import { sendOtpSms } from './smsService.js';
import { logOtpEvent, OTP_EVENTS } from '../utils/otpLogger.js';

// ── Code generation ─────────────────────────────────────────────────────────

// Cryptographically random numeric code. `randomInt` is uniform, unlike the
// Math.random() pattern the legacy mock OTP used.
const generateCode = (length = config.otp.length) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(crypto.randomInt(min, max + 1));
};

// OTPs are short-lived and high-entropy-bounded, so a fast digest is correct
// here; bcrypt would add latency for no security gain at 6 digits + 5 attempts.
export const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// Constant-time compare so verification cannot be timed character by character.
export const compareOtp = (plain, hash) => {
  const candidate = Buffer.from(hashOtp(plain));
  const expected = Buffer.from(String(hash));
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
};

// ── Delivery ────────────────────────────────────────────────────────────────

const deliver = async ({ type, otp, user, email, phone }) => {
  const expiryMinutes = config.otp.expiryMinutes;

  // Email channel: either an inherently email type, or SMS is switched off and
  // we have an address to fall back to.
  const useEmail = EMAIL_OTP_TYPES.includes(type) || (!config.otp.smsEnabled && (email || user?.email));

  if (useEmail) {
    return sendOtpEmail({ to: email || user?.email, name: user?.name, otp, type, expiryMinutes });
  }
  return sendOtpSms({ phone, otp, expiryMinutes });
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Issue (or re-issue) an OTP for a user + type and dispatch it.
 *
 * Enforces the resend cooldown, replaces any previous active code for the same
 * type, and returns a plain result object rather than throwing so callers map
 * it straight onto the project's `{ success, message }` response shape.
 */
export const issueOtp = async ({ user, type, channelValue, identifier, ignoreCooldown = false }) => {
  const isEmailChannel = EMAIL_OTP_TYPES.includes(type);
  const email = isEmailChannel ? channelValue : undefined;
  const phone = isEmailChannel ? undefined : channelValue;

  // Pre-account challenges (Google sign-up) are keyed by email, since no User
  // document exists yet. Everything else is keyed by userId.
  const key = user?._id ? { userId: user._id, type } : { identifier: String(identifier).toLowerCase(), type };

  const existing = await Otp.findOne(key);

  // Resend cooldown — stops a client hammering the send endpoint.
  if (existing && !ignoreCooldown) {
    const elapsedMs = Date.now() - new Date(existing.lastSentAt).getTime();
    const cooldownMs = config.otp.resendCooldownSeconds * 1000;
    if (elapsedMs < cooldownMs) {
      const retryAfter = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return {
        success: false,
        code: 'COOLDOWN_ACTIVE',
        retryAfter,
        message: `Please wait ${retryAfter}s before requesting another OTP.`,
      };
    }
  }

  const otp = generateCode();
  const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);

  // Upsert keeps the "one active OTP per type per user" invariant, and resets
  // the attempt counter so a fresh code always starts with a full budget.
  const record = await Otp.findOneAndUpdate(
    key,
    {
      ...key,
      otpHash: hashOtp(otp),
      type,
      email,
      phone,
      expiresAt,
      verified: false,
      attempts: 0,
      lastSentAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logOtpEvent(OTP_EVENTS.GENERATED, { userId: user?._id, type, email, phone });

  const delivery = await deliver({ type, otp, user, email, phone });

  // A "simulated" delivery means no gateway is configured — that is a dev-mode
  // configuration state, not a delivery failure, so it must not log as an error.
  logOtpEvent(delivery.sent || delivery.simulated ? OTP_EVENTS.SENT : OTP_EVENTS.SEND_FAILED, {
    userId: user?._id,
    type,
    email,
    phone,
    simulated: delivery.simulated,
    error: delivery.error,
  });

  // The generated code is never returned to the caller — not even in
  // development. It exists only in the delivered email/SMS and as a hash in the
  // database. Anything else would be a bypass of the whole challenge.
  return {
    success: true,
    otpId: record._id,
    expiresAt,
    channel: isEmailChannel ? 'email' : 'sms',
    simulated: Boolean(delivery.simulated),
  };
};

/** Drop every outstanding code for a user (used after a successful login). */
export const clearOtps = async (userId, type) => {
  const filter = { userId };
  if (type) filter.type = type;
  await Otp.deleteMany(filter);
};

export { OTP_TYPES };
export default { issueOtp, clearOtps, hashOtp, compareOtp };
