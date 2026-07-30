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
    tagline: { type: String, default: '', trim: true },
    ashramType: { type: String, default: '', trim: true },
    establishedYear: { type: String, default: '' },
    foundedBy: { type: String, default: '' },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    history: {
      type: String,
      default: '',
    },
    contact: {
      phone: { type: String, default: '' },
      altPhone: { type: String, default: '' },
      email: { type: String, default: '' },
      website: { type: String, default: '' },
      social: {
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        youtube: { type: String, default: '' },
      },
    },
    trust: {
      trustName: { type: String, default: '' },
      trustRegNo: { type: String, default: '' },
      panNo: { type: String, default: '' },
      trustType: { type: String, default: '' },
      registeredBy: { type: String, default: '' },
    },
    activities: [{ type: String }],
    dailySchedule: { type: String, default: '' },
    specialEvents: { type: String, default: '' },
    pricing: {
      totalCapacity: { type: Number, default: 0 },
      lowestNightPrice: { type: Number, default: 0 },
      peakSeasonMultiplier: { type: Number, default: 1.5 },
      donationInfo: { type: String, default: '' },
    },
    policies: {
      checkInTime: { type: String, default: '' },
      checkOutTime: { type: String, default: '' },
      minStay: { type: Number, default: 1 },
      maxStay: { type: Number, default: 30 },
      cancellationPolicy: { type: String, default: '' },
    },
    food: {
      foodType: { type: String, default: '' },
      mealTimings: {
        breakfast: { type: String, default: '' },
        lunch: { type: String, default: '' },
        dinner: { type: String, default: '' },
      },
      prasadDetails: { type: String, default: '' },
      specialDiet: { type: String, default: '' },
    },
    transport: {
      nearestRailway: { type: String, default: '' },
      railwayDistance: { type: String, default: '' },
      nearestAirport: { type: String, default: '' },
      airportDistance: { type: String, default: '' },
      busStand: { type: String, default: '' },
      busDistance: { type: String, default: '' },
      autoRickshaw: { type: Boolean, default: false },
      taxiAvailable: { type: Boolean, default: false },
      parkingAvailable: { type: Boolean, default: false },
    },
    medical: {
      nearestHospital: { type: String, default: '' },
      hospitalDistance: { type: String, default: '' },
      emergencyPhone: { type: String, default: '' },
      firstAidAvailable: { type: Boolean, default: false },
      ambulanceAccess: { type: Boolean, default: false },
    },
    nearbyAttractions: [
      {
        name: { type: String },
        distance: { type: String },
        type: { type: String },
      },
    ],
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
    addOnServices: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        unit: {
          type: String,
          enum: ['per_day', 'per_meal', 'per_person', 'one_time', 'per_box'],
          default: 'per_day',
        },
        unitLabel: { type: String, default: 'Day' },
        maxQuantity: { type: Number, default: 10 },
        enabled: { type: Boolean, default: true },
        iconUrl: { type: String, default: '' },
        description: { type: String, default: '' },
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

// Geo index & compound performance indexes for high-frequency queries.
//
// Index set is deliberately minimal: an index whose key pattern is a strict
// PREFIX of another index can never be the only usable plan, so it costs write
// throughput and RAM for nothing. Both prefixes that used to live here
// ({ status: 1 } and { status: 1, 'address.city': 1 }) were removed for that
// reason — `{ status: 'approved' }` is still served by the compounds below.
ashramSchema.index({ 'address.coordinates': '2dsphere' });
ashramSchema.index({ ownerId: 1 });
// Public search landing (GET /api/ashrams) — equality on status, then the
// city facet, then the rating ordering. Also serves { status } and
// { status, 'address.city' } on its own via prefix matching.
ashramSchema.index({ status: 1, 'address.city': 1, 'rating.average': -1 });
// Rating-ranked listing with no city facet.
ashramSchema.index({ status: 1, 'rating.average': -1 });

// REMOVED: ashramSchema.index({ isVerified: 1, status: 1 })
// `isVerified` is not a path on this schema — verification is modelled purely
// as status: 'approved'. Mongoose creates indexes from schema.index() without
// validating the path, so this built a real index in which every document held
// a null key and which no query could ever use. Note that deleting the line
// does NOT drop the existing index from MongoDB; run scripts/sync_indexes.js.

// Security Guard: Prevent temporary test documents from being created in production
ashramSchema.pre('save', function (next) {
  if (this.name && (this.name.startsWith('TEMP_') || this.name.startsWith('AUDIT_TEST_'))) {
    if (process.env.NODE_ENV === 'production') {
      return next(new Error('Creation of temporary test ashrams is blocked in production.'));
    }
  }
  next();
});

const Ashram = mongoose.model('Ashram', ashramSchema);
export default Ashram;
