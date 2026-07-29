import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import NotificationTemplate from '../models/NotificationTemplate.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { logActivity, sendNotification } from '../utils/activityTracker.js';

// Get Real-Time Enterprise Dashboard Stats
export const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todaysNotifications,
      criticalAlerts,
      unreadNotifications,
      failedLogins,
      pendingComplaints,
      openTickets,
      failedPayments,
      otpFailures,
      serverErrors,
      apiErrors,
    ] = await Promise.all([
      Notification.countDocuments({ createdAt: { $gte: todayStart } }),
      Notification.countDocuments({ severity: { $in: ['critical', 'security', 'emergency'] } }),
      Notification.countDocuments({ isRead: false }),
      ActivityLog.countDocuments({ action: 'FAILED_LOGIN' }),
      ActivityLog.countDocuments({ module: 'COMPLAINTS', status: 'pending' }),
      ActivityLog.countDocuments({ module: 'SUPPORT', action: 'TICKET_OPENED' }),
      ActivityLog.countDocuments({ module: 'PAYMENT', action: 'PAYMENT_FAILED' }),
      ActivityLog.countDocuments({ action: 'OTP_FAILED' }),
      ActivityLog.countDocuments({ severity: 'emergency' }),
      ActivityLog.countDocuments({ status: { $gte: 400 } }),
    ]);

    return res.json({
      success: true,
      data: {
        todaysNotifications,
        criticalAlerts,
        unreadNotifications,
        failedLogins,
        pendingComplaints,
        openTickets,
        failedPayments,
        otpFailures,
        serverErrors,
        apiErrors,
        emailsFailed: 0,
        smsFailed: 0,
      },
    });
  } catch (err) {
    console.error('Fetch dashboard stats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get Filtered System Activity Logs
export const getActivityLogs = async (req, res) => {
  try {
    const { module, severity, role, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (module && module !== 'all') {
      filter.module = module.toUpperCase();
    }
    if (severity && severity !== 'all') {
      filter.severity = severity;
    }
    if (role && role !== 'all') {
      filter.role = role;
    }
    if (search) {
      const term = new RegExp(search, 'i');
      filter.$or = [
        { userName: term },
        { userEmail: term },
        { action: term },
        { description: term },
        { ipAddress: term },
        { activityId: term },
      ];
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Role-based visibility enforcement
    if (req.user?.role === 'district_officer') {
      filter.city = req.user.district || 'Rishikesh';
    } else if (req.user?.role === 'owner') {
      filter.userId = req.user._id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [docs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)),
      ActivityLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: docs.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      data: docs,
    });
  } catch (err) {
    console.error('Fetch activity logs error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get All User / Admin Notifications
export const getNotifications = async (req, res) => {
  try {
    const { type, severity, isRead, search, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (type && type !== 'all') filter.type = type;
    if (severity && severity !== 'all') filter.severity = severity;
    if (isRead !== undefined && isRead !== 'all') filter.isRead = isRead === 'true';

    if (search) {
      const term = new RegExp(search, 'i');
      filter.$or = [{ title: term }, { message: term }, { module: term }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [docs, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ isRead: false }),
    ]);

    return res.json({
      success: true,
      count: docs.length,
      total,
      unreadCount,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      data: docs,
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Mark Notification as Read
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany({ isRead: false }, { isRead: true, readAt: new Date() });
      return res.json({ success: true, message: 'All notifications marked as read' });
    }
    const updated = await Notification.findByIdAndUpdate(id, { isRead: true, readAt: new Date() }, { new: true });
    return res.json({ success: true, message: 'Notification marked as read', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk Actions on Notifications
export const bulkNotificationAction = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No notification IDs provided' });
    }

    if (action === 'delete') {
      await Notification.deleteMany({ _id: { $in: ids } });
    } else if (action === 'mark_read') {
      await Notification.updateMany({ _id: { $in: ids } }, { isRead: true, readAt: new Date() });
    } else if (action === 'mark_unread') {
      await Notification.updateMany({ _id: { $in: ids } }, { isRead: false });
    } else if (action === 'archive') {
      await Notification.updateMany({ _id: { $in: ids } }, { isArchived: true });
    }

    return res.json({ success: true, message: `Bulk action '${action}' completed successfully for ${ids.length} items.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Seed Initial Activity Telemetry & Sample Notifications if Empty
export const seedTelemetryData = async (req, res) => {
  try {
    const count = await ActivityLog.countDocuments();
    if (count === 0) {
      const sampleEvents = [
        { module: 'AUTH', action: 'USER_REGISTERED', description: 'New Pilgrim account registered: rahul.sharma@example.com', severity: 'success', role: 'customer' },
        { module: 'AUTH', action: 'USER_LOGGED_IN', description: 'Super Admin logged in from 103.24.12.45', severity: 'info', role: 'super_admin' },
        { module: 'BOOKING', action: 'BOOKING_CREATED', description: 'Booking #BK10291 created at Parmarth Niketan Ashram for ₹3,400', severity: 'info', role: 'customer' },
        { module: 'PAYMENT', action: 'PAYMENT_SUCCESS', description: 'Payment of ₹3,400 successful via Razorpay (PayRef: PAY_891230)', severity: 'success', role: 'customer' },
        { module: 'ASHRAM', action: 'ASHRAM_APPROVED', description: 'Swarg Ashram verification approved by District Officer', severity: 'success', role: 'district_officer' },
        { module: 'BANNER', action: 'BANNER_UPLOADED', description: 'New Hero Slider banner proposed by BannerBoy CMS', severity: 'warning', role: 'banner_manager' },
        { module: 'SECURITY', action: 'FAILED_LOGIN', description: 'Failed login attempt for admin@tirvona.com from IP 45.12.89.2', severity: 'critical', role: 'guest' },
      ];

      for (const ev of sampleEvents) {
        await logActivity({
          module: ev.module,
          action: ev.action,
          description: ev.description,
          severity: ev.severity,
          role: ev.role,
        });

        await sendNotification({
          title: `${ev.module} Event — ${ev.action}`,
          message: ev.description,
          severity: ev.severity,
          module: ev.module.toLowerCase(),
          action: ev.action,
        });
      }
    }

    return res.json({ success: true, message: 'Telemetry data checked/seeded.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
