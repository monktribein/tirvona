import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';

/**
 * Log an activity event to MongoDB and emit live Socket.IO update
 */
export const logActivity = async ({
  req = null,
  userId = null,
  userName = 'Guest / System',
  userEmail = 'system@tirvona.com',
  role = 'system',
  module,
  action,
  description,
  severity = 'info',
  oldValue = null,
  newValue = null,
  metadata = {},
  status = 200,
  io = null,
}) => {
  try {
    const activityData = {
      activityId: `ACT_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date(),
      userId: userId || req?.user?._id || null,
      userName: userName || req?.user?.name || 'Guest / System',
      userEmail: userEmail || req?.user?.email || 'system@tirvona.com',
      role: role || req?.user?.role || 'system',
      module: module || 'SYSTEM',
      action: action || 'UNKNOWN_ACTION',
      description: description || `${action} occurred in ${module}`,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1',
      browser: req?.headers?.['user-agent'] || 'Chrome / Edge',
      os: 'Windows / Linux',
      country: 'India',
      city: 'Rishikesh',
      device: 'Desktop',
      requestId: `REQ_${Math.floor(Math.random() * 1000000)}`,
      apiEndpoint: req?.originalUrl || '/api/v1',
      httpMethod: req?.method || 'GET',
      status,
      oldValue,
      newValue,
      severity,
      metadata,
    };

    const createdLog = await ActivityLog.create(activityData);

    // Socket.io real-time broadcast to super admin monitoring dashboard
    const activeIo = io || req?.io;
    if (activeIo) {
      activeIo.emit('activity_feed_event', createdLog);
      activeIo.emit('new_system_activity', createdLog);
    }

    return createdLog;
  } catch (err) {
    console.error('Log activity error:', err);
    return null;
  }
};

/**
 * Dispatch an enterprise notification to a specific recipient or role
 */
export const sendNotification = async ({
  recipientId = null,
  recipientRole = 'super_admin',
  title,
  message,
  type = 'in_app',
  severity = 'info',
  module = 'system',
  action = 'SYSTEM_ALERT',
  metadata = {},
  req = null,
  io = null,
}) => {
  try {
    const notificationData = {
      recipientId,
      recipientRole,
      title,
      message,
      type,
      severity,
      module,
      action,
      metadata,
      isRead: false,
    };

    const createdNotif = await Notification.create(notificationData);

    // Socket.io real-time broadcast
    const activeIo = io || req?.io;
    if (activeIo) {
      activeIo.emit('new_notification', createdNotif);
      if (recipientId) {
        activeIo.to(recipientId.toString()).emit('user_notification', createdNotif);
      }
    }

    return createdNotif;
  } catch (err) {
    console.error('Send notification error:', err);
    return null;
  }
};
