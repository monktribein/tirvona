import mongoose from 'mongoose';
import { PARKING_SLOT_STATUS } from '../config/parkingConfig.js';

// parking_slots — an individual, physically-labelled bay ("B2-014"). A bay is
// assigned at CHECK-IN, not at booking time: reservations consume capacity from
// parking_availability, and the guard's scan pins the vehicle to a real bay.
const parkingSlotSchema = new mongoose.Schema(
  {
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    // FK → parking_slot_types._id
    slotTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlotType',
      required: true,
      index: true,
    },
    slotNumber: { type: String, required: true, trim: true, uppercase: true },
    floorLabel: { type: String, default: '' },
    zone: { type: String, default: '' },

    status: {
      type: String,
      enum: Object.values(PARKING_SLOT_STATUS),
      default: PARKING_SLOT_STATUS.AVAILABLE,
      index: true,
    },

    // Set while a vehicle physically occupies the bay; cleared on check-out.
    // FK → parking_bookings._id
    currentBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      default: null,
    },
    occupiedAt: { type: Date, default: null },

    maintenanceNote: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'parking_slots' }
);

// A bay label is unique within its location.
parkingSlotSchema.index({ locationId: 1, slotNumber: 1 }, { unique: true });
// The assignment query: "give me a free bay of this type here".
parkingSlotSchema.index({ locationId: 1, slotTypeId: 1, status: 1, isActive: 1 });

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);
export default ParkingSlot;
