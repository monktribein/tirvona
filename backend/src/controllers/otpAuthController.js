import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import config from '../config/env.js';
import { register as legacyRegister } from './authController.js';
import { maskEmail, maskPhone } from '../utils/otpLogger.js';
import { OTP_TYPES, EMAIL_OTP_TYPES, REGISTER_OTP_TYPES } from '../models/Otp.js';
import { verifyOtp } from '../services/otpVerificationService.js';
import { issueOtp, clearOtps } from '../services/otpService.js';
import {
  requiresOtp,
  generateOtpToken,
  verifyOtpToken,
  buildSessionPayload,
  findUserByIdentifier,
  evaluateSuspension,
  startRegistrationChallenge,
  startLoginChallenge,
  recordLogin,
} from '../services/authenticationService.js';
import {
  validateEmail,
  validateName,
  validateOtp,
  validatePassword,
  validatePhone,
  normalizeEmail,
  normalizePhone,
  detectIdentifierType,
  firstError,
} from '../utils/validators.js';

// Maps a verification failure code onto the HTTP status the project uses.
const OTP_ERROR_STATUS = {
  OTP_NOT_FOUND: 400,
  OTP_EXPIRED: 400,
  OTP_INVALID: 400,
  TOO_MANY_ATTEMPTS: 429,
};

// Shape shared by every "we just sent you a code" response. `sentTo` is masked
// so the UI can name the destination without exposing the full address.
const challengeResponse = (res, { user, challenge, message }) =>
  res.json({
    success: true,
    otpRequired: true,
    message,
    data: {
      otpToken: generateOtpToken(user._id, challenge.type),
      type: challenge.type,
      channel: challenge.channel,
      sentTo: challenge.channel === 'email' ? maskEmail(challenge.sentTo) : maskPhone(challenge.sentTo),
      expiresAt: challenge.expiresAt,
    },
  });

// @desc    Registration entry point.
//          Guest Visitors go through the OTP flow; every other self-service role
//          (Ashram Owner, with its KYC fields and pending-approval status) keeps
//          the original registration controller untouched.
// @route   POST /api/auth/register
// @access  Public
export const registerDispatch = async (req, res) => {
  const requestedRole = req.body.role || 'customer';
  if (requestedRole !== 'customer') {
    return legacyRegister(req, res);
  }
  return registerWithOtp(req, res);
};

// @desc    Register a Guest Visitor and send a registration OTP to their mobile
// @route   POST /api/auth/register  (role = customer)
// @access  Public
export const registerWithOtp = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const validationError = firstError([
      validateName(name),
      validateEmail(email),
      validatePhone(phone),
      validatePassword(password),
    ]);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    // Duplicate email and duplicate phone are reported separately so the user
    // knows which field to change.
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    if (await User.findOne({ phone: normalizedPhone })) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash: password,
      role: 'customer',
      status: 'active',
      // The account exists but is not usable until the mobile OTP is confirmed.
      isVerified: false,
    });

    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTER',
      module: 'AUTH',
      details: { role: user.role, email: user.email, pendingOtpVerification: true },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const challenge = await startRegistrationChallenge(user);

    return challengeResponse(res, {
      user,
      challenge,
      message:
        challenge.channel === 'email'
          ? 'Account created. Enter the OTP sent to your email address to activate it.'
          : 'Account created. Enter the OTP sent to your mobile number to activate it.',
    });
  } catch (error) {
    console.error('OTP registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// @desc    Confirm the registration OTP and activate the account
// @route   POST /api/auth/register/verify-otp
// @access  Public
export const verifyRegistrationOtp = async (req, res) => {
  try {
    const { otpToken, otp } = req.body;

    const otpError = validateOtp(otp, config.otp.length);
    if (otpError) return res.status(400).json({ success: false, message: otpError });

    // Accepts either registration channel — SMS (PHONE_REGISTER) or the email
    // variant used while SMS delivery is switched off.
    const decoded = verifyOtpToken(otpToken);
    if (!decoded || !REGISTER_OTP_TYPES.includes(decoded.otpType)) {
      return res.status(401).json({ success: false, message: 'This verification session has expired. Please register again.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const result = await verifyOtp({ userId: user._id, type: decoded.otpType, otp: String(otp).trim() });
    if (!result.success) {
      return res.status(OTP_ERROR_STATUS[result.code] || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        ...(result.attemptsRemaining !== undefined ? { attemptsRemaining: result.attemptsRemaining } : {}),
      });
    }

    // Stamp whichever channel actually proved the account.
    const viaEmail = decoded.otpType === OTP_TYPES.EMAIL_REGISTER;
    user.isVerified = true;
    if (viaEmail) {
      user.emailVerifiedAt = new Date();
    } else {
      user.phoneVerifiedAt = new Date();
    }
    user.status = 'active';
    await user.save();

    await recordLogin(user, req, 'USER_REGISTER_OTP_VERIFIED');

    // Account is proven — log the pilgrim straight in, matching the previous
    // behaviour where registration returned a session immediately.
    return res.json({
      success: true,
      message: viaEmail ? 'Email verified. Welcome to Tirvona!' : 'Mobile number verified. Welcome to Tirvona!',
      data: buildSessionPayload(user),
    });
  } catch (error) {
    console.error('Registration OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
};

// @desc    Password login. Guest Visitors then get an OTP challenge.
// @route   POST /api/auth/login
// @access  Public
export const loginWithOtp = async (req, res) => {
  try {
    // The form posts a single field named `email` that accepts email or mobile.
    const identifier = req.body.identifier ?? req.body.email;
    const { password } = req.body;

    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier || !password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Password is always checked FIRST. A wrong password never triggers an OTP,
    // so the SMS/email gateway cannot be used as an oracle or a spam cannon.
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const suspension = await evaluateSuspension(user, req);
    if (suspension) return res.status(403).json(suspension);

    // A Guest Visitor who never finished registration verification restarts that
    // challenge instead of the login one.
    if (requiresOtp(user) && user.isVerified === false) {
      const challenge = await startRegistrationChallenge(user);
      return challengeResponse(res, {
        user,
        challenge,
        message:
          challenge.channel === 'email'
            ? 'Your account is not verified yet. Enter the OTP we just sent to your email.'
            : 'Your mobile number is not verified yet. Enter the OTP we just sent.',
      });
    }

    // Owners, staff and every admin role keep the original password-only login.
    if (!requiresOtp(user)) {
      await recordLogin(user, req, 'USER_LOGIN_PASSWORD');
      return res.json({ success: true, data: buildSessionPayload(user) });
    }

    const challenge = await startLoginChallenge(user, identifier);

    // Retrying login inside the resend cooldown is normal (a slow SMS, a page
    // refresh). The previously sent code is still valid, so hand back the
    // challenge and tell them to use it rather than failing the login.
    if (!challenge.success && challenge.code === 'COOLDOWN_ACTIVE') {
      return challengeResponse(res, {
        user,
        challenge,
        message: 'We already sent you a code. Please enter it, or request a new one shortly.',
      });
    }

    if (!challenge.success) {
      return res.status(429).json({ success: false, code: challenge.code, message: challenge.message });
    }

    return challengeResponse(res, {
      user,
      challenge,
      // Follows the channel actually used, which may be email even when the
      // user typed a mobile number (SMS delivery switched off).
      message:
        challenge.channel === 'email'
          ? 'Enter the OTP sent to your email address.'
          : 'Enter the OTP sent to your mobile number.',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// @desc    Confirm the login OTP and issue the session token
// @route   POST /api/auth/login/verify-otp
// @access  Public
export const verifyLoginOtp = async (req, res) => {
  try {
    const { otpToken, otp } = req.body;

    const otpError = validateOtp(otp, config.otp.length);
    if (otpError) return res.status(400).json({ success: false, message: otpError });

    const decoded = verifyOtpToken(otpToken);
    if (!decoded || ![OTP_TYPES.EMAIL_LOGIN, OTP_TYPES.MOBILE_LOGIN].includes(decoded.otpType)) {
      return res.status(401).json({ success: false, message: 'This login session has expired. Please log in again.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const suspension = await evaluateSuspension(user, req);
    if (suspension) return res.status(403).json(suspension);

    const result = await verifyOtp({ userId: user._id, type: decoded.otpType, otp: String(otp).trim() });
    if (!result.success) {
      return res.status(OTP_ERROR_STATUS[result.code] || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        ...(result.attemptsRemaining !== undefined ? { attemptsRemaining: result.attemptsRemaining } : {}),
      });
    }

    // A successful login clears any other outstanding codes for this account.
    await clearOtps(user._id);

    if (!user.isVerified) {
      user.isVerified = true;
      if (decoded.otpType === OTP_TYPES.MOBILE_LOGIN) user.phoneVerifiedAt = new Date();
    }
    if (decoded.otpType === OTP_TYPES.EMAIL_LOGIN) user.emailVerifiedAt = new Date();

    await recordLogin(user, req, 'USER_LOGIN_OTP');

    return res.json({ success: true, data: buildSessionPayload(user) });
  } catch (error) {
    console.error('Login OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
};

// @desc    Resend the OTP for the challenge currently in progress
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOtp = async (req, res) => {
  try {
    const { otpToken } = req.body;

    const decoded = verifyOtpToken(otpToken);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'This session has expired. Please start again.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isEmailChannel = EMAIL_OTP_TYPES.includes(decoded.otpType);
    const challenge = await issueOtp({
      user,
      type: decoded.otpType,
      channelValue: isEmailChannel ? user.email : user.phone,
    });

    if (!challenge.success) {
      return res.status(429).json({
        success: false,
        code: challenge.code,
        retryAfter: challenge.retryAfter,
        message: challenge.message,
      });
    }

    return res.json({
      success: true,
      message: isEmailChannel ? 'A new OTP has been sent to your email.' : 'A new OTP has been sent to your mobile.',
      data: {
        // Re-issued so the 10-minute window tracks the latest code.
        otpToken: generateOtpToken(user._id, decoded.otpType),
        type: decoded.otpType,
        channel: challenge.channel,
        sentTo: isEmailChannel ? maskEmail(user.email) : maskPhone(user.phone),
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error resending OTP' });
  }
};
