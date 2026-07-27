import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PilgrimageCircuit from '../models/PilgrimageCircuit.js';
import Temple from '../models/Temple.js';
import EventFestival from '../models/EventFestival.js';
import SacredDirectoryItem from '../models/SacredDirectoryItem.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const circuitsData = [
  {
    title: 'Char Dham Yatra Uttarakhand',
    slug: 'char-dham-uttarakhand',
    circuitType: 'Char Dham',
    duration: '12 Days / 11 Nights',
    distance: '1,450 km',
    budgetRange: '₹22,000 - ₹45,000 per person',
    recommendedSeason: 'May to October',
    description: 'Sacred journey covering Yamunotri, Gangotri, Kedarnath, and Badrinath nestled in the majestic Himalayas.',
    coverImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80',
    ],
    stops: [
      { day: 1, stopName: 'Haridwar to Barkot', templeOrSpot: 'Yamuna River Ghat', city: 'Haridwar', description: 'Begin journey with Ganga Aarti.' },
      { day: 2, stopName: 'Yamunotri Dham Darshan', templeOrSpot: 'Yamunotri Temple', city: 'Yamunotri', description: 'Trek to holy Yamunotri shrine.' },
      { day: 3, stopName: 'Uttarkashi', templeOrSpot: 'Kashi Vishwanath Uttarkashi', city: 'Uttarkashi', description: 'Evening prayers at Kashi Vishwanath.' },
      { day: 4, stopName: 'Gangotri Dham Darshan', templeOrSpot: 'Gangotri Temple', city: 'Gangotri', description: 'Holy dip in Bhagirathi River.' },
      { day: 5, stopName: 'Guptkashi', templeOrSpot: 'Vishwanath Temple', city: 'Guptkashi', description: 'Overnight rest before Kedarnath trek.' },
      { day: 6, stopName: 'Kedarnath Dham Darshan', templeOrSpot: 'Kedarnath Jyotirlinga', city: 'Kedarnath', description: 'Sacred Jyotirlinga darshan.' },
      { day: 7, stopName: 'Badrinath Dham Darshan', templeOrSpot: 'Badrinath Temple', city: 'Badrinath', description: 'Tapt Kund dip & Lord Vishnu darshan.' },
    ],
    rating: 5.0,
    reviewsCount: 480,
    featured: true,
  },
  {
    title: '12 Jyotirlinga Maha Yatra',
    slug: '12-jyotirlinga-yatra',
    circuitType: '12 Jyotirlinga',
    duration: '21 Days / 20 Nights',
    distance: '6,200 km',
    budgetRange: '₹45,000 - ₹85,000 per person',
    recommendedSeason: 'October to March',
    description: 'Divine pilgrimage covering all 12 sacred Jyotirlinga shrines of Lord Shiva across India.',
    coverImage: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=800&q=80',
    ],
    stops: [
      { day: 1, stopName: 'Somnath Jyotirlinga', templeOrSpot: 'Somnath Temple', city: 'Veraval', description: 'First Jyotirlinga on Gujarat coast.' },
      { day: 3, stopName: 'Nageshwar Jyotirlinga', templeOrSpot: 'Nageshwar Temple', city: 'Dwarka', description: 'Sacred shrine near Dwarka.' },
      { day: 6, stopName: 'Mahakaleshwar Jyotirlinga', templeOrSpot: 'Mahakaleshwar Temple', city: 'Ujjain', description: 'Bhasma Aarti at Ujjain.' },
    ],
    rating: 4.9,
    reviewsCount: 390,
    featured: true,
  },
  {
    title: '51 Shakti Peeth Parikrama',
    slug: '51-shakti-peeth-circuit',
    circuitType: 'Shakti Peeth',
    duration: '15 Days / 14 Nights',
    distance: '3,800 km',
    budgetRange: '₹30,000 - ₹60,000 per person',
    recommendedSeason: 'September to April',
    description: 'Sacred circuit honoring Goddess Adi Parashakti across Kamakhya, Kalighat, Tarapith, and Vindhyachal.',
    coverImage: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
    stops: [
      { day: 1, stopName: 'Kamakhya Devi Temple', templeOrSpot: 'Nilachal Hill', city: 'Guwahati', description: 'Blessed Shakti Peeth darshan.' },
      { day: 4, stopName: 'Kalighat Shakti Peeth', templeOrSpot: 'Kalighat Mandir', city: 'Kolkata', description: 'Sacred Bengali Shakti shrine.' },
    ],
    rating: 4.9,
    reviewsCount: 260,
    featured: true,
  },
];

const templesData = [
  {
    name: 'Shri Kashi Vishwanath Temple',
    slug: 'kashi-vishwanath-varanasi',
    deity: 'Lord Shiva (Kashi Vishwanath)',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    history: 'One of the most famous Hindu temples dedicated to Lord Shiva, located on the western bank of holy River Ganga in Varanasi.',
    architectureStyle: 'Traditional North Indian Nagara style with 15.5 meter high gold spire.',
    darshanTimings: '03:00 AM - 11:00 PM',
    aartiTimings: 'Mangla Aarti: 03:00 AM | Sringara Aarti: 09:00 PM',
    dressCode: 'Saree / Salwar for women, Dhoti / Kurta for men.',
    rules: ['No mobile phones or electronic gadgets inside corridor', 'Leather items prohibited'],
    phone: '+91 542 239 2629',
    officialWebsite: 'https://shrikashivishwanath.org',
    trustName: 'Kashi Vishwanath Temple Trust',
    coverImage: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=1200&q=80',
    rating: 4.9,
    reviewsCount: 1250,
    featured: true,
  },
  {
    name: 'Shri Mahakaleshwar Temple Ujjain',
    slug: 'mahakaleshwar-ujjain',
    deity: 'Lord Shiva (Mahakal)',
    city: 'Ujjain',
    state: 'Madhya Pradesh',
    history: 'One of the twelve Jyotirlingas, famous for its unique south-facing idol (Dakshinamurti) and world-renowned Bhasma Aarti.',
    architectureStyle: 'Maratha, Bhumija, and Chalukya architectural influences.',
    darshanTimings: '04:00 AM - 11:00 PM',
    aartiTimings: 'Bhasma Aarti: 04:00 AM (Advance booking required) | Sandhya Aarti: 07:00 PM',
    dressCode: 'Strict traditional dress for Bhasma Aarti (Saree for women, Dhoti for men).',
    rules: ['Bhasma Aarti requires prior online registration', 'Strict security checking'],
    phone: '+91 734 255 0563',
    officialWebsite: 'https://mahakaleshwar.nic.in',
    trustName: 'Shri Mahakaleshwar Mandir Prabandhan Samiti',
    coverImage: 'https://images.unsplash.com/photo-1608958416801-9c60e3a6a908?auto=format&fit=crop&w=1200&q=80',
    rating: 4.9,
    reviewsCount: 980,
    featured: true,
  },
  {
    name: 'Shri Ram Janmabhoomi Mandir',
    slug: 'ram-janmabhoomi-ayodhya',
    deity: 'Bhagwan Shri Ram Lalla',
    city: 'Ayodhya',
    state: 'Uttar Pradesh',
    history: 'The sacred birthplace of Lord Ram, newly consecrated grand pink sandstone mandir designed by Sompura family.',
    architectureStyle: 'Grand Nagara architectural style with 161 ft high Shikhara.',
    darshanTimings: '06:30 AM - 12:00 PM & 02:00 PM - 10:00 PM',
    aartiTimings: 'Shringar Aarti: 06:30 AM | Sandhya Aarti: 07:30 PM',
    dressCode: 'Modest traditional Indian clothing.',
    rules: ['Free entry for all devotees', 'Baggage storage provided outside perimeter'],
    phone: '+91 5278 297000',
    officialWebsite: 'https://srjbtkshetra.org',
    trustName: 'Shri Ram Janmabhoomi Teerth Kshetra Trust',
    coverImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    rating: 5.0,
    reviewsCount: 2400,
    featured: true,
  },
];

const eventsData = [
  {
    title: 'Prayagraj Mahakumbh Mela 2026',
    slug: 'mahakumbh-mela-2026',
    eventType: 'Mahakumbh',
    location: 'Triveni Sangam, Prayagraj',
    templeName: 'Prayagraj Sangam Ghats',
    startDate: new Date('2026-01-14'),
    endDate: new Date('2026-02-26'),
    description: 'The world\'s largest spiritual gathering at the confluence of Ganga, Yamuna, and mythical Saraswati rivers.',
    ticketPrice: 'Free Sacred Access',
    coverImage: 'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=1200&q=80',
    featured: true,
  },
  {
    title: 'Mahashivratri Grand Celebration Kashi',
    slug: 'mahashivratri-kashi-2026',
    eventType: 'Temple Event',
    location: 'Kashi Vishwanath Temple, Varanasi',
    templeName: 'Kashi Vishwanath Temple',
    startDate: new Date('2026-02-15'),
    endDate: new Date('2026-02-16'),
    description: 'All-night Shiva Barat procession and continuous Abhishek at Kashi Vishwanath Dham.',
    ticketPrice: 'Free Darshan / Special Pass Available',
    coverImage: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=1200&q=80',
    featured: true,
  },
];

const directoryItemsData = [
  // 1. Travel Guides
  {
    moduleType: 'travel-guides',
    title: 'Kedarnath Trek Complete Travel Guide',
    slug: 'kedarnath-trek-guide',
    category: 'Trek & Yatra Guide',
    city: 'Kedarnath',
    state: 'Uttarakhand',
    description: 'Essential packing list, fitness tips, pony/palki rates, and weather safety advice for 16 km Gaurikund-Kedarnath trek.',
    coverImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
    badge: 'VERIFIED GUIDE',
  },
  // 2. Local Guides
  {
    moduleType: 'local-guides',
    title: 'Pandit Ramesh Sharma (Certified Kashi Guide)',
    slug: 'pandit-ramesh-sharma-vns',
    category: 'Varanasi Heritage & Temple Guide',
    price: 1200,
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    contactPhone: '+91 98390 12345',
    description: 'Licensed Ministry of Tourism guide with 15 years experience in Ganga Aarti, heritage gully walks, and Kashi temple histories.',
    coverImage: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=800&q=80',
    badge: 'CERTIFIED GUIDE',
  },
  // 3. Transport & Cabs
  {
    moduleType: 'transport',
    title: 'Haridwar to Char Dham AC Innova Crysta Cab Service',
    slug: 'haridwar-chardham-innova-cab',
    category: 'Himalayan Cab Rental',
    price: 3800,
    city: 'Haridwar',
    state: 'Uttarakhand',
    contactPhone: '+91 94120 54321',
    description: 'Experienced hill drivers, sanitized vehicles, all-India tourist permit, and 24/7 mountain breakdown support.',
    coverImage: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80',
    badge: 'VERIFIED OPERATOR',
  },
  // 4. Restaurants & Prasad
  {
    moduleType: 'restaurants',
    title: 'Chotiwala Pure Vegetarian Satvik Restaurant Rishikesh',
    slug: 'chotiwala-satvik-restaurant-rishikesh',
    category: 'Pure Satvik Bhojnalaya',
    price: 250,
    city: 'Rishikesh',
    state: 'Uttarakhand',
    description: 'Iconic 60-year-old vegetarian dining near Ram Jhula serving pure onion-garlic free thalis and authentic Ayurvedic food.',
    coverImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
    badge: 'PURE SATVIK',
  },
  // 5. Shops & Services
  {
    moduleType: 'shops',
    title: 'Ganga Kripa Authentic Rudraksha & Gemstone Store',
    slug: 'ganga-kripa-rudraksha-haridwar',
    category: 'Sacred Store & Pharmacy',
    city: 'Haridwar',
    state: 'Uttarakhand',
    description: 'Government certified 1 to 14 Mukhi Nepal Rudraksha, pure Sphatik malas, and copper puja utensils.',
    coverImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    badge: 'GOVT CERTIFIED',
  },
  // 6. Puja Items
  {
    moduleType: 'puja-items',
    title: 'Complete Maha Shivratri Panchamrit & Puja Kit',
    slug: 'mahashivratri-puja-kit',
    category: 'Sacred Puja Kit',
    price: 499,
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    description: 'Includes pure cow ghee, organic gangajal, bilva patra, dhatura, janeyu, bhasma, and brass diya.',
    coverImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    badge: 'TOP RATED',
  },
  // 7. Religious Products
  {
    moduleType: 'religious-products',
    title: 'Pure Brass Shri Ram Lalla Idol (9 Inches)',
    slug: 'brass-ram-lalla-idol-9in',
    category: 'Brass Idols & Frames',
    price: 1850,
    city: 'Ayodhya',
    state: 'Uttar Pradesh',
    description: 'Handcrafted solid brass idol carved by Ayodhya master artisans with intricate antique polish.',
    coverImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    badge: 'HANDCRAFTED',
  },
  // 8. Books & Media
  {
    moduleType: 'books',
    title: 'Shrimad Bhagavad Gita (As It Is - Hardbound Gold Edition)',
    slug: 'bhagavad-gita-gold-edition',
    category: 'Spiritual Scriptures & E-Books',
    price: 450,
    city: 'Vrindavan',
    state: 'Uttar Pradesh',
    description: 'Original Sanskrit verses with clear Hindi & English translation and commentary.',
    coverImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
    badge: 'BESTSELLER',
  },
  // 9. Handicrafts & Gifts
  {
    moduleType: 'handicrafts',
    title: 'Kashi Handloom Saffron Silk Puja Stole (Angavastram)',
    slug: 'kashi-saffron-angavastram',
    category: 'Handloom & Temple Crafts',
    price: 890,
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    description: 'Pure hand-woven silk angavastram embroidered with Mahamrityunjaya Mantra.',
    coverImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    badge: 'HANDLOOM SILK',
  },
];

const seedServices = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    await PilgrimageCircuit.deleteMany({});
    await Temple.deleteMany({});
    await EventFestival.deleteMany({});
    await SacredDirectoryItem.deleteMany({});
    console.log('Cleared previous sacred services data.');

    await PilgrimageCircuit.insertMany(circuitsData);
    await Temple.insertMany(templesData);
    await EventFestival.insertMany(eventsData);
    await SacredDirectoryItem.insertMany(directoryItemsData);

    console.log('\nSuccessfully seeded Sacred Services Ecosystem into MongoDB Atlas!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding sacred services:', error);
    process.exit(1);
  }
};

seedServices();
