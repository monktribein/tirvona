import express from 'express';
import {
  getPendingVerifications,
  scheduleInspection,
  updateVerificationStatus,
} from '../controllers/verificationController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/pending', protect, restrictTo('district_officer', 'govt_admin', 'super_admin'), getPendingVerifications);
router.post('/:id/schedule', protect, restrictTo('district_officer', 'super_admin'), scheduleInspection);
router.post('/:id/status', protect, restrictTo('district_officer', 'govt_admin', 'super_admin'), updateVerificationStatus);

export default router;
