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
    },
    pricing: {
      basePrice: { type: Number, required: true },
      servicesPrice: { type: Number, required: true, default: 0 },
      donationAmount: { type: Number, required: true, default: 0 },
      totalAmount: { type: Number, required: true },
      amountPaid: { type: Number, required: true, default: 0 },
    },
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

bookingSchema.index({ customerId: 1 });
bookingSchema.index({ ashramId: 1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
