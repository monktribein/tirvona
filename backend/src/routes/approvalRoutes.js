import express from 'express';
import { protect, requireSuperAdmin } from '../middleware/auth.js';
import {
  createApprovalRequest,
  getApprovalRequests,
  getApprovalStats,
  getApprovalRequestById,
  reviewApprovalRequest,
  addApprovalComment,
  createRoomCategoryRequest,
  getRoomCategoryRequests,
  getRoomCategoryRequestById,
  reviewRoomCategoryRequest,
  resubmitRoomCategoryRequest,
} from '../controllers/approvalController.js';

const router = express.Router();

router.use(protect);

// ── Central Approval Center Master Routes ──
router.route('/requests')
  .post(createApprovalRequest)
  .get(getApprovalRequests);

router.route('/requests/stats')
  .get(getApprovalStats);

router.route('/requests/:id')
  .get(getApprovalRequestById);

router.route('/requests/:id/review')
  .put(requireSuperAdmin, reviewApprovalRequest);

router.route('/requests/:id/comment')
  .post(addApprovalComment);

// ── Legacy Room Category Specific Approval Routes ──
router.route('/room-categories')
  .post(createRoomCategoryRequest)
  .get(getRoomCategoryRequests);

router.route('/room-categories/:id')
  .get(getRoomCategoryRequestById);

router.route('/room-categories/:id/review')
  .put(requireSuperAdmin, reviewRoomCategoryRequest);

router.route('/room-categories/:id/resubmit')
  .put(resubmitRoomCategoryRequest);

export default router;
