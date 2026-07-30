import mongoose from 'mongoose';
import {
  PARKING_PAYMENT_STATUS,
  PARKING_PAYMENT_STATUS_VALUES,
} from '../config/parkingConfig.js';

// parking_payments — a single payment attempt against a parking booking.
//
// Deliberately NOT the existing `payments` collection: parking money is kept
// isolated from ashram money end to end. The Razorpay *helpers* are reused
// read-only (utils/razorpay.js is not modified), but every record written here
// lands in this collection alone.
const parkingPaymentSchema = new mongoose.Schema(
  {
    // FK → parking_bookings._id
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      required: true,
    },
    // FK → users._id
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // FK → parking_partners._id — denormalised for settlement reporting.
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },

    // `overstay` covers the top-up collected by the guard at exit.
    purpose: {
      type: String,
      enum: ['booking', 'overstay'],
      default: 'booking',
    },

    method: {
      type: String,
      enum: ['razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash', 'demo'],
      default: 'razorpay',
    },

    status: {
      type: String,
      enum: PARKING_PAYMENT_STATUS_VALUES,
      default: PARKING_PAYMENT_STATUS.PENDING,
      index: true,
    },

    transactionId: { type: String, default: '', index: true },

    // Razorpay handshake values. The signature is stored for dispute evidence;
    // it is verified before this record is ever marked paid.
    gateway: {
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      signature: { type: String, default: '' },
      provider: { type: String, default: 'razorpay' },
    },

    failureReason: { type: String, default: '' },
    paidAt: { type: Date, default: null },

    refund: {
      amount: { type: Number, default: 0 },
      reference: { type: String, default: '' },
      at: { type: Date, default: null },
      // FK → users._id
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: '' },
    },

    ipAddress: { type: String, default: '' },
  },
  { timestamps: true, collection: 'parking_payments' }
);

parkingPaymentSchema.index({ bookingId: 1, status: 1 });
parkingPaymentSchema.index({ partnerId: 1, status: 1, paidAt: -1 });
parkingPaymentSchema.index({ 'gateway.orderId': 1 });

const ParkingPayment = mongoose.model('ParkingPayment', parkingPaymentSchema);
export default ParkingPayment;
