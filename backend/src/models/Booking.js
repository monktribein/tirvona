import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
    },
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
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      required: true,
    },
    guestsCount: {
      type: Number,
      required: true,
      default: 1,
    },
    roomsBookedCount: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'completed',
        'cancelled',
        'refunded',
        'no_show',
      ],
      default: 'pending',
    },
    services: {
      prasad: {
        ordered: { type: Boolean, default: false },
        price: { type: Number, default: 0 },
      },
      meals: {
        ordered: { type: Boolean, default: false },
        price: { type: Number, default: 0 },
      },
      parking: {
        ordered: { type: Boolean, default: false },
        price: { type: Number, default: 0 },
      },
      locker: {
        ordered: { type: Boolean, default: false },
        price: { type: Number, default: 0 },
      },
      donation: {
        amount: { type: Number, default: 0 },
      },
      selectedAddOns: [
        {
          serviceId: { type: String },
          name: { type: String, required: true },
          price: { type: Number, required: true },
          unit: { type: String },
          unitLabel: { type: String },
          quantity: { type: Number, required: true, default: 1 },
          totalPrice: { type: Number, required: true, default: 0 },
        },
      ],
    },
    pricing: {
      basePrice: { type: Number, required: true },
      servicesPrice: { type: Number, required: true, default: 0 },
      donationAmount: { type: Number, required: true, default: 0 },
      extraGuestAmount: { type: Number, default: 0 },
      mealAmount: { type: Number, default: 0 },
      upgradeAmount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      loyaltyDiscount: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      originalAmount: { type: Number },
      finalAmount: { type: Number },
      totalSavings: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      amountPaid: { type: Number, required: true, default: 0 },
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
    },
    appliedOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
    },
    offerName: { type: String },
    promoCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    discountType: { type: String },
    discountPercentage: { type: Number, default: 0 },
    rewardPointsUsed: { type: Number, default: 0 },
    rewardPointsEarned: { type: Number, default: 0 },
    reservationExpiresAt: { type: Date },
    paymentSummary: { type: Object },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partially_paid', 'fully_paid', 'refunded'],
      default: 'pending',
    },
    checkInCode: {
      type: String,
      required: true,
    },
    cancellation: {
      reason: String,
      date: Date,
      refundAmount: Number,
      refundTransactionId: String,
    },
    history: [
      {
        status: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });

// getDashboardBookings filters { ashramId, status } and always sorts
// { createdAt: -1 } with NO limit. Without createdAt in the index MongoDB must
// materialise the whole match and sort it in memory, which does not merely run
// slowly — it aborts with "Sort exceeded memory limit" past 32MB. Supersedes
// the old { ashramId: 1, status: 1 }, which is a prefix of this.
bookingSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
// Reception desk arrivals board: { ashramId, checkInDate: { $gte, $lt } }.
bookingSchema.index({ ashramId: 1, checkInDate: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
