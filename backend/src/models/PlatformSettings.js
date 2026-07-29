import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'main',
    },
    platformFee: {
      enabled: { type: Boolean, default: true },
      type: {
        type: String,
        enum: ['flat', 'percentage'],
        default: 'flat',
      },
      value: { type: Number, default: 49 },
      label: { type: String, default: 'Tirvona Platform Fee' },
    },
    gstRate: { type: Number, default: 5 },
  },
  {
    timestamps: true,
  }
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);
export default PlatformSettings;
