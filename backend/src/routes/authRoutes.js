import express from 'express';
import {
  register,
  login,
  sendOTP,
  verifyOTP,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
  getOwnerStaff,
  createOwnerStaff,
  resetStaffPassword,
  toggleStaffStatus
} from '../controllers/authController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/otp/send', sendOTP);
router.post('/otp/verify', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

// Owner Staff Management
router.get('/owner-staff', protect, authorize('owner', 'super_admin'), getOwnerStaff);
router.post('/owner-staff', protect, authorize('owner', 'super_admin'), createOwnerStaff);
router.put('/owner-staff/:id/password', protect, authorize('owner', 'super_admin'), resetStaffPassword);
router.put('/owner-staff/:id/status', protect, authorize('owner', 'super_admin'), toggleStaffStatus);

export default router;
