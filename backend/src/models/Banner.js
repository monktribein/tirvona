import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: [
        'homepage',
        'hero_slider',
        'offers',
        'blog',
        'marketplace',
        'destination',
        'festival',
        'mobile',
        'desktop',
      ],
      default: 'homepage',
    },
    imageUrl: {
      type: String,
      required: [true, 'Banner image URL is required'],
    },
    targetUrl: {
      type: String,
      default: '/',
    },
    deviceType: {
      type: String,
      enum: ['all', 'desktop', 'mobile'],
      default: 'all',
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'approved', 'rejected', 'scheduled', 'archived'],
      default: 'pending',
    },
    priorityOrder: {
      type: Number,
      default: 1,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    clicksCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Banner', bannerSchema);
