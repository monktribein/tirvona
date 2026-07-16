import mongoose from 'mongoose';

const ashramSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Ashram name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    history: {
      type: String,
      default: '',
    },
    rules: [
      {
        type: String,
      },
    ],
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [77.209, 28.613], // Default New Delhi coordinates
        },
      },
    },
    amenities: [
      {
        type: String, // e.g. WiFi, Hot Water, Meditation Hall, Cow Shelter, River View, Lift, Wheelchair
      },
    ],
    documents: {
      trustDeedUrl: { type: String, default: '' },
      fireSafetyCertificateUrl: { type: String, default: '' },
      landOwnershipUrl: { type: String, default: '' },
    },
    images: [{ type: String }],
    virtualTour360: [{ type: String }],
    videos: [{ type: String }],
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['pending_docs', 'pending_inspection', 'approved', 'rejected', 'suspended'],
      default: 'pending_docs',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    inspectionDetails: {
      officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      scheduledDate: { type: Date },
      reportUrl: { type: String, default: '' },
      comments: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

// Geo index for spatial search
ashramSchema.index({ 'address.coordinates': '2dsphere' });
ashramSchema.index({ status: 1 });
ashramSchema.index({ ownerId: 1 });

const Ashram = mongoose.model('Ashram', ashramSchema);
export default Ashram;
