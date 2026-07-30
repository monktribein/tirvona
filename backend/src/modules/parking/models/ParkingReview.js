import mongoose from 'mongoose';

// parking_reviews — a rating left against a parking facility.
//
// Separate from the platform `reviews` collection (which is scoped to ashrams)
// so neither aggregate can contaminate the other.
const parkingReviewSchema = new mongoose.Schema(
  {
    // FK → parking_locations._id
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    // FK → users._id
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // FK → parking_bookings._id. Required: only a completed stay can be rated,
    // which is what makes the aggregate trustworthy.
    // Indexed below as a unique index — declaring `index: true` here as well
    // would register the same {bookingId:1} key twice.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingBooking',
      required: true,
    },

    rating: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      safety: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      staff: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
    },

    comment: { type: String, default: '', trim: true, maxlength: 2000 },
    images: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    moderationNote: { type: String, default: '' },
    // FK → users._id
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    partnerResponse: {
      text: { type: String, default: '' },
      at: { type: Date, default: null },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true, collection: 'parking_reviews' }
);

// One review per booking — the uniqueness constraint that stops rating stuffing.
parkingReviewSchema.index({ bookingId: 1 }, { unique: true });
parkingReviewSchema.index({ locationId: 1, status: 1, createdAt: -1 });

const ParkingReview = mongoose.model('ParkingReview', parkingReviewSchema);
export default ParkingReview;
