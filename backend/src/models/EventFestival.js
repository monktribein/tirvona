import mongoose from 'mongoose';

const eventFestivalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    eventType: {
      type: String,
      required: true,
      enum: ['Kumbh Mela', 'Mahakumbh', 'Navratri', 'Diwali', 'Holi', 'Janmashtami', 'Ram Navami', 'Temple Event', 'Festival Special'],
      default: 'Temple Event',
    },
    location: { type: String, required: true },
    templeName: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, required: true },
    ticketPrice: { type: String, default: 'Free Entry / Online Pass Available' },
    registrationLink: { type: String, default: '/register' },
    coverImage: { type: String, required: true },
    gallery: [{ type: String }],
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'draft'], default: 'upcoming' },
    featured: { type: Boolean, default: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
  },
  { timestamps: true }
);

// Events listing sorts { startDate: 1 } and optionally facets by eventType.
eventFestivalSchema.index({ startDate: 1 });
eventFestivalSchema.index({ eventType: 1, startDate: 1 });

const EventFestival = mongoose.model('EventFestival', eventFestivalSchema);
export default EventFestival;
