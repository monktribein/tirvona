import mongoose from 'mongoose';
import { PARKING_VEHICLE_TYPE_VALUES } from '../config/parkingConfig.js';

// parking_slot_types — a bookable inventory bucket within a location, e.g.
// "Covered Two-Wheeler Bay" or "Open SUV Bay". Capacity and availability are
// tracked per slot type, not per individual slot, so a booking never has to
// pin a specific bay at reservation time.
const parkingSlotTypeSchema = new mongoose.Schema(
  {
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    description: { type: String, default: '' },

    // Vehicle classes accepted in this bucket.
    vehicleTypes: [{ type: String, enum: PARKING_VEHICLE_TYPE_VALUES }],

    // Total bays of this type. The single source of truth for capacity; daily
    // occupancy is held in parking_availability.
    totalCapacity: { type: Number, required: true, default: 0, min: 0 },

    isCovered: { type: Boolean, default: false },
    hasEvCharging: { type: Boolean, default: false },
    floorLabel: { type: String, default: '' },

    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'parking_slot_types' }
);

parkingSlotTypeSchema.index({ locationId: 1, isActive: 1, displayOrder: 1 });
parkingSlotTypeSchema.index({ locationId: 1, vehicleTypes: 1 });

const ParkingSlotType = mongoose.model('ParkingSlotType', parkingSlotTypeSchema);
export default ParkingSlotType;
