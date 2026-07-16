import express from 'express';
import {
  createRoom,
  updateRoom,
  updateDailyAvailability,
  getRoomCalendar,
} from '../controllers/roomController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, restrictTo('owner', 'manager', 'super_admin'), createRoom);
router.put('/:id', protect, restrictTo('owner', 'manager', 'super_admin'), updateRoom);
router.post('/:id/availability', protect, restrictTo('owner', 'manager', 'super_admin'), updateDailyAvailability);
router.get('/:id/calendar', protect, getRoomCalendar);

export default router;
