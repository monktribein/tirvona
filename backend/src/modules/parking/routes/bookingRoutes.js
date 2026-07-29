import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../../../middlewares/authMiddleware.js';
import {
  createBooking,
  createPaymentOrder,
  confirmPayment,
  listMyBookings,
  getBooking,
  getBookingQr,
  previewRefund,
  cancelBooking,
  reviewBooking,
  listNotifications,
  markNotificationsRead,
} from '../controllers/parkingBookingController.js';

// The visitor's own parking bookings.
//
// `protect` is the platform's existing authentication middleware, imported and
// used unmodified. No parking role is required here: any signed-in visitor can
// book parking, exactly as any signed-in visitor can book a stay.
const router = express.Router();

// Booking creation holds inventory, so it is throttled to stop a script from
// exhausting a facility's capacity with holds it never pays for. The
// time-boxed reservation hold is the second layer.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please try again shortly.' },
});

// Re-rendering a pass reissues a token, so it is capped as well.
const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many pass downloads. Please try again shortly.' },
});

router.use(protect);

router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markNotificationsRead);

router.route('/')
  .get(listMyBookings)
  .post(createLimiter, createBooking);

router.get('/:id', getBooking);
router.get('/:id/qr', qrLimiter, getBookingQr);
router.get('/:id/refund-preview', previewRefund);

router.post('/:id/payment/order', createPaymentOrder);
router.post('/:id/payment', confirmPayment);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/review', reviewBooking);

export default router;
