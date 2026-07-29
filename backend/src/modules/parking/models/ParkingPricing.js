import mongoose from 'mongoose';
import {
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_PRICING_MODES,
} from '../config/parkingConfig.js';

// parking_pricing — the rate card for one (location, slot type, vehicle type)
// combination. Multiple rows may exist for the same combination with different
// validity windows; the pricing service picks the most specific active one.
const parkingPricingSchema = new mongoose.Schema(
  {
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    // FK → parking_slot_types._id. Null means "any slot type at this location".
    slotTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlotType',
      default: null,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: PARKING_VEHICLE_TYPE_VALUES,
      required: true,
      index: true,
    },

    mode: {
      type: String,
      enum: Object.values(PARKING_PRICING_MODES),
      default: PARKING_PRICING_MODES.SLAB,
    },

    // Charged once per booking, on top of the duration-based amount.
    baseFee: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    // Billing ceiling for a 24-hour block; also the rate used in flat_day mode.
    dailyRate: { type: Number, default: 0, min: 0 },

    /**
     * Slab pricing, e.g. ₹30 for the first 2h, ₹20/h thereafter. Evaluated in
     * ascending `uptoHours` order; the final open-ended slab should set
     * `uptoHours: null`.
     */
    slabs: [
      {
        uptoHours: { type: Number, default: null },
        price: { type: Number, default: 0, min: 0 },
        perHourAfter: { type: Number, default: 0, min: 0 },
      },
    ],

    // Multiplier applied on dates listed in parking_holidays (Kumbh, festivals).
    peakMultiplier: { type: Number, default: 1, min: 0 },
    // Multiplier applied to each overstayed hour beyond the grace period.
    overstayMultiplier: { type: Number, default: null, min: 0 },

    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    minimumBillableHours: { type: Number, default: 1, min: 0 },
    freeMinutes: { type: Number, default: 0, min: 0 },

    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true },
    // FK → users._id
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'parking_pricing' }
);

// The rate-card lookup performed on every quote.
parkingPricingSchema.index({ locationId: 1, vehicleType: 1, isActive: 1, slotTypeId: 1 });
parkingPricingSchema.index({ locationId: 1, validFrom: 1, validUntil: 1 });

const ParkingPricing = mongoose.model('ParkingPricing', parkingPricingSchema);
export default ParkingPricing;
