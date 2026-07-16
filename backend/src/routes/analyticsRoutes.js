import express from 'express';
import {
  getDashboardAnalytics,
  getSystemAnalytics,
  getSystemAuditLogs,
} from '../controllers/analyticsController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, restrictTo('owner', 'manager', 'super_admin'), getDashboardAnalytics);
router.get('/system', protect, restrictTo('govt_admin', 'super_admin'), getSystemAnalytics);
router.get('/audit-logs', protect, restrictTo('super_admin'), getSystemAuditLogs);

export default router;
