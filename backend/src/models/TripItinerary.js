import mongoose from 'mongoose';

const tripItinerarySchema = new mongoose.Schema(
  {
    destination: { type: String, required: true },
    purpose: { type: String, required: true },
    startCity: { type: String, required: true },
    travelDate: { type: String, required: true },
    durationDays: { type: Number, default: 7 },
    adults: { type: Number, default: 2 },
    children: { type: Number, default: 0 },
    seniorCitizens: { type: Number, default: 0 },
    budgetType: { type: String, default: 'Standard' },
    preferences: {
      needAshram: { type: Boolean, default: true },
      needSatvikFood: { type: Boolean, default: true },
      needGuide: { type: Boolean, default: true },
      needVipDarshan: { type: Boolean, default: true },
    },
    totalEstimatedCost: { type: Number, default: 19700 },
    status: { type: String, enum: ['generated', 'saved', 'booked'], default: 'generated' },
  },
  { timestamps: true }
);

// Saved itineraries are listed newest-first, optionally filtered by status.
// (No owner field exists on this schema, so there is no per-user index.)
tripItinerarySchema.index({ status: 1, createdAt: -1 });
tripItinerarySchema.index({ destination: 1, status: 1 });

const TripItinerary = mongoose.model('TripItinerary', tripItinerarySchema);
export default TripItinerary;
