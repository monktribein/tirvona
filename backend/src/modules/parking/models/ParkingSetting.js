import mongoose from 'mongoose';

// parking_settings — operational policy, resolved in three tiers.
//
//   scope 'platform' → the global default (a single row, locationId null)
//   scope 'partner'  → overrides for one partner
//   scope 'location' → overrides for one facility
//
// The settings service merges platform ← partner ← location over the hardcoded
// PARKING_DEFAULTS, so an unset field always falls back rather than reading as
// zero. Nothing here is required for the module to run.
const parkingSettingSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['platform', 'partner', 'location'],
      required: true,
    },
    // FK → parking_partners._id (scope 'partner')
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      default: null,
      index: true,
    },
    // FK → parking_locations._id (scope 'location')
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
      index: true,
    },

    // Every value is nullable — null means "inherit from the tier above".
    reservationHoldMinutes: { type: Number, default: null, min: 0 },
    overstayGraceMinutes: { type: Number, default: null, min: 0 },
    noShowAfterMinutes: { type: Number, default: null, min: 0 },
    overstayMultiplier: { type: Number, default: null, min: 0 },
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    minimumBillableHours: { type: Number, default: null, min: 0 },
    freeCancellationHours: { type: Number, default: null, min: 0 },
    refundPercentInsideWindow: { type: Number, default: null, min: 0, max: 100 },
    refundPercentOutsideWindow: { type: Number, default: null, min: 0, max: 100 },
    qrValidityBufferMinutes: { type: Number, default: null, min: 0 },

    allowOnlineBooking: { type: Boolean, default: true },
    allowCancellation: { type: Boolean, default: true },
    requireVehicleNumber: { type: Boolean, default: true },

    // FK → users._id
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'parking_settings' }
);

// One settings row per scope target.
parkingSettingSchema.index(
  { scope: 1, partnerId: 1, locationId: 1 },
  { unique: true }
);

const ParkingSetting = mongoose.model('ParkingSetting', parkingSettingSchema);
export default ParkingSetting;
