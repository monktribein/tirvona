import express from 'express';
import {
  createBooking,
  createPaymentOrder,
  processBookingPayment,
  getBookingHistory,
  getBookingById,
  getDashboardBookings,
  verifyCheckin,
  verifyCheckout,
  cancelBooking,
} from '../controllers/bookingController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/create', protect, restrictTo('customer'), createBooking);
router.post('/:id/payment/order', protect, restrictTo('customer'), createPaymentOrder);
router.post('/:id/payment', protect, restrictTo('customer'), processBookingPayment);
router.get('/history', protect, restrictTo('customer'), getBookingHistory);
router.get('/dashboard', protect, restrictTo('owner', 'manager', 'reception', 'super_admin'), getDashboardBookings);
router.get('/:id', protect, getBookingById);
router.post('/:id/checkin', protect, restrictTo('owner', 'manager', 'reception'), verifyCheckin);
router.post('/:id/checkout', protect, restrictTo('owner', 'manager', 'reception'), verifyCheckout);
router.post('/:id/cancel', protect, cancelBooking);

export default router;
