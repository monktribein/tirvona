import mongoose from 'mongoose';

const serviceProviderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'transport',
        'guides',
        'food',
        'medical',
        'shops',
        'photography',
        'events',
        'emergency',
      ],
      index: true,
    },
    subcategory: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      default: 'Uttarakhand',
    },
    address: {
      type: String,
      default: '',
    },
    coordinates: {
      lat: { type: Number, default: 30.0869 },
      lng: { type: Number, default: 78.2676 },
    },
    pricing: {
      amount: { type: Number, required: true, default: 0 },
      unit: { type: String, default: 'per service' },
      currency: { type: String, default: 'INR' },
    },
    specifications: {
      pureVeg: { type: Boolean, default: false },
      jainFood: { type: Boolean, default: false },
      noOnionGarlic: { type: Boolean, default: false },
      govtVerified: { type: Boolean, default: true },
      wheelchairAccessible: { type: Boolean, default: false },
      languages: [{ type: String }],
      vehicleType: { type: String, default: '' },
      available24x7: { type: Boolean, default: false },
    },
    contactPhone: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 12,
    },
    images: [{ type: String }],
    isVerified: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceProviderSchema.index({ city: 1, category: 1, status: 1 });

const ServiceProvider = mongoose.models.ServiceProvider || mongoose.model('ServiceProvider', serviceProviderSchema);
export default ServiceProvider;
