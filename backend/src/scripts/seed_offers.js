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

    const masterOwner = await User.findOne({ email: 'stayadmin@tirvona.com' });
    const ownerId = masterOwner?._id || ashrams[0].ownerId;

    const sampleOffers = [
      {
        ownerId,
        ashramId: ashrams[0]._id,
        applicableAshrams: ashrams.slice(0, 3).map((a) => a._id),
        applicableCities: ['Haridwar', 'Rishikesh'],
        offerTitle: 'Kumbh Mela 2026 Mahakumbh Special Package',
        shortTitle: 'Kumbh Mela 2026 Deal',
        subtitle: '20% OFF on riverside sadhana stay & morning aarti pass',
        offerType: 'Mahakumbh Offer',
        description: 'Experience the holy Kumbh Mela 2026 with 20% OFF accommodation, complimentary Satvik meals, VIP Ganga Aarti access, and quiet sadhana halls.',
        highlights: [
          '20% OFF all room categories',
          'Free Satvik Breakfast & Herbal Tea',
          'VIP Pass for Evening Ganga Aarti',
          'Guided Morning Yoga & Pranayama Sessions',
        ],
        termsAndConditions: [
          'Valid for stays booked between Feb 2026 and April 2026.',
          'Promo code KUMBH2026 must be applied at checkout.',
          'Non-transferable coupon.',
        ],
        bannerImage: '/banner/ashram_rishikesh.png',
        thumbnailImage: '/banner/ashram_rishikesh.png',
        promoCode: 'KUMBH2026',
        discountType: 'Percentage',
        discountValue: 20,
        maximumDiscount: 1000,
        minimumBookingAmount: 1200,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        maximumRedemptions: 250,
        remainingRedemptions: 245,
        priority: 10,
        featured: true,
        status: 'active',
      },
      {
        ownerId,
        ashramId: ashrams[1]?._id || ashrams[0]._id,
        applicableAshrams: ashrams.slice(1, 4).map((a) => a._id),
        applicableCities: ['Rishikesh'],
        offerTitle: 'Weekend Spiritual Yoga & Meditation Sadhana Special',
        shortTitle: 'Weekend Sadhana Deal',
        subtitle: 'FLAT ₹500 OFF on 3-Day Retreat Packages',
        offerType: 'Weekend Offer',
        description: 'Recharge your mind, body, and soul with our weekend spiritual retreat package in Rishikesh. Enjoy complimentary yoga sessions and organic Satvik dining.',
        highlights: [
          'FLAT ₹500 Instant Discount',
          'Complimentary Yoga Mat & Meditation Kit',
          'Free Organic Ayurvedic Meal',
          'Access to Sacred Meditation Cave',
        ],
        termsAndConditions: [
          'Valid for weekend stays (Friday to Sunday).',
          'Minimum booking amount of ₹1000 required.',
        ],
        bannerImage: '/banner/ashram_rishikesh.png',
        thumbnailImage: '/banner/ashram_rishikesh.png',
        promoCode: 'WEEKEND500',
        discountType: 'Flat Amount',
        discountValue: 500,
        maximumDiscount: 500,
        minimumBookingAmount: 1000,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        maximumRedemptions: 100,
        remainingRedemptions: 98,
        priority: 8,
        featured: true,
        status: 'active',
      },
      {
        ownerId,
        ashramId: ashrams[2]?._id || ashrams[0]._id,
        applicableAshrams: ashrams.slice(2, 5).map((a) => a._id),
        applicableCities: ['Vrindavan', 'Varanasi'],
        offerTitle: 'Spring Festival Darshan & Room Upgrade Deal',
        shortTitle: 'Festival Room Upgrade',
        subtitle: 'Free Room Upgrade & Special Temple Prasad',
        offerType: 'Festival Offer',
        description: 'Book your spiritual pilgrimage stay during the festival season and get a complimentary upgrade to a Deluxe Ganga View room with special prasad.',
        highlights: [
          'Complimentary Room Category Upgrade',
          'Special Blessed Temple Prasad Packet',
          '24/7 Hot Water & Pure Vegetarian Dining',
        ],
        termsAndConditions: [
          'Subject to room availability.',
          'Promo code FESTIVAL2026 must be applied during booking.',
        ],
        bannerImage: '/banner/ashram_rishikesh.png',
        thumbnailImage: '/banner/ashram_rishikesh.png',
        promoCode: 'FESTIVAL2026',
        discountType: 'Free Upgrade',
        discountValue: 25,
        maximumDiscount: 800,
        minimumBookingAmount: 800,
        validFrom: new Date(),
        validTill: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        maximumRedemptions: 150,
        remainingRedemptions: 142,
        priority: 9,
        featured: true,
        status: 'active',
      },
    ];

    await Offer.insertMany(sampleOffers);
    console.log(`\nSuccessfully seeded ${sampleOffers.length} enterprise active offers in MongoDB Atlas!\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding offers:', error);
    process.exit(1);
  }
};

seedOffers();
