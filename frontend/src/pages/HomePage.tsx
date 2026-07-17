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
  Building2, 
  Compass,
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');

  // Stays catalog and UI states
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'top_rated' | 'most_booked' | 'recent' | 'govt_recom'>('top_rated');

  // Autocomplete Suggestions states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStays();
    // Close autocomplete on click outside
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
      if (res.data.success) {
        setAshrams(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching stays:', err);
      // Failover mock data
      setAshrams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?destination=${encodeURIComponent(destination)}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
  };

  // Autocomplete Suggestion Logic
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const valueLower = val.toLowerCase();
    const matches: Set<string> = new Set();

    // 1. Matches cities
    const cities = ['Haridwar', 'Rishikesh', 'Vrindavan'];
    cities.forEach(city => {
      if (city.toLowerCase().startsWith(valueLower)) {
        matches.add(city);
      }
    });

    // 2. Matches ashram names
    ashrams.forEach(ashram => {
      if (ashram.name.toLowerCase().includes(valueLower)) {
        matches.add(ashram.name);
      }
    });

    // 3. Matches amenities
    const commonAmenities = ['Meditation Hall', 'River View', 'Cow Shelter', 'Yoga', 'Pure Vegetarian Food'];
    commonAmenities.forEach(am => {
      if (am.toLowerCase().includes(valueLower)) {
        matches.add(am);
      }
    });

    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };

  const selectSuggestion = (sug: string) => {
    setDestination(sug);
    setShowSuggestions(false);
  };

  // Group Dynamic Statistics per City
  const getCityStats = (cityName: string) => {
    const cityStays = ashrams.filter(a => a.address?.city?.toLowerCase() === cityName.toLowerCase());
    const count = cityStays.length || 10;
    
    const sumRatings = cityStays.reduce((acc, curr) => acc + (curr.rating?.average || 0), 0);
    const avgRating = count > 0 ? parseFloat((sumRatings / count).toFixed(1)) : 4.7;

    const prices = cityStays.map(a => a.lowestNightPrice || 150);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 150;

    return { count, avgRating, minPrice };
  };

  const haridwarStats = getCityStats('Haridwar');
  const rishikeshStats = getCityStats('Rishikesh');
  const vrindavanStats = getCityStats('Vrindavan');

  // Filter Stays by Active tab
  const getTabbedAshrams = () => {
    if (activeTab === 'top_rated') {
      return [...ashrams].sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)).slice(0, 6);
    }
    if (activeTab === 'most_booked') {
      return [...ashrams].sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0)).slice(0, 6);
    }
    if (activeTab === 'recent') {
      return [...ashrams].slice(-6).reverse(); // Last 6 seeded
    }
    if (activeTab === 'govt_recom') {
      // Stays with average rating >= 4.6
      return ashrams.filter(a => (a.rating?.average || 0) >= 4.6).slice(0, 6);
    }
    return ashrams.slice(0, 6);
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Header Section */}
      <section className="relative bg-gradient-to-br from-[#0c1a30] via-[#112547] to-[#1e3d70] text-white py-24 px-6 md:px-12 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Decorative Saffron and Gold Lights */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#ff9933]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#ffcc33]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-6 z-10">
          <motion.span 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#ff9933]/15 text-[#ff9933] text-xs font-bold rounded-full border border-[#ff9933]/30 shadow-inner"
          >
            <ShieldCheck size={14} /> Ministry of Tourism Approved Portal
          </motion.span>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-gray-100 to-[#ffcc33] bg-clip-text text-transparent"
          >
            One Nation, One Spiritual Stay Portal
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-lg text-gray-300 max-w-2xl mx-auto font-medium"
          >
            Explore and book verified Ashrams, Dharamshalas, and Spiritual retreats across India. Transparent pricing, direct verification, and unified online reservation.
          </motion.p>

          {/* Search Box Engine Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-4xl mx-auto mt-10 relative z-30"
          >
            <form onSubmit={handleSearch} className="bg-card text-foreground rounded-3xl shadow-2xl p-5 md:p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end border border-border">
              {/* Destination with Autocomplete */}
              <div className="flex flex-col text-left space-y-1.5 relative" ref={autocompleteRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <MapPin size={12} className="text-[#ff9933]" /> Destination City / Ashram
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rishikesh, Parmarth"
                  value={destination}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff9933]/40 focus:border-[#ff9933] transition-all"
                />
                
                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 text-xs"
                    >
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Suggested matches:</div>
                      {suggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectSuggestion(sug)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 font-semibold flex items-center gap-2 border-b border-border last:border-b-0 cursor-pointer"
                        >
                          <Compass size={12} className="text-[#ff9933]" />
                          <span>{sug}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Check In Date */}
              <div className="flex flex-col text-left space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Calendar size={12} className="text-[#ff9933]" /> Check In
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>

              {/* Check Out Date */}
              <div className="flex flex-col text-left space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Calendar size={12} className="text-[#ff9933]" /> Check Out
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>

              {/* Guests */}
              <div className="flex flex-col text-left space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Users size={12} className="text-[#ff9933]" /> Guests Count
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="1">1 Guest</option>
                  <option value="2">2 Guests</option>
                  <option value="3">3 Guests</option>
                  <option value="4">4+ Guests</option>
                </select>
              </div>

              {/* Search Button */}
              <button
                type="submit"
                className="w-full py-3 bg-[#ff9933] hover:bg-[#e68a00] text-white font-bold rounded-xl text-xs shadow-lg shadow-[#ff9933]/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search size={14} /> Find Accommodations
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Popular Destinations (Haridwar, Rishikesh, Vrindavan) */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="space-y-1.5 mb-8">
          <span className="text-xs uppercase font-extrabold text-[#ff9933] tracking-widest flex items-center gap-1.5">
            <Compass size={14} /> Sacred Locations
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-[#0c1a30] dark:text-white leading-tight">
            Explore Sacred Destinations
          </h2>
          <p className="text-xs text-gray-500 font-medium">Popular holy cities across India with verified spiritual stay retreats</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rishikesh */}
          <div
            onClick={() => navigate(`/search?destination=Rishikesh`)}
            className="group relative h-64 rounded-3xl overflow-hidden shadow-md hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
          >
            <img
              src="https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=600&q=80"
              alt="Rishikesh"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1627894142757-08ca1b75bca2?auto=format&fit=crop&w=600&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a30]/95 via-[#0c1a30]/40 to-transparent" />
            <div className="absolute bottom-5 left-5 text-white space-y-1">
              <h3 className="font-extrabold text-lg tracking-wide flex items-center gap-1.5">
                Rishikesh <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[10px] text-gray-300 font-bold uppercase">Uttarakhand</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold text-gray-300">
                <span className="flex items-center gap-0.5"><Star className="text-accent fill-accent" size={10} /> {rishikeshStats.avgRating} Avg Rating</span>
                <span>•</span>
                <span>Starting from ₹{rishikeshStats.minPrice}/bed</span>
              </div>
            </div>
            <span className="absolute top-5 right-5 bg-[#ff9933] px-2.5 py-1 rounded-lg text-[9px] text-white font-extrabold shadow">
              {rishikeshStats.count} Verified Stays
            </span>
          </div>

          {/* Haridwar */}
          <div
            onClick={() => navigate(`/search?destination=Haridwar`)}
            className="group relative h-64 rounded-3xl overflow-hidden shadow-md hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
          >
            <img
              src="https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=600&q=80"
              alt="Haridwar"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a30]/95 via-[#0c1a30]/40 to-transparent" />
            <div className="absolute bottom-5 left-5 text-white space-y-1">
              <h3 className="font-extrabold text-lg tracking-wide flex items-center gap-1.5">
                Haridwar <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[10px] text-gray-300 font-bold uppercase">Uttarakhand</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold text-gray-300">
                <span className="flex items-center gap-0.5"><Star className="text-accent fill-accent" size={10} /> {haridwarStats.avgRating} Avg Rating</span>
                <span>•</span>
                <span>Starting from ₹{haridwarStats.minPrice}/bed</span>
              </div>
            </div>
            <span className="absolute top-5 right-5 bg-[#ff9933] px-2.5 py-1 rounded-lg text-[9px] text-white font-extrabold shadow">
              {haridwarStats.count} Verified Stays
            </span>
          </div>

          {/* Vrindavan */}
          <div
            onClick={() => navigate(`/search?destination=Vrindavan`)}
            className="group relative h-64 rounded-3xl overflow-hidden shadow-md hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
          >
            <img
              src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80"
              alt="Vrindavan"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a30]/95 via-[#0c1a30]/40 to-transparent" />
            <div className="absolute bottom-5 left-5 text-white space-y-1">
              <h3 className="font-extrabold text-lg tracking-wide flex items-center gap-1.5">
                Vrindavan <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[10px] text-gray-300 font-bold uppercase">Uttar Pradesh</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold text-gray-300">
                <span className="flex items-center gap-0.5"><Star className="text-accent fill-accent" size={10} /> {vrindavanStats.avgRating} Avg Rating</span>
                <span>•</span>
                <span>Starting from ₹{vrindavanStats.minPrice}/bed</span>
              </div>
            </div>
            <span className="absolute top-5 right-5 bg-[#ff9933] px-2.5 py-1 rounded-lg text-[9px] text-white font-extrabold shadow">
              {vrindavanStats.count} Verified Stays
            </span>
          </div>
        </div>
      </section>

      {/* Featured Verified Retreats Section (Tabbed Category Lists) */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div className="space-y-1.5">
            <span className="text-xs uppercase font-extrabold text-[#ff9933] tracking-widest flex items-center gap-1.5">
              <ShieldCheck size={14} /> Assured Stays
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#0c1a30] dark:text-white leading-tight">
              Featured retreats
            </h2>
            <p className="text-xs text-gray-500 font-medium">Clean bedding, satvik vegetarian boarding, spiritual aura, approved by government inspectors</p>
          </div>
          <Link to="/search" className="text-xs font-bold text-[#ff9933] hover:underline flex items-center gap-1">
            Browse All Stays <ArrowRight size={14} />
          </Link>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-border gap-6 text-xs font-bold mb-8 overflow-x-auto pb-1.5">
          <button
            onClick={() => setActiveTab('top_rated')}
            className={`pb-3 flex items-center gap-1 px-1.5 cursor-pointer relative transition-all ${activeTab === 'top_rated' ? 'text-[#ff9933]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Award size={14} /> Top Rated
            {activeTab === 'top_rated' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#ff9933]" />}
          </button>
          <button
            onClick={() => setActiveTab('most_booked')}
            className={`pb-3 flex items-center gap-1 px-1.5 cursor-pointer relative transition-all ${activeTab === 'most_booked' ? 'text-[#ff9933]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Sparkles size={14} /> Most Booked
            {activeTab === 'most_booked' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#ff9933]" />}
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`pb-3 flex items-center gap-1 px-1.5 cursor-pointer relative transition-all ${activeTab === 'recent' ? 'text-[#ff9933]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <BookOpen size={14} /> Recently Verified
            {activeTab === 'recent' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#ff9933]" />}
          </button>
          <button
            onClick={() => setActiveTab('govt_recom')}
            className={`pb-3 flex items-center gap-1 px-1.5 cursor-pointer relative transition-all ${activeTab === 'govt_recom' ? 'text-[#ff9933]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <ShieldCheck size={14} /> Govt Recommended
            {activeTab === 'govt_recom' && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#ff9933]" />}
          </button>
        </div>

        {/* Tab Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-80 bg-card border border-border rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {getTabbedAshrams().map((ashram) => (
              <motion.div
                key={ashram._id}
                layout
                className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
              >
                <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-slate-800">
                  <img
                    src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'}
                    alt={ashram.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                  />
                  <span className="absolute top-4 left-4 bg-primary/95 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-0.5">
                    <CheckCircle size={10} /> Govt Approved
                  </span>
                  <span className="absolute bottom-4 right-4 bg-white/95 text-secondary px-2 py-0.5 rounded shadow text-[10px] font-extrabold flex items-center gap-0.5">
                    <Star className="text-accent fill-accent" size={10} /> {ashram.rating?.average || 4.5}
                  </span>
                </div>

                <div className="p-5 flex-grow space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white leading-snug line-clamp-1">
                      {ashram.name}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1 uppercase">
                      <MapPin size={10} className="text-[#ff9933]" /> {ashram.address?.city}, {ashram.address?.state}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {ashram.description || 'Peaceful lodgings offering daily satsangs, pure Satvik vegetarian food, and meditation spaces.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {ashram.amenities?.slice(0, 3).map((am: string, i: number) => (
                      <span key={i} className="text-[9px] font-bold bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                        {am}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-border flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Starting Rate</span>
                    <span className="text-sm font-extrabold text-[#0c1a30] dark:text-accent">₹{ashram.lowestNightPrice || 150} <span className="text-[10px] text-gray-400 font-normal">/ night</span></span>
                  </div>
                  <Link
                    to={`/ashram/${ashram._id}`}
                    className="px-4 py-2 bg-[#ff9933] hover:bg-[#e68a00] text-white text-xs font-bold rounded-lg hover:shadow transition-all"
                  >
                    Book Stay
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Government Trust Banner */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="bg-gradient-to-r from-[#0c1a30] to-[#1a3863] rounded-3xl p-8 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 border border-border shadow-xl">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px]" />
          <div className="space-y-2 z-10 text-center md:text-left">
            <h3 className="font-extrabold text-lg flex items-center justify-center md:justify-start gap-2">
              <Building2 className="text-[#ff9933]" /> Standardizing Spiritual Stays Nationwide
            </h3>
            <p className="text-xs text-gray-300 max-w-xl">
              All properties are subjected to periodic inspections by State Tourism Departments to maintain safety, hygiene, proper separate female facilities, and fair satvik pricing thresholds.
            </p>
          </div>
          <div className="flex gap-4 z-10 shrink-0">
            <div className="flex flex-col items-center p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl w-24">
              <span className="text-xl font-extrabold text-[#ffcc33]">30</span>
              <span className="text-[8px] uppercase font-bold text-gray-300">Verified Ashrams</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl w-24">
              <span className="text-xl font-extrabold text-[#ffcc33]">100%</span>
              <span className="text-[8px] uppercase font-bold text-gray-300">Secured Payments</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
export default HomePage;
