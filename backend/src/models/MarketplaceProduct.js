import mongoose from 'mongoose';

const marketplaceProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'prasad',
        'rudraksha',
        'tulsi_mala',
        'puja_kits',
        'murti',
        'ayurveda',
        'books',
        'temple_clothes',
        'handicrafts',
        'incense',
        'donations',
      ],
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      default: null,
    },
    stock: {
      type: Number,
      default: 50,
    },
    templeSource: {
      type: String,
      default: 'Kashi Vishwanath Temple Trust',
    },
    authenticityCertificate: {
      type: String,
      default: 'Govt Certified & Temple Sanctified',
    },
    weight: {
      type: String,
      default: '250g',
    },
    images: [{ type: String }],
    vendor: {
      name: { type: String, default: 'Tirvona Sacred Heritage Trust' },
      type: { type: String, default: 'Temple Vendor' },
      location: { type: String, default: 'Varanasi, UP' },
      isVerified: { type: Boolean, default: true },
    },
    rating: {
      type: Number,
      default: 4.9,
    },
    reviewCount: {
      type: Number,
      default: 28,
    },
    specifications: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'out_of_stock', 'suspended'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

marketplaceProductSchema.index({ category: 1, status: 1 });

const MarketplaceProduct = mongoose.models.MarketplaceProduct || mongoose.model('MarketplaceProduct', marketplaceProductSchema);
export default MarketplaceProduct;
