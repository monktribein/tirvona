import mongoose from 'mongoose';

const roomCategoryRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
    },
    stayAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    categoryData: {
      name: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      maxGuests: { type: Number, required: true, default: 2 },
      defaultAmenities: [{ type: String }],
      suggestedBasePrice: { type: Number, default: 500 },
      images: [{ type: String }],
      reasonForRequest: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'needs_modification'],
      default: 'pending',
    },
    reviewComment: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    history: [
      {
        status: String,
        reviewComment: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

roomCategoryRequestSchema.index({ ashramId: 1, status: 1 });
roomCategoryRequestSchema.index({ stayAdminId: 1 });
roomCategoryRequestSchema.index({ status: 1 });

const RoomCategoryRequest = mongoose.model('RoomCategoryRequest', roomCategoryRequestSchema, 'room_category_requests');
export default RoomCategoryRequest;
