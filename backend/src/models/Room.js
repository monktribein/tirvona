import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Room type name is required (e.g. Standard Triple AC)'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['dormitory', 'private_room', 'family_room', 'hall'],
      required: true,
    },
    acType: {
      type: String,
      enum: ['AC', 'Non-AC'],
      required: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Maximum occupant capacity is required'],
    },
    totalInventory: {
      type: Number,
      required: [true, 'Total number of rooms of this type is required'],
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price per night / bed is required'],
    },
    amenities: [
      {
        type: String,
      },
    ],
    images: [{ type: String }],
    pricingRules: [
      {
        name: { type: String, required: true }, // e.g. Kumbh Mela, Diwali
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        multiplier: { type: Number, default: 1.0 },
        overridePrice: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'under_maintenance'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

roomSchema.index({ ashramId: 1 });
roomSchema.index({ ashramId: 1, status: 1 });
roomSchema.index({ type: 1 });

const Room = mongoose.model('Room', roomSchema);
export default Room;
