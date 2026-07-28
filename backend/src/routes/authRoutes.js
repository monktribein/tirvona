import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendOTP,
  verifyOTP,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  getOwnerStaff,
  createOwnerStaff,
  resetStaffPassword,
  toggleStaffStatus
} from '../controllers/authController.js';
import {
  registerDispatch,
  verifyRegistrationOtp,
  loginWithOtp,
  verifyLoginOtp,
  resendOtp,
} from '../controllers/otpAuthController.js';
import {
  googleAuth,
  verifyGoogleOtp,
  completeGoogleProfile,
  resendGoogleOtp,
} from '../controllers/googleAuthController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Dispatching an OTP costs money and can be used to harass a phone number, so
// generation is throttled harder than the general auth limiter. The per-user
// resend cooldown in otpService is the second layer; this one is per-IP.
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

// Verification is cheap but brute-forceable, so it gets a wider ceiling than
// sending while still capping an attacker's guesses per IP.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

router.post('/register', otpSendLimiter, registerDispatch);
router.post('/register/verify-otp', otpVerifyLimiter, verifyRegistrationOtp);
router.post('/login', loginWithOtp);
router.post('/login/verify-otp', otpVerifyLimiter, verifyLoginOtp);
router.post('/resend-otp', otpSendLimiter, resendOtp);

// Google Sign-In. `/google` can dispatch an email OTP, so it carries the send
// limiter; the profile step creates an account, so it is throttled too.
router.post('/google', otpSendLimiter, googleAuth);
router.post('/google/verify-otp', otpVerifyLimiter, verifyGoogleOtp);
router.post('/google/complete', otpVerifyLimiter, completeGoogleProfile);
router.post('/google/resend-otp', otpSendLimiter, resendGoogleOtp);

// Legacy passwordless phone-OTP login. Retained so the existing "Login with OTP"
// mode keeps working; superseded by the flows above for new integrations.
router.post('/otp/send', otpSendLimiter, sendOTP);
router.post('/otp/verify', otpVerifyLimiter, verifyOTP);
// Sending a reset link puts mail in someone else's inbox, so it is throttled
// with the same ceiling as OTP dispatch rather than the general auth limiter.
router.post('/forgot-password', otpSendLimiter, forgotPassword);
router.get('/reset-password/:token', verifyResetToken);
router.post('/reset-password', otpVerifyLimiter, resetPassword);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

// Owner Staff Management
router.get('/owner-staff', protect, authorize('owner', 'super_admin'), getOwnerStaff);
router.post('/owner-staff', protect, authorize('owner', 'super_admin'), createOwnerStaff);
router.put('/owner-staff/:id/password', protect, authorize('owner', 'super_admin'), resetStaffPassword);
router.put('/owner-staff/:id/status', protect, authorize('owner', 'super_admin'), toggleStaffStatus);

export default router;
