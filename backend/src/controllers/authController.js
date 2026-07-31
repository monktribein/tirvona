import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import config from '../config/env.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { validateEmail, validatePassword, normalizeEmail } from '../utils/validators.js';
import { maskEmail } from '../utils/otpLogger.js';
// Dispatcher form (`serializeUser(doc, 'view')`) rather than the named views:
// two handlers below declare a local `const staffUser`, which would shadow a
// same-named import. An unknown view name throws, so this loses no safety.
import { serializeUser, serializeUsers } from '../serializers/userSerializer.js';

// Helper to sign JWT token. `tv` (token version) is embedded so a password
// reset can invalidate previously-issued tokens (see authMiddleware.protect).
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tv: tokenVersion }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

// Memory store for mock OTPs (in production, use Redis or MongoDB collection with TTL index)
const otpStore = new Map();

// Password resets no longer use an in-memory store: the token hash lives on the
// User document, so links survive a restart and work across multiple instances.

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, district, state, govtIdType, govtIdNumber, govtIdUrl } = req.body;

    const emailExists = await User.findOne({ email });
    const phoneExists = await User.findOne({ phone });

    if (emailExists || phoneExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email or phone number already exists.',
      });
    }

    // C1: public registration may only create the self-service roles the product
    // exposes (Guest Visitor / Ashram Owner). Every privileged role — admin, govt,
    // and on-site staff — must be provisioned through authenticated internal flows.
    const PUBLIC_SELF_SERVICE_ROLES = ['customer', 'owner'];
    const requestedRole = role || 'customer';
    if (!PUBLIC_SELF_SERVICE_ROLES.includes(requestedRole)) {
      return res.status(403).json({
        success: false,
        message: 'This account type cannot be self-registered. Please contact an administrator.',
      });
    }

    // Validation for specialized roles
    if (role === 'district_officer' && (!district || !state)) {
      return res.status(400).json({
        success: false,
        message: 'District officers must specify their district and state.',
      });
    }

    if (role === 'govt_admin' && !state) {
      return res.status(400).json({
        success: false,
        message: 'Government admins must specify their jurisdiction state.',
      });
    }

    const userData = {
      name,
      email,
      phone,
      passwordHash: password,
      role: requestedRole,
      status: requestedRole === 'owner' ? 'pending' : 'active', // Owners need Super Admin approval; customers auto-activated
    };

    if (district) userData.district = district;
    if (state) userData.state = state;
    if (govtIdType && govtIdNumber) {
      userData.govtId = {
        idType: govtIdType,
        idNumber: govtIdNumber,
        documentUrl: govtIdUrl || '',
      };
    }

    const user = await User.create(userData);

    // Write audit log
    await AuditLog.create({
      userId: user._id,
      action: 'USER_REGISTER',
      module: 'AUTH',
      details: { role: user.role, email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        token: generateToken(user._id, user.tokenVersion),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// NOTE: `login` used to live here. It is now `loginWithOtp` in
// controllers/otpAuthController.js, which adds the Guest Visitor OTP challenge
// and email-or-mobile identifier lookup. The suspension and auto-reactivation
// logic it contained moved verbatim into services/authenticationService.js
// (`evaluateSuspension`) and is shared by both login paths.

// @desc    Send OTP to phone
// @route   POST /api/auth/otp/send
// @access  Public
export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Check if phone exists (for login) or if it's registration.
    // If phone doesn't exist, we will mock register them or ask to register first.
    // Let's check if the user exists.
    let user = await User.findOne({ phone });
    
    // Generate 6 digit random number
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save in map store (expires in 5 minutes)
    otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    
    // For production-grade simulation, print clearly in the console so developers/users can see
    console.log(`\n=============================================`);
    console.log(`[SMS GATEWAY MOCK] OTP for phone ${phone}: ${otp}`);
    console.log(`=============================================\n`);

    // The code is never returned in the response, in any environment.
    res.json({
      success: true,
      message: 'OTP sent successfully',
      phone,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error sending OTP' });
  }
};

// @desc    Verify OTP & login
// @route   POST /api/auth/otp/verify
// @access  Public
export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const storedOtpData = otpStore.get(phone);
    if (!storedOtpData) {
      return res.status(400).json({ success: false, message: 'OTP expired or not requested' });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // Success: Delete OTP
    otpStore.delete(phone);

    // Find or create User automatically (Guest registers instantly via OTP)
    let user = await User.findOne({ phone });
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: `Guest Pilgrim ${phone.slice(-4)}`,
        email: `otp_${phone}@ashraybharat.gov.in`,
        phone,
        role: 'customer',
        status: 'active',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account is suspended.' });
    }

    // Write audit log
    await AuditLog.create({
      userId: user._id,
      action: isNewUser ? 'USER_REGISTER_OTP' : 'USER_LOGIN_OTP',
      module: 'AUTH',
      details: { phone: user.phone },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        token: generateToken(user._id, user.tokenVersion),
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    // No projection: the serializer is the boundary. A partial `-passwordHash`
    // beside it would imply the projection is what protects the response, which
    // is the confusion that let aadhaarId and tokenVersion ship from here.
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: serializeUser(user, 'self'),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update current user's own profile (name / phone)
// @route   PUT /api/auth/me
// @access  Private
export const updateMe = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (phone && phone !== user.phone) {
      const phoneTaken = await User.findOne({ phone, _id: { $ne: user._id } });
      if (phoneTaken) {
        return res.status(400).json({ success: false, message: 'Phone number already in use' });
      }
      user.phone = phone;
    }
    if (name) user.name = name;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated',
      data: serializeUser(user, 'self'),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

// How long a reset link stays valid.
const RESET_LINK_EXPIRY_MINUTES = 30;

// The frontend origin the reset link points at. CLIENT_URL may hold a
// comma-separated CORS list, so the first entry is the canonical app URL.
const getClientOrigin = () =>
  (config.clientUrl ? config.clientUrl.split(',')[0].trim() : '') || 'http://localhost:5173';

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// @desc    Email a password-reset link to a registered address
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  // Identical response in every branch — an attacker must not be able to tell
  // registered addresses from unregistered ones by the reply or its timing.
  const genericResponse = {
    success: true,
    message: 'If that email is registered, a password reset link has been sent to it.',
  };

  try {
    const { email } = req.body;
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ success: false, message: emailError });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      console.log(`[PASSWORD RESET] Requested for unregistered address ${maskEmail(email)} — no mail sent.`);
      return res.json(genericResponse);
    }

    // Raw token goes in the email; only its hash is persisted.
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_LINK_EXPIRY_MINUTES * 60 * 1000);
    // Modified-only: a legacy field elsewhere on the document must not stop
    // someone requesting a reset — that is the one path left to a locked-out user.
    await user.save({ validateModifiedOnly: true });

    const resetUrl = `${getClientOrigin()}/reset-password?token=${token}`;

    const delivery = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiryMinutes: RESET_LINK_EXPIRY_MINUTES,
    });

    if (delivery.simulated) {
      // No RESEND_API_KEY — print the link so local development still works.
      console.log(`[PASSWORD RESET:DEV] Link for ${maskEmail(user.email)}: ${resetUrl}`);
    } else if (!delivery.sent) {
      console.error(`[PASSWORD RESET] Delivery failed for ${maskEmail(user.email)}: ${delivery.error}`);
    } else {
      console.log(`[PASSWORD RESET] Link sent to ${maskEmail(user.email)}`);
    }

    await AuditLog.create({
      userId: user._id,
      action: 'PASSWORD_RESET_REQUESTED',
      module: 'AUTH',
      details: { email: user.email, delivered: Boolean(delivery.sent) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error requesting password reset' });
  }
};

// @desc    Check a reset token before showing the new-password form
// @route   GET /api/auth/reset-password/:token
// @access  Public
export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      resetTokenHash: hashResetToken(String(token || '')),
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt email');

    if (!user) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    return res.json({ success: true, data: { email: maskEmail(user.email) } });
  } catch (error) {
    console.error('Verify reset token error:', error);
    return res.status(500).json({ success: false, message: 'Server error validating reset link' });
  }
};

// @desc    Set a new password using the emailed reset link
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    // The token must match AND still be unexpired — both are checked in the
    // query so an expired token can never select a user.
    const user = await User.findOne({
      resetTokenHash: hashResetToken(token),
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (!user) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    user.passwordHash = newPassword; // pre-save hook hashes it
    user.tokenVersion = (user.tokenVersion || 0) + 1; // revoke every existing session
    user.resetTokenHash = undefined; // single use
    user.resetTokenExpiresAt = undefined;
    // Modified-only, so a legacy field cannot block the actual reset either.
    // The new password IS validated, because it is a modified path.
    await user.save({ validateModifiedOnly: true });

    await AuditLog.create({
      userId: user._id,
      action: 'PASSWORD_RESET',
      module: 'AUTH',
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
};

// @desc    Get staff members for current owner
// @route   GET /api/auth/owner-staff
// @access  Private (Owner / Super Admin)
export const getOwnerStaff = async (req, res) => {
  try {
    // Only Master Owner (owner@tirvona.com) or Super Admin can view global ashram credentials
    if (req.user.email !== 'stayadmin@tirvona.com' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Master Platform Owner can access global credentials.',
      });
    }

    const staff = await User.find({
      role: { $in: ['owner', 'manager', 'reception', 'housekeeping'] }
    });

    res.json({
      success: true,
      // `staff`, not `admin`: this list only ever renders name/email/phone/role/
      // status, so the narrower view is sufficient.
      data: serializeUsers(staff, 'staff'),
    });
  } catch (error) {
    console.error('Get owner staff error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching staff members' });
  }
};

// @desc    Create new staff member or ashram admin
// @route   POST /api/auth/owner-staff
// @access  Private (Owner / Super Admin)
export const createOwnerStaff = async (req, res) => {
  try {
    // C4: only the Master Platform Owner or a Super Admin may provision accounts
    // through this global endpoint (same gate as getOwnerStaff). Regular owners
    // manage their ashram staff via the ownership-scoped /users/staff endpoints.
    if (req.user.email !== 'stayadmin@tirvona.com' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Master Platform Owner can provision staff here.',
      });
    }

    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, phone, password, role.',
      });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this phone number already exists.',
      });
    }

    const validRoles = ['owner', 'manager', 'reception', 'housekeeping'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff role provided.',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: password,
      role,
      status: 'active',
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'STAFF_CREATE',
      module: 'AUTH',
      details: { createdUserId: user._id, email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: serializeUser(user, 'staff'),
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Server error creating staff account' });
  }
};

// @desc    Reset password for a staff member
// @route   PUT /api/auth/owner-staff/:id/password
// @access  Private (Owner / Super Admin)
export const resetStaffPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // C3: only the Master Platform Owner / Super Admin may use this endpoint...
    if (req.user.email !== 'stayadmin@tirvona.com' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Master Platform Owner can reset staff passwords here.',
      });
    }

    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Staff user not found' });
    }

    // ...and only against manageable staff/owner accounts — never other
    // administrators, government officials, or customer accounts.
    const MANAGEABLE_STAFF_ROLES = ['owner', 'manager', 'reception', 'housekeeping'];
    if (!MANAGEABLE_STAFF_ROLES.includes(staffUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only reset passwords for staff and owner accounts.',
      });
    }

    staffUser.passwordHash = password;
    staffUser.tokenVersion = (staffUser.tokenVersion || 0) + 1; // revoke the staff member's existing sessions
    await staffUser.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'STAFF_PASSWORD_RESET',
      module: 'AUTH',
      details: { targetUserId: staffUser._id, email: staffUser.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Password updated successfully for ${staffUser.email}`,
    });
  } catch (error) {
    console.error('Reset staff password error:', error);
    res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
};

// @desc    Toggle staff account status (active/suspended)
// @route   PUT /api/auth/owner-staff/:id/status
// @access  Private (Owner / Super Admin)
export const toggleStaffStatus = async (req, res) => {
  try {
    // C3: same authorization as staff password reset — master owner / super admin
    // only, and only against manageable staff/owner accounts.
    if (req.user.email !== 'stayadmin@tirvona.com' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Master Platform Owner can change staff status here.',
      });
    }

    const { status } = req.body;
    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Staff user not found' });
    }

    const MANAGEABLE_STAFF_ROLES = ['owner', 'manager', 'reception', 'housekeeping'];
    if (!MANAGEABLE_STAFF_ROLES.includes(staffUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only change status for staff and owner accounts.',
      });
    }

    staffUser.status = status || (staffUser.status === 'active' ? 'suspended' : 'active');
    await staffUser.save();

    res.json({
      success: true,
      message: `Status updated to ${staffUser.status} for ${staffUser.email}`,
      data: serializeUser(staffUser, 'admin'),
    });
  } catch (error) {
    console.error('Toggle staff status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating staff status' });
  }
};
