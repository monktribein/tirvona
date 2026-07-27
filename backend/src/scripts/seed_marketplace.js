import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketplaceCategory from '../models/MarketplaceCategory.js';
import MarketplaceProduct from '../models/MarketplaceProduct.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const categoriesData = [
  {
    name: 'Varanasi Lal Peda',
    slug: 'varanasi-peda',
    description: 'Authentic slow-cooked khoya peda from Kashi Vishwanath temple sweetmakers, enriched with saffron and green cardamom.',
    coverImage: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=1200&q=80',
    originState: 'Uttar Pradesh',
    originCity: 'Varanasi',
    templeName: 'Shri Kashi Vishwanath Temple',
    history: 'Varanasi Lal Peda has been offered at Kashi Vishwanath Dham for over two centuries. Crafted by traditional halwais of Godowlia and Thatheri Bazar using pure cow milk reduced for 6 hours.',
    importance: 'Considered auspicious for Shivratri and daily darshan. Devotees take it back home as holy Mahaprasad.',
    whyFamous: 'Renowned for its deep caramelized mahogany color, subtle cardamom scent, and melt-in-the-mouth texture.',
    devoteeUsage: 'Consumed after offer of Ganga jal and Bilva patra to Lord Shiva.',
    festivalInfo: 'High demand during Mahashivratri, Shravan Maas, and Dev Deepawali.',
    deliveryDays: 2,
    sellerCount: 18,
    rating: 4.9,
    totalOrders: 28400,
    trendingBadge: 'BESTSELLER',
    featured: true,
    displayOrder: 1,
    seoTitle: 'Buy Authentic Varanasi Lal Peda Online | Kashi Vishwanath Prashad',
    seoDescription: 'Order original Varanasi Lal Peda slow-cooked in pure desi ghee from Kashi Vishwanath temple vendors. Express 48-hr home delivery across India.',
  },
  {
    name: 'Mathura Peda',
    slug: 'mathura-peda',
    description: 'Traditional slow-roasted mawa peda sweet from Shri Krishna Janmabhoomi Mathura with rich aromatic spices and boora sugar.',
    coverImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1200&q=80',
    originState: 'Uttar Pradesh',
    originCity: 'Mathura',
    templeName: 'Shri Krishna Janmabhoomi Temple',
    history: 'Crafted since the era of Shri Krishna in Braj region using slow-browning khoya and aromatic cardamom.',
    importance: 'Offered as favorite Makhan-Mishri and Peda bhog to Kanha ji.',
    whyFamous: 'Distinctive golden-brown shade, grainy texture, and rich cardamom flavor.',
    devoteeUsage: 'Janmashtami bhog and Braj Yatra prasad.',
    festivalInfo: 'Janmashtami, Radhashtami, and Holi in Braj.',
    deliveryDays: 2,
    sellerCount: 20,
    rating: 4.9,
    totalOrders: 31500,
    trendingBadge: 'MATHURA SPECIAL',
    featured: true,
    displayOrder: 2,
    seoTitle: 'Mathura Peda Online Order | Shri Krishna Janmabhoomi Prasad',
    seoDescription: 'Authentic Mathura Peda prepared in pure desi ghee. Order online for Janmashtami bhog & daily home prasad.',
  },
  {
    name: 'Tirupati Srivari Laddu',
    slug: 'tirupati-laddu',
    description: 'World-famous GI-tagged Tirumala Venkateswara temple laddu made with pure cow ghee, cashew nuts, raisins, and cardamoms.',
    coverImage: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=1200&q=80',
    originState: 'Andhra Pradesh',
    originCity: 'Tirupati',
    templeName: 'Tirumala Venkateswara Temple',
    history: 'First introduced in 1715 AD at Tirumala hills. Prepared in the sacred Potu (temple kitchen) using gram flour, sugar, cashew, and Pachha Karpooram.',
    importance: 'Sanctified by Lord Balaji offering. It carries divine blessings of wealth, health, and prosperity.',
    whyFamous: 'Geographical Indication (GI) tag certification. Unmatched aroma and divine taste revered globally.',
    devoteeUsage: 'Distributed among family and neighbors after returning from Tirumala Darshan.',
    festivalInfo: 'Peak demand during Brahmotsavam and Vaikunta Ekadasi.',
    deliveryDays: 3,
    sellerCount: 12,
    rating: 5.0,
    totalOrders: 42000,
    trendingBadge: 'DIVINE FAVORITE',
    featured: true,
    displayOrder: 3,
    seoTitle: 'Original Tirupati Srivari Laddu Online Delivery | Tirumala Prashad',
    seoDescription: 'Get authentic GI-tagged Tirupati Laddu delivered to your home in sealed protective packaging. 100% genuine Tirumala prashad.',
  },
  {
    name: 'Ayodhya Ram Temple Prasad',
    slug: 'ayodhya-prasad',
    description: 'Sacred Elaichi Dana, Besan Ladoo & Panchmeva offering blessed at Shri Ram Janmabhoomi Mandir Ayodhya.',
    coverImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    originState: 'Uttar Pradesh',
    originCity: 'Ayodhya',
    templeName: 'Shri Ram Janmabhoomi Mandir',
    history: 'Prepared following age-old Ayodhya parampara using pure desi ghee, organic saffron, and dry fruits consecrated in Ram Lalla Pran Pratishtha.',
    importance: 'Symbolizes the divine return of Prabhu Shri Ram and brings peace and harmony to home.',
    whyFamous: 'Directly consecrated at the newly consecrated Ram Janmabhoomi Temple.',
    devoteeUsage: 'Offered at home mandir during Sundarkand path and Ram Navami.',
    festivalInfo: 'Ram Navami, Diwali, and Pran Pratishtha anniversaries.',
    deliveryDays: 2,
    sellerCount: 24,
    rating: 4.9,
    totalOrders: 35600,
    trendingBadge: 'TRENDING',
    featured: true,
    displayOrder: 4,
    seoTitle: 'Ayodhya Ram Temple Prasad Online Booking | Shri Ram Janmabhoomi',
    seoDescription: 'Order authentic Ayodhya Ram Lalla Mahaprasad online. Freshly packed besan ladoo & dry fruit prasad with fast delivery.',
  },
  {
    name: 'Puri Jagannath Mahaprasad',
    slug: 'puri-mahaprasad',
    description: 'Holy Khaja & Nirmalya cooked in earthen pots on 7 traditional clay stoves at Puri Shri Mandir.',
    coverImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1200&q=80',
    originState: 'Odisha',
    originCity: 'Puri',
    templeName: 'Shri Jagannath Temple Puri',
    history: 'Prepared in Rosaghara (largest kitchen in the world) where Goddess Mahalaxmi is believed to supervise the cooking.',
    importance: 'Known as Abhada or Chhappan Bhog. It is believed that partaking in Mahaprasad grants ultimate liberation.',
    whyFamous: 'Unique flaky layered Khaja dipped in cardamom sugar syrup that stays fresh for months.',
    devoteeUsage: 'Shared with reverence among family and spiritual seekers.',
    festivalInfo: 'Ratha Yatra, Chandan Yatra, and Snana Yatra.',
    deliveryDays: 3,
    sellerCount: 15,
    rating: 4.9,
    totalOrders: 19800,
    trendingBadge: 'SACRED 56 BHOG',
    featured: true,
    displayOrder: 5,
    seoTitle: 'Puri Jagannath Temple Mahaprasad Khaja Online | Odisha Special',
    seoDescription: 'Buy fresh Puri Jagannath Temple Khaja & Nirmalya Mahaprasad online. Express delivery straight from Lord Jagannath Dham Puri.',
  },
  {
    name: 'Shirdi Sai Sansthan Halwa',
    slug: 'shirdi-halwa',
    description: 'Blessed Wheat Halwa & Udi Mahaprasad from Shri Saibaba Sansthan Trust Shirdi.',
    coverImage: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=1200&q=80',
    originState: 'Maharashtra',
    originCity: 'Shirdi',
    templeName: 'Shri Saibaba Sansthan Temple',
    history: 'Made in Prasadalaya where thousands of devotees partake in Baba\'s langar daily.',
    importance: 'Carries Sai Baba\'s message of Sabka Malik Ek and spiritual healing.',
    whyFamous: 'Rich aromatic suji-wheat halwa roasted in pure ghee with dry fruits.',
    devoteeUsage: 'Thursday Sai vrat parana and daily home puja.',
    festivalInfo: 'Ramnavami, Guru Purnima, and Vijayadashami in Shirdi.',
    deliveryDays: 2,
    sellerCount: 14,
    rating: 4.9,
    totalOrders: 16700,
    trendingBadge: 'POPULAR',
    featured: true,
    displayOrder: 6,
    seoTitle: 'Shirdi Sai Baba Prasad Online | Wheat Halwa & Ladoo Delivery',
    seoDescription: 'Order authentic Shirdi Sai Baba Sansthan Mahaprasad online. Delivered fresh with tamper-proof packing.',
  },
];

const seedMarketplace = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    // Clear existing marketplace data
    await MarketplaceCategory.deleteMany({});
    await MarketplaceProduct.deleteMany({});
    console.log('Cleared previous marketplace categories & products.');

    // Insert categories
    const createdCategories = await MarketplaceCategory.insertMany(categoriesData);
    console.log(`Inserted ${createdCategories.length} marketplace categories.`);

    // Create products for each category
    const productsData = [];
    for (const cat of createdCategories) {
      productsData.push(
        {
          categoryId: cat._id,
          productName: `${cat.name} Premium Pack (500g)`,
          slug: `${cat.slug}-500g`,
          price: 350,
          discountPrice: 299,
          stock: 150,
          images: [cat.coverImage, cat.thumbnail],
          description: `Authentic ${cat.name} prepared by traditional sweetmakers of ${cat.originCity} using 100% pure desi ghee and handpicked nuts. Consecrated at ${cat.templeName}.`,
          weight: '500g',
          rating: cat.rating,
          reviewsCount: 184,
          deliveryDays: cat.deliveryDays,
          templeName: cat.templeName,
          storeName: `Shri ${cat.originCity} Heritage Sweet Bhandar`,
          festivalSpecial: true,
          featured: true,
          vegetarian: true,
          organic: true,
          status: 'active',
        },
        {
          categoryId: cat._id,
          productName: `${cat.name} Family Gift Box (1 kg)`,
          slug: `${cat.slug}-1kg`,
          price: 680,
          discountPrice: 599,
          stock: 200,
          images: [cat.bannerImage, cat.coverImage],
          description: `Royal 1kg tin pack of ${cat.name} ideal for family rituals, festival celebrations, and bulk prasad distribution. Consecrated at ${cat.templeName}.`,
          weight: '1 kg',
          rating: 4.9,
          reviewsCount: 240,
          deliveryDays: cat.deliveryDays,
          templeName: cat.templeName,
          storeName: `Authentic ${cat.templeName} Vendor`,
          festivalSpecial: true,
          featured: true,
          vegetarian: true,
          organic: true,
          status: 'active',
        }
      );
    }

    const createdProducts = await MarketplaceProduct.insertMany(productsData);
    console.log(`Inserted ${createdProducts.length} marketplace products.`);

    console.log('\nSuccessfully re-seeded direct Unsplash CDN URLs into MongoDB Atlas!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding marketplace:', error);
    process.exit(1);
  }
};

seedMarketplace();
