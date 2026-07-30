import mongoose from 'mongoose';
import {
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_AMENITIES,
} from '../config/parkingConfig.js';

// parking_locations — a physical parking facility. This is the record a pilgrim
// searches, browses and books against.
const parkingLocationSchema = new mongoose.Schema(
  {
    // FK → parking_partners._id
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: '' },
    images: [{ type: String, trim: true }],
    coverImage: { type: String, default: '' },

    address: {
      line1: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, default: '', index: true },
      district: { type: String, default: '' },
      state: { type: String, default: '', index: true },
      pincode: { type: String, default: '' },
    },

    // GeoJSON point, so proximity search can use a 2dsphere index rather than
    // scanning and sorting in application code.
    geo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      // [longitude, latitude] — GeoJSON order, not lat/lng.
      coordinates: { type: [Number], default: [0, 0] },
    },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    googleMapsUrl: { type: String, default: '' },

    // Destinations / temples this facility serves, with walking distance. Free
    // text plus an optional FK into the existing temples collection — the ref is
    // read-only and never writes to that collection.
    nearbyDestinations: [
      {
        name: { type: String, trim: true },
        templeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Temple' },
        templeSlug: { type: String, trim: true, lowercase: true },
        distanceKm: { type: Number, default: 0 },
        walkingMinutes: { type: Number, default: 0 },
      },
    ],

    supportedVehicleTypes: [
      {
        type: String,
        enum: PARKING_VEHICLE_TYPE_VALUES,
      },
    ],

    amenities: [{ type: String, enum: PARKING_AMENITIES }],

    // Denormalised amenity booleans. The array above drives filtering; these
    // make the detail page render without a lookup and keep the API response
    // shape explicit for the UI.
    isCovered: { type: Boolean, default: false },
    hasCctv: { type: Boolean, default: false },
    hasSecurity: { type: Boolean, default: false },
    hasWashroom: { type: Boolean, default: false },
    hasEvCharging: { type: Boolean, default: false },
    hasWheelchairAccess: { type: Boolean, default: false },

    openingHours: {
      // A 24×7 facility skips the per-day window entirely.
      is24x7: { type: Boolean, default: true },
      opensAt: { type: String, default: '00:00' }, // 'HH:mm', local time
      closesAt: { type: String, default: '23:59' },
    },

    totalCapacity: { type: Number, default: 0, min: 0 },

    contactPhone: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
    instructions: { type: String, default: '' },

    // Maintained by parkingReviewService — never written by clients.
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },

    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'inactive', 'suspended'],
      default: 'draft',
    },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    // FK → users._id
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'parking_locations' }
);

// Proximity search ("parking near me / near this temple").
parkingLocationSchema.index({ geo: '2dsphere' });
// The common search shape: active listings in a city, best-rated first.
parkingLocationSchema.index({ status: 1, 'address.city': 1, 'rating.average': -1 });
parkingLocationSchema.index({ status: 1, supportedVehicleTypes: 1 });
parkingLocationSchema.index({ partnerId: 1, status: 1 });
parkingLocationSchema.index({ 'nearbyDestinations.templeSlug': 1, status: 1 });

// Keep the GeoJSON point and the flat lat/lng fields in step. Clients send the
// familiar latitude/longitude pair; the 2dsphere index needs [lng, lat].
parkingLocationSchema.pre('save', function syncGeo(next) {
  if (this.isModified('latitude') || this.isModified('longitude') || this.isNew) {
    this.geo = { type: 'Point', coordinates: [this.longitude || 0, this.latitude || 0] };
  }
  next();
});

const ParkingLocation = mongoose.model('ParkingLocation', parkingLocationSchema);
export default ParkingLocation;
