import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import config from '../config/env.js';
import { OTP_TYPES } from '../models/Otp.js';
import { verifyGoogleIdToken } from '../services/googleAuthService.js';
import { issueOtp } from '../services/otpService.js';
import { verifyOtp } from '../services/otpVerificationService.js';
import {
  generateGoogleToken,
  verifyGoogleToken,
  buildSessionPayload,
  evaluateSuspension,
  recordLogin,
} from '../services/authenticationService.js';
import { validateName, validatePhone, validateOtp, normalizePhone, firstError } from '../utils/validators.js';
import { maskEmail } from '../utils/otpLogger.js';

const OTP_ERROR_STATUS = {
  OTP_NOT_FOUND: 400,
  OTP_EXPIRED: 400,
  OTP_INVALID: 400,
  TOO_MANY_ATTEMPTS: 429,
};

// Sign-up OTPs for a Google account are keyed by email, because the User
// document is only created once the profile step completes.
const issueGoogleOtp = (profile) =>
  issueOtp({
    user: { name: profile.name, email: profile.email },
    type: OTP_TYPES.EMAIL_REGISTER,
    channelValue: profile.email,
    identifier: profile.email,
  });

// @desc    Start Google Sign-In. Returning users get a session; new users get
//          an email OTP challenge.
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const result = await verifyGoogleIdToken(req.body.credential);
    if (!result.success) {
      const status = result.code === 'GOOGLE_NOT_CONFIGURED' ? 503 : 401;
      return res.status(status).json({ success: false, code: result.code, message: result.message });
    }

    const { profile } = result;

    // Match on the stable Google id first, then fall back to email so an
    // existing password account is linked rather than duplicated.
    const existing = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });

    if (existing) {
      const suspension = await evaluateSuspension(existing, req);
      if (suspension) return res.status(403).json(suspension);

      // Link the Google identity to the existing account on first use.
      if (!existing.googleId) {
        existing.googleId = profile.googleId;
        if (!existing.avatarUrl && profile.avatarUrl) existing.avatarUrl = profile.avatarUrl;
      }
      // Google has already proven ownership of the address, so no OTP here.
      if (!existing.isVerified) {
        existing.isVerified = true;
        existing.emailVerifiedAt = new Date();
      }
      await existing.save();

      await recordLogin(existing, req, 'USER_LOGIN_GOOGLE');

      return res.json({
        success: true,
        message: `Welcome back, ${existing.name}!`,
        data: buildSessionPayload(existing),
      });
    }

    // New account: verify the address with an OTP before creating anything.
    const challenge = await issueGoogleOtp(profile);

    return res.json({
      success: true,
      otpRequired: true,
      isNewUser: true,
      message: 'Enter the OTP sent to your email address to continue.',
      data: {
        googleToken: generateGoogleToken(profile, 'otp'),
        channel: 'email',
        type: OTP_TYPES.EMAIL_REGISTER,
        sentTo: maskEmail(profile.email),
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ success: false, message: 'Server error during Google sign-in' });
  }
};

// @desc    Confirm the OTP for a Google sign-up
// @route   POST /api/auth/google/verify-otp
// @access  Public
export const verifyGoogleOtp = async (req, res) => {
  try {
    const { googleToken, otp } = req.body;

    const otpError = validateOtp(otp, config.otp.length);
    if (otpError) return res.status(400).json({ success: false, message: otpError });

    const pending = verifyGoogleToken(googleToken, 'otp');
    if (!pending) {
      return res.status(401).json({ success: false, message: 'This sign-in session has expired. Please try again.' });
    }

    const result = await verifyOtp({
      identifier: pending.email,
      type: OTP_TYPES.EMAIL_REGISTER,
      otp: String(otp).trim(),
    });

    if (!result.success) {
      return res.status(OTP_ERROR_STATUS[result.code] || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        ...(result.attemptsRemaining !== undefined ? { attemptsRemaining: result.attemptsRemaining } : {}),
      });
    }

    // Address proven. Advance the token to the profile stage — still no User
    // document, so a half-finished sign-up leaves nothing behind in the DB.
    return res.json({
      success: true,
      needsProfile: true,
      message: 'Email verified. Just a couple of details to finish.',
      data: {
        googleToken: generateGoogleToken(
          { googleId: pending.googleId, email: pending.email, name: pending.name, avatarUrl: pending.avatarUrl },
          'profile'
        ),
        email: pending.email,
        suggestedName: pending.name || '',
      },
    });
  } catch (error) {
    console.error('Google OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
};

// @desc    Create the account from the verified Google identity + the details
//          collected in the profile step
// @route   POST /api/auth/google/complete
// @access  Public
export const completeGoogleProfile = async (req, res) => {
  try {
    const { googleToken, name, phone } = req.body;

    const pending = verifyGoogleToken(googleToken, 'profile');
    if (!pending) {
      return res.status(401).json({ success: false, message: 'This sign-in session has expired. Please try again.' });
    }

    const validationError = firstError([validateName(name), validatePhone(phone)]);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const normalizedPhone = normalizePhone(phone);

    // Re-check both uniqueness constraints: the window between the OTP and this
    // call is long enough for someone else to have claimed either value.
    if (await User.findOne({ email: pending.email })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    if (await User.findOne({ phone: normalizedPhone })) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: pending.email,
      phone: normalizedPhone,
      googleId: pending.googleId,
      authProvider: 'google',
      avatarUrl: pending.avatarUrl || '',
      role: 'customer',
      status: 'active',
      // The email was proven by both Google and our own OTP.
      isVerified: true,
      emailVerifiedAt: new Date(),
    });

    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTER_GOOGLE',
      module: 'AUTH',
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await recordLogin(user, req, 'USER_LOGIN_GOOGLE');

    return res.status(201).json({
      success: true,
      message: 'Welcome to Tirvona!',
      data: buildSessionPayload(user),
    });
  } catch (error) {
    // A concurrent signup can still trip the unique index despite the checks.
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'That email or mobile number is already registered.' });
    }
    console.error('Google profile completion error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating your account' });
  }
};

// @desc    Resend the OTP for an in-progress Google sign-up
// @route   POST /api/auth/google/resend-otp
// @access  Public
export const resendGoogleOtp = async (req, res) => {
  try {
    const pending = verifyGoogleToken(req.body.googleToken, 'otp');
    if (!pending) {
      return res.status(401).json({ success: false, message: 'This sign-in session has expired. Please try again.' });
    }

    const challenge = await issueGoogleOtp(pending);
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
      message: 'A new OTP has been sent to your email.',
      data: {
        googleToken: generateGoogleToken(pending, 'otp'),
        channel: 'email',
        sentTo: maskEmail(pending.email),
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (error) {
    console.error('Google resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error resending OTP' });
  }
};
