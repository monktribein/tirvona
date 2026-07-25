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
        'govt_admin',
        'district_officer',
        'owner',
        'manager',
        'reception',
        'housekeeping',
        'customer',
        'support',
      ],
      default: 'customer',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'active',
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
