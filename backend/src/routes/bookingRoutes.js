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
import rateLimit from 'express-rate-limit';

const router = express.Router();

// The check-in code is a 6-digit number verified by verifyCheckin. Throttle this
// route so the code cannot be brute-forced (10^6 space) with unlimited attempts.
const checkinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // generous for a busy front desk; still makes 6-digit code brute-force infeasible

  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many check-in attempts. Please try again later.' },
});

router.post('/create', protect, restrictTo('customer'), createBooking);
router.post('/:id/payment/order', protect, restrictTo('customer'), createPaymentOrder);
router.post('/:id/payment', protect, restrictTo('customer'), processBookingPayment);
router.get('/history', protect, restrictTo('customer'), getBookingHistory);
router.get('/dashboard', protect, restrictTo('owner', 'manager', 'reception', 'super_admin'), getDashboardBookings);
router.get('/:id', protect, getBookingById);
router.post('/:id/checkin', checkinLimiter, protect, restrictTo('owner', 'manager', 'reception'), verifyCheckin);
router.post('/:id/checkout', protect, restrictTo('owner', 'manager', 'reception'), verifyCheckout);
router.post('/:id/cancel', protect, cancelBooking);

export default router;
