import mongoose from 'mongoose';

const serviceBookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    bookingTime: {
      type: String,
      default: '10:00 AM',
    },
    guestsCount: {
      type: Number,
      default: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    specialNotes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'paid',
    },
  },
  {
    timestamps: true,
  }
);

const ServiceBooking = mongoose.models.ServiceBooking || mongoose.model('ServiceBooking', serviceBookingSchema);
export default ServiceBooking;
