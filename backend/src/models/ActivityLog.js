import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    activityId: {
      type: String,
      required: true,
      unique: true,
      default: () => `ACT_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      default: 'Guest / System',
    },
    userEmail: {
      type: String,
      default: 'system@tirvona.com',
    },
    role: {
      type: String,
      default: 'system',
    },
    module: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    browser: {
      type: String,
      default: 'Chrome / Edge',
    },
    os: {
      type: String,
      default: 'Windows / Linux',
    },
    country: {
      type: String,
      default: 'India',
    },
    city: {
      type: String,
      default: 'Rishikesh',
    },
    device: {
      type: String,
      default: 'Desktop',
    },
    requestId: {
      type: String,
      default: () => `REQ_${Math.floor(Math.random() * 1000000)}`,
    },
    apiEndpoint: {
      type: String,
      default: '/api/v1',
    },
    httpMethod: {
      type: String,
      default: 'GET',
    },
    status: {
      type: mongoose.Schema.Types.Mixed,
      default: 200,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'critical', 'security', 'emergency'],
      default: 'info',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Same reasoning as AuditLog: unbounded growth, always read newest-first, so
// each filter facet carries `timestamp` as its trailing sort key.
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ module: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ severity: 1, timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
