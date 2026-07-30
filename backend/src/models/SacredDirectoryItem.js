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

// One collection backs nine public routes (travel-guides, transport, shops,
// books, …), each selecting { status: 'active', moduleType } and ranking by
// rating — so moduleType is the primary selectivity after status.
sacredDirectoryItemSchema.index({ status: 1, moduleType: 1, rating: -1 });
sacredDirectoryItemSchema.index({ status: 1, moduleType: 1, category: 1 });

const SacredDirectoryItem = mongoose.model('SacredDirectoryItem', sacredDirectoryItemSchema);
export default SacredDirectoryItem;
