import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
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
  Loader2,
} from 'lucide-react';

export const LocalServicesHubPage: React.FC = () => {
  const navigate = useNavigate();

  const [selectedCity, setSelectedCity] = useState('Varanasi');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchLocalServices();
  }, [selectedCity, selectedCategory]);

  const fetchLocalServices = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${baseUrl}/api/local`, {
        params: {
          city: selectedCity,
          category: selectedCategory,
        },
      });
      if (res.data?.success) {
        setItems(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching local services:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16 space-y-6">

      {/* Hero Banner Header Container matching Navbar Layout Width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3">
        <div className="relative text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden min-h-[340px] sm:min-h-[380px] flex flex-col justify-between items-center text-center border border-white/10">
          {/* Background Banner Image */}
          <img
            src="/banner/popular.png"
            alt="Local Services, Transport & Guides Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay gradient for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/40" />

          {/* Banner Content (Centered matching global Tirvona typography & color scheme) */}
          <div className="max-w-3xl space-y-2.5 relative z-10 mx-auto text-center my-auto pt-2 pb-4">
            <p className="font-['Kalam'] text-base sm:text-xl font-bold text-[#E58C28] drop-shadow-md">
              Tirvona Local Pilgrim Ecosystem
            </p>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-lg" style={{ fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif", letterSpacing: '-0.03em' }}>
              Local Services, Transport &amp; <span className="text-[#D4AF37]">Guides</span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-gray-100 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow">
              Find verified cabs, certified temple guides, satvik dining, 24/7 emergency medical care, and sacred stores near you.
            </p>

            {/* Location Selector */}
            <div className="max-w-xs mx-auto mt-3 flex items-center bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg border border-white/20">
              <MapPin size={16} className="text-[#0A4DA6] ml-2 shrink-0" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-transparent px-2 text-xs font-black text-[#0B192C] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="Varanasi">Varanasi (Kashi Dham)</option>
                <option value="Haridwar">Haridwar &amp; Rishikesh</option>
                <option value="Ayodhya">Ayodhya Ram Janmabhoomi</option>
                <option value="Kedarnath">Kedarnath &amp; Badrinath</option>
                <option value="Ujjain">Ujjain Mahakal</option>
                <option value="Puri">Puri Jagannath</option>
              </select>
            </div>
          </div>

          {/* Category Tabs Container inside Banner */}
          <div className="w-full relative z-10 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md border border-white/20 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full">
              {categories.map((cat) => {
                const IconComp = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                      active
                        ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/20'
                        : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <IconComp size={14} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="animate-spin text-[#0A4DA6]" size={36} />
            <p className="text-sm font-bold text-gray-500">Loading verified local services...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 p-8 shadow-sm">
            <p className="text-base font-bold text-gray-700 dark:text-gray-200">
              No local services found for {selectedCity} in {selectedCategory === 'All' ? 'this area' : selectedCategory}.
            </p>
            <p className="text-xs text-gray-500 mt-1">Super Admin can add new listings for this city directly from the Local Hub module.</p>
          </div>
        ) : (
          /* Services Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item._id || item.id}
                className="bg-white dark:bg-[#0B192C] rounded-[32px] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                      {item.badge || 'VERIFIED OPERATOR'}
                    </span>
                    <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                      ★ {item.rating || '4.9'}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                      <MapPin size={13} className="text-[#0A4DA6]" />
                      <span>{item.location || item.city}</span>
                    </div>
                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description || item.desc}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <span className="text-xs font-black text-[#0A4DA6] dark:text-amber-400">
                    {item.price || 'Contact for Fare'}
                  </span>
                  <button
                    onClick={() => alert(`Contacting ${item.title}: ${item.phone || '+91 98765 00000'}`)}
                    className="px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Contact &amp; Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explore Marketplace Button */}
        <div className="pt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-sm shadow-xl hover:shadow-2xl transition-all cursor-pointer group"
          >
            <span>Explore Marketplace</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default LocalServicesHubPage;

