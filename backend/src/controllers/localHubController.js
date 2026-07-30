import LocalServiceItem from '../models/LocalServiceItem.js';
import { escapeRegex } from '../utils/sanitize.js';

const INITIAL_FALLBACK_ITEMS = [
  {
    city: 'Haridwar',
    category: 'transport',
    title: 'Haridwar - Rishikesh AC Auto & Innova Cab Hub',
    location: 'Haridwar Railway Station',
    phone: '+91 98765 11111',
    rating: 4.9,
    reviewsCount: 184,
    badge: 'VERIFIED OPERATOR',
    price: '₹400 / transfer',
    description: '24/7 prepaid auto rickshaws, station transfers, and hill cabs with certified mountain drivers.',
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
  {
    city: 'Varanasi',
    category: 'guides',
    title: 'Pandit Ramesh Shastri (Licensed Kashi Guide)',
    location: 'Dashashwamedh Ghat, Varanasi',
    phone: '+91 98390 22222',
    rating: 5.0,
    reviewsCount: 312,
    badge: 'CERTIFIED SHASTRI',
    price: '₹1,200 / tour',
    description: 'Ministry of Tourism certified guide for Ganga Aarti history, temple corridor walks, and Sankat Mochan history.',
    image: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
  {
    city: 'Varanasi',
    category: 'food',
    title: 'Shiv Shakti Satvik Bhojnalaya',
    location: 'Near Kashi Vishwanath Gate 4, Varanasi',
    phone: '+91 542 239 0000',
    rating: 4.8,
    reviewsCount: 95,
    badge: '100% PURE SATVIK',
    price: '₹180 / thali',
    description: 'Onion-garlic free traditional thali, fresh cow ghee rotis, and pure Gangajal drinking water.',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
  {
    city: 'Rishikesh',
    category: 'medical',
    title: '24/7 Pilgrimage Medical Center & Ambulance',
    location: 'Rishikesh Ram Jhula',
    phone: '108 / +91 94120 33333',
    rating: 4.9,
    reviewsCount: 64,
    badge: '24/7 EMERGENCY',
    price: 'Emergency Aid',
    description: 'Free oxygen cylinders, first aid kit, mountain emergency doctors, and ambulance services for yatris.',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
  {
    city: 'Haridwar',
    category: 'shops',
    title: 'Ganga Kripa Certified Rudraksha & Bhandar',
    location: 'Har Ki Pauri, Haridwar',
    phone: '+91 98765 44444',
    rating: 4.9,
    reviewsCount: 210,
    badge: 'GOVT CERTIFIED',
    price: 'Authentic Store',
    description: 'Government lab tested 1-14 Mukhi Nepal Rudrakshas, pure Sphatik malas, and brass puja thalis.',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
  {
    city: 'Varanasi',
    category: 'events',
    title: 'Dashashwamedh Ghat Ganga Aarti (Daily 6:30 PM)',
    location: 'Varanasi',
    phone: 'Free Access',
    rating: 5.0,
    reviewsCount: 520,
    badge: 'DAILY EVENING AARTI',
    price: 'Free Entry',
    description: 'Grand evening brass lamp ritual on the holy river Ganga with live Vedic chanting.',
    image: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=600&q=80',
    status: 'active',
  },
];

export const getLocalServices = async (req, res) => {
  try {
    const { city, category, search } = req.query;
    const filter = { status: 'active' };

    if (city && city !== 'All' && city !== 'all') {
      filter.city = { $regex: escapeRegex(city), $options: 'i' };
    }

    if (category && category !== 'All' && category !== 'all') {
      const catMap = { restaurants: 'food' };
      filter.category = catMap[category.toLowerCase()] || category;
    }

    if (search) {
      const term = escapeRegex(search);
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { location: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    let items = await LocalServiceItem.find(filter).sort({ rating: -1, createdAt: -1 }).lean();

    // Auto-seed initial items if collection is empty
    if (items.length === 0 && (await LocalServiceItem.countDocuments()) === 0) {
      try {
        await LocalServiceItem.insertMany(INITIAL_FALLBACK_ITEMS);
        items = await LocalServiceItem.find(filter).sort({ rating: -1, createdAt: -1 }).lean();
      } catch (seedErr) {
        console.warn('Auto-seed fallback local items error:', seedErr);
        items = INITIAL_FALLBACK_ITEMS.filter((item) => {
          if (filter.category && item.category !== filter.category) return false;
          if (city && city !== 'All' && !item.city.toLowerCase().includes(city.toLowerCase())) return false;
          return true;
        });
      }
    }

    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('Error fetching local services:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching local services' });
  }
};

