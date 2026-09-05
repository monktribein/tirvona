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

export const TempleSchema = new Schema(
  {
    // 1. Basic Info
    name: { type: String, required: true, trim: true },
    templeShortName: { type: String, trim: true },
    slug: { type: String, unique: true, required: true, index: true },
    shortDescription: { type: String },
    description: { type: String },
    deity: String,
    templeType: String,
    religiousTradition: String,
    templeTags: [String],

    // 2. History & Significance
    establishedYear: String,
    historicalPeriod: String,
    founder: String,
    dynasty: String,
    historicalSignificance: String,
    religiousSignificance: String,
    spiritualSignificance: String,
    templeStory: String,
    importantBeliefs: String,
    importantTraditions: String,
    importantRituals: String,
    architecturalStyle: String,

    // 3. Location
    address: {
      street: { type: String },
      landmark: String,
      area: String,
      city: { type: String, index: true },
      district: { type: String },
      state: { type: String },
      country: { type: String, default: "India" },
      pincode: { type: String },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        // [longitude, latitude]
        coordinates: { type: [Number], required: true },
      },
      mapUrl: String,
      googleMapsEmbedUrl: String,
      plusCode: String,
    },

    // 4. Media
    media: {
      coverImage: String,
      galleryImages: [String],
      templeExteriorImages: [String],
      templeInteriorImages: [String],
      deityImages: [String],
      architectureImages: [String],
      festivalImages: [String],
      aartiImages: [String],
      additionalImages: [String],
      videoUrl: String,
      youtubeUrl: String,
      liveStreamUrl: String,
      officialWebsite: String,
    },

    // 5. Timings
    timings: [
      {
        dayOfWeek: {
          type: String,
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        },
        timeSlots: [
          {
            title: String,
            startTime: String,
            endTime: String,
            description: String,
            isClosed: { type: Boolean, default: false },
            isOpen24Hours: { type: Boolean, default: false },
            isSpecialTiming: { type: Boolean, default: false },
          },
        ],
      },
    ],

    // 8. Visitor Info
    visitorInfo: {
      bestTimeToVisit: String,
      recommendedVisitDuration: String,
      entryFee: String,
      dressCode: String,
      photographyAllowed: String,
      mobilePhoneAllowed: String,
      footwearInstructions: String,
      idRequired: String,
      wheelchairAccessible: String,
      seniorCitizenInformation: String,
      childrenPolicy: String,
      prasadAvailable: String,
      lockerAvailable: String,
      parkingAvailable: String,
      foodAvailable: String,
      drinkingWater: String,
      washrooms: String,
      cloakRoom: String,
      securityInformation: String,
      templeRules: String,
      importantInstructions: String,
      emergencyContact: String,
      templeContactNumber: String,
    },

    // 9. Darshan Information
    darshanInfo: {
      darshanType: String,
      generalDarshan: String,
      specialDarshan: String,
      vipDarshan: String,
      darshanDuration: String,
      queueInformation: String,
      entryGateInformation: String,
      specialEntryInformation: String,
      restrictions: String,
    },

    // 10. How to Reach
    howToReach: {
      byAir: String,
      byTrain: String,
      byBus: String,
      byRoad: String,
      nearestRailwayStation: String,
      nearestAirport: String,
      nearestBusStand: String,
    },

    // 13. SEO
    seo: {
      seoTitle: String,
      seoDescription: String,
      seoKeywords: String,
      canonicalUrl: String,
      ogTitle: String,
      ogDescription: String,
      ogImage: String,
      twitterTitle: String,
      twitterDescription: String,
      twitterImage: String,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived", "active"],
      default: "draft",
      index: true,
    },
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },

    createdBy: id("User"),
    updatedBy: id("User"),
    deletedAt: Date,
  },
  opts("temples")
);

// Crucial geospatial index for nearby entity detection
TempleSchema.index({ "address.coordinates": "2dsphere" });
// Fast lookup indexes
TempleSchema.index({ slug: 1 });
TempleSchema.index({ "address.city": 1, status: 1 });
TempleSchema.index({ isFeatured: 1, status: 1 });

export const TempleAartiSchema = new Schema(
  {
    templeId: id("Temple", true),
    name: { type: String, required: true },
    startTime: { type: String, required: true }, // Format HH:mm
    endTime: { type: String, required: true },
    days: [String], // Array of days, empty implies daily
    description: String,
    specialNotes: String,
    liveStreamUrl: String,
    isActive: { type: Boolean, default: true },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("temple_aartis")
);
TempleAartiSchema.index({ templeId: 1, isActive: 1 });

export const TempleFestivalSchema = new Schema(
  {
    templeId: id("Temple", true),
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: String,
    specialTiming: String,
    specialAarti: String,
    importantInformation: String,
    expectedCrowdLevel: String,
    isActive: { type: Boolean, default: true },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("temple_festivals")
);
TempleFestivalSchema.index({ templeId: 1, startDate: 1 });
