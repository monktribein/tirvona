import { Router } from 'express';
import {
  getDashboardStats,
  getActivityLogs,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  bulkNotificationAction,
  seedTelemetryData,
} from '../controllers/enterpriseNotificationController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all routes
router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/activities', getActivityLogs);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.delete('/notifications/:id', deleteNotification);
router.post('/notifications/bulk', bulkNotificationAction);
router.post('/seed', seedTelemetryData);

export default router;
