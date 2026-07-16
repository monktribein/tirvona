import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Can be null for guest attempts (like failed logins)
  },
  action: {
    type: String,
    required: true, // e.g. USER_LOGIN, BOOKING_CREATED, ASHRAM_APPROVED, RATE_MODIFIED
  },
  module: {
    type: String,
    required: true, // e.g. AUTH, BOOKING, GOVT_APPROVAL, ROOM_INVENTORY, SUPPORT
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ module: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
