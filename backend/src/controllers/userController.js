import User from '../models/User.js';
import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';

const STAFF_ROLES = ['manager', 'reception', 'housekeeping'];

// @desc    List users (with optional role/status filters)
// @route   GET /api/users
// @access  Private (Super Admin / Govt Admin)
export const listUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-passwordHash -deviceSessions')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving users' });
  }
};

// Verify the requester owns (or is super_admin over) the given ashram.
const assertOwnsAshram = async (user, ashramId) => {
  if (user.role === 'super_admin') return Ashram.findById(ashramId);
  return Ashram.findOne({ _id: ashramId, ownerId: user.id });
};

// @desc    List staff employed at the owner's ashram(s)
// @route   GET /api/users/staff
// @access  Private (Owner / Super Admin)
export const listStaff = async (req, res) => {
  try {
    const ashrams = req.user.role === 'super_admin'
      ? await Ashram.find().select('_id')
      : await Ashram.find({ ownerId: req.user.id }).select('_id');
    const ashramIds = ashrams.map((a) => a._id);

    const staff = await User.find({
      role: { $in: STAFF_ROLES },
      employerAshramId: { $in: ashramIds },
    })
      .select('-passwordHash -deviceSessions')
      .populate('employerAshramId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: staff.length, data: staff });
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving staff' });
  }
};

// @desc    Create a staff account tied to one of the owner's ashrams
// @route   POST /api/users/staff
// @access  Private (Owner / Super Admin)
export const createStaff = async (req, res) => {
  try {
    const { name, email, phone, password, role, ashramId } = req.body;

    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be manager, reception, or housekeeping' });
    }
    if (!name || !email || !phone || !password || !ashramId) {
      return res.status(400).json({ success: false, message: 'name, email, phone, password and ashramId are required' });
    }

    const ashram = await assertOwnsAshram(req.user, ashramId);
    if (!ashram) {
      return res.status(403).json({ success: false, message: 'You do not own this ashram' });
    }

    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A user with this email or phone already exists' });
    }

    const staff = await User.create({
      name,
      email,
      phone,
      passwordHash: password,
      role,
      status: 'active',
      employerAshramId: ashramId,
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'STAFF_CREATE',
      module: 'USER_MGMT',
      details: { staffId: staff._id, role, ashramId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: { id: staff._id, name: staff.name, email: staff.email, phone: staff.phone, role: staff.role, status: staff.status, employerAshramId: ashramId },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Server error creating staff account' });
  }
};

// @desc    Remove / deactivate a staff member the owner manages
// @route   DELETE /api/users/staff/:id
// @access  Private (Owner / Super Admin)
export const removeStaff = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);
    if (!staff || !STAFF_ROLES.includes(staff.role)) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const ashram = await assertOwnsAshram(req.user, staff.employerAshramId);
    if (!ashram) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this staff member' });
    }

    staff.status = 'suspended';
    await staff.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'STAFF_DEACTIVATE',
      module: 'USER_MGMT',
      details: { staffId: staff._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Staff member deactivated' });
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({ success: false, message: 'Server error removing staff member' });
  }
};

// @desc    Update a user's account status (active / suspended)
// @route   PATCH /api/users/:id/status
// @access  Private (Super Admin)
export const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent an admin from locking themselves out.
    if (user._id.toString() === req.user.id && status === 'suspended') {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account' });
    }

    user.status = status;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_STATUS_UPDATE',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, newStatus: status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `User status updated to ${status}`,
      data: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating user status' });
  }
};
