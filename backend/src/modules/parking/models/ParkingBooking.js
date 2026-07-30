import mongoose from 'mongoose';
import {
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_BOOKING_STATUS,
  PARKING_BOOKING_STATUS_VALUES,
  PARKING_PAYMENT_STATUS,
  PARKING_PAYMENT_STATUS_VALUES,
} from '../config/parkingConfig.js';

// parking_bookings — a pilgrim's reservation of a parking bay.
//
// Entirely separate from the ashram `bookings` collection: no field, index or
// controller is shared, and neither engine reads the other's records.
const parkingBookingSchema = new mongoose.Schema(
  {
    // Human-facing reference, e.g. TVN-PKG-8F3A21. Unique.
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // FK → users._id (the visitor). Reuses the platform's existing identity.
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    // FK → parking_partners._id — denormalised so partner reports never need a
    // join through the location collection.
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      required: true,
    },
    // FK → parking_slot_types._id
    slotTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlotType',
      required: true,
      index: true,
    },
    // FK → parking_slots._id. Null until the guard assigns a bay at check-in.
    assignedSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      default: null,
    },
    assignedSlotNumber: { type: String, default: '' },

    // ── Vehicle ──────────────────────────────────────────────────────────────
    vehicleType: {
      type: String,
      enum: PARKING_VEHICLE_TYPE_VALUES,
      required: true,
      index: true,
    },
    // Normalised to uppercase, no spaces/hyphens, so the guard's typed lookup
    // matches regardless of how the visitor entered it.
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    vehicleModel: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },

    // ── Booked window ────────────────────────────────────────────────────────
    entryAt: { type: Date, required: true, index: true },
    exitAt: { type: Date, required: true },
    // Whole hours between entryAt and exitAt, rounded up to the billable floor.
    durationHours: { type: Number, required: true, min: 0 },
    // Every calendar date the reservation touches. Drives the availability
    // release on cancel/checkout without recomputing the span.
    occupiedDates: [{ type: Date }],

    // ── Actuals ──────────────────────────────────────────────────────────────
    checkedInAt: { type: Date, default: null },
    checkedOutAt: { type: Date, default: null },
    actualDurationMinutes: { type: Number, default: null },
    overstayMinutes: { type: Number, default: 0, min: 0 },

    // ── Money (snapshot at booking time; the rate card may change later) ──────
    pricing: {
      baseFee: { type: Number, default: 0 },
      durationAmount: { type: Number, default: 0 },
      peakMultiplier: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 },
      taxPercent: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      // Charged at exit when the vehicle stayed beyond the grace period.
      overstayAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    // Platform commission on this booking, computed at confirmation.
    commission: {
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      partnerEarning: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: PARKING_BOOKING_STATUS_VALUES,
      default: PARKING_BOOKING_STATUS.PENDING,
    },
    paymentStatus: {
      type: String,
      enum: PARKING_PAYMENT_STATUS_VALUES,
      default: PARKING_PAYMENT_STATUS.PENDING,
      index: true,
    },

    // A pending booking holds inventory only until this moment.
    reservationExpiresAt: { type: Date, default: null },

    cancellation: {
      reason: { type: String, default: '' },
      cancelledAt: { type: Date, default: null },
      // FK → users._id
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      refundAmount: { type: Number, default: 0 },
      refundReference: { type: String, default: '' },
    },

    // Append-only lifecycle trail. Mirrors the `history` convention already used
    // by the ashram Booking model.
    history: [
      {
        status: { type: String },
        note: { type: String, default: '' },
        at: { type: Date, default: Date.now },
        // FK → users._id
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    notes: { type: String, default: '' },
    source: { type: String, enum: ['web', 'app', 'counter'], default: 'web' },
  },
  { timestamps: true, collection: 'parking_bookings' }
);

// "My bookings", newest first.
parkingBookingSchema.index({ customerId: 1, createdAt: -1 });
// Partner/manager dashboards: today's arrivals and departures per facility.
parkingBookingSchema.index({ locationId: 1, status: 1, entryAt: 1 });
parkingBookingSchema.index({ partnerId: 1, status: 1, createdAt: -1 });
// The guard's manual fallback when a QR will not scan.
parkingBookingSchema.index({ locationId: 1, vehicleNumber: 1, status: 1 });
// Sweeper for unpaid holds and no-shows.
parkingBookingSchema.index({ status: 1, reservationExpiresAt: 1 });

const ParkingBooking = mongoose.model('ParkingBooking', parkingBookingSchema);
export default ParkingBooking;
