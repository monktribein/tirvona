import { Schema, SchemaTypes } from "mongoose";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});
const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

export const AshramSchema = new Schema(
  {
    ownerId: id("User", true),
    ashramCode: { type: String, unique: true, sparse: true, index: true },
    slug: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    tagline: String,
    ashramType: String,
    establishedYear: String,
    foundedBy: String,
    description: { type: String, required: true },
    history: String,
    contact: {
      phone: String,
      altPhone: String,
      email: String,
      website: String,
      social: { facebook: String, instagram: String, youtube: String },
    },
    trust: {
      trustName: String,
      trustRegNo: String,
      panNo: String,
      trustType: String,
      registeredBy: String,
    },
    activities: [String],
    dailySchedule: String,
    specialEvents: String,
    pricing: {
      totalCapacity: { type: Number, default: 0 },
      lowestNightPrice: { type: Number, default: 0 },
      peakSeasonMultiplier: { type: Number, default: 1.5 },
      donationInfo: String,
    },
    policies: {
      checkInTime: String,
      checkOutTime: String,
      minStay: { type: Number, default: 1 },
      maxStay: { type: Number, default: 30 },
      cancellationPolicy: String,
    },
    food: {
      foodType: String,
      mealTimings: { breakfast: String, lunch: String, dinner: String },
      prasadDetails: String,
      specialDiet: String,
    },
    transport: {
      nearestRailway: String,
      railwayDistance: String,
      nearestAirport: String,
      airportDistance: String,
      busStand: String,
      busDistance: String,
      autoRickshaw: Boolean,
      taxiAvailable: Boolean,
      parkingAvailable: Boolean,
    },
    medical: {
      nearestHospital: String,
      hospitalDistance: String,
      emergencyPhone: String,
      firstAidAvailable: Boolean,
      ambulanceAccess: Boolean,
    },
    nearbyAttractions: [{ name: String, distance: String, type: String }],
    rules: [String],
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [77.209, 28.613] },
      },
    },
    amenities: [String],
    addOnServices: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        unit: {
          type: String,
          enum: ["per_day", "per_meal", "per_person", "one_time", "per_box"],
          default: "per_day",
        },
        unitLabel: String,
        maxQuantity: { type: Number, default: 10 },
        enabled: { type: Boolean, default: true },
        iconUrl: String,
        description: String,
      },
    ],
    documents: {
      trustDeedUrl: String,
      fireSafetyCertificateUrl: String,
      landOwnershipUrl: String,
      uploadNotes: String,
    },
    images: [String],
    virtualTour360: [String],
    videos: [String],
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    isVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "pending_docs",
        "pending_inspection",
        "approved",
        "rejected",
        "suspended",
      ],
      default: "pending_docs",
      index: true,
    },
    rejectionReason: String,
    inspectionDetails: {
      officerId: id("User"),
      scheduledDate: Date,
      reportUrl: String,
      comments: String,
      inspectedAt: Date,
    },
    createdBy: id("User"),
    updatedBy: id("User"),
    deletedAt: Date,
    deletedBy: id("User"),
  },
  opts("ashrams"),
);
AshramSchema.index({ "address.coordinates": "2dsphere" });
AshramSchema.index(
  { "trust.trustRegNo": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "trust.trustRegNo": { $type: "string", $gt: "" },
    },
  },
);
AshramSchema.index(
  { "trust.panNo": 1 },
  {
    unique: true,
    partialFilterExpression: { "trust.panNo": { $type: "string", $gt: "" } },
  },
);
AshramSchema.index({ ownerId: 1 });
AshramSchema.index({ status: 1, "address.city": 1, "rating.average": -1 });
AshramSchema.index({ status: 1, "rating.average": -1 });

export const RoomSchema = new Schema(
  {
    ashramId: id("Ashram", true),
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["dormitory", "private_room", "family_room", "hall"],
      required: true,
    },
    acType: { type: String, enum: ["AC", "Non-AC"], required: true },
    capacity: { type: Number, required: true, min: 1 },
    totalInventory: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, required: true, min: 0 },
    amenities: [String],
    images: [String],
    pricingRules: [
      {
        name: String,
        startDate: Date,
        endDate: Date,
        multiplier: { type: Number, default: 1 },
        overridePrice: Number,
      },
    ],
    status: {
      type: String,
      enum: ["active", "under_maintenance"],
      default: "active",
    },
    deletedAt: Date,
  },
  opts("rooms"),
);
RoomSchema.index({ ashramId: 1, status: 1 });
RoomSchema.index({ type: 1 });

export const BookingInventorySchema = new Schema(
  {
    ashramId: id("Ashram", true),
    roomId: id("Room", true),
    date: { type: Date, required: true },
    totalInventory: { type: Number, required: true, min: 0 },
    heldCount: { type: Number, default: 0, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    onlineBookedCount: { type: Number, default: 0, min: 0 },
    offlineBookedCount: { type: Number, default: 0, min: 0 },
    maintenanceCount: { type: Number, default: 0, min: 0 },
    customPrice: Number,
    isClosed: { type: Boolean, default: false },
    note: String,
  },
  opts("booking_daily_availability"),
);
BookingInventorySchema.index({ roomId: 1, date: 1 }, { unique: true });
BookingInventorySchema.index({ ashramId: 1, date: 1 });

export const BookingPricingSchema = new Schema(
  {
    ashramId: id("Ashram", true),
    roomId: id("Room"),
    name: { type: String, required: true },
    validFrom: Date,
    validUntil: Date,
    daysOfWeek: [Number],
    multiplier: { type: Number, default: 1 },
    overridePrice: Number,
    minStay: Number,
    taxPercent: Number,
    platformFeePercent: Number,
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    updatedBy: id("User"),
  },
  opts("booking_pricing"),
);
BookingPricingSchema.index({
  ashramId: 1,
  roomId: 1,
  isActive: 1,
  validFrom: 1,
  validUntil: 1,
});

export const BookingAddonSchema = new Schema(
  {
    ashramId: id("Ashram", true),
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    unit: {
      type: String,
      enum: ["per_day", "per_meal", "per_person", "one_time", "per_box"],
      default: "per_day",
    },
    unitLabel: String,
    maxQuantity: { type: Number, default: 10 },
    enabled: { type: Boolean, default: true },
    iconUrl: String,
    description: String,
    createdBy: id("User"),
  },
  opts("booking_addons"),
);
BookingAddonSchema.index({ ashramId: 1, enabled: 1 });

export const HousekeepingUnitSchema = new Schema(
  {
    ashramId: id("Ashram", true),
    roomId: id("Room"),
    unitNumber: { type: String, required: true },
    bookingId: id("Booking"),
    status: {
      type: String,
      enum: ["clean", "dirty", "cleaning", "maintenance"],
      default: "clean",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    assignedTo: id("User"),
    notes: String,
    lastCleanedAt: Date,
    inspectedBy: id("User"),
    inspectedAt: Date,
    version: { type: Number, default: 1 },
  },
  opts("booking_housekeeping"),
);
HousekeepingUnitSchema.index({ ashramId: 1, unitNumber: 1 }, { unique: true });
HousekeepingUnitSchema.index({ ashramId: 1, status: 1 });
