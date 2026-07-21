import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import heroBg from '../assets/rishikesh-tera-manzil-temple.jpg';
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
  Bed,
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
    { name: 'Kedarnath', state: 'Uttarakhand', rating: '4.8', img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80' },
    { name: 'Varanasi', state: 'Uttar Pradesh', rating: '4.7', img: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80' },
    { name: 'Tirupati', state: 'Andhra Pradesh', rating: '4.8', img: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=500&q=80' },
    { name: 'Rameswaram', state: 'Tamil Nadu', rating: '4.7', img: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80' },
    { name: 'Shirdi', state: 'Maharashtra', rating: '4.6', img: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=500&q=80' },
    { name: 'Ayodhya', state: 'Uttar Pradesh', rating: '4.7', img: 'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=500&q=80' },
  ];

  // 12-icon service strip
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
    <div className="pb-16 lg:pb-24 overflow-x-hidden">

      {/* ══════════════════════ HERO SECTION ══════════════════════ */}
      <section
        className="relative overflow-hidden flex items-end lg:items-center"
        style={{ minHeight: 'clamp(380px, 55vw, 680px)' }}
      >
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Rishikesh Tera Manzil Temple"
            className="w-full h-full object-cover object-[center_30%]"
            loading="eager"
          />
          {/* Mobile overlay — lighter, positioned right so temple stays visible */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60 lg:hidden" />
          {/* Desktop overlay — left-to-right white gradient */}
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-white/70 via-white/15 to-transparent dark:from-[#070F1B]/80 dark:via-[#070F1B]/15" />
          {/* Bottom fade for both */}
          <div className="absolute bottom-0 left-0 right-0 h-20 lg:h-28 bg-gradient-to-t from-white dark:from-[#070F1B] to-transparent" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-0 lg:flex lg:items-center" style={{ minHeight: 'clamp(380px, 55vw, 680px)' }}>
          <div className="max-w-xl">
            {/* Mobile: white text on dark overlay; Desktop: dark text on white gradient */}
            <motion.h1
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-extrabold tracking-tight leading-[1.1] uppercase mb-3 text-white lg:text-[#0B192C] lg:dark:text-white"
              style={{ fontSize: 'clamp(2rem, 9vw, 3.75rem)' }}
            >
              Connecting Sacred<br />Destinations.{' '}
              <span className="text-[#D4AF37] font-black">Empowering Communities.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-sm lg:text-sm text-white/90 lg:text-[#0B192C]/80 lg:dark:text-gray-300 font-medium leading-relaxed max-w-sm mb-4 line-clamp-3 lg:line-clamp-none"
            >
              Plan your pilgrimage, book stays, explore holy places, shop spiritual products and contribute to a greater cause.
            </motion.p>

            {/* Trust badges — wrap into 2 rows on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="flex flex-wrap gap-x-3 gap-y-2"
            >
              {[
                { icon: <ShieldCheck size={13} className="text-[#D4AF37]" />, label: 'Trusted & Secure' },
                { icon: <MapPin size={13} className="text-[#D4AF37]" />, label: 'Verified Destinations' },
                { icon: <Sparkles size={13} className="text-[#D4AF37]" />, label: 'AI Powered' },
                { icon: <LayoutGrid size={13} className="text-[#D4AF37]" />, label: 'One Platform' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-white/90 lg:text-[#0B192C]/75 lg:dark:text-gray-300">
                  {b.icon}
                  <span>{b.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Mobile CTA — quick search trigger */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="mt-5 lg:hidden"
            >
              <button
                onClick={() => document.getElementById('mobile-search-card')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-[#0A4DA6] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-black/20"
              >
                <Search size={16} /> Search Sacred Stays
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ SEARCH CARD ══════════════════════ */}
      {/* Mobile: below hero, full section */}
      {/* Desktop: floating card with negative margin */}
      <section
        id="mobile-search-card"
        className="px-4 pt-5 pb-2 lg:hidden bg-white dark:bg-[#070F1B]"
      >
        <div className="bg-white dark:bg-[#0B192C] rounded-3xl shadow-xl shadow-black/10 border border-gray-100 dark:border-slate-800 p-4">
          {/* Tabs — horizontally scrollable on mobile */}
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {[
              { id: 'destinations', icon: <Compass size={12} />, label: 'Destinations' },
              { id: 'stay', icon: <Bed size={12} />, label: 'Stay' },
              { id: 'darshan', icon: <Heart size={12} />, label: 'Darshan & Seva' },
              { id: 'experiences', icon: <Sparkles size={12} />, label: 'Experiences' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSearchTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  searchTab === tab.id
                    ? 'bg-[#0A4DA6] text-white shadow-sm'
                    : 'text-gray-500 bg-gray-50 dark:bg-slate-900 dark:text-gray-400'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Form — stacked vertically on mobile */}
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Destination */}
            <div className="relative" ref={autocompleteRef}>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">Where to?</label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search temples, cities, places..."
                  value={destination}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-300"
                />
              </div>
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-sm"
                  >
                    {suggestions.map((sug, i) => (
                      <button key={i} type="button" onClick={() => selectSuggestion(sug)}
                        className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 last:border-b-0 cursor-pointer">
                        <Compass size={12} className="text-[#0A4DA6] flex-shrink-0" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">Check In</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-2 py-3.5 text-xs font-semibold focus:outline-none text-[#0B192C] dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">Check Out</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-2 py-3.5 text-xs font-semibold focus:outline-none text-[#0B192C] dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Travelers */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">Travelers</label>
              <div className="relative">
                <Users size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={guests}
                  onChange={e => setGuests(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3.5 text-sm font-semibold focus:outline-none cursor-pointer appearance-none text-[#0B192C] dark:text-white"
                >
                  <option value="1">1 Traveler</option>
                  <option value="2">2 Travelers</option>
                  <option value="3">3 Travelers</option>
                  <option value="4">4+ Travelers</option>
                </select>
              </div>
            </div>

            {/* Submit — full width, 48px min */}
            <button
              type="submit"
              className="w-full min-h-[52px] bg-[#0A4DA6] text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#0A4DA6]/25 transition-all active:scale-[0.98]"
            >
              <Search size={16} /> Search Sacred Stays
            </button>
          </form>

          {/* Popular searches */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-[10px] text-gray-400">
            <span className="font-bold uppercase tracking-wider">Popular:</span>
            {['Kedarnath', 'Varanasi', 'Tirupati', 'Shirdi', 'Ayodhya', 'Ujjain'].map(city => (
              <button key={city} type="button" onClick={() => selectSuggestion(city)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 rounded-full font-semibold transition-all">
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Desktop search card — floating with negative margin */}
      <section className="hidden lg:block max-w-5xl mx-auto px-6 -mt-16 z-20 relative mb-16">
        <div className="bg-white dark:bg-[#0B192C] rounded-[28px] shadow-2xl shadow-black/10 border border-gray-100 dark:border-slate-800 p-6">
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
                  searchTab === tab.id ? 'bg-[#0A4DA6] text-white shadow-sm' : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

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
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl pl-9 pr-4 py-3 text-xs font-semibold focus:outline-none text-[#0B192C] dark:text-white" />
              </div>
            </div>

            <div className="flex flex-col text-left space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Travelers</label>
              <div className="relative">
                <Users size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={guests} onChange={e => setGuests(e.target.value)}
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-10 lg:mb-20 mt-6 lg:mt-0">
        {/* Section Header */}
        <div className="text-center space-y-2 mb-6 lg:mb-8">
          <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.2rem, 5vw, 1.875rem)' }}>
            Everything You Need for a Blessed Journey
          </h2>
          <div className="flex justify-center items-center gap-2">
            <span className="h-px w-8 bg-[#D4AF37] inline-block" />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L9.19 8.62 2 9.27l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7L22 9.27l-7.19-.65z" /></svg>
            <span className="h-px w-8 bg-[#D4AF37] inline-block" />
          </div>
        </div>

        {/* Service Cards: 1 col mobile, 2 col tablet, 3 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {/* Card 1 — Destinations (blue) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/search')}
          >
            <img
              src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=700&q=80"
              alt="Kedarnath Temple"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A4DA6]/95 via-[#0A4DA6]/75 to-[#0A4DA6]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Destinations <ArrowRight size={15} /></h3>
                <p className="text-xs text-blue-100/90 leading-relaxed">Explore sacred places, plan your trip and discover spiritual experiences.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#0A4DA6] font-extrabold text-xs rounded-full hover:bg-blue-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/search'); }}
              >
                Explore Destinations
              </button>
            </div>
          </div>

          {/* Card 2 — Local (teal) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=700&q=80"
              alt="Rishikesh Local Street"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E7B6C]/95 via-[#0E7B6C]/75 to-[#0E7B6C]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Local <ArrowRight size={15} /></h3>
                <p className="text-xs text-emerald-100/90 leading-relaxed">Find local services, guided tours, transport, food and more near you.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#0E7B6C] font-extrabold text-xs rounded-full hover:bg-emerald-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/faq'); }}
              >
                Explore Local
              </button>
            </div>
          </div>

          {/* Card 3 — Marketplace (purple) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer sm:col-span-2 lg:col-span-1"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1600618528240-fb9fc964b853?auto=format&fit=crop&w=700&q=80"
              alt="Spiritual Marketplace"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#6B21A8]/95 via-[#6B21A8]/75 to-[#6B21A8]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Marketplace <ArrowRight size={15} /></h3>
                <p className="text-xs text-purple-100/90 leading-relaxed">Shop spiritual products, puja items, books, handicrafts and more.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#6B21A8] font-extrabold text-xs rounded-full hover:bg-purple-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/faq'); }}
              >
                Visit Marketplace
              </button>
            </div>
          </div>
        </div>

        {/* 12-icon service strip — 6 cols (2 rows) on mobile, 12 cols on desktop */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] mt-4 px-2 py-3 shadow-sm">
          <div className="grid grid-cols-6 lg:grid-cols-12 divide-x divide-gray-100 dark:divide-slate-800 divide-y lg:divide-y-0">
            {serviceIcons.map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-900 rounded-lg transition-colors ${i >= 6 ? 'border-t border-gray-100 dark:border-slate-800 lg:border-t-0' : ''}`}
              >
                {item.icon}
                <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 whitespace-pre-line text-center leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ POPULAR SACRED DESTINATIONS ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5 mb-10 lg:mb-20">
        <div className="flex justify-between items-center">
          <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.1rem, 5vw, 1.875rem)' }}>
            Popular Sacred Destinations
          </h2>
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Desktop scroll arrows only */}
            <div className="hidden lg:flex gap-2">
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

        {/* Carousel — 80vw cards on mobile, 240px on desktop */}
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory -mx-4 sm:mx-0 px-4 sm:px-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {sacredDestinations.map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(`/search?destination=${item.name}`)}
              className="flex-shrink-0 snap-start bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
              style={{ width: 'clamp(220px, 78vw, 240px)' }}
            >
              <div className="h-44 bg-gray-100 dark:bg-slate-800 overflow-hidden relative">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
                  loading="lazy"
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = item.fallback; }}
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 mb-10 lg:mb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div className="space-y-1">
            <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.1rem, 5vw, 1.875rem)' }}>Featured Retreats</h2>
            <p className="text-xs text-gray-400 font-bold uppercase">Govt Verified accommodations with daily prayer and vegetarian food</p>
          </div>
          <Link to="/search" className="text-xs font-bold text-[#0A4DA6] hover:underline flex items-center gap-1">
            View All Stays <ArrowRight size={13} />
          </Link>
        </div>

        {/* Tab Buttons — horizontally scrollable */}
        <div className="flex border-b border-gray-100 dark:border-slate-800 gap-4 lg:gap-6 text-xs font-bold pb-2 overflow-x-auto scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0">
          {[
            { id: 'top_rated', icon: <Award size={13} />, label: 'Top Rated' },
            { id: 'most_booked', icon: <Sparkles size={13} />, label: 'Most Booked' },
            { id: 'recent', icon: <BookOpen size={13} />, label: 'Recently Verified' },
            { id: 'govt_recom', icon: <ShieldCheck size={13} />, label: 'Govt Recommended' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 flex items-center gap-1 px-1 shrink-0 relative cursor-pointer transition-all ${activeTab === tab.id ? 'text-[#0A4DA6]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {tab.icon} {tab.label}
              {activeTab === tab.id && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0A4DA6]" />}
            </button>
          ))}
        </div>

        {/* Listings Grid — 1 col mobile, 3 col desktop */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(n => <div key={n} className="h-72 bg-gray-50 border border-gray-100 rounded-3xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {getTabbedAshrams().map(ashram => (
              <motion.div
                key={ashram._id}
                layout
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                <div className="relative overflow-hidden bg-gray-50 dark:bg-slate-900" style={{ height: 'clamp(180px, 40vw, 192px)' }}>
                  <img
                    src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'}
                    alt={ashram.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                  />
                  <span className="absolute top-3 left-3 bg-[#0A4DA6] text-white text-[9px] font-extrabold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <CheckCircle size={9} /> Verified
                  </span>
                  <span className="absolute bottom-3 right-3 bg-white/95 px-2.5 py-0.5 rounded shadow text-[9.5px] font-black flex items-center gap-0.5">
                    <Star className="text-[#D4AF37] fill-[#D4AF37]" size={9} /> {ashram.rating?.average || 4.5}
                  </span>
                </div>
                <div className="p-4 flex-grow space-y-3">
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
                <div className="px-4 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Starting Rate</span>
                    <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">₹{ashram.lowestNightPrice || 150} <span className="text-[10px] text-gray-400 font-normal">/ night</span></span>
                  </div>
                  <Link
                    to={`/ashram/${ashram._id}`}
                    className="px-4 py-2.5 min-h-[40px] bg-[#0A4DA6] hover:bg-opacity-90 text-white text-xs font-bold rounded-full transition-all flex items-center"
                  >
                    Book Stay
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════ WHY CHOOSE TIRVONA ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-10 lg:mb-20">
        <div className="text-center">
          <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1.1rem, 5vw, 1.875rem)' }}>Why Choose Tirvona?</h2>
        </div>

        {/* 1 col on mobile, 5 col on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Curated for Pilgrims', desc: 'Handpicked destinations and authentic information.', icon: <Compass className="w-6 h-6 text-[#0A4DA6]" /> },
            { label: 'Safe & Trusted', desc: 'Verified services and secure bookings.', icon: <Shield className="w-6 h-6 text-[#0A4DA6]" /> },
            { label: 'AI Pilgrim Assistant', desc: 'Get personalized guidance for your journey.', icon: <Activity className="w-6 h-6 text-[#0A4DA6]" /> },
            { label: 'Contribute & Grow', desc: 'Your donations empower temples and communities.', icon: <Heart className="w-6 h-6 text-[#0A4DA6]" /> },
            { label: 'One Platform', desc: 'All you need for your spiritual journey.', icon: <LayoutGrid className="w-6 h-6 text-[#0A4DA6]" /> },
          ].map((item, i) => (
            <div
              key={i}
              className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-2.5 p-4 lg:p-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl lg:rounded-xl shadow-sm lg:shadow-none lg:bg-transparent lg:border-0 lg:dark:bg-transparent text-left lg:text-center"
            >
              <div className="w-12 h-12 lg:w-12 lg:h-12 bg-[#0A4DA6]/5 dark:bg-[#0A4DA6]/10 border border-[#0A4DA6]/10 rounded-2xl lg:rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight">{item.label}</h4>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ EMPOWERING TEMPLES BANNER ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-10 lg:mb-20">
        <div className="bg-[#0B192C] rounded-3xl p-6 sm:p-8 lg:p-12 text-white relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xl">
          <div className="absolute top-0 right-0 w-[250px] lg:w-[350px] h-[250px] lg:h-[350px] bg-[#0A4DA6]/10 rounded-full blur-[80px] lg:blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-[150px] lg:w-[200px] h-[150px] lg:h-[200px] bg-[#D4AF37]/5 rounded-full blur-[60px] lg:blur-[80px] pointer-events-none" />

          <div className="space-y-3 z-10 max-w-lg">
            <h3 className="font-extrabold leading-snug" style={{ fontSize: 'clamp(1.3rem, 5vw, 1.875rem)' }}>
              Empowering Temples.<br />
              <span className="text-[#D4AF37]">Enriching Communities.</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              A part of every booking and donation goes towards the development of sacred places and local communities.
            </p>
            <button className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-white text-[#0B192C] font-extrabold text-sm rounded-full hover:bg-gray-100 transition-all cursor-pointer">
              Know More
            </button>
          </div>

          {/* Stats — always 2 columns */}
          <div className="grid grid-cols-2 gap-3 z-10 w-full lg:w-auto lg:min-w-[300px]">
            {[
              { label: 'Sacred Destinations', val: '2500+' },
              { label: 'Happy Pilgrims', val: '10M+' },
              { label: 'Temple Partners', val: '500+' },
              { label: 'Donations Facilitated', val: '₹50Cr+' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <span className="block text-2xl font-black text-[#D4AF37] leading-none mb-1">{stat.val}</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ NEWSLETTER ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex flex-col gap-4 py-8 border-y border-gray-100 dark:border-slate-800">
          <div className="space-y-1 text-center">
            <h2 className="font-extrabold text-[#0B192C] dark:text-white" style={{ fontSize: 'clamp(1rem, 5vw, 1.25rem)' }}>
              Stay Inspired, Stay Connected
            </h2>
            <p className="text-xs text-gray-400 font-medium">Subscribe to our newsletter for travel tips, spiritual stories and exclusive offers.</p>
          </div>
          {/* Stacked on mobile, inline on desktop */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email address"
              className="flex-grow bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-full px-5 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 text-[#0B192C] dark:text-white placeholder:text-gray-400"
            />
            <button className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-[#0A4DA6] text-white font-extrabold text-sm rounded-full cursor-pointer hover:bg-[#0A4DA6]/90 transition-all shrink-0">
              Subscribe
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
export default HomePage;
