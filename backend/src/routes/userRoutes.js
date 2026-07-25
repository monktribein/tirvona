import express from 'express';
import { listUsers, updateUserStatus, listStaff, createStaff, removeStaff } from '../controllers/userController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Staff management (owners manage staff at their own ashrams).
router.get('/staff', protect, restrictTo('owner', 'super_admin'), listStaff);
router.post('/staff', protect, restrictTo('owner', 'super_admin'), createStaff);
router.delete('/staff/:id', protect, restrictTo('owner', 'super_admin'), removeStaff);

router.get('/', protect, restrictTo('super_admin', 'govt_admin'), listUsers);
router.patch('/:id/status', protect, restrictTo('super_admin'), updateUserStatus);

export default router;
