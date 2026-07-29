import ParkingPayment from '../models/ParkingPayment.js';
import config from '../../../config/env.js';
import {
  isRazorpayConfigured,
  createRazorpayOrder,
  verifyRazorpaySignature,
} from '../../../utils/razorpay.js';
import { confirmBooking } from './parkingBookingService.js';
import { recordTransaction } from './parkingLedgerService.js';
import { notify, PARKING_NOTIFICATION_EVENTS as EVENTS } from './parkingNotificationService.js';
import {
  PARKING_BOOKING_STATUS,
  PARKING_PAYMENT_STATUS,
} from '../config/parkingConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking payments.
//
// Reuses the platform's existing Razorpay helpers — imported read-only, with no
// modification to utils/razorpay.js and no change to how ashram payments behave.
// What is NOT shared is the data: every parking payment is written to
// parking_payments and parking_transactions, never to the `payments` collection.
//
// The signature check mirrors the ashram engine's rule: when Razorpay is
// configured, a valid signature is mandatory before anything is marked paid.
// ─────────────────────────────────────────────────────────────────────────────

/** Open a payment order for a pending booking. */
export const createOrder = async ({ booking, user }) => {
  if (booking.paymentStatus === PARKING_PAYMENT_STATUS.PAID) {
    return { ok: false, status: 400, message: 'This booking is already paid.' };
  }
  if (booking.status !== PARKING_BOOKING_STATUS.PENDING) {
    return { ok: false, status: 400, message: 'This booking can no longer be paid for.' };
  }
  // An expired hold no longer owns a bay, so it must not be payable.
  if (booking.reservationExpiresAt && new Date(booking.reservationExpiresAt) < new Date()) {
    return { ok: false, status: 410, message: 'Your reservation hold expired. Please book again.' };
  }

  const amount = booking.pricing.totalAmount;

  // Demo mode keeps local development working when no gateway keys are set —
  // the same fallback the ashram booking engine uses.
  if (!isRazorpayConfigured()) {
    const payment = await ParkingPayment.create({
      bookingId: booking._id,
      userId: user._id,
      partnerId: booking.partnerId,
      amount,
      purpose: 'booking',
      method: 'demo',
      status: PARKING_PAYMENT_STATUS.PENDING,
    });
    return { ok: true, demo: true, paymentId: payment._id, data: { amount } };
  }

  const order = await createRazorpayOrder(amount, booking.bookingReference);

  const payment = await ParkingPayment.create({
    bookingId: booking._id,
    userId: user._id,
    partnerId: booking.partnerId,
    amount,
    purpose: 'booking',
    method: 'razorpay',
    status: PARKING_PAYMENT_STATUS.PENDING,
    gateway: { orderId: order.id, provider: 'razorpay' },
  });

  return {
    ok: true,
    demo: false,
    paymentId: payment._id,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
    },
  };
};

/**
 * Verify a payment and confirm the booking.
 *
 * With Razorpay configured the signature MUST verify — otherwise nothing is
 * marked paid and no pass is issued.
 */
export const confirmPayment = async ({
  booking,
  user,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  method,
  req = null,
}) => {
  if (booking.paymentStatus === PARKING_PAYMENT_STATUS.PAID) {
    return { ok: false, status: 400, message: 'This booking is already paid.' };
  }
  if (booking.status !== PARKING_BOOKING_STATUS.PENDING) {
    return { ok: false, status: 400, message: 'This booking can no longer be paid for.' };
  }
  if (booking.reservationExpiresAt && new Date(booking.reservationExpiresAt) < new Date()) {
    return { ok: false, status: 410, message: 'Your reservation hold expired. Please book again.' };
  }

  const usingRazorpay = isRazorpayConfigured();

  if (usingRazorpay) {
    const valid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!valid) {
      await ParkingPayment.findOneAndUpdate(
        { bookingId: booking._id, status: PARKING_PAYMENT_STATUS.PENDING },
        {
          $set: {
            status: PARKING_PAYMENT_STATUS.FAILED,
            failureReason: 'Signature verification failed',
          },
        }
      );

      await notify({
        req,
        userId: booking.customerId,
        booking,
        event: EVENTS.PAYMENT_FAILED,
      });

      return { ok: false, status: 400, message: 'Payment signature verification failed.' };
    }
  }

  const payment = await ParkingPayment.findOneAndUpdate(
    { bookingId: booking._id, purpose: 'booking', status: PARKING_PAYMENT_STATUS.PENDING },
    {
      $set: {
        status: PARKING_PAYMENT_STATUS.PAID,
        method: usingRazorpay ? 'razorpay' : method || 'demo',
        paidAt: new Date(),
        transactionId: razorpay_payment_id || `PKTXN-${Date.now()}`,
        'gateway.paymentId': razorpay_payment_id || '',
        'gateway.signature': razorpay_signature || '',
        'gateway.orderId': razorpay_order_id || '',
      },
    },
    { new: true, sort: { createdAt: -1 } }
  );

  const { booking: confirmed, pass, location } = await confirmBooking({
    booking,
    req,
    actorId: user._id,
  });

  if (payment) {
    await recordTransaction({
      bookingId: booking._id,
      paymentId: payment._id,
      partnerId: booking.partnerId,
      locationId: booking.locationId,
      type: 'commission',
      direction: 'credit',
      amount: confirmed.commission.amount,
      description: `Platform commission on ${confirmed.bookingReference}`,
      meta: { percent: confirmed.commission.percent },
      recordedBy: user._id,
    });
  }

  await notify({
    req,
    userId: booking.customerId,
    booking: confirmed,
    event: EVENTS.PAYMENT_SUCCESS,
    context: { amount: confirmed.pricing.totalAmount, locationName: location?.name },
  });

  return { ok: true, booking: confirmed, payment, pass, location };
};

/**
 * Collect the overstay charge at the gate.
 *
 * Recorded as a separate payment row with `purpose: 'overstay'`, so the original
 * booking payment stays intact and reconcilable.
 */
export const collectOverstay = async ({ booking, amount, method = 'cash', collectedBy }) => {
  if (amount <= 0) return { ok: true, payment: null };

  const payment = await ParkingPayment.create({
    bookingId: booking._id,
    userId: booking.customerId,
    partnerId: booking.partnerId,
    amount,
    purpose: 'overstay',
    method,
    status: PARKING_PAYMENT_STATUS.PAID,
    paidAt: new Date(),
    transactionId: `PKOVR-${Date.now()}`,
  });

  await recordTransaction({
    bookingId: booking._id,
    paymentId: payment._id,
    partnerId: booking.partnerId,
    locationId: booking.locationId,
    type: 'overstay',
    direction: 'credit',
    amount,
    description: `Overstay collected for ${booking.bookingReference}`,
    meta: { method, overstayMinutes: booking.overstayMinutes },
    recordedBy: collectedBy,
  });

  return { ok: true, payment };
};

export const findPaymentsForBooking = (bookingId) =>
  ParkingPayment.find({ bookingId }).sort({ createdAt: -1 });

export default { createOrder, confirmPayment, collectOverstay, findPaymentsForBooking };
