import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import config from '../config/env.js';
import { OTP_TYPES } from '../models/Otp.js';
import { issueOtp } from './otpService.js';
import { detectIdentifierType, normalizeEmail, normalizePhone } from '../utils/validators.js';

// Roles that must clear an OTP challenge. Deliberately narrow: only the public
// "Guest Visitor" role. Ashram owners, staff and every admin role keep the
// existing password-only flow untouched.
const OTP_REQUIRED_ROLES = ['customer'];

export const requiresOtp = (user) => OTP_REQUIRED_ROLES.includes(user.role);

// ── Tokens ──────────────────────────────────────────────────────────────────

/** Full session JWT. `tv` lets a password reset invalidate issued tokens. */
export const generateToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tv: tokenVersion }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/**
 * Short-lived token that only identifies who is mid-OTP-challenge. It carries a
 * `purpose` claim so it can never be mistaken for a session token by `protect`,
 * and it means the client never sends a raw userId to the verify endpoint.
 */
export const generateOtpToken = (userId, type) =>
  jwt.sign({ id: userId, purpose: 'otp_pending', otpType: type }, config.jwtSecret, { expiresIn: '10m' });

/**
 * Carries a *verified* Google identity across the sign-up steps, before any
 * User document exists. `stage` advances 'otp' → 'profile' so a token issued
 * for the OTP step cannot be replayed to skip straight to account creation.
 *
 * Only the identity fields are re-signed. Callers legitimately pass a decoded
 * token back in (resend, stage advance), and that object carries the reserved
 * `iat`/`exp` claims — leaving them in makes `jwt.sign` throw
 * "options.expiresIn ... payload already has an exp property".
 */
export const generateGoogleToken = (profile, stage) =>
  jwt.sign(
    {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name || '',
      avatarUrl: profile.avatarUrl || '',
      purpose: 'google_pending',
      stage,
    },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

export const verifyGoogleToken = (token, expectedStage) => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.purpose !== 'google_pending') return null;
    if (expectedStage && decoded.stage !== expectedStage) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const verifyOtpToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.purpose !== 'otp_pending') return null;
    return decoded;
  } catch {
    return null;
  }
};

// ── Shared response shapes ──────────────────────────────────────────────────

/** The authenticated payload every auth endpoint in this project returns. */
export const buildSessionPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  isVerified: user.isVerified,
  token: generateToken(user._id, user.tokenVersion),
});

// ── Lookup ──────────────────────────────────────────────────────────────────

/**
 * Resolve the single login field, which accepts an email OR a mobile number.
 * Phone lookup tolerates the stored value carrying +91/0/spaces by matching the
 * normalized 10-digit tail.
 */
export const findUserByIdentifier = async (identifier) => {
  const kind = detectIdentifierType(identifier);

  if (kind === 'email') {
    return User.findOne({ email: normalizeEmail(identifier) });
  }

  if (kind === 'phone') {
    const national = normalizePhone(identifier);
    return User.findOne({
      $or: [
        { phone: national },
        { phone: `+91${national}` },
        { phone: `91${national}` },
        { phone: `0${national}` },
      ],
    });
  }

  return null;
};

// ── Suspension ──────────────────────────────────────────────────────────────

/**
 * Evaluate account lifecycle/suspension state.
 *
 * Returns `null` when the user may proceed, or a ready-to-send response body
 * when they may not. Expired temporary suspensions are auto-reactivated here,
 * exactly as the original inline login logic did — this is the single copy of
 * that behaviour, shared by the password and OTP paths.
 */
export const evaluateSuspension = async (user, req) => {
  const isSuspended = user.isSuspended || ['suspended', 'temp_suspended', 'perm_suspended'].includes(user.status);
  if (!isSuspended) return null;

  if (user.suspensionType === 'temporary' && user.suspensionEndDate && new Date(user.suspensionEndDate) < new Date()) {
    user.isSuspended = false;
    user.status = 'active';
    user.suspensionType = 'none';
    user.reactivatedAt = new Date();
    // Modified-only, for the same reason as recordLogin: an unrelated legacy
    // field must not stop a lapsed suspension from being lifted.
    await user.save({ validateModifiedOnly: true });

    await AuditLog.create({
      userId: user._id,
      action: 'USER_AUTO_REACTIVATED',
      module: 'AUTH',
      details: { reason: 'Temporary suspension duration elapsed' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return null;
  }

  let remainingDays = null;
  if (user.suspensionEndDate) {
    const diffMs = new Date(user.suspensionEndDate).getTime() - Date.now();
    remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  let suspendedByName = 'Super Admin';
  if (user.suspendedBy) {
    const adminUser = await User.findById(user.suspendedBy).select('name');
    if (adminUser) suspendedByName = adminUser.name;
  }

  return {
    success: false,
    message: 'Your account is suspended.',
    isSuspended: true,
    suspensionData: {
      status: user.status,
      suspensionType: user.suspensionType || (user.status === 'perm_suspended' ? 'permanent' : 'temporary'),
      suspensionReason: user.suspensionReason || 'Terms & Conditions violation',
      suspendedBy: suspendedByName,
      suspendedAt: user.suspendedAt ? new Date(user.suspendedAt).toLocaleDateString() : 'N/A',
      suspensionEndDate: user.suspensionEndDate ? new Date(user.suspensionEndDate).toLocaleDateString() : 'N/A',
      remainingDays,
      visibleMessage: user.visibleMessage || '',
      supportEmail: 'support@tirvona.com',
    },
  };
};

// ── Challenges ──────────────────────────────────────────────────────────────

/**
 * Start the registration challenge.
 *
 * Normally an SMS OTP to the new mobile number. While `config.otp.smsEnabled`
 * is false, the same challenge is emailed instead — the phone path below is
 * left in place and comes straight back when the flag is turned on.
 */
export const startRegistrationChallenge = async (user) => {
  const useSms = config.otp.smsEnabled;
  const type = useSms ? OTP_TYPES.PHONE_REGISTER : OTP_TYPES.EMAIL_REGISTER;
  const channelValue = useSms ? user.phone : user.email;

  const result = await issueOtp({ user, type, channelValue });
  return { ...result, type, channel: result.channel || (useSms ? 'sms' : 'email'), sentTo: channelValue };
};

/**
 * Start the login challenge. The channel normally follows what the user typed:
 * an email identifier gets an email OTP, a mobile identifier gets an SMS OTP.
 * With SMS switched off, both identifiers get an email OTP.
 */
export const startLoginChallenge = async (user, identifier) => {
  const typedEmail = detectIdentifierType(identifier) === 'email';
  const useEmail = typedEmail || !config.otp.smsEnabled;

  const type = useEmail ? OTP_TYPES.EMAIL_LOGIN : OTP_TYPES.MOBILE_LOGIN;
  const channelValue = useEmail ? user.email : user.phone;

  const result = await issueOtp({ user, type, channelValue });
  return { ...result, type, channel: result.channel || (useEmail ? 'email' : 'sms'), sentTo: channelValue };
};

/**
 * Record a completed login. Kept here so every path writes the same audit row.
 *
 * `validateModifiedOnly` is essential, not cosmetic: a plain save() re-validates
 * the ENTIRE document, so one legacy field written before the current schema —
 * e.g. a status of 'inactive' that predates the enum — would throw here and
 * lock that account out of every login path on the platform, even though this
 * function only touches `lastLoginAt`. Newly-set values are still validated,
 * because those count as modified.
 */
export const recordLogin = async (user, req, action) => {
  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });

  await AuditLog.create({
    userId: user._id,
    action,
    module: 'AUTH',
    details: { email: user.email, role: user.role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
};

export default {
  requiresOtp,
  generateToken,
  generateOtpToken,
  verifyOtpToken,
  buildSessionPayload,
  findUserByIdentifier,
  evaluateSuspension,
  startRegistrationChallenge,
  startLoginChallenge,
  recordLogin,
};
