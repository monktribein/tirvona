import mongoose from 'mongoose';

const institutionContactSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionMaster',
      required: true,
      index: true,
    },
    contactType: {
      type: String,
      enum: ['Trustee', 'Manager', 'Receptionist', 'Emergency', 'Accountant'],
      default: 'Manager',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      default: 'Administrator',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model('InstitutionContact', institutionContactSchema);
