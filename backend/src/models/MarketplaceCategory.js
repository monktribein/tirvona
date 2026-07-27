import mongoose from 'mongoose';

const marketplaceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
      default: '/banner/ashram_rishikesh.png',
    },
    thumbnail: {
      type: String,
      default: '/banner/ashram_rishikesh.png',
    },
    bannerImage: {
      type: String,
      default: '/banner/ashram_rishikesh.png',
    },
    icon: {
      type: String,
      default: 'Award',
    },
    gallery: [{ type: String }],

    originState: {
      type: String,
      required: true,
    },
    originCity: {
      type: String,
      required: true,
    },
    templeName: {
      type: String,
      required: true,
    },

    // About Section Content
    history: {
      type: String,
      default: '',
    },
    importance: {
      type: String,
      default: '',
    },
    whyFamous: {
      type: String,
      default: '',
    },
    devoteeUsage: {
      type: String,
      default: '',
    },
    festivalInfo: {
      type: String,
      default: '',
    },

    // Hero Stats & Badges
    deliveryDays: {
      type: Number,
      default: 2,
    },
    sellerCount: {
      type: Number,
      default: 12,
    },
    rating: {
      type: Number,
      default: 4.9,
    },
    totalOrders: {
      type: Number,
      default: 15400,
    },
    itemCount: {
      type: Number,
      default: 8,
    },

    featured: {
      type: Boolean,
      default: true,
    },
    trendingBadge: {
      type: String,
      default: 'POPULAR',
    },
    displayOrder: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
    },

    // SEO Meta
    seoTitle: {
      type: String,
    },
    seoDescription: {
      type: String,
    },
  },
  { timestamps: true }
);

export const MarketplaceCategory = mongoose.model(
  'MarketplaceCategory',
  marketplaceCategorySchema,
  'marketplace_categories'
);

export default MarketplaceCategory;
