import mongoose from 'mongoose';

const pilgrimageCircuitSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    circuitType: {
      type: String,
      required: true,
      enum: [
        'Char Dham',
        '12 Jyotirlinga',
        'Shakti Peeth',
        'Sapta Puri',
        'Ramayana Circuit',
        'Krishna Circuit',
        'Buddhist Circuit',
        'Jain Circuit',
        'Sikh Circuit',
        'South India Circuit',
        'North India Circuit',
        'General Circuit',
      ],
      default: 'General Circuit',
    },
    duration: { type: String, required: true }, // e.g. '12 Days / 11 Nights'
    distance: { type: String, required: true }, // e.g. '1,450 km'
    budgetRange: { type: String, default: '₹15,000 - ₹35,000 per person' },
    recommendedSeason: { type: String, default: 'May to October' },
    description: { type: String, required: true },
    coverImage: { type: String, required: true },
    gallery: [{ type: String }],
    stops: [
      {
        day: { type: Number, required: true },
        stopName: { type: String, required: true },
        templeOrSpot: { type: String },
        city: { type: String },
        description: { type: String },
      },
    ],
    nearbyStayCount: { type: Number, default: 12 },
    rating: { type: Number, default: 4.9 },
    reviewsCount: { type: Number, default: 340 },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    featured: { type: Boolean, default: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
  },
  { timestamps: true }
);

const PilgrimageCircuit = mongoose.model('PilgrimageCircuit', pilgrimageCircuitSchema);
export default PilgrimageCircuit;
