import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

// Helper to sign JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: '30d',
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
      phone, // For frontend debug helper
      otp,   // Sending OTP back in response ONLY FOR DEMO/DEVELOPMENT. In prod, this is omitted!
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
