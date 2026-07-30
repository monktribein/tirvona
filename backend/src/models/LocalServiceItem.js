import mongoose from 'mongoose';

const localServiceItemSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['transport', 'guides', 'food', 'medical', 'emergency', 'shops', 'photography', 'stays', 'events'],
    },
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    phone: { type: String, default: '+91 98765 00000' },
    rating: { type: Number, default: 4.9 },
    reviewsCount: { type: Number, default: 140 },
    badge: { type: String, default: 'VERIFIED OPERATOR' },
    price: { type: String, default: 'Contact for Fare' },
    description: { type: String, required: true },
    image: { type: String, required: true },
    gallery: [{ type: String }],
    status: { type: String, enum: ['active', 'draft', 'pending', 'approved', 'rejected'], default: 'active' },

    // SECTION 1: Address & Coordinates
    address: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },

    // SECTION 3: Pricing
    discount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },

    // SECTION 4: Contact
    email: { type: String },
    website: { type: String },

    // SECTION 5: Availability
    openingHours: { type: String, default: '06:00 AM' },
    closingHours: { type: String, default: '09:00 PM' },
    weeklyOff: { type: String, default: 'None' },

    // SECTION 6: Verification & Flags
    isVerified: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    // SECTION 7: SEO
    slug: { type: String },
    metaTitle: { type: String },
    metaDescription: { type: String },
  },
  { timestamps: true }
);

// Local services hub: filtered by city + category within active listings.
localServiceItemSchema.index({ status: 1, city: 1, category: 1 });
localServiceItemSchema.index({ status: 1, category: 1, rating: -1 });

const LocalServiceItem = mongoose.model('LocalServiceItem', localServiceItemSchema);
export default LocalServiceItem;
