import mongoose from 'mongoose';

const marketplaceWaitlistSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['buyer', 'seller', 'artisan', 'temple_trust'], default: 'buyer' },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
  },
  { timestamps: true }
);

const MarketplaceWaitlist = mongoose.model('MarketplaceWaitlist', marketplaceWaitlistSchema);
export default MarketplaceWaitlist;
