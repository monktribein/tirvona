import AuditLog from '../../../models/AuditLog.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import reviewRepo from '../repositories/parkingReviewRepository.js';
import bookingService from '../services/parkingBookingService.js';
import paymentService from '../services/parkingPaymentService.js';
import qrService from '../services/parkingQrService.js';
import { quoteRefund } from '../services/parkingPricingService.js';
import notificationService from '../services/parkingNotificationService.js';
import ParkingLocation from '../models/ParkingLocation.js';
import {
  validateVehicleNumber,
  validateVehicleType,
  validateBookingWindow,
  validateObjectId,
  validateRating,
  firstError,
} from '../validators/parkingValidators.js';

// The visitor's own booking surface. Every route here runs behind the
// platform's existing `protect` middleware, and every handler scopes its work to
// `req.user._id` — a booking is only ever reachable by the person who made it.

/** Write a parking action to the platform's existing audit trail. */
const audit = async (req, action, details) => {
  try {
    await AuditLog.create({
      userId: req.user._id,
      action,
      module: 'PARKING',
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Parking audit log error:', error.message);
  }
};

/**
 * Load a booking and prove it belongs to the caller.
 * Returns `null` after responding, so callers `if (!booking) return;`.
 */
const loadOwnBooking = async (req, res) => {
  const idError = validateObjectId(req.params.id, 'booking');
  if (idError) {
    res.status(400).json({ success: false, message: idError });
    return null;
  }

  const booking = await bookingRepo.findById(req.params.id);
  if (!booking) {
    res.status(404).json({ success: false, message: 'Booking not found.' });
    return null;
  }

  if (booking.customerId.toString() !== req.user._id.toString()) {
    res.status(403).json({ success: false, message: 'Not authorised for this booking.' });
    return null;
  }

  return booking;
};

// @desc    Create a parking reservation and hold the bay
// @route   POST /api/parking/bookings
// @access  Private (any authenticated visitor)
export const createBooking = async (req, res) => {
  try {
    const {
      locationId, slotTypeId, vehicleType, vehicleNumber,
      entryAt, exitAt, vehicleModel, driverName, driverPhone,
    } = req.body;

    const error = firstError([
      validateObjectId(locationId, 'parking location'),
      validateObjectId(slotTypeId, 'parking area'),
      validateVehicleType(vehicleType),
      validateVehicleNumber(vehicleNumber),
      validateBookingWindow(entryAt, exitAt),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await bookingService.createBooking({
      user: req.user,
      locationId, slotTypeId, vehicleType, vehicleNumber,
      entryAt, exitAt, vehicleModel, driverName, driverPhone,
      req,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, code: result.code, message: result.message });
    }

    await audit(req, 'PARKING_BOOKING_CREATED', {
      bookingReference: result.booking.bookingReference,
      locationId,
      amount: result.booking.pricing.totalAmount,
    });

    return res.status(201).json({
      success: true,
      message: 'Bay held. Complete payment to confirm your booking.',
      data: {
        booking: result.booking,
        quote: result.quote,
        holdExpiresAt: result.booking.reservationExpiresAt,
      },
    });
  } catch (error) {
    console.error('Create parking booking error:', error);
    return res.status(500).json({ success: false, message: 'Could not create your parking booking.' });
  }
};

// @desc    Open a payment order for a pending booking
// @route   POST /api/parking/bookings/:id/payment/order
// @access  Private (booking owner)
export const createPaymentOrder = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    const result = await paymentService.createOrder({ booking, user: req.user });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.json({ success: true, demo: result.demo, data: result.data });
  } catch (error) {
    console.error('Parking payment order error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Could not start the payment.' });
  }
};

// @desc    Verify payment, confirm the booking, issue the QR pass
// @route   POST /api/parking/bookings/:id/payment
// @access  Private (booking owner)
export const confirmPayment = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    const result = await paymentService.confirmPayment({
      booking,
      user: req.user,
      razorpay_order_id: req.body.razorpay_order_id,
      razorpay_payment_id: req.body.razorpay_payment_id,
      razorpay_signature: req.body.razorpay_signature,
      method: req.body.method,
      req,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    await audit(req, 'PARKING_PAYMENT_SUCCESS', {
      bookingReference: result.booking.bookingReference,
      amount: result.booking.pricing.amountPaid,
    });

    const qrImage = await qrService.renderQrDataUrl(result.pass.token);

    return res.json({
      success: true,
      message: 'Payment confirmed. Your parking pass is ready.',
      data: {
        booking: result.booking,
        qr: {
          token: result.pass.token,
          displayCode: result.pass.displayCode,
          image: qrImage,
          validFrom: result.pass.validFrom,
          validUntil: result.pass.validUntil,
        },
      },
    });
  } catch (error) {
    console.error('Parking payment confirmation error:', error);
    return res.status(500).json({ success: false, message: 'Could not confirm your payment.' });
  }
};

// @desc    The visitor's parking booking history
// @route   GET /api/parking/bookings
// @access  Private
export const listMyBookings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const { items, total } = await bookingRepo.findForCustomer(req.user._id, {
      status: req.query.status,
      page,
      limit,
    });

    return res.json({
      success: true,
      count: items.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: items,
    });
  } catch (error) {
    console.error('List parking bookings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load your parking bookings.' });
  }
};

// @desc    One booking in full
// @route   GET /api/parking/bookings/:id
// @access  Private (booking owner)
export const getBooking = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    const detailed = await bookingRepo.findByIdDetailed(booking._id);
    const pass = await qrService.findActiveForBooking(booking._id);

    return res.json({
      success: true,
      data: {
        booking: detailed,
        pass: pass
          ? {
              displayCode: pass.displayCode,
              validFrom: pass.validFrom,
              validUntil: pass.validUntil,
              status: pass.status,
              entryScannedAt: pass.entryScannedAt,
              exitScannedAt: pass.exitScannedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get parking booking error:', error);
    return res.status(500).json({ success: false, message: 'Could not load this booking.' });
  }
};

// @desc    Re-render the QR pass for download
// @route   GET /api/parking/bookings/:id/qr
// @access  Private (booking owner)
//
// The stored token is never retrievable — only its hash is kept — so a pass is
// reissued here rather than re-read. That keeps a database dump worthless while
// still letting the owner download their pass again on a new device.
export const getBookingQr = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'A pass is issued once payment is complete.' });
    }
    if (['cancelled', 'expired', 'no_show'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking no longer has a valid pass.' });
    }

    const location = await ParkingLocation.findById(booking.locationId).select('name');
    const pass = await qrService.issueQrForBooking(booking, { location });

    const format = String(req.query.format || 'png').toLowerCase();
    const image =
      format === 'svg'
        ? await qrService.renderQrSvg(pass.token)
        : await qrService.renderQrDataUrl(pass.token);

    return res.json({
      success: true,
      data: {
        format,
        image,
        token: pass.token,
        displayCode: pass.displayCode,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        bookingReference: booking.bookingReference,
        vehicleNumber: booking.vehicleNumber,
      },
    });
  } catch (error) {
    console.error('Parking QR render error:', error);
    return res.status(500).json({ success: false, message: 'Could not generate your parking pass.' });
  }
};

// @desc    Preview the refund before cancelling
// @route   GET /api/parking/bookings/:id/refund-preview
// @access  Private (booking owner)
export const previewRefund = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    const location = await ParkingLocation.findById(booking.locationId);
    const refund = await quoteRefund({ booking, location });

    return res.json({ success: true, data: refund });
  } catch (error) {
    console.error('Parking refund preview error:', error);
    return res.status(500).json({ success: false, message: 'Could not calculate the refund.' });
  }
};

// @desc    Cancel a booking and release the bay
// @route   POST /api/parking/bookings/:id/cancel
// @access  Private (booking owner)
export const cancelBooking = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    const result = await bookingService.cancelBooking({
      booking,
      actor: req.user,
      reason: req.body.reason,
      req,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    await audit(req, 'PARKING_BOOKING_CANCELLED', {
      bookingReference: booking.bookingReference,
      refundAmount: result.refund.refundAmount,
    });

    return res.json({
      success: true,
      message: result.refund.refundAmount > 0
        ? `Booking cancelled. ₹${result.refund.refundAmount} will be refunded.`
        : 'Booking cancelled.',
      data: { booking: result.booking, refund: result.refund },
    });
  } catch (error) {
    console.error('Cancel parking booking error:', error);
    return res.status(500).json({ success: false, message: 'Could not cancel this booking.' });
  }
};

// @desc    Review a completed parking stay
// @route   POST /api/parking/bookings/:id/review
// @access  Private (booking owner)
export const reviewBooking = async (req, res) => {
  try {
    const booking = await loadOwnBooking(req, res);
    if (!booking) return;

    // Only a completed stay can be rated — that constraint is what makes the
    // aggregate on the listing trustworthy.
    if (booking.status !== 'checked_out') {
      return res.status(400).json({
        success: false,
        message: 'You can review a parking after your stay is complete.',
      });
    }

    const { rating, comment, safety, cleanliness, staff, valueForMoney } = req.body;

    const error = validateRating(rating);
    if (error) return res.status(400).json({ success: false, message: error });

    const existing = await reviewRepo.findByBooking(booking._id);
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking.' });
    }

    const review = await reviewRepo.create({
      locationId: booking.locationId,
      customerId: req.user._id,
      bookingId: booking._id,
      rating: {
        overall: Number(rating),
        safety: safety ? Number(safety) : undefined,
        cleanliness: cleanliness ? Number(cleanliness) : undefined,
        staff: staff ? Number(staff) : undefined,
        valueForMoney: valueForMoney ? Number(valueForMoney) : undefined,
      },
      comment: String(comment || '').slice(0, 2000),
      status: 'approved',
    });

    const aggregate = await reviewRepo.recalculateRating(booking.locationId);

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback.',
      data: { review, rating: aggregate },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking.' });
    }
    console.error('Parking review error:', error);
    return res.status(500).json({ success: false, message: 'Could not save your review.' });
  }
};

// @desc    The visitor's parking notifications
// @route   GET /api/parking/notifications
// @access  Private
export const listNotifications = async (req, res) => {
  try {
    const result = await notificationService.listForUser(req.user._id, {
      page: Math.max(1, parseInt(req.query.page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20)),
    });

    return res.json({
      success: true,
      count: result.items.length,
      total: result.total,
      unread: result.unread,
      data: result.items,
    });
  } catch (error) {
    console.error('Parking notifications error:', error);
    return res.status(500).json({ success: false, message: 'Could not load notifications.' });
  }
};

// @desc    Mark all parking notifications read
// @route   POST /api/parking/notifications/read-all
// @access  Private
export const markNotificationsRead = async (req, res) => {
  try {
    await notificationService.markAllRead(req.user._id);
    return res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error) {
    console.error('Parking notification read error:', error);
    return res.status(500).json({ success: false, message: 'Could not update notifications.' });
  }
};

export default {
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
};
