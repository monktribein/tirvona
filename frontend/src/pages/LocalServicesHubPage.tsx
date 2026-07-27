import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Car,
  Users,
  Utensils,
  Ambulance,
  Phone,
  ShoppingBag,
  Camera,
  Bed,
  Sparkles,
  Search,
  ChevronRight,
  ShieldCheck,
  Star,
  Clock,
  ArrowRight,
  Heart,
  BookOpen,
} from 'lucide-react';

export const LocalServicesHubPage: React.FC = () => {
  const navigate = useNavigate();

  const [selectedCity, setSelectedCity] = useState('Varanasi');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    { id: 'All', label: 'All Services', icon: MapPin },
    { id: 'transport', label: 'Transport & Cabs', icon: Car },
    { id: 'guides', label: 'Verified Guides', icon: Users },
    { id: 'food', label: 'Satvik Dining', icon: Utensils },
    { id: 'medical', label: 'Emergency & Medical', icon: Ambulance },
    { id: 'shops', label: 'Puja Shops & Stores', icon: ShoppingBag },
    { id: 'photography', label: 'Photography', icon: Camera },
    { id: 'stays', label: 'Nearby Ashrams', icon: Bed },
    { id: 'events', label: 'Aartis & Events', icon: Sparkles },
  ];

  const localItems = [
    {
      id: '1',
      category: 'transport',
      title: 'Haridwar - Rishikesh AC Auto & Innova Cab Hub',
      location: 'Haridwar Railway Station',
      phone: '+91 98765 11111',
      rating: 4.9,
      badge: 'VERIFIED OPERATOR',
      price: '₹400 / transfer',
      desc: '24/7 prepaid auto rickshaws, station transfers, and hill cabs with certified mountain drivers.',
      image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: '2',
      category: 'guides',
      title: 'Pandit Ramesh Shastri (Licensed Kashi Guide)',
      location: 'Dashashwamedh Ghat, Varanasi',
      phone: '+91 98390 22222',
      rating: 5.0,
      badge: 'CERTIFIED SHASTRI',
      price: '₹1,200 / tour',
      desc: 'Ministry of Tourism certified guide for Ganga Aarti history, temple corridor walks, and Sankat Mochan history.',
      image: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: '3',
      category: 'food',
      title: 'Shiv Shakti Satvik Bhojnalaya',
      location: 'Near Kashi Vishwanath Gate 4, Varanasi',
      phone: '+91 542 239 0000',
      rating: 4.8,
      badge: '100% PURE SATVIK',
      price: '₹180 / thali',
      desc: 'Onion-garlic free traditional thali, fresh cow ghee rotis, and pure Gangajal drinking water.',
      image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: '4',
      category: 'medical',
      title: '24/7 Pilgrimage Medical Center & Ambulance',
      location: 'Rishikesh Ram Jhula',
      phone: '108 / +91 94120 33333',
      rating: 4.9,
      badge: '24/7 EMERGENCY',
      price: 'Emergency Aid',
      desc: 'Free oxygen cylinders, first aid kit, mountain emergency doctors, and ambulance services for yatris.',
      image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: '5',
      category: 'shops',
      title: 'Ganga Kripa Certified Rudraksha & Bhandar',
      location: 'Har Ki Pauri, Haridwar',
      phone: '+91 98765 44444',
      rating: 4.9,
      badge: 'GOVT CERTIFIED',
      price: 'Authentic Store',
      desc: 'Government lab tested 1-14 Mukhi Nepal Rudrakshas, pure Sphatik malas, and brass puja thalis.',
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: '6',
      category: 'events',
      title: 'Dashashwamedh Ghat Ganga Aarti (Daily 6:30 PM)',
      location: 'Varanasi',
      phone: 'Free Access',
      rating: 5.0,
      badge: 'DAILY EVENING AARTI',
      price: 'Free Entry',
      desc: 'Grand evening brass lamp ritual on the holy river Ganga with live Vedic chanting.',
      image: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=600&q=80',
    },
  ];

  const filteredItems = localItems.filter(
    (item) => selectedCategory === 'All' || item.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-20 sm:pt-24 pb-16">

      {/* Breadcrumb Bar */}
      <div className="bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800/80 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <Link to="/" className="hover:text-[#0A4DA6]">Home</Link>
          <ChevronRight size={13} />
          <span className="text-[#0A4DA6] dark:text-amber-400 font-black">Local Services Hub</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-12 sm:py-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-4 relative z-10">
          <span className="px-4 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-wider border border-white/20">
            Tirvona Local Pilgrim Ecosystem
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Local Services, Transport & Guides
          </h1>
          <p className="text-sm sm:text-base text-blue-100 max-w-2xl mx-auto font-medium">
            Find verified cabs, certified temple guides, satvik dining, 24/7 emergency medical care, and sacred stores near you.
          </p>

          {/* Location Selector */}
          <div className="max-w-md mx-auto mt-6 flex items-center bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-xl border border-white/20">
            <MapPin size={18} className="text-[#0A4DA6] ml-4 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-transparent px-3 text-xs sm:text-sm font-black text-[#0B192C] dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="Varanasi">Varanasi (Kashi Dham)</option>
              <option value="Haridwar">Haridwar & Rishikesh</option>
              <option value="Ayodhya">Ayodhya Ram Janmabhoomi</option>
              <option value="Kedarnath">Kedarnath & Badrinath</option>
              <option value="Ujjain">Ujjain Mahakal</option>
              <option value="Puri">Puri Jagannath</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          {categories.map((cat) => {
            const IconComp = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'bg-[#0A4DA6] text-white shadow-md'
                    : 'bg-white dark:bg-[#0B192C] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-800 hover:bg-gray-100'
                }`}
              >
                <IconComp size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Services Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-[#0B192C] rounded-[32px] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-48 overflow-hidden bg-slate-900">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                    {item.badge}
                  </span>
                  <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                    ★ {item.rating}
                  </span>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                    <MapPin size={13} className="text-[#0A4DA6]" />
                    <span>{item.location}</span>
                  </div>
                  <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                <span className="text-xs font-black text-[#0A4DA6] dark:text-amber-400">
                  {item.price}
                </span>
                <button
                  onClick={() => alert(`Contacting ${item.title}: ${item.phone}`)}
                  className="px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Contact & Book
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Link to Marketplace Banner */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-purple-500/20">
          <div className="space-y-1 text-center sm:text-left">
            <span className="px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase">
              Tirvona Sacred Marketplace
            </span>
            <h4 className="font-black text-lg">Looking for Temple Prasad, Puja Bhandar & Spiritual Items?</h4>
            <p className="text-xs text-purple-200">Explore the upcoming Tirvona Sacred Merchandise & Prasad Delivery Marketplace.</p>
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-lg shrink-0 cursor-pointer"
          >
            Visit Marketplace →
          </button>
        </div>

      </div>
    </div>
  );
};
