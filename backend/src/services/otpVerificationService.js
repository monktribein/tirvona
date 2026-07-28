import Otp from '../models/Otp.js';
import config from '../config/env.js';
import { compareOtp } from './otpService.js';
import { logOtpEvent, OTP_EVENTS } from '../utils/otpLogger.js';

/**
 * Verify a submitted OTP for a user + type.
 *
 * Returns `{ success: true, record }` or `{ success: false, code, message }`
 * where `code` is one of OTP_NOT_FOUND | OTP_EXPIRED | TOO_MANY_ATTEMPTS |
 * OTP_INVALID. The caller maps the code onto an HTTP status.
 *
 * On success the OTP is destroyed immediately — a code is single-use and cannot
 * be replayed even within its validity window.
 */
export const verifyOtp = async ({ userId, identifier, type, otp }) => {
  // Pre-account challenges are keyed by email; everything else by userId.
  const key = userId ? { userId, type } : { identifier: String(identifier).toLowerCase(), type };
  const record = await Otp.findOne(key);

  if (!record) {
    logOtpEvent(OTP_EVENTS.FAILED, { userId, type, reason: 'not_found' });
    return { success: false, code: 'OTP_NOT_FOUND', message: 'No active OTP found. Please request a new code.' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    logOtpEvent(OTP_EVENTS.EXPIRED, { userId, type, email: record.email, phone: record.phone });
    return { success: false, code: 'OTP_EXPIRED', message: 'This OTP has expired. Please request a new code.' };
  }

  if (record.attempts >= config.otp.maxAttempts) {
    await Otp.deleteOne({ _id: record._id });
    logOtpEvent(OTP_EVENTS.TOO_MANY_ATTEMPTS, { userId, type, email: record.email, phone: record.phone });
    return {
      success: false,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  if (!compareOtp(otp, record.otpHash)) {
    record.attempts += 1;
    await record.save();

    const remaining = Math.max(0, config.otp.maxAttempts - record.attempts);

    // The budget was spent by this very attempt — burn the code now.
    if (remaining === 0) {
      await Otp.deleteOne({ _id: record._id });
      logOtpEvent(OTP_EVENTS.TOO_MANY_ATTEMPTS, { userId, type, email: record.email, phone: record.phone });
      return {
        success: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    logOtpEvent(OTP_EVENTS.FAILED, {
      userId,
      type,
      email: record.email,
      phone: record.phone,
      attemptsRemaining: remaining,
    });
    return {
      success: false,
      code: 'OTP_INVALID',
      attemptsRemaining: remaining,
      message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Verified — invalidate immediately so the code cannot be reused.
  await Otp.deleteOne({ _id: record._id });
  logOtpEvent(OTP_EVENTS.VERIFIED, { userId, type, email: record.email, phone: record.phone });

  return { success: true, record };
};

export default { verifyOtp };
