import mongoose from 'mongoose';

// A physical, individually-trackable room unit within a room category.
// Room categories carry an inventory *count*; RoomUnits make each physical room
// addressable for housekeeping (clean / dirty / cleaning / maintenance).
const roomUnitSchema = new mongoose.Schema(
  {
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    unitNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['clean', 'dirty', 'cleaning', 'maintenance'],
      default: 'clean',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Housekeeping staff currently responsible
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// One unit number per room category.
roomUnitSchema.index({ roomId: 1, unitNumber: 1 }, { unique: true });
roomUnitSchema.index({ ashramId: 1, status: 1 });

const RoomUnit = mongoose.model('RoomUnit', roomUnitSchema);
export default RoomUnit;
