import mongoose from 'mongoose';

const visitorArticleSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => 'ART-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    },
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Experience',
        'Travel Guide',
        'Temple History',
        'Food',
        'Festivals',
        'Photography',
        'Videos',
      ],
      default: 'Experience',
      index: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
      maxlength: 350,
    },
    content: {
      type: String,
      required: [true, 'Article content is required'],
    },
    featuredImage: {
      type: String,
      required: [true, 'Featured image is required'],
    },
    galleryImages: [
      {
        type: String,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    language: {
      type: String,
      default: 'English',
      enum: ['English', 'Hindi', 'Sanskrit', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati'],
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    isVerifiedStay: {
      type: Boolean,
      default: true,
    },
    visitDate: {
      type: Date,
      required: true,
    },
    visitMonth: {
      type: String,
      default: '',
    },
    publishedAt: {
      type: Date,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    contributorPoints: {
      type: Number,
      default: 50,
    },
    moderationFlags: {
      spamScore: { type: Number, default: 0 },
      duplicateFlagged: { type: Boolean, default: false },
      offensiveFlagged: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

visitorArticleSchema.index({ status: 1, createdAt: -1 });
visitorArticleSchema.index({ ashramId: 1, status: 1 });
visitorArticleSchema.index({ visitorId: 1, status: 1 });

const VisitorArticle = mongoose.model('VisitorArticle', visitorArticleSchema);
export default VisitorArticle;
