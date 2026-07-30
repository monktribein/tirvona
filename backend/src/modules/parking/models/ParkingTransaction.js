import mongoose from 'mongoose';
import {
  PARKING_TRANSACTION_TYPES,
  PARKING_TRANSACTION_TYPE_VALUES,
} from '../config/parkingConfig.js';

// parking_transactions — the append-only money ledger for the parking module.
//
// Where parking_payments records a gateway interaction, this records the
// accounting movement: what was earned, what the platform took, what was
// refunded, what was paid out. Reports are built from this collection so a
// gateway retry can never double-count revenue.
const parkingTransactionSchema = new mongoose.Schema(
  {
    // FK → parking_bookings._id. Null for partner-level payouts.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      default: null,
      index: true,
    },
    // FK → parking_payments._id
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPayment',
      default: null,
      index: true,
    },
    // FK → parking_partners._id
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
    },
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
    },

    type: {
      type: String,
      enum: PARKING_TRANSACTION_TYPE_VALUES,
      required: true,
    },

    // Positive = money into the platform, negative = money out (refund/payout).
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },

    description: { type: String, default: '' },
    reference: { type: String, default: '', index: true },

    // Free-form snapshot (commission percent applied, overstay minutes, etc.)
    // so a historical row explains itself without re-deriving from live config.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    // FK → users._id
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'parking_transactions' }
);

// Revenue and settlement reporting.
parkingTransactionSchema.index({ partnerId: 1, type: 1, occurredAt: -1 });
parkingTransactionSchema.index({ locationId: 1, occurredAt: -1 });
parkingTransactionSchema.index({ type: 1, occurredAt: -1 });

export { PARKING_TRANSACTION_TYPES };

const ParkingTransaction = mongoose.model('ParkingTransaction', parkingTransactionSchema);
export default ParkingTransaction;
