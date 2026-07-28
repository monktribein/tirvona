import express from 'express';
import {
  submitChangeRequest,
  getPendingRequests,
  getMyRequests,
  approveChangeRequest,
  rejectChangeRequest,
  getPublishedContent,
} from '../controllers/cmsController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route to fetch approved CMS content
router.get('/published', getPublishedContent);

// BannerBoy routes
router.post('/request-change', protect, restrictTo('banner_manager', 'super_admin'), submitChangeRequest);
router.get('/my-requests', protect, restrictTo('banner_manager', 'super_admin'), getMyRequests);

// Owner / Admin approval routes
router.get('/pending-approvals', protect, restrictTo('owner', 'manager', 'super_admin', 'govt_admin'), getPendingRequests);
router.post('/approve/:id', protect, restrictTo('owner', 'super_admin', 'govt_admin'), approveChangeRequest);
router.post('/reject/:id', protect, restrictTo('owner', 'super_admin', 'govt_admin'), rejectChangeRequest);

export default router;
