import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    ashramId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ashram',
      required: [true, 'Ashram selection is required'],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Offer title is required'],
      trim: true,
    },
    offerType: {
      type: String,
      enum: ['Kumbh Mela', 'Ardhkumbh Mela', 'Weekend Special', 'Festival Deal', 'Seasonal Offer', 'General'],
      default: 'General',
    },
    discountPercentage: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    isRateUpgrade: {
      type: Boolean,
      default: false, // true = price upgrade/surge (e.g. +30%), false = discount (-20%)
    },
    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'SPECIAL20',
    },
    bannerText: {
      type: String,
      required: [true, 'Banner text is required'],
      default: 'Special festival packages and seasonal booking discounts available!',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ ashramId: 1 });
offerSchema.index({ ownerId: 1 });
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const Offer = mongoose.model('Offer', offerSchema);
export default Offer;
