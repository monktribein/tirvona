import User from '../models/User.js';
import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';
import { escapeRegex } from '../utils/sanitize.js';

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
      const safe = escapeRegex(search); // M2: literal match, no regex injection / ReDoS
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
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

// @desc    Suspend a user account with Enterprise Lifecycle controls
// @route   PATCH /api/users/:id/suspend
// @access  Private (Super Admin)
export const suspendUser = async (req, res) => {
  try {
    const {
      reason,
      suspensionType = 'temporary',
      durationDays = 7,
      customEndDate,
      internalNotes = '',
      visibleMessage = '',
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account' });
    }

    let endDate = null;
    if (suspensionType === 'temporary') {
      if (customEndDate) {
        endDate = new Date(customEndDate);
      } else {
        endDate = new Date(Date.now() + Number(durationDays) * 86400000);
      }
    }

    user.isSuspended = true;
    user.status = suspensionType === 'permanent' ? 'perm_suspended' : 'temp_suspended';
    user.suspensionReason = reason || 'Terms Violation';
    user.suspensionType = suspensionType;
    user.suspendedBy = req.user.id;
    user.suspendedAt = new Date();
    user.suspensionEndDate = endDate;
    user.internalNotes = internalNotes;
    user.visibleMessage = visibleMessage;

    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_SUSPENDED',
      module: 'USER_MGMT',
      details: {
        targetUserId: user._id,
        targetUserEmail: user.email,
        reason,
        suspensionType,
        suspensionEndDate: endDate,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: `Account successfully suspended (${suspensionType})`,
      data: user,
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    return res.status(500).json({ success: false, message: 'Server error suspending user account' });
  }
};

// @desc    Reactivate a suspended user account
// @route   PATCH /api/users/:id/reactivate
// @access  Private (Super Admin)
export const reactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isSuspended = false;
    user.status = 'active';
    user.suspensionType = 'none';
    user.reactivatedAt = new Date();
    user.reactivatedBy = req.user.id;

    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_REACTIVATED',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, targetUserEmail: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: 'Account successfully reactivated',
      data: user,
    });
  } catch (error) {
    console.error('Reactivate user error:', error);
    return res.status(500).json({ success: false, message: 'Server error reactivating user account' });
  }
};

// @desc    Create a new User / Staff / Enterprise account with IAM auto-generated details
// @route   POST /api/users/create-account
// @access  Private (Super Admin)
export const createAccount = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role = 'customer',
      designation = '',
      department = '',
      city = '',
      state = '',
      aadhaarId = '',
      gender = 'Not Specified',
      dob,
      assignedAshram,
      joiningDate,
      permissions = [],
      remarks = '',
      status = 'active',
    } = req.body;

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email address already registered' });
    }

    const tempPassword = password || `Tirvona#${Math.floor(1000 + Math.random() * 9000)}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const empId = `EMP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const username = req.body.username || `usr_${name.toLowerCase().replace(/\s+/g, '_')}_${Math.floor(100 + Math.random() * 900)}`;

    const newUser = await User.create({
      name,
      email,
      phone: phone || `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`,
      passwordHash,
      role,
      status,
      employeeId: empId,
      username,
      designation,
      department,
      city,
      state,
      aadhaarId,
      gender,
      dob: dob ? new Date(dob) : undefined,
      assignedAshram: assignedAshram || undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      permissions,
      remarks,
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_ACCOUNT_CREATED',
      module: 'USER_MGMT',
      details: { targetUserId: newUser._id, email: newUser.email, role: newUser.role, employeeId: empId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      tempPassword,
      data: newUser,
    });
  } catch (error) {
    console.error('Create account error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error creating account' });
  }
};

// @desc    Change a user's enterprise role
// @route   PATCH /api/users/:id/role
// @access  Private (Super Admin)
export const changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_ROLE_CHANGED',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, oldRole, newRole: role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: `Role changed to ${role}`, data: user });
  } catch (error) {
    console.error('Change role error:', error);
    return res.status(500).json({ success: false, message: 'Server error changing user role' });
  }
};

// @desc    Update granular permissions for a user
// @route   PATCH /api/users/:id/permissions
// @access  Private (Super Admin)
export const updatePermissions = async (req, res) => {
  try {
    const { permissions = [] } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.permissions = permissions;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_PERMISSIONS_UPDATED',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, permissionsCount: permissions.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Permissions updated successfully', data: user });
  } catch (error) {
    console.error('Update permissions error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating permissions' });
  }
};

// @desc    Reset password for a user
// @route   POST /api/users/:id/reset-password
// @access  Private (Super Admin)
export const resetUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newTempPassword = req.body.password || `Tirvona#${Math.floor(1000 + Math.random() * 9000)}`;
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newTempPassword, salt);
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_PASSWORD_RESET',
      module: 'USER_MGMT',
      details: { targetUserId: user._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Password reset successfully', tempPassword: newTempPassword });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
};

// @desc    Soft Delete User Account
// @route   DELETE /api/users/:id/soft-delete
// @access  Private (Super Admin)
export const softDeleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }

    user.status = 'deleted';
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user.id;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_SOFT_DELETED',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Account soft deleted. Moved to Deleted Accounts queue.', data: user });
  } catch (error) {
    console.error('Soft delete error:', error);
    return res.status(500).json({ success: false, message: 'Server error performing soft delete' });
  }
};

// @desc    Permanent Delete User Account (with Security Admin Password Check & 'DELETE' confirmation)
// @route   DELETE /api/users/:id/permanent-delete
// @access  Private (Super Admin)
export const permanentDeleteUser = async (req, res) => {
  try {
    const { adminPassword, confirmText } = req.body;
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Confirmation string must be "DELETE"' });
    }

    const admin = await User.findById(req.user.id);
    if (admin.passwordHash) {
      const isMatch = await bcrypt.compare(adminPassword || '', admin.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid Admin Password' });
      }
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot permanently delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_PERMANENTLY_DELETED',
      module: 'USER_MGMT',
      details: { targetUserId: req.params.id, email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Account permanently purged from database.' });
  } catch (error) {
    console.error('Permanent delete error:', error);
    return res.status(500).json({ success: false, message: 'Server error performing permanent delete' });
  }
};

// @desc    Restore Soft Deleted User Account
// @route   PATCH /api/users/:id/restore
// @access  Private (Super Admin)
export const restoreUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'active';
    user.isDeleted = false;
    user.isSuspended = false;
    user.deletedAt = undefined;
    user.deletedBy = undefined;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'USER_RESTORED',
      module: 'USER_MGMT',
      details: { targetUserId: user._id, email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Account restored to Active status.', data: user });
  } catch (error) {
    console.error('Restore user error:', error);
    return res.status(500).json({ success: false, message: 'Server error restoring user account' });
  }
};


