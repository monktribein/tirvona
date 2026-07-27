import mongoose from 'mongoose';

const sacredDirectoryItemSchema = new mongoose.Schema(
  {
    moduleType: {
      type: String,
      required: true,
      enum: [
        'travel-guides',
        'local-guides',
        'transport',
        'restaurants',
        'shops',
        'puja-items',
        'religious-products',
        'books',
        'handicrafts',
      ],
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, required: true },
    price: { type: Number, default: 0 },
    rating: { type: Number, default: 4.8 },
    reviewsCount: { type: Number, default: 120 },
    contactPhone: { type: String, default: '+91 98765 00000' },
    city: { type: String, default: 'Haridwar' },
    state: { type: String, default: 'Uttarakhand' },
    description: { type: String, required: true },
    specifications: [{ label: String, value: String }],
    coverImage: { type: String, required: true },
    gallery: [{ type: String }],
    badge: { type: String, default: 'VERIFIED' },
    featured: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

const SacredDirectoryItem = mongoose.model('SacredDirectoryItem', sacredDirectoryItemSchema);
export default SacredDirectoryItem;
