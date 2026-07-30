import mongoose from 'mongoose';
import { PARKING_NOTIFICATION_EVENT_VALUES } from '../config/parkingConfig.js';

// parking_notifications — the outbox for parking-related messages.
//
// Rows are written whether or not a channel is configured, so "did the visitor
// ever get told?" is answerable from the database rather than from lost console
// output — the same reasoning behind the OTP model's delivery fields.
const parkingNotificationSchema = new mongoose.Schema(
  {
    // FK → users._id
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // FK → parking_bookings._id
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      default: null,
    },

    event: {
      type: String,
      enum: PARKING_NOTIFICATION_EVENT_VALUES,
      required: true,
      index: true,
    },

    title: { type: String, required: true },
    message: { type: String, required: true },

    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'socket'],
      default: 'in_app',
    },

    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    deliveryError: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    sentAt: { type: Date, default: null },

    readAt: { type: Date, default: null },
    // Small payload the UI uses to deep-link (booking reference, QR code, etc.).
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'parking_notifications' }
);

parkingNotificationSchema.index({ userId: 1, createdAt: -1 });
parkingNotificationSchema.index({ userId: 1, readAt: 1 });
parkingNotificationSchema.index({ bookingId: 1, event: 1 });

const ParkingNotification = mongoose.model('ParkingNotification', parkingNotificationSchema);
export default ParkingNotification;
