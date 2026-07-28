import mongoose from 'mongoose';

const userMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    bookingDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    plannerDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    offerDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    marketplaceCart: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    wishlist: {
      type: [String],
      default: [],
    },
    recentSearches: {
      type: [String],
      default: [],
    },
    recentCities: {
      type: [String],
      default: [],
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dashboardState: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    profileProgress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: { language: 'en', currency: 'INR', theme: 'light' },
    },
    recentlyViewed: {
      type: [String],
      default: [],
    },
    lastVisitedPage: {
      path: { type: String, default: '/' },
      timestamp: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

const UserMemory = mongoose.models.UserMemory || mongoose.model('UserMemory', userMemorySchema);
export default UserMemory;
