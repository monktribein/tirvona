import mongoose from 'mongoose';

const institutionMasterSchema = new mongoose.Schema(
  {
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      index: true,
    },
    legalName: {
      type: String,
      required: [true, 'Legal institution name is required'],
      trim: true,
    },
    trustName: {
      type: String,
      trim: true,
    },
    registrationNo: {
      type: String,
      trim: true,
      index: true,
    },
    trustType: {
      type: String,
      enum: ['Religious Trust', 'Charitable Trust', 'Society', 'Section 8 NGO', 'Private Dharamshala', 'Govt Board'],
      default: 'Religious Trust',
    },
    establishedYear: {
      type: Number,
      default: 1950,
    },
    taxExemption80G: {
      type: Boolean,
      default: false,
    },
    fcraRegistered: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'onboarding', 'verified', 'suspended', 'archived'],
      default: 'onboarding',
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.model('InstitutionMaster', institutionMasterSchema);
