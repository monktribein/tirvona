import mongoose from 'mongoose';

const templeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    deity: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    history: { type: String, required: true },
    architectureStyle: { type: String, default: 'Nagara & Dravidian Architecture' },
    darshanTimings: { type: String, required: true },
    aartiTimings: { type: String, required: true },
    dressCode: { type: String, default: 'Traditional Indian attire recommended.' },
    rules: [{ type: String }],
    phone: { type: String, default: '+91 98765 43210' },
    officialWebsite: { type: String, default: 'https://tirvona.com' },
    trustName: { type: String, default: 'Shri Temple Sansthan Trust' },
    coverImage: { type: String, required: true },
    gallery: [{ type: String }],
    faqs: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    rating: { type: Number, default: 4.9 },
    reviewsCount: { type: Number, default: 520 },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    featured: { type: Boolean, default: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
  },
  { timestamps: true }
);

// Temples directory: { status: 'active' } faceted by city/state, ranked by
// rating. (`slug` is already indexed by its unique: true.)
templeSchema.index({ status: 1, rating: -1, createdAt: -1 });
templeSchema.index({ status: 1, city: 1 });
templeSchema.index({ status: 1, state: 1 });

const Temple = mongoose.model('Temple', templeSchema);
export default Temple;
