import mongoose from 'mongoose';

// parking_availability — per-slot-type occupancy for a single calendar date.
// This is the concurrency-control record: reservations are taken by a
// conditional $inc against `bookedCount` so a facility can never be oversold.
//
// Mirrors the shape and the guarantee of the existing RoomAvailability model,
// but is a completely separate collection and is never read or written by the
// ashram booking engine.
const parkingAvailabilitySchema = new mongoose.Schema(
  {
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    // FK → parking_slot_types._id
    slotTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlotType',
      required: true,
      index: true,
    },
    // Midnight UTC of the day this row accounts for.
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Capacity snapshot, copied from the slot type when the row is created so a
    // later capacity change cannot retroactively oversell a booked date.
    totalCapacity: { type: Number, required: true, default: 0, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    // Bays withdrawn from sale for repairs/events on this date.
    blockedCount: { type: Number, default: 0, min: 0 },

    // Overrides the rate card for this date only.
    customPrice: { type: Number, default: null, min: 0 },
    isClosed: { type: Boolean, default: false },
    note: { type: String, default: '' },
  },
  { timestamps: true, collection: 'parking_availability' }
);

// One row per (slot type, date). Unique so concurrent upserts converge.
parkingAvailabilitySchema.index({ slotTypeId: 1, date: 1 }, { unique: true });
// Calendar/occupancy queries for a whole facility over a date range.
parkingAvailabilitySchema.index({ locationId: 1, date: 1 });

const ParkingAvailability = mongoose.model('ParkingAvailability', parkingAvailabilitySchema);
export default ParkingAvailability;
