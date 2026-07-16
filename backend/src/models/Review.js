import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    rating: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      cleanliness: { type: Number, required: true, min: 1, max: 5 },
      service: { type: Number, required: true, min: 1, max: 5 },
      location: { type: Number, required: true, min: 1, max: 5 },
      valueForMoney: { type: Number, required: true, min: 1, max: 5 },
    },
    comment: {
      type: String,
      required: [true, 'Please add a comment'],
    },
    reply: {
      managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      comment: { type: String },
      timestamp: { type: Date },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'hidden'],
      default: 'approved',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a customer can only review an ashram once per booking
reviewSchema.index({ bookingId: 1 }, { unique: true });
reviewSchema.index({ ashramId: 1, status: 1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
