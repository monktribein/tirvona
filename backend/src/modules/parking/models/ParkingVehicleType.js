import mongoose from 'mongoose';
import { PARKING_VEHICLE_TYPE_VALUES } from '../config/parkingConfig.js';

// parking_vehicle_types — the catalogue of vehicle classes. Seeded from
// PARKING_VEHICLE_TYPE_META, but kept as a collection so an operator can retire
// a class or re-label it without a code deploy.
const parkingVehicleTypeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: PARKING_VEHICLE_TYPE_VALUES,
    },
    label: { type: String, required: true, trim: true },
    icon: { type: String, default: 'car' },
    // Standard slot units this class consumes (a bus needs four bays).
    footprint: { type: Number, default: 1, min: 0 },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'parking_vehicle_types' }
);

parkingVehicleTypeSchema.index({ isActive: 1, displayOrder: 1 });

const ParkingVehicleType = mongoose.model('ParkingVehicleType', parkingVehicleTypeSchema);
export default ParkingVehicleType;
