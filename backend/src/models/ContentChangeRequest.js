import mongoose from 'mongoose';

const contentChangeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      default: 'banner_manager',
    },
    page: {
      type: String,
      required: true,
      default: 'homepage',
    },
    section: {
      type: String,
      required: true, // e.g. 'hero_banner', 'hero_heading', 'slider', 'announcement', 'footer'
    },
    title: {
      type: String,
      default: 'Content Change Request',
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'draft'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

contentChangeRequestSchema.index({ status: 1 });
contentChangeRequestSchema.index({ userId: 1 });
contentChangeRequestSchema.index({ createdAt: -1 });

const ContentChangeRequest = mongoose.model('ContentChangeRequest', contentChangeRequestSchema);
export default ContentChangeRequest;
