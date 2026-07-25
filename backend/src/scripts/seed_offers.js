import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ashram from '../models/Ashram.js';
import User from '../models/User.js';
import Offer from '../models/Offer.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const seedOffers = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    // Clear existing offers
    await Offer.deleteMany({});
    console.log('Cleared previous offers.');

    const ashrams = await Ashram.find();
    if (ashrams.length === 0) {
      console.log('No ashrams found to attach offers to.');
      process.exit(0);
    }

    const saptAshram = ashrams.find(a => a.name.includes('Sapt Rishi')) || ashrams[0];
    const parmarthAshram = ashrams.find(a => a.name.includes('Parmarth')) || ashrams[1] || ashrams[0];
    const shantikunjAshram = ashrams.find(a => a.name.includes('Shantikunj')) || ashrams[2] || ashrams[0];

    const sampleOffers = [
      {
        ashramId: saptAshram._id,
        ownerId: saptAshram.ownerId,
        title: 'Kumbh Mela 2026 Mahakumbh Special Package',
        offerType: 'Kumbh Mela',
        discountPercentage: 20,
        isRateUpgrade: false,
        promoCode: 'KUMBH2026',
        bannerText: '🚩 Sacred Kumbh Mela 2026 Special: Enjoy 20% OFF on quiet riverside sadhana stay & morning aarti!',
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        ashramId: parmarthAshram._id,
        ownerId: parmarthAshram.ownerId,
        title: 'Ardhkumbh Peak Festival Upgrade',
        offerType: 'Ardhkumbh Mela',
        discountPercentage: 30,
        isRateUpgrade: true,
        promoCode: 'ARDHKUMBH30',
        bannerText: '✨ Ardhkumbh Peak Pilgrimage Deal: +30% Rate Upgrade with complimentary VIP Ganga Aarti pass & Satvik Bhojan!',
        startDate: new Date(),
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        ashramId: shantikunjAshram._id,
        ownerId: shantikunjAshram.ownerId,
        title: 'Weekend Spiritual Retreat Special',
        offerType: 'Weekend Special',
        discountPercentage: 25,
        isRateUpgrade: false,
        promoCode: 'WEEKEND25',
        bannerText: '🧘 Weekend Sadhana Deal: Get 25% OFF on Friday-to-Sunday spiritual retreat packages & herbal breakfast!',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    ];

    await Offer.insertMany(sampleOffers);
    console.log(`\nSuccessfully seeded ${sampleOffers.length} active festival offer banners!\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding offers:', error);
    process.exit(1);
  }
};

seedOffers();
