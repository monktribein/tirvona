import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Tag,
  Search,
  Calendar,
  Sparkles,
  MapPin,
  Building,
  CheckCircle2,
  Copy,
  ArrowRight,
  Filter,
  ShieldCheck,
  Flame,
  Percent,
  ChevronRight,
  Gift
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const OffersPage: React.FC = () => {
  const { category: urlCategory, city: urlCity } = useParams();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(urlCategory || 'All');
  const [selectedCity, setSelectedCity] = useState(urlCity || 'All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = [
    'All',
    'Festival Offer',
    'Mahakumbh Offer',
    'Weekend Offer',
    'Meditation Camp',
    'Yoga Camp',
    'Room Upgrade',
    'Food Offer',
    'Senior Citizen Offer',
  ];

  const cities = ['All', 'Rishikesh', 'Haridwar', 'Vrindavan', 'Varanasi', 'Kedarnath'];

  useEffect(() => {
    fetchOffers();
  }, [selectedCategory, selectedCity]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers?status=active`;
      if (selectedCategory !== 'All') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedCity !== 'All') {
        url += `&city=${encodeURIComponent(selectedCity)}`;
      }

      const res = await axios.get(url);
      if (res.data.success) {
        setOffers(res.data.data);
      }
    } catch (err) {
      console.error('Fetch public offers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addNotification('Promo Code Copied!', `"${code}" copied to clipboard.`, 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleBookWithOffer = (offer: any) => {
    const ashram = offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);
    if (ashram?._id) {
      navigate(`/ashram/${ashram._id}?promoCode=${encodeURIComponent(offer.promoCode)}`);
    } else {
      navigate(`/search?promoCode=${encodeURIComponent(offer.promoCode)}`);
    }
  };

  const filteredOffers = offers.filter((o) =>
    o.offerTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.promoCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.description && o.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20 space-y-10">
      {/* Hero Banner Header */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-14 px-4 sm:px-8 shadow-xl">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30 backdrop-blur-md">
            <Flame size={14} /> Sacred Pilgrimage Deals & Special Promotions
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Exclusive Ashram Deals & Festival Specials
          </h1>

          <p className="text-sm sm:text-base text-gray-200 max-w-2xl font-medium leading-relaxed">
            Unlock instant rate upgrades, complimentary Satvik meals, and festival specials across authentic registered Ashrams in Haridwar, Rishikesh, Vrindavan, and Varanasi.
          </p>

          {/* Quick Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 pt-2">
            <Link to="/" className="hover:text-white">Home</Link>
            <ChevronRight size={12} />
            <span className="text-amber-400 font-bold">Offers & Special Deals</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-8">
        {/* Search & Category Filter Bar */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/20'
                    : 'bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & City Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-slate-800">
            {/* City Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs font-bold text-gray-400 shrink-0">City:</span>
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCity(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                    selectedCity === c
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search offer or promo code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
          </div>
        </div>

        {/* Offers Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-96 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <Gift size={48} className="mx-auto text-amber-500/50" />
            <h3 className="text-xl font-black text-[#0B192C] dark:text-white">No Offers Found</h3>
            <p className="text-xs text-gray-400">Try selecting another category or city filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer) => {
              const targetAshram = offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);

              return (
                <div
                  key={offer._id}
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Banner Container */}
                    <div className="relative aspect-video bg-black overflow-hidden">
                      <img
                        src={offer.bannerImage || '/banner/ashram_rishikesh.png'}
                        alt={offer.offerTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                        onError={(e: any) => { e.target.src = '/banner/ashram_rishikesh.png'; }}
                      />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <span className="px-3 py-1 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                          {offer.offerType || 'Festival Special'}
                        </span>

                        <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black shadow-lg flex items-center gap-1">
                          <Percent size={12} />
                          {offer.discountType === 'Percentage'
                            ? `${offer.discountValue}% OFF`
                            : `FLAT ₹${offer.discountValue} OFF`}
                        </span>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-black text-lg text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] dark:group-hover:text-amber-400 transition-colors">
                          {offer.offerTitle}
                        </h3>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {offer.description}
                        </p>
                      </div>

                      {/* Ashram & Location Tag */}
                      {targetAshram && (
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0A4DA6] dark:text-amber-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl">
                          <Building size={13} />
                          <span className="truncate">{targetAshram.name}</span>
                          <span className="text-gray-300">•</span>
                          <MapPin size={12} />
                          <span>{targetAshram.address?.city || 'Haridwar'}</span>
                        </div>
                      )}

                      {/* Promo Code Box */}
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-2">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                            PROMO CODE
                          </span>
                          <span className="font-mono font-black text-sm text-[#0B192C] dark:text-white">
                            {offer.promoCode}
                          </span>
                        </div>

                        <button
                          onClick={() => handleCopyCode(offer.promoCode)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          <Copy size={12} />
                          {copiedCode === offer.promoCode ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                    <Link
                      to={`/offers/${offer._id}`}
                      className="text-xs font-black text-gray-500 dark:text-gray-300 hover:text-[#0A4DA6] transition-colors"
                    >
                      View Details
                    </Link>

                    <button
                      onClick={() => handleBookWithOffer(offer)}
                      className="px-4 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-black text-xs rounded-full flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer active:scale-95"
                    >
                      Book Now <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OffersPage;
