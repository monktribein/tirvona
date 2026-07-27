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
    status: { type: String, enum: ['active', 'draft'], default: 'active' },
  },
  { timestamps: true }
);

const LocalServiceItem = mongoose.model('LocalServiceItem', localServiceItemSchema);
export default LocalServiceItem;
