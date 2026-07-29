import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: true,
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
    inAppNotifications: {
      type: Boolean,
      default: true,
    },
    subscribedModules: {
      type: [String],
      default: ['auth', 'booking', 'payment', 'ashram', 'support', 'banner', 'marketplace', 'security'],
    },
  },
  { timestamps: true }
);

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export default NotificationPreference;
