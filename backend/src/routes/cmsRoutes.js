import express from 'express';
import {
  submitChangeRequest,
  getPendingRequests,
  getMyRequests,
  approveChangeRequest,
  rejectChangeRequest,
  getPublishedContent,
  deleteChangeRequest,
  resetSectionContent,
} from '../controllers/cmsController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route to fetch approved CMS content
router.get('/published', getPublishedContent);

// BannerBoy / CMS Manager routes
router.post('/request-change', protect, restrictTo('banner_manager', 'content_manager', 'super_admin', 'owner', 'manager'), submitChangeRequest);
router.get('/my-requests', protect, restrictTo('banner_manager', 'content_manager', 'super_admin', 'owner', 'manager'), getMyRequests);
router.delete('/request/:id', protect, restrictTo('banner_manager', 'content_manager', 'super_admin', 'owner', 'manager'), deleteChangeRequest);

// Owner / Admin approval routes
router.get('/pending-approvals', protect, restrictTo('owner', 'manager', 'super_admin', 'govt_admin'), getPendingRequests);
router.post('/approve/:id', protect, restrictTo('owner', 'super_admin', 'govt_admin'), approveChangeRequest);
router.post('/reject/:id', protect, restrictTo('owner', 'super_admin', 'govt_admin'), rejectChangeRequest);
router.post('/reset-section/:section', protect, restrictTo('owner', 'super_admin', 'govt_admin'), resetSectionContent);

export default router;
