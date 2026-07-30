import mongoose from 'mongoose';

// parking_commissions — the platform's cut on a single booking, and its
// settlement state toward the partner.
//
// One row per confirmed booking. Written at confirmation with the percentage in
// force at that moment, so a later rate renegotiation never rewrites history.
const parkingCommissionSchema = new mongoose.Schema(
  {
    // FK → parking_bookings._id. `unique` already builds the index, so no
    // separate `index: true` — that would register {bookingId:1} twice.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      required: true,
      unique: true,
    },
    // FK → parking_partners._id
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      required: true,
    },
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },

    // What the visitor actually paid, before the split.
    grossAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    // grossAmount − commissionAmount. Stored rather than derived so a settlement
    // statement is a plain read.
    partnerEarning: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },

    settlementStatus: {
      type: String,
      enum: ['pending', 'processing', 'settled', 'on_hold', 'reversed'],
      default: 'pending',
    },
    settledAt: { type: Date, default: null },
    settlementReference: { type: String, default: '' },
    // Groups the bookings paid out together.
    payoutBatchId: { type: String, default: '', index: true },

    // Set when the underlying booking is refunded — the commission reverses too.
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: '' },

    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'parking_commissions' }
);

// Settlement runs: everything owed to one partner, oldest first.
parkingCommissionSchema.index({ partnerId: 1, settlementStatus: 1, createdAt: 1 });
parkingCommissionSchema.index({ settlementStatus: 1, createdAt: -1 });

const ParkingCommission = mongoose.model('ParkingCommission', parkingCommissionSchema);
export default ParkingCommission;
