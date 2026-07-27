import express from 'express';
import {
  listUsers,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  createAccount,
  changeRole,
  updatePermissions,
  resetUserPassword,
  softDeleteUser,
  permanentDeleteUser,
  restoreUser,
  listStaff,
  createStaff,
  removeStaff,
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Staff management (owners manage staff at their own ashrams).
router.get('/staff', protect, restrictTo('owner', 'super_admin'), listStaff);
router.post('/staff', protect, restrictTo('owner', 'super_admin'), createStaff);
router.delete('/staff/:id', protect, restrictTo('owner', 'super_admin'), removeStaff);

// IAM Super Admin Endpoints
router.get('/', protect, restrictTo('super_admin', 'govt_admin'), listUsers);
router.post('/create-account', protect, restrictTo('super_admin'), createAccount);
router.patch('/:id/status', protect, restrictTo('super_admin'), updateUserStatus);
router.patch('/:id/suspend', protect, restrictTo('super_admin'), suspendUser);
router.patch('/:id/reactivate', protect, restrictTo('super_admin'), reactivateUser);
router.patch('/:id/role', protect, restrictTo('super_admin'), changeRole);
router.patch('/:id/permissions', protect, restrictTo('super_admin'), updatePermissions);
router.post('/:id/reset-password', protect, restrictTo('super_admin'), resetUserPassword);
router.delete('/:id/soft-delete', protect, restrictTo('super_admin'), softDeleteUser);
router.delete('/:id/permanent-delete', protect, restrictTo('super_admin'), permanentDeleteUser);
router.patch('/:id/restore', protect, restrictTo('super_admin'), restoreUser);

export default router;
