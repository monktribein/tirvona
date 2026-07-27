import mongoose from 'mongoose';

const institutionLocationSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionMaster',
      required: true,
      index: true,
    },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    landmark: { type: String, default: '' },
    nearestGhat: { type: String, default: '' },
    district: { type: String, required: true, index: true },
    state: { type: String, required: true, default: 'Uttarakhand', index: true },
    pincode: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, default: 29.9457 },
      longitude: { type: Number, default: 78.1642 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('InstitutionLocation', institutionLocationSchema);
