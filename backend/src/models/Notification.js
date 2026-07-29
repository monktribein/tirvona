import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    recipientRole: {
      type: String,
      enum: ['super_admin', 'govt_admin', 'district_officer', 'owner', 'customer', 'banner_manager', 'all'],
      default: 'all',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'push'],
      default: 'in_app',
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'critical', 'security', 'emergency'],
      default: 'info',
    },
    module: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ recipientId: 1 });
notificationSchema.index({ recipientRole: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ severity: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
