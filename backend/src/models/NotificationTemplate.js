import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema(
  {
    templateCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'in_app', 'push'],
      default: 'email',
    },
    subject: {
      type: String,
      default: '',
    },
    body: {
      type: String,
      required: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);
export default NotificationTemplate;
