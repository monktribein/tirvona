import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
    },
    applicableAshrams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ashram',
      },
    ],
    applicableCities: [{ type: String }],
    applicableStates: [{ type: String }],
    applicableRoomCategories: [{ type: String }],

    offerTitle: {
      type: String,
      required: true,
      trim: true,
    },
    shortTitle: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    offerType: {
      type: String,
      enum: [
        'Weekend Offer',
        'Festival Offer',
        'Mahakumbh Offer',
        'Seasonal Offer',
        'Summer Offer',
        'Winter Offer',
        'New Ashram Launch',
        'Donation Campaign',
        'Room Upgrade',
        'Food Offer',
        'Family Package',
        'Senior Citizen Offer',
        'Student Offer',
        'Long Stay Offer',
        'Corporate Retreat',
        'Yoga Camp',
        'Meditation Camp',
        'Special Darshan',
        'Custom',
      ],
      default: 'Festival Offer',
    },

    description: {
      type: String,
      required: true,
    },
    fullHtmlDescription: {
      type: String,
    },
    highlights: [{ type: String }],
    termsAndConditions: [{ type: String }],

    // Images
    bannerImage: {
      type: String,
      default: '/banner/ashram_rishikesh.png',
    },
    thumbnailImage: {
      type: String,
      default: '/banner/ashram_rishikesh.png',
    },
    desktopBanner: {
      type: String,
    },
    mobileBanner: {
      type: String,
    },
    galleryImages: [{ type: String }],

    // Promo & Discount Configuration
    promoCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: [
        'Percentage',
        'Flat Amount',
        'Free Upgrade',
        'Free Meal',
        'Free Prasad',
        'Free Donation Coupon',
      ],
      default: 'Percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maximumDiscount: {
      type: Number,
      default: 0,
    },
    minimumBookingAmount: {
      type: Number,
      default: 0,
    },

    // Validity & Redemptions
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validTill: {
      type: Date,
      required: true,
    },
    maximumRedemptions: {
      type: Number,
      default: 100,
    },
    remainingRedemptions: {
      type: Number,
      default: 100,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },

    // Visibility & Priority
    priority: {
      type: Number,
      default: 1,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'expired', 'disabled'],
      default: 'active',
    },

    // Analytics counters
    viewsCount: { type: Number, default: 0 },
    clicksCount: { type: Number, default: 0 },
    redemptionsCount: { type: Number, default: 0 },
    revenueGenerated: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Auto update status to expired if validTill has passed
offerSchema.pre('save', function (next) {
  if (this.validTill && new Date(this.validTill) < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

// This model previously carried NO indexes at all, so every promo-code
// validation in the booking path was a full collection scan.
// Promo lookup during checkout. Sparse: most offers have no code.
offerSchema.index({ promoCode: 1 }, { sparse: true });
// Public offers listing: { status: 'active', validTill: { $gte: now } }.
offerSchema.index({ status: 1, validTill: 1 });
// Owner's own offers, newest first.
offerSchema.index({ ownerId: 1, createdAt: -1 });
// Offers attached to a property — both the single ref and the multi-ref array.
offerSchema.index({ ashramId: 1, status: 1 });
offerSchema.index({ applicableAshrams: 1, status: 1 });

export const Offer = mongoose.model('Offer', offerSchema);
export default Offer;
