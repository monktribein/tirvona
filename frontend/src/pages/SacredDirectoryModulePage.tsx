import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, Phone, Star, ShieldCheck, ArrowRight, BookOpen, Users, Car, Utensils, ShoppingBag, Heart, Award, Sparkles } from 'lucide-react';

interface ModuleConfig {
  title: string;
  subtitle: string;
  eyebrow: string;
  futureTitle: string;
  futureDesc: string;
  icon: any;
}

const moduleConfigs: Record<string, ModuleConfig> = {
  'travel-guides': {
    title: 'Sacred Travel Guides & Tips',
    subtitle: 'Expert yatra planning, packing checklists, Himalayan weather safety, and local etiquette guides.',
    eyebrow: 'Yatra Companion',
    futureTitle: 'Offline Mobile Travel Guides & Maps',
    futureDesc: 'Download complete offline PDF & GPS offline maps for remote Himalayan yatra routes.',
    icon: BookOpen,
  },
  'local-guides': {
    title: 'Verified Local Temple Guides',
    subtitle: 'Connect with ministry-certified heritage guides, Shastri pujaris, and local history experts.',
    eyebrow: 'Certified Guides',
    futureTitle: 'Live Video Consultation & Virtual Darshan Guide',
    futureDesc: 'Book 1-on-1 video call consultations with local heritage pandits before starting your yatra.',
    icon: Users,
  },
  'transport': {
    title: 'Pilgrimage Cabs & Transport Services',
    subtitle: 'Book verified hill drivers, AC Innova cabs, luxury tempo travellers, and station transfers.',
    eyebrow: 'Sacred Transport',
    futureTitle: 'Real-time Cab Booking & Live Train Status APIs',
    futureDesc: 'Direct integration with Indian Railways IRCTC live train tracking and instant cab dispatch.',
    icon: Car,
  },
  'restaurants': {
    title: 'Satvik Restaurants & Temple Bhojnalaya',
    subtitle: 'Discover 100% pure vegetarian, onion-garlic free satvik bhojnalayas and temple prasad halls.',
    eyebrow: 'Pure Vegetarian Dining',
    futureTitle: 'Online Satvik Thali & Prasad Delivery',
    futureDesc: 'Order fresh satvik thalis delivered directly to your ashram room or train seat.',
    icon: Utensils,
  },
  'shops': {
    title: 'Shops & Local Sacred Services',
    subtitle: 'Verified puja bhandars, authentic rudraksha dealers, ayurvedic pharmacies, and ATMs.',
    eyebrow: 'Local Marketplace',
    futureTitle: 'Verified Merchant Digital Storefronts',
    futureDesc: 'Browse inventory and reserve items directly from verified holy city shopkeepers.',
    icon: ShoppingBag,
  },
  'puja-items': {
    title: 'Sacred Puja Items & Ritual Kits',
    subtitle: 'Handpicked brass diyas, organic camphor, Gangajal, bilva patra, and consecrated puja kits.',
    eyebrow: 'Puja Essentials',
    futureTitle: 'Monthly Puja Box Subscription',
    futureDesc: 'Subscribe to receive fresh monthly puja supplies delivered to your doorstep every month.',
    icon: Heart,
  },
  'religious-products': {
    title: 'Religious Products & Sacred Idols',
    subtitle: 'Pure brass deities, consecrated yantras, gold-embossed frames, and tulsi japa malas.',
    eyebrow: 'Spiritual Decor',
    futureTitle: 'Global Express Sacred Shipping',
    futureDesc: 'Express international delivery with tamper-proof Vedic consecration packaging.',
    icon: Award,
  },
  'books': {
    title: 'Spiritual Books & Media Library',
    subtitle: 'Hardbound Bhagavad Gita, Upanishads, audiobooks, bhajans, and Vedic chanting audio.',
    eyebrow: 'Vedic Knowledge',
    futureTitle: 'Tirvona Digital Audio Library',
    futureDesc: 'Listen to 10,000+ uninterrupted Vedic mantras, podcasts, and discourses in high-definition audio.',
    icon: BookOpen,
  },
  'handicrafts': {
    title: 'Temple Handicrafts & Artisan Gifts',
    subtitle: 'Authentic Banarasi silk stoles, hand-carved wooden temples, brassware, and marble craft.',
    eyebrow: 'Heritage Craft',
    futureTitle: 'Direct Artisan Marketplace & GI Certification',
    futureDesc: 'Direct-from-artisan marketplace with blockchain GI-tag authenticity verification.',
    icon: Sparkles,
  },
};

export const SacredDirectoryModulePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract moduleType from pathname (e.g., /travel-guides -> travel-guides)
  const pathnameModule = location.pathname.replace('/', '') || 'travel-guides';
  const config = moduleConfigs[pathnameModule] || moduleConfigs['travel-guides'];

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDirectoryItems();
  }, [pathnameModule]);

  const fetchDirectoryItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/services/directory`,
        { params: { moduleType: pathnameModule, search: searchTerm } }
      );
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error(`Error fetching directory items for ${pathnameModule}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDirectoryItems();
  };

  const IconComp = config.icon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-24 sm:pt-28 pb-16">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-12 lg:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <span className="px-4 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold uppercase tracking-wider border border-white/20">
            {config.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            {config.title}
          </h1>
          <p className="text-sm sm:text-base text-blue-100 max-w-2xl mx-auto font-medium">
            {config.subtitle}
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mt-6 flex items-center bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-xl border border-white/20">
            <Search size={18} className="text-gray-400 ml-4 shrink-0" />
            <input
              type="text"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent px-3 text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
            />
            <button type="submit" className="px-6 py-2.5 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs transition-colors shrink-0">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Directory Items Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
            <IconComp size={48} className="text-gray-400 mx-auto mb-3" />
            <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">No Items Found</h3>
            <p className="text-xs text-gray-400">Try refining your search term or select another service.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item._id}
                className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                      {item.badge || item.category}
                    </span>
                    <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                      ★ {item.rating}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                      {item.city}, {item.state}
                    </span>
                    <h3 className="font-black text-lg text-[#0B192C] dark:text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <div>
                    {item.price > 0 ? (
                      <span className="text-xs font-black text-[#0A4DA6] dark:text-amber-400">
                        ₹{item.price}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
                        Free Guidance
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => alert(`Contact details for ${item.title}: ${item.contactPhone}`)}
                    className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-blue-900 transition-colors"
                  >
                    <span>Contact & Info</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Future Integration Banner */}
        <div className="mt-12 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-500/20 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">In Future</span>
            <h4 className="font-black text-lg">{config.futureTitle}</h4>
            <p className="text-xs text-gray-300">{config.futureDesc}</p>
          </div>
          <span className="px-5 py-2 rounded-full bg-white/10 text-amber-300 font-black text-xs border border-amber-400/30 shrink-0">
            Coming Soon 🚀
          </span>
        </div>
      </div>
    </div>
  );
};
