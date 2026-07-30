import mongoose from 'mongoose';

const plannerTemplateSchema = new mongoose.Schema(
  {
    destination: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    purpose: { type: String, required: true },
    durationDays: { type: Number, default: 7 },
    bestSeason: { type: String, default: 'May to October' },
    crowdLevel: { type: String, default: 'Moderate' },
    weather: { type: String, default: '14°C - Clear' },
    totalDistance: { type: String, default: '1,450 km' },
    dayPlans: [
      {
        day: { type: Number, required: true },
        title: { type: String, required: true },
        morning: { type: String },
        afternoon: { type: String },
        evening: { type: String },
        night: { type: String },
      },
    ],
    estimatedCostPerPerson: { type: Number, default: 19700 },
    packingList: [{ type: String }],
    status: { type: String, enum: ['active', 'draft'], default: 'active' },
  },
  { timestamps: true }
);

// Planner templates are read as { status: 'active' }. (`slug` is already
// indexed by its unique: true.)
plannerTemplateSchema.index({ status: 1, createdAt: -1 });

const PlannerTemplate = mongoose.model('PlannerTemplate', plannerTemplateSchema);
export default PlannerTemplate;
