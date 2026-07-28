import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import ServiceProvider from '../models/ServiceProvider.js';

const seedServices = async () => {
  try {
    await connectDB();

    console.log('Clearing existing service providers...');
    await ServiceProvider.deleteMany({});

    const initialServices = [
      // 1. Transport Services
      {
        name: 'Rishikesh Divine Taxi & Cab Service',
        category: 'transport',
        subcategory: 'Verified Taxi & Cab',
        tagline: 'Govt Registered Rishikesh & Char Dham Yatra Cabs',
        description: '24x7 AC cabs, Innova, & Dzire for Haridwar, Rishikesh, Neelkanth, & Kedarnath transfers.',
        city: 'Rishikesh',
        state: 'Uttarakhand',
        address: 'Triveni Ghat Road, Rishikesh',
        pricing: { amount: 1800, unit: 'per day transfer', currency: 'INR' },
        specifications: { govtVerified: true, pureVeg: true, vehicleType: 'AC SUV / Dzire', available24x7: true, languages: ['Hindi', 'English'] },
        contactPhone: '+919876543210',
        whatsappNumber: '+919876543210',
        rating: 4.9,
        reviewCount: 42,
        images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=600&q=80'],
      },
      {
        name: 'Kashi Pilgrimage Helicopter & Airport Transfer',
        category: 'transport',
        subcategory: 'Airport Pickup & Heli Services',
        tagline: 'Varanasi Airport to Kashi Vishwanath Express Pickup',
        description: 'Pre-verified airport transfers & special helipad transfers for senior citizen yatris.',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        address: 'Babatpur Airport Road, Varanasi',
        pricing: { amount: 1200, unit: 'per trip', currency: 'INR' },
        specifications: { govtVerified: true, wheelchairAccessible: true, available24x7: true, languages: ['Hindi', 'English', 'Tamil'] },
        contactPhone: '+919876543211',
        whatsappNumber: '+919876543211',
        rating: 4.8,
        reviewCount: 38,
        images: ['https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80'],
      },

      // 2. Temple Guides
      {
        name: 'Pt. Ramesh Sharma — Certified Kashi Temple Guide',
        category: 'guides',
        subcategory: 'Heritage & Temple History Guide',
        tagline: '15+ Years Experience in Kashi Vishwanath & Ganga Aarti Heritage',
        description: 'Official tourism certified guide for Kashi Vishwanath Corridor, Annapurna Temple, and Manikarnika Ghat.',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        address: 'Dashashwamedh Ghat, Varanasi',
        pricing: { amount: 800, unit: 'per tour session', currency: 'INR' },
        specifications: { govtVerified: true, languages: ['Hindi', 'English', 'Sanskrit', 'Bengali'], available24x7: false },
        contactPhone: '+919876543212',
        whatsappNumber: '+919876543212',
        rating: 5.0,
        reviewCount: 89,
        images: ['https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=600&q=80'],
      },

      // 3. Satvik Food & Bhojnalaya
      {
        name: 'Govinda Satvik Bhojnalaya & Annadanam Counter',
        category: 'food',
        subcategory: 'Pure Veg & Jain Restaurant',
        tagline: '100% Pure Desi Ghee Satvik Thali — No Onion & Garlic',
        description: 'Authentic Vaishnav Satvik meals prepared with Vedic cleanliness near Vrindavan Bankey Bihari Temple.',
        city: 'Vrindavan',
        state: 'Uttar Pradesh',
        address: 'Raman Reti Marg, Vrindavan',
        pricing: { amount: 180, unit: 'per Thali', currency: 'INR' },
        specifications: { pureVeg: true, jainFood: true, noOnionGarlic: true, govtVerified: true, wheelchairAccessible: true },
        contactPhone: '+919876543213',
        whatsappNumber: '+919876543213',
        rating: 4.9,
        reviewCount: 124,
        images: ['https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'],
      },

      // 4. Medical & Emergency Services
      {
        name: 'Char Dham Yatra 24x7 Emergency Cardiac Ambulance',
        category: 'medical',
        subcategory: 'ICU Ambulance & Oxygen Support',
        tagline: '24x7 Rapid Medical Care for Mountain Yatris',
        description: 'Equipped with ventilator, oxygen cylinders, & trained paramedic team stationed along Haridwar-Rishikesh highway.',
        city: 'Haridwar',
        state: 'Uttarakhand',
        address: 'Har Ki Pauri Bypass, Haridwar',
        pricing: { amount: 1500, unit: 'emergency callout', currency: 'INR' },
        specifications: { govtVerified: true, available24x7: true, wheelchairAccessible: true },
        contactPhone: '+919876543214',
        whatsappNumber: '+919876543214',
        rating: 4.9,
        reviewCount: 65,
        images: ['https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=600&q=80'],
      },

      // 5. Nearby Puja Shops & Samagri
      {
        name: 'Shri Ram Authentic Puja Samagri & Flowers Store',
        category: 'shops',
        subcategory: 'Organic Flowers & Puja Kits',
        tagline: 'Fresh Marigold Garlands, Gangajal, & Shringhar Items',
        description: 'Sanctified puja samagri, brass diyas, authentic kumkum, and fresh lotus flower baskets delivered to room.',
        city: 'Ayodhya',
        state: 'Uttar Pradesh',
        address: 'Ram Janmabhoomi Path, Ayodhya',
        pricing: { amount: 250, unit: 'per Puja Basket', currency: 'INR' },
        specifications: { govtVerified: true, pureVeg: true, available24x7: true },
        contactPhone: '+919876543215',
        whatsappNumber: '+919876543215',
        rating: 4.8,
        reviewCount: 51,
        images: ['https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80'],
      },

      // 6. Photography & Drone Event Coverage
      {
        name: 'Ganga Aarti Divine Memories Photography',
        category: 'photography',
        subcategory: 'Photo Studio & Drone Coverage',
        tagline: 'HD Photo & Video Memories at Parmarth Niketan Aarti',
        description: 'Professional photographers capturing your family blessings during Evening Ganga Aarti.',
        city: 'Rishikesh',
        state: 'Uttarakhand',
        address: 'Parmarth Niketan Ghat, Rishikesh',
        pricing: { amount: 1500, unit: 'per session', currency: 'INR' },
        specifications: { govtVerified: true, languages: ['Hindi', 'English'] },
        contactPhone: '+919876543216',
        whatsappNumber: '+919876543216',
        rating: 4.9,
        reviewCount: 34,
        images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'],
      },
    ];

    await ServiceProvider.insertMany(initialServices);
    console.log('Successfully seeded enterprise service providers into MongoDB!');
    process.exit(0);
  } catch (error) {
    console.error('Seed services error:', error);
    process.exit(1);
  }
};

seedServices();
