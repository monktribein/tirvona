import express from 'express';
import { getHousekeepingBoard, updateUnitStatus } from '../controllers/housekeepingController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

const staffRoles = restrictTo('owner', 'manager', 'reception', 'housekeeping', 'super_admin');

router.get('/', protect, staffRoles, getHousekeepingBoard);
router.patch('/:id', protect, staffRoles, updateUnitStatus);

export default router;
