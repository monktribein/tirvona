import mongoose from 'mongoose';

const volunteerJobSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
    },
    ashramName: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    state: {
      type: String,
      default: 'Uttarakhand',
    },
    title: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'volunteer',
        'internship',
        'full_time',
        'part_time',
        'temple_guide',
        'festival_seva',
        'kitchen_seva',
        'medical_seva',
        'digital_marketing',
        'event_coordinator',
        'security',
        'administration',
      ],
      default: 'volunteer',
      index: true,
    },
    openingsCount: {
      type: Number,
      default: 5,
    },
    duration: {
      type: String,
      default: '1 Month (Extendable)',
    },
    accommodation: {
      type: String,
      enum: ['free_ashram_stay', 'paid', 'none'],
      default: 'free_ashram_stay',
    },
    food: {
      type: String,
      enum: ['satvik_free_3_meals', 'paid', 'none'],
      default: 'satvik_free_3_meals',
    },
    stipend: {
      type: String,
      default: 'Honorarium + Accommodation',
    },
    certificateProvided: {
      type: Boolean,
      default: true,
    },
    responsibilities: [String],
    requirements: [String],
    benefits: [String],
    contactPerson: {
      name: String,
      phone: String,
      email: String,
    },
    deadline: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    status: {
      type: String,
      enum: ['open', 'closing_soon', 'closed'],
      default: 'open',
      index: true,
    },
    isGovtVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const VolunteerJob = mongoose.models.VolunteerJob || mongoose.model('VolunteerJob', volunteerJobSchema);
export default VolunteerJob;
