import mongoose from 'mongoose';

const marketplaceProductSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceCategory',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      default: 0,
    },
    stock: {
      type: Number,
      default: 100,
    },
    images: [{ type: String }],
    description: {
      type: String,
      required: true,
    },
    weight: {
      type: String,
      default: '500g',
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    reviewsCount: {
      type: Number,
      default: 120,
    },
    deliveryDays: {
      type: Number,
      default: 2,
    },
    templeName: {
      type: String,
      required: true,
    },
    storeName: {
      type: String,
      default: 'Shri Tirvona Certified Temple Vendor',
    },

    // Badges & Flags
    festivalSpecial: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: true,
    },
    vegetarian: {
      type: Boolean,
      default: true,
    },
    organic: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'out_of_stock', 'draft'],
      default: 'active',
    },
  },
  { timestamps: true }
);

export const MarketplaceProduct = mongoose.model(
  'MarketplaceProduct',
  marketplaceProductSchema,
  'marketplace_products'
);

export default MarketplaceProduct;
