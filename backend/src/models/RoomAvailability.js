import mongoose from 'mongoose';

const roomAvailabilitySchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    bookedCount: {
      type: Number,
      default: 0,
    },
    maintenanceCount: {
      type: Number,
      default: 0,
    },
    customPrice: {
      type: Number, // Optional override price for this specific date
    },
  },
  {
    timestamps: true,
  }
);

// Ensure query combination is efficient and unique per date per room
roomAvailabilitySchema.index({ roomId: 1, date: 1 }, { unique: true });

const RoomAvailability = mongoose.model('RoomAvailability', roomAvailabilitySchema);
export default RoomAvailability;
