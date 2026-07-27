import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false, // Optional for Google / OTP users
    },
    role: {
      type: String,
      enum: [
        'super_admin',
        'national_admin',
        'state_admin',
        'govt_admin',
        'district_officer',
        'owner',
        'manager',
        'reception',
        'housekeeping',
        'banner_manager',
        'content_manager',
        'offer_manager',
        'blog_manager',
        'local_manager',
        'marketplace_manager',
        'finance_manager',
        'support',
        'inspector',
        'staff',
        'volunteer',
        'customer',
      ],
      default: 'customer',
    },
    status: {
      type: String,
      enum: [
        'active',
        'pending',
        'pending_approval',
        'suspended',
        'temp_suspended',
        'perm_suspended',
        'disabled',
        'deleted',
        'archived',
      ],
      default: 'active',
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: {
      type: String,
      default: '',
    },
    suspensionType: {
      type: String,
      enum: ['temporary', 'permanent', 'none'],
      default: 'none',
    },
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    suspendedAt: {
      type: Date,
    },
    suspensionEndDate: {
      type: Date,
    },
    internalNotes: {
      type: String,
      default: '',
    },
    visibleMessage: {
      type: String,
      default: '',
    },
    reactivatedAt: {
      type: Date,
    },
    reactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    employeeId: {
      type: String,
      default: function () {
        return `EMP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      },
    },
    username: {
      type: String,
      default: '',
    },
    designation: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    aadhaarId: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      default: 'Not Specified',
    },
    dob: {
      type: Date,
    },
    assignedAshram: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    permissions: [
      {
        type: String,
      },
    ],
    remarks: {
      type: String,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    district: {
      type: String,
      required: function () {
        return this.role === 'district_officer';
      },
    },
    state: {
      type: String,
      required: function () {
        return this.role === 'district_officer' || this.role === 'govt_admin';
      },
    },
    // The ashram a staff member (manager/reception/housekeeping) is employed at.
    // Scopes their dashboard data and permissions to that single property.
    // Optional at the schema level: staff may be created first and assigned to
    // an ashram afterwards. Until assigned, the authorization helpers treat them
    // as having no ashram access (see utils/ashramAccess.js).
    employerAshramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
    },
    govtId: {
      idType: {
        type: String,
        enum: ['Aadhaar', 'PAN', 'Service ID', 'VoterID'],
        required: false,
      },
      idNumber: {
        type: String,
        required: false,
      },
      documentUrl: {
        type: String,
        required: false,
      },
    },
    deviceSessions: [
      {
        token: String,
        deviceName: String,
        ipAddress: String,
        lastActive: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
