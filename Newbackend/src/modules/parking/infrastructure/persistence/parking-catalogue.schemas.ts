import { Schema, SchemaTypes } from "mongoose";
import {
  PARKING_AMENITIES,
  PARKING_ROLES,
  PARKING_VEHICLE_TYPES,
} from "../../domain/parking.constants";

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

export const ParkingPartnerSchema = new Schema(
  {
    partnerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    userId: { ...id("User", true), index: true },
    businessName: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    contactPhone: { type: String, default: "", trim: true },
    gstNumber: { type: String, default: "", trim: true },
    panNumber: { type: String, default: "", trim: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      district: String,
      state: String,
      pincode: String,
    },
    bankAccount: {
      accountHolder: String,
      accountLast4: String,
      ifsc: String,
      bankName: String,
    },
    documents: [
      {
        docType: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "pending",
      index: true,
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: id("User"),
    rejectionReason: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  opts("parking_partners"),
);
ParkingPartnerSchema.index({ status: 1, createdAt: -1 });
ParkingPartnerSchema.index({ "address.city": 1, status: 1 });

export const ParkingLocationSchema = new Schema(
  {
    partnerId: id("ParkingPartner", true),
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: "" },
    images: [{ type: String, trim: true }],
    coverImage: { type: String, default: "" },
    address: {
      line1: String,
      landmark: String,
      city: { type: String, index: true },
      district: String,
      state: { type: String, index: true },
      pincode: String,
    },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    googleMapsUrl: { type: String, default: "" },
    nearbyDestinations: [
      {
        name: String,
        templeId: id("Temple"),
        templeSlug: { type: String, lowercase: true },
        distanceKm: Number,
        walkingMinutes: Number,
      },
    ],
    supportedVehicleTypes: [{ type: String, enum: PARKING_VEHICLE_TYPES }],
    amenities: [{ type: String, enum: PARKING_AMENITIES }],
    isCovered: { type: Boolean, default: false },
    hasCctv: { type: Boolean, default: false },
    hasSecurity: { type: Boolean, default: false },
    hasWashroom: { type: Boolean, default: false },
    hasEvCharging: { type: Boolean, default: false },
    hasWheelchairAccess: { type: Boolean, default: false },
    openingHours: {
      is24x7: { type: Boolean, default: true },
      opensAt: { type: String, default: "00:00" },
      closesAt: { type: String, default: "23:59" },
    },
    totalCapacity: { type: Number, default: 0, min: 0 },
    contactPhone: String,
    termsAndConditions: String,
    instructions: String,
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    status: {
      type: String,
      enum: ["draft", "pending", "active", "inactive", "suspended"],
      default: "draft",
      index: true,
    },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    createdBy: id("User"),
  },
  opts("parking_locations"),
);
ParkingLocationSchema.index({ geo: "2dsphere" });
ParkingLocationSchema.index({
  status: 1,
  "address.city": 1,
  "rating.average": -1,
});
ParkingLocationSchema.index({ status: 1, supportedVehicleTypes: 1 });
ParkingLocationSchema.index({ partnerId: 1, status: 1 });
ParkingLocationSchema.index({ "nearbyDestinations.templeSlug": 1, status: 1 });
ParkingLocationSchema.pre("save", function () {
  this.set("geo", {
    type: "Point",
    coordinates: [this.get("longitude") || 0, this.get("latitude") || 0],
  });
});

export const ParkingSlotTypeSchema = new Schema(
  {
    locationId: id("ParkingLocation", true),
    name: { type: String, required: true, trim: true },
    code: { type: String, default: "", uppercase: true, trim: true },
    description: { type: String, default: "" },
    vehicleTypes: [{ type: String, enum: PARKING_VEHICLE_TYPES }],
    totalCapacity: { type: Number, required: true, min: 0 },
    isCovered: { type: Boolean, default: false },
    hasEvCharging: { type: Boolean, default: false },
    floorLabel: String,
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  opts("parking_slot_types"),
);
ParkingSlotTypeSchema.index({ locationId: 1, isActive: 1, displayOrder: 1 });
ParkingSlotTypeSchema.index({ locationId: 1, vehicleTypes: 1 });

export const ParkingSlotSchema = new Schema(
  {
    locationId: id("ParkingLocation", true),
    slotTypeId: { ...id("ParkingSlotType", true), index: true },
    slotNumber: { type: String, required: true, trim: true, uppercase: true },
    floorLabel: String,
    zone: String,
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "maintenance", "blocked"],
      default: "available",
      index: true,
    },
    currentBookingId: id("ParkingBooking"),
    occupiedAt: Date,
    maintenanceNote: String,
    isActive: { type: Boolean, default: true },
  },
  opts("parking_slots"),
);
ParkingSlotSchema.index({ locationId: 1, slotNumber: 1 }, { unique: true });
ParkingSlotSchema.index({
  locationId: 1,
  slotTypeId: 1,
  status: 1,
  isActive: 1,
});

export const ParkingVehicleTypeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: PARKING_VEHICLE_TYPES,
    },
    label: { type: String, required: true },
    icon: { type: String, default: "car" },
    footprint: { type: Number, default: 1, min: 0 },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  opts("parking_vehicle_types"),
);
ParkingVehicleTypeSchema.index({ isActive: 1, displayOrder: 1 });

export const ParkingPricingSchema = new Schema(
  {
    locationId: id("ParkingLocation", true),
    slotTypeId: { ...id("ParkingSlotType"), index: true },
    vehicleType: {
      type: String,
      enum: PARKING_VEHICLE_TYPES,
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["hourly", "slab", "flat_day"],
      default: "slab",
    },
    baseFee: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    dailyRate: { type: Number, default: 0, min: 0 },
    slabs: [
      {
        uptoHours: { type: Number, default: null },
        price: { type: Number, default: 0, min: 0 },
        perHourAfter: { type: Number, default: 0, min: 0 },
      },
    ],
    peakMultiplier: { type: Number, default: 1, min: 0 },
    overstayMultiplier: { type: Number, default: null, min: 0 },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    minimumBillableHours: { type: Number, default: 1, min: 0 },
    freeMinutes: { type: Number, default: 0, min: 0 },
    validFrom: Date,
    validUntil: Date,
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: id("User"),
  },
  opts("parking_pricing"),
);
ParkingPricingSchema.index({
  locationId: 1,
  vehicleType: 1,
  isActive: 1,
  slotTypeId: 1,
});
ParkingPricingSchema.index({ locationId: 1, validFrom: 1, validUntil: 1 });

export const ParkingAvailabilitySchema = new Schema(
  {
    locationId: id("ParkingLocation", true),
    slotTypeId: id("ParkingSlotType", true),
    date: { type: Date, required: true, index: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    blockedCount: { type: Number, default: 0, min: 0 },
    customPrice: { type: Number, default: null, min: 0 },
    isClosed: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  opts("parking_availability"),
);
ParkingAvailabilitySchema.index({ slotTypeId: 1, date: 1 }, { unique: true });
ParkingAvailabilitySchema.index({ locationId: 1, date: 1 });

export const ParkingSettingSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["platform", "partner", "location"],
      required: true,
    },
    partnerId: { ...id("ParkingPartner"), index: true },
    locationId: { ...id("ParkingLocation"), index: true },
    reservationHoldMinutes: { type: Number, default: null },
    overstayGraceMinutes: { type: Number, default: null },
    noShowAfterMinutes: { type: Number, default: null },
    overstayMultiplier: { type: Number, default: null },
    commissionPercent: { type: Number, default: null },
    taxPercent: { type: Number, default: null },
    minimumBillableHours: { type: Number, default: null },
    freeCancellationHours: { type: Number, default: null },
    refundPercentInsideWindow: { type: Number, default: null },
    refundPercentOutsideWindow: { type: Number, default: null },
    qrValidityBufferMinutes: { type: Number, default: null },
    allowOnlineBooking: { type: Boolean, default: true },
    allowCancellation: { type: Boolean, default: true },
    requireVehicleNumber: { type: Boolean, default: true },
    updatedBy: id("User"),
  },
  opts("parking_settings"),
);
ParkingSettingSchema.index(
  { scope: 1, partnerId: 1, locationId: 1 },
  { unique: true },
);

export const ParkingHolidaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    partnerId: { ...id("ParkingPartner"), index: true },
    locationId: id("ParkingLocation"),
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    peakMultiplier: { type: Number, default: 1, min: 0 },
    isClosed: { type: Boolean, default: false },
    type: {
      type: String,
      enum: [
        "festival",
        "peak_season",
        "maintenance",
        "closure",
        "public_holiday",
      ],
      default: "festival",
    },
    isActive: { type: Boolean, default: true },
    createdBy: id("User"),
  },
  opts("parking_holidays"),
);
ParkingHolidaySchema.index({ isActive: 1, startDate: 1, endDate: 1 });
ParkingHolidaySchema.index({ locationId: 1, isActive: 1, startDate: 1 });

export const ParkingStaffSchema = new Schema(
  {
    userId: id("User", true),
    partnerId: id("ParkingPartner", true),
    locationIds: [{ type: SchemaTypes.ObjectId, ref: "ParkingLocation" }],
    parkingRole: {
      type: String,
      enum: PARKING_ROLES,
      required: true,
      index: true,
    },
    capabilityOverrides: [{ type: String }],
    employeeCode: { type: String, uppercase: true, trim: true },
    shift: {
      type: String,
      enum: ["morning", "evening", "night", "rotational", "general"],
      default: "general",
    },
    phone: String,
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    assignedBy: id("User"),
    lastActiveAt: Date,
  },
  opts("parking_staff"),
);
ParkingStaffSchema.index(
  { userId: 1, partnerId: 1, parkingRole: 1 },
  { unique: true },
);
ParkingStaffSchema.index({ userId: 1, status: 1 });
ParkingStaffSchema.index({ partnerId: 1, status: 1 });
ParkingStaffSchema.index({ locationIds: 1, status: 1 });
