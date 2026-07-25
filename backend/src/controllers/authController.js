import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import config from '../config/env.js';

// Helper to sign JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

// Memory store for mock OTPs (in production, use Redis or MongoDB collection with TTL index)
const otpStore = new Map();

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
      role: role || 'customer',
      status: role && role !== 'customer' ? 'pending' : 'active', // Admin/officers/owners need verification, customers auto-activated
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
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account is suspended.' });
    }

    // Write audit log
    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGIN_PASSWORD',
      module: 'AUTH',
      details: { email: user.email },
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
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

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

    res.json({
      success: true,
      message: 'OTP sent successfully (Simulated)',
      phone,
      // OTP is only echoed outside production for local testing; never leak it in prod.
      ...(config.isProduction ? {} : { otp }),
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
        token: generateToken(user._id),
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
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get staff members for current owner
// @route   GET /api/auth/owner-staff
// @access  Private (Owner / Super Admin)
export const getOwnerStaff = async (req, res) => {
  try {
    // Only Master Owner (owner@tirvona.com) or Super Admin can view global ashram credentials
    if (req.user.email !== 'owner@tirvona.com' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Master Platform Owner can access global credentials.',
      });
    }

    const staff = await User.find({
      role: { $in: ['owner', 'manager', 'reception', 'housekeeping'] }
    }).select('-passwordHash');

    res.json({
      success: true,
      data: staff,
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
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
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

    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Staff user not found' });
    }

    staffUser.passwordHash = password;
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
    const { status } = req.body;
    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ success: false, message: 'Staff user not found' });
    }

    staffUser.status = status || (staffUser.status === 'active' ? 'suspended' : 'active');
    await staffUser.save();

    res.json({
      success: true,
      message: `Status updated to ${staffUser.status} for ${staffUser.email}`,
      data: staffUser,
    });
  } catch (error) {
    console.error('Toggle staff status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating staff status' });
  }
};
