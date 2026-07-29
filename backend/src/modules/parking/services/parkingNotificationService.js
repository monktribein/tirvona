import ParkingNotification from '../models/ParkingNotification.js';
import { PARKING_NOTIFICATION_EVENTS } from '../config/parkingConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking notifications.
//
// Writes an outbox row for every event and, when a Socket.io instance is
// attached to the request, pushes it live to the user's private room.
//
// It reuses the socket the app already sets up (`req.io`, rooms keyed by the
// JWT-verified user id) without altering that setup, and it writes only to
// parking_notifications — the platform's own notification paths are untouched.
//
// Every function is best-effort: a notification failure must never roll back a
// paid booking, so errors are logged and swallowed.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = {
  [PARKING_NOTIFICATION_EVENTS.BOOKING_CONFIRMED]: (ctx) => ({
    title: 'Parking Confirmed',
    message: `Your parking at ${ctx.locationName} is confirmed for ${ctx.entryLabel}. Booking ${ctx.reference}.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.PAYMENT_SUCCESS]: (ctx) => ({
    title: 'Payment Received',
    message: `We received ₹${ctx.amount} for parking booking ${ctx.reference}.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.PAYMENT_FAILED]: (ctx) => ({
    title: 'Payment Failed',
    message: `Your payment for parking booking ${ctx.reference} did not go through. The bay is held for a short while — please try again.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.QR_READY]: (ctx) => ({
    title: 'Parking Pass Ready',
    message: `Your QR pass for ${ctx.locationName} is ready. Show it at the gate — code ${ctx.displayCode}.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.ENTRY_REMINDER]: (ctx) => ({
    title: 'Parking Entry Reminder',
    message: `Your parking slot at ${ctx.locationName} starts at ${ctx.entryLabel}. Keep your QR pass handy.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.EXIT_REMINDER]: (ctx) => ({
    title: 'Parking Exit Reminder',
    message: `Your parking at ${ctx.locationName} ends at ${ctx.exitLabel}. Overstay charges apply after the grace period.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.CANCELLATION]: (ctx) => ({
    title: 'Parking Cancelled',
    message: `Booking ${ctx.reference} at ${ctx.locationName} has been cancelled.`,
  }),
  [PARKING_NOTIFICATION_EVENTS.REFUND]: (ctx) => ({
    title: 'Refund Initiated',
    message: `A refund of ₹${ctx.amount} for parking booking ${ctx.reference} has been initiated.`,
  }),
};

const formatMoment = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Record a parking notification and push it over the socket when available.
 *
 * `req` is optional — background jobs have no request, and the row is still
 * written so the user sees it next time they load their notifications.
 */
export const notify = async ({ req = null, userId, booking = null, event, context = {} }) => {
  try {
    const template = TEMPLATES[event];
    if (!template) return null;

    const ctx = {
      reference: booking?.bookingReference || context.reference || '',
      locationName: context.locationName || booking?.locationId?.name || 'the parking',
      entryLabel: formatMoment(context.entryAt || booking?.entryAt),
      exitLabel: formatMoment(context.exitAt || booking?.exitAt),
      amount: context.amount ?? booking?.pricing?.totalAmount ?? 0,
      displayCode: context.displayCode || '',
    };

    const { title, message } = template(ctx);

    const record = await ParkingNotification.create({
      userId,
      bookingId: booking?._id || null,
      event,
      title,
      message,
      channel: 'in_app',
      status: 'sent',
      sentAt: new Date(),
      meta: {
        bookingReference: ctx.reference,
        locationName: ctx.locationName,
        displayCode: ctx.displayCode,
        ...context.meta,
      },
    });

    // Live push. The room name is the user id — exactly the room the app's
    // socket layer joins after verifying the JWT, so no new socket wiring is
    // introduced and nothing about that layer changes.
    if (req?.io && userId) {
      try {
        req.io.to(userId.toString()).emit('parking_notification', {
          id: record._id,
          event,
          title,
          message,
          bookingReference: ctx.reference,
          at: record.createdAt,
        });
      } catch (socketErr) {
        console.error('Parking socket emit error:', socketErr.message);
      }
    }

    return record;
  } catch (error) {
    // Never let a notification failure surface as a booking failure.
    console.error('Parking notification error:', error.message);
    return null;
  }
};

/** A user's parking notifications, newest first. */
export const listForUser = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total, unread] = await Promise.all([
    ParkingNotification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ParkingNotification.countDocuments({ userId }),
    ParkingNotification.countDocuments({ userId, readAt: null }),
  ]);

  return { items, total, unread };
};

export const markAllRead = (userId) =>
  ParkingNotification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });

export { PARKING_NOTIFICATION_EVENTS };

export default { notify, listForUser, markAllRead };
