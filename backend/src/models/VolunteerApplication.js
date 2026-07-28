import mongoose from 'mongoose';

const volunteerApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VolunteerJob',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    applicantName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    education: {
      type: String,
      default: 'Graduate',
    },
    skills: {
      type: String,
      default: 'Spiritual Seva, Event Management, Communication',
    },
    languages: {
      type: String,
      default: 'Hindi, English',
    },
    availability: {
      type: String,
      default: 'Immediate (Next 7 Days)',
    },
    motivation: {
      type: String,
      required: true,
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['applied', 'shortlisted', 'interviewed', 'accepted', 'rejected'],
      default: 'applied',
      index: true,
    },
    interviewSchedule: {
      date: Date,
      notes: String,
    },
  },
  {
    timestamps: true,
  }
);

const VolunteerApplication =
  mongoose.models.VolunteerApplication || mongoose.model('VolunteerApplication', volunteerApplicationSchema);
export default VolunteerApplication;
