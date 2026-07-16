import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    method: {
      type: String,
      enum: ['razorpay', 'upi', 'cards', 'net_banking', 'cash'],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['success', 'pending', 'failed', 'refunded'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ bookingId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
