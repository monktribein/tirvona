import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  Star,
  CheckCircle,
  Compass,
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Heart,
  LayoutGrid,
  Map,
  Shield,
  Activity,
  Bed
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');

  const [ashrams, setAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'top_rated' | 'most_booked' | 'recent' | 'govt_recom'>('top_rated');

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const [searchTab, setSearchTab] = useState<'destinations' | 'stay' | 'darshan' | 'experiences'>('destinations');
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStays();
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchStays = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams?verified=true`);
      if (res.data.success) setAshrams(res.data.data);
    } catch (err) {
      console.error('Error fetching stays:', err);
      setAshrams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?destination=${encodeURIComponent(destination)}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const valueLower = val.toLowerCase();
    const matches: Set<string> = new Set();
    ['Haridwar', 'Rishikesh', 'Vrindavan'].forEach(city => {
      if (city.toLowerCase().startsWith(valueLower)) matches.add(city);
    });
    ashrams.forEach(ashram => {
      if (ashram.name.toLowerCase().includes(valueLower)) matches.add(ashram.name);
    });
    ['Meditation Hall', 'River View', 'Cow Shelter', 'Yoga', 'Pure Vegetarian Food'].forEach(am => {
      if (am.toLowerCase().includes(valueLower)) matches.add(am);
    });
    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };

  const selectSuggestion = (sug: string) => {
    setDestination(sug);
    setShowSuggestions(false);
  };

  const getTabbedAshrams = () => {
    if (activeTab === 'top_rated') return [...ashrams].sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)).slice(0, 6);
    if (activeTab === 'most_booked') return [...ashrams].sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0)).slice(0, 6);
    if (activeTab === 'recent') return [...ashrams].slice(-6).reverse();
    if (activeTab === 'govt_recom') return ashrams.filter(a => (a.rating?.average || 0) >= 4.6).slice(0, 6);
    return ashrams.slice(0, 6);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  // Destinations for carousel
  const sacredDestinations = [
    {
      name: 'Kedarnath', state: 'Uttarakhand', rating: '4.8',
      img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Varanasi', state: 'Uttar Pradesh', rating: '4.7',
      img: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Tirupati', state: 'Andhra Pradesh', rating: '4.8',
      img: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Rameswaram', state: 'Tamil Nadu', rating: '4.7',
      img: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Shirdi', state: 'Maharashtra', rating: '4.6',
      img: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Ayodhya', state: 'Uttar Pradesh', rating: '4.7',
      img: 'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=500&q=80',
      fallback: 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=500&q=80',
    },
  ];

  // Unified 12-icon strip data
  const serviceIcons = [
    { label: 'Pilgrimage\nCircuits', icon: <MapPin size={16} className="text-[#0A4DA6]" /> },
    { label: 'Temple\nDetails', icon: <Compass size={16} className="text-[#0A4DA6]" /> },
    { label: 'Travel\nGuides', icon: <BookOpen size={16} className="text-[#0A4DA6]" /> },
    { label: 'Events &\nFestivals', icon: <Sparkles size={16} className="text-[#0A4DA6]" /> },
    { label: 'Local\nGuides', icon: <Users size={16} className="text-[#0E7B6C]" /> },
    { label: 'Transport &\nCabs', icon: <Map size={16} className="text-[#0E7B6C]" /> },
    { label: 'Restaurants\n& Prasad', icon: <Activity size={16} className="text-[#0E7B6C]" /> },
    { label: 'Shops &\nServices', icon: <LayoutGrid size={16} className="text-[#0E7B6C]" /> },
    { label: 'Puja\nItems', icon: <Heart size={16} className="text-[#6B21A8]" /> },
    { label: 'Religious\nProducts', icon: <Award size={16} className="text-[#6B21A8]" /> },
    { label: 'Books &\nMedia', icon: <BookOpen size={16} className="text-[#6B21A8]" /> },
    { label: 'Handicrafts\n& Gifts', icon: <Sparkles size={16} className="text-[#6B21A8]" /> },
  ];

  return (
    <div className="pb-24">

      {/* ══════════════════════ HERO SECTION ══════════════════════ */}
      <section className="relative min-h-[88vh] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/uploads/parmarth-niketan-gallery-4.jpg"
            alt="Rishikesh"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent dark:from-[#070F1B]/95 dark:via-[#070F1B]/80" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white dark:from-[#070F1B] to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 flex flex-col justify-center min-h-[88vh] py-20">
          <div className="max-w-xl">
            <motion.h1
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0B192C] dark:text-white leading-[1.05] mb-4"
            >
              Your Journey.<br />
              <span className="text-[#D4AF37] font-black">Our Purpose.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-sm md:text-base text-[#0B192C]/75 dark:text-gray-300 font-medium leading-relaxed max-w-sm mb-8"
            >
              Plan your pilgrimage, book stays, explore holy places, shop spiritual products and contribute to a greater cause.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="flex flex-wrap gap-x-6 gap-y-3"
            >
              {[
                { icon: <ShieldCheck size={13} className="text-[#0A4DA6]" />, label: 'Trusted & Secure' },
                { icon: <MapPin size={13} className="text-[#0A4DA6]" />, label: 'Verified Destinations' },
                { icon: <Sparkles size={13} className="text-[#0A4DA6]" />, label: 'AI Powered Guidance' },
                { icon: <LayoutGrid size={13} className="text-[#0A4DA6]" />, label: 'One Platform For All' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-[#0B192C]/70 dark:text-gray-300">
                  {b.icon}
                  <span>{b.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FLOATING SEARCH CARD ══════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 -mt-8 z-20 relative mb-16">
        <div className="bg-white dark:bg-[#0B192C] rounded-[28px] shadow-2xl shadow-black/10 border border-gray-100 dark:border-slate-800 p-6">
          {/* Search Tabs */}
          <div className="flex gap-2 mb-5 border-b border-gray-100 dark:border-slate-800 pb-4">
            {[
              { id: 'destinations', icon: <Compass size={13} />, label: 'Destinations' },
              { id: 'stay', icon: <Bed size={13} />, label: 'Stay' },
              { id: 'darshan', icon: <Heart size={13} />, label: 'Darshan & Seva' },
              { id: 'experiences', icon: <Sparkles size={13} />, label: 'Experiences' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSearchTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  searchTab === tab.id
                    ? 'bg-[#0A4DA6] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col text-left space-y-1.5 relative" ref={autocompleteRef}>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Where do you want to go?</label>
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search temples, cities, places..."
                  value={destination}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-400"
                />
              </div>
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs"
                  >
                    {suggestions.map((sug, i) => (
                      <button key={i} type="button" onClick={() => selectSuggestion(sug)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 last:border-b-0 cursor-pointer">
                        <Compass size={11} className="text-[#0A4DA6]" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col text-left space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Check In – Check Out</label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-xs font-semibold focus:outline-none text-[#0B192C] dark:text-white" />
              </div>
            </div>

            <div className="flex flex-col text-left space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Travelers</label>
              <div className="relative">
                <Users size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={guests} onChange={(e) => setGuests(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3 text-xs font-semibold focus:outline-none cursor-pointer appearance-none text-[#0B192C] dark:text-white">
                  <option value="1">1 Traveler</option>
                  <option value="2">2 Travelers</option>
                  <option value="3">3 Travelers</option>
                  <option value="4">4+ Travelers</option>
                </select>
              </div>
            </div>

            <button type="submit"
              className="w-full py-3 bg-[#0A4DA6] hover:bg-[#0A4DA6]/90 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#0A4DA6]/20 transition-all">
              <Search size={13} /> Search
            </button>
          </form>

          {/* Popular Searches */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-[10px] text-gray-400">
            <span className="font-bold uppercase tracking-wider mr-1">Popular Searches:</span>
            {['Kedarnath', 'Varanasi', 'Tirupati', 'Rameswaram', 'Shirdi', 'Amarnath', 'Ayodhya', 'Ujjain'].map(city => (
              <button key={city} type="button" onClick={() => selectSuggestion(city)}
                className="px-3 py-1 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 rounded-full font-semibold transition-all cursor-pointer">
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ EVERYTHING YOU NEED ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 mb-20">
        {/* Section Header */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B192C] dark:text-white">
            Everything You Need for a Blessed Journey
          </h2>
          <div className="flex justify-center items-center gap-2">
            <span className="h-px w-8 bg-[#D4AF37] inline-block"></span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L9.19 8.62 2 9.27l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7L22 9.27l-7.19-.65z"/></svg>
            <span className="h-px w-8 bg-[#D4AF37] inline-block"></span>
          </div>
        </div>

        {/* 3 Full-Bleed Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Card 1 — Destinations (blue) */}
          <div
            className="relative rounded-[28px] overflow-hidden h-[260px] shadow-lg group cursor-pointer"
            onClick={() => navigate('/search')}
          >
            <img
              src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=700&q=80"
              alt="Kedarnath Temple"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A4DA6]/95 via-[#0A4DA6]/80 to-[#0A4DA6]/10" />
            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[65%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">Tirvona</p>
                <h3 className="font-extrabold text-xl text-white flex items-center gap-1.5 leading-tight">
                  Destinations <ArrowRight size={16} />
                </h3>
                <p className="text-[11px] text-blue-100/90 leading-relaxed">
                  Explore sacred places, plan your trip and discover spiritual experiences.
                </p>
              </div>
              <button
                className="self-start px-5 py-2 bg-white text-[#0A4DA6] font-extrabold text-[11px] rounded-full hover:bg-blue-50 transition-all cursor-pointer shadow"
                onClick={(e) => { e.stopPropagation(); navigate('/search'); }}
              >
                Explore Destinations
              </button>
            </div>
          </div>

          {/* Card 2 — Local (teal) */}
          <div
            className="relative rounded-[28px] overflow-hidden h-[260px] shadow-lg group cursor-pointer"
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=700&q=80"
              alt="Rishikesh Local Street"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E7B6C]/95 via-[#0E7B6C]/80 to-[#0E7B6C]/10" />
            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[65%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">Tirvona</p>
                <h3 className="font-extrabold text-xl text-white flex items-center gap-1.5 leading-tight">
                  Local <ArrowRight size={16} />
                </h3>
                <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                  Find local services, guided tours, transport, food and more near you.
                </p>
              </div>
              <button
                className="self-start px-5 py-2 bg-white text-[#0E7B6C] font-extrabold text-[11px] rounded-full hover:bg-emerald-50 transition-all cursor-pointer shadow"
                onClick={(e) => { e.stopPropagation(); navigate('/faq'); }}
              >
                Explore Local
              </button>
            </div>
          </div>

          {/* Card 3 — Marketplace (purple) */}
          <div
            className="relative rounded-[28px] overflow-hidden h-[260px] shadow-lg group cursor-pointer"
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1600618528240-fb9fc964b853?auto=format&fit=crop&w=700&q=80"
              alt="Spiritual Marketplace"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#6B21A8]/95 via-[#6B21A8]/80 to-[#6B21A8]/10" />
            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[65%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-200">Tirvona</p>
                <h3 className="font-extrabold text-xl text-white flex items-center gap-1.5 leading-tight">
                  Marketplace <ArrowRight size={16} />
                </h3>
                <p className="text-[11px] text-purple-100/90 leading-relaxed">
                  Shop spiritual products, puja items, books, handicrafts and more.
                </p>
              </div>
              <button
                className="self-start px-5 py-2 bg-white text-[#6B21A8] font-extrabold text-[11px] rounded-full hover:bg-purple-50 transition-all cursor-pointer shadow"
                onClick={(e) => { e.stopPropagation(); navigate('/faq'); }}
              >
                Visit Marketplace
              </button>
            </div>
          </div>
        </div>

        {/* Unified 12-icon strip below all 3 cards */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] mt-4 px-2 py-3 shadow-sm overflow-x-auto">
          <div className="grid grid-cols-12 min-w-[600px] divide-x divide-gray-100 dark:divide-slate-800">
            {serviceIcons.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 py-2 px-1 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                {item.icon}
                <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 whitespace-pre-line text-center leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ POPULAR SACRED DESTINATIONS ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 space-y-6 mb-20">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B192C] dark:text-white">
            Popular Sacred Destinations
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button onClick={() => scrollCarousel('left')}
                className="p-2 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer text-[#0B192C] dark:text-white">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => scrollCarousel('right')}
                className="p-2 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer text-[#0B192C] dark:text-white">
                <ChevronRight size={15} />
              </button>
            </div>
            <Link to="/search"
              className="text-xs font-bold px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-full text-[#0B192C] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
              View All
            </Link>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="flex gap-5 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {sacredDestinations.map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(`/search?destination=${item.name}`)}
              className="min-w-[240px] max-w-[240px] snap-start bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
            >
              <div className="h-44 bg-gray-100 dark:bg-slate-800 overflow-hidden relative">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = item.fallback; }}
                />
                <span className="absolute bottom-3 right-3 bg-white/95 dark:bg-[#0B192C]/95 px-2.5 py-0.5 rounded-lg shadow text-[10px] font-black text-[#0B192C] dark:text-white flex items-center gap-0.5">
                  <Star className="text-[#D4AF37] fill-[#D4AF37]" size={10} /> {item.rating}
                </span>
              </div>
              <div className="p-4">
                <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">{item.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">{item.state}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ FEATURED RETREATS ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 space-y-8 mb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B192C] dark:text-white">Featured Retreats</h2>
            <p className="text-xs text-gray-400 font-bold uppercase">Govt Verified accommodations with daily prayer and vegetarian food</p>
          </div>
          <Link to="/search" className="text-xs font-bold text-[#0A4DA6] hover:underline flex items-center gap-1">
            View All Stays <ArrowRight size={13} />
          </Link>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 gap-6 text-xs font-bold pb-2 overflow-x-auto">
          {[
            { id: 'top_rated', icon: <Award size={13} />, label: 'Top Rated' },
            { id: 'most_booked', icon: <Sparkles size={13} />, label: 'Most Booked' },
            { id: 'recent', icon: <BookOpen size={13} />, label: 'Recently Verified' },
            { id: 'govt_recom', icon: <ShieldCheck size={13} />, label: 'Govt Recommended' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 flex items-center gap-1 px-1 relative cursor-pointer transition-all ${activeTab === tab.id ? 'text-[#0A4DA6]' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab.icon} {tab.label}
              {activeTab === tab.id && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0A4DA6]" />}
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => <div key={n} className="h-80 bg-gray-50 border border-gray-100 rounded-3xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {getTabbedAshrams().map((ashram) => (
              <motion.div key={ashram._id} layout
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col transform hover:-translate-y-1">
                <div className="relative h-48 overflow-hidden bg-gray-50 dark:bg-slate-900">
                  <img
                    src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'}
                    alt={ashram.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                  />
                  <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[9px] font-extrabold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <CheckCircle size={9} /> Verified
                  </span>
                  <span className="absolute bottom-4 right-4 bg-white/95 px-2.5 py-0.5 rounded shadow text-[9.5px] font-black flex items-center gap-0.5">
                    <Star className="text-[#D4AF37] fill-[#D4AF37]" size={9} /> {ashram.rating?.average || 4.5}
                  </span>
                </div>
                <div className="p-5 flex-grow space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white line-clamp-1">{ashram.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1 uppercase">
                      <MapPin size={9} className="text-[#0A4DA6]" /> {ashram.address?.city}, {ashram.address?.state}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {ashram.description || 'Peaceful lodgings offering daily satsangs, pure Satvik vegetarian food, and meditation spaces.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ashram.amenities?.slice(0, 3).map((am: string, i: number) => (
                      <span key={i} className="text-[9px] font-bold bg-gray-50 dark:bg-slate-900 text-gray-500 px-2 py-0.5 rounded-md">{am}</span>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Starting Rate</span>
                    <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">₹{ashram.lowestNightPrice || 150} <span className="text-[10px] text-gray-400 font-normal">/ night</span></span>
                  </div>
                  <Link to={`/ashram/${ashram._id}`} className="px-4 py-2 bg-[#0A4DA6] hover:bg-opacity-90 text-white text-xs font-bold rounded-full transition-all">
                    Book Stay
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════ WHY CHOOSE TIRVONA ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 space-y-10 mb-20">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B192C] dark:text-white">Why Choose Tirvona?</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {[
            { label: 'Curated for Pilgrims', desc: 'Handpicked destinations and authentic information.', icon: <Compass className="w-5 h-5 text-[#0A4DA6]" /> },
            { label: 'Safe & Trusted', desc: 'Verified services and secure bookings.', icon: <Shield className="w-5 h-5 text-[#0A4DA6]" /> },
            { label: 'AI Pilgrim Assistant', desc: 'Get personalized guidance for your journey.', icon: <Activity className="w-5 h-5 text-[#0A4DA6]" /> },
            { label: 'Contribute & Grow', desc: 'Your donations empower temples and communities.', icon: <Heart className="w-5 h-5 text-[#0A4DA6]" /> },
            { label: 'One Platform', desc: 'All you need for your spiritual journey.', icon: <LayoutGrid className="w-5 h-5 text-[#0A4DA6]" /> },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center space-y-2.5 px-2">
              <div className="w-12 h-12 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center shadow-sm">
                {item.icon}
              </div>
              <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white leading-tight">{item.label}</h4>
              <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ EMPOWERING TEMPLES BANNER ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 mb-20">
        <div className="bg-[#0B192C] rounded-[36px] p-8 md:p-12 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 shadow-xl">
          <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-[#0A4DA6]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-[200px] h-[200px] bg-[#D4AF37]/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="space-y-4 z-10 max-w-lg text-center md:text-left">
            <h3 className="font-extrabold text-2xl md:text-3xl leading-snug">
              Empowering Temples.<br />
              <span className="text-[#D4AF37]">Enriching Communities.</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              A part of every booking and donation goes towards the development of sacred places and local communities.
            </p>
            <button className="px-6 py-2.5 bg-white text-[#0B192C] font-extrabold text-xs rounded-full hover:bg-gray-100 transition-all cursor-pointer">
              Know More
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 z-10 w-full md:w-auto md:min-w-[320px]">
            {[
              { label: 'Sacred Destinations', val: '2500+' },
              { label: 'Happy Pilgrims', val: '10M+' },
              { label: 'Temple Partners', val: '500+' },
              { label: 'Donations Facilitated', val: '₹50Cr+' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-[20px] p-5 text-center">
                <span className="block text-2xl font-black text-[#D4AF37] leading-none mb-1">{stat.val}</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ NEWSLETTER ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 py-8 border-y border-gray-100 dark:border-slate-800">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl font-extrabold text-[#0B192C] dark:text-white">Stay Inspired, Stay Connected</h2>
            <p className="text-xs text-gray-400 font-medium">Subscribe to our newsletter for travel tips, spiritual stories and exclusive offers.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <input type="email" placeholder="Enter your email"
              className="flex-grow md:w-72 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-full px-5 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-400" />
            <button className="px-6 py-3 bg-[#0A4DA6] text-white font-extrabold text-xs rounded-full cursor-pointer hover:bg-[#0A4DA6]/90 transition-all shrink-0">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
export default HomePage;
