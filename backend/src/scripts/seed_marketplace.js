import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import MarketplaceProduct from '../models/MarketplaceProduct.js';

const seedMarketplace = async () => {
  try {
    await connectDB();

    console.log('Clearing existing marketplace products...');
    await MarketplaceProduct.deleteMany({});

    const initialProducts = [
      {
        name: 'Varanasi Kashi Vishwanath Mahaprasad Box',
        slug: 'varanasi-kashi-vishwanath-mahaprasad-box',
        category: 'prasad',
        description: 'Authentic sanctified Peda and Dry Fruit Prashad directly from Kashi Vishwanath Temple Sanctum Sanctorum.',
        price: 350,
        salePrice: 299,
        stock: 120,
        templeSource: 'Kashi Vishwanath Temple Trust, Varanasi',
        authenticityCertificate: 'Govt Certified Sanctified Prasadam (FSSAI Approved)',
        weight: '400g',
        rating: 4.9,
        reviewCount: 78,
        images: ['https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Shri Kashi Vishwanath Trust Vendor', type: 'Temple Vendor', location: 'Varanasi, UP', isVerified: true },
        isFeatured: true,
      },
      {
        name: 'Mathura Vrindavan Desi Ghee Peda Box',
        slug: 'mathura-vrindavan-desi-ghee-peda-box',
        category: 'prasad',
        description: 'Traditional Mathura Peda made with 100% pure Brij cow milk khoya and cardamom.',
        price: 400,
        salePrice: 349,
        stock: 95,
        templeSource: 'Bankey Bihari Mandir Vendor Trust',
        authenticityCertificate: 'Pure Vaishnav Sanctified Food',
        weight: '500g',
        rating: 4.8,
        reviewCount: 62,
        images: ['https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Brijwasi Temple Sweets', type: 'Temple Vendor', location: 'Mathura, UP', isVerified: true },
        isFeatured: true,
      },
      {
        name: 'Original 5-Mukhi Nepali Rudraksha Japa Mala',
        slug: 'original-5-mukhi-nepali-rudraksha-japa-mala',
        category: 'rudraksha',
        description: '108+1 Lab-Certified Original 5-Mukhi Nepali Rudraksha Mala energised in Har Ki Pauri Ganga Aarti.',
        price: 1200,
        salePrice: 899,
        stock: 60,
        templeSource: 'Haridwar Ganga Sabha Trust',
        authenticityCertificate: 'ISO 9001 Lab Certification Card Included',
        weight: '150g',
        rating: 5.0,
        reviewCount: 110,
        images: ['https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Ganga Heritage Artisans SHG', type: 'Women SHG', location: 'Haridwar, UK', isVerified: true },
        isFeatured: true,
      },
      {
        name: 'Vrindavan Sacred Original Tulsi Japa Mala',
        slug: 'vrindavan-sacred-original-tulsi-japa-mala',
        category: 'tulsi_mala',
        description: 'Handcrafted natural Vrindavan Tulsi wood beads for daily Japa and Radhe Krishna devotion.',
        price: 299,
        salePrice: 199,
        stock: 150,
        templeSource: 'ISKCON Vrindavan Artisans',
        authenticityCertificate: '100% Natural Vrindavan Sacred Wood',
        weight: '80g',
        rating: 4.9,
        reviewCount: 45,
        images: ['https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Vrindavan Crafts NGO', type: 'NGO Vendor', location: 'Vrindavan, UP', isVerified: true },
        isFeatured: false,
      },
      {
        name: 'Handcrafted Pure Brass Panchmukhi Diya & Aarti Lamp',
        slug: 'handcrafted-pure-brass-panchmukhi-diya-aarti-lamp',
        category: 'murti',
        description: 'Heavy gauge pure brass 5-wick Aarti lamp handcrafted by traditional Moradabad artisans.',
        price: 999,
        salePrice: 799,
        stock: 40,
        templeSource: 'Heritage Brass Guild',
        authenticityCertificate: '100% Solid Brass Guarantee',
        weight: '650g',
        rating: 4.8,
        reviewCount: 39,
        images: ['https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Uttar Pradesh Artisans Co-op', type: 'Local Artisan', location: 'Moradabad, UP', isVerified: true },
        isFeatured: true,
      },
      {
        name: 'Complete Daily Nitya Puja Kit (21 Items)',
        slug: 'complete-daily-nitya-puja-kit-21-items',
        category: 'puja_kits',
        description: 'Includes Kumkum, Chandan, Camphor, Dhoop Cone, Gangajal, Moli Thread, Brass Diya, & Janeu.',
        price: 699,
        salePrice: 499,
        stock: 80,
        templeSource: 'Tirvona Spiritual Foundation',
        authenticityCertificate: 'FSSAI & Vedic Standards Approved',
        weight: '850g',
        rating: 4.9,
        reviewCount: 94,
        images: ['https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80'],
        vendor: { name: 'Tirvona Sacred Heritage Trust', type: 'NGO Vendor', location: 'Rishikesh, UK', isVerified: true },
        isFeatured: false,
      },
    ];

    await MarketplaceProduct.insertMany(initialProducts);
    console.log('Successfully seeded enterprise marketplace products into MongoDB!');
    process.exit(0);
  } catch (error) {
    console.error('Seed marketplace error:', error);
    process.exit(1);
  }
};

seedMarketplace();
