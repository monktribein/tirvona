import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  MapPin, 
  Star, 
  Compass, 
  Wifi, 
  ShieldCheck,
  Search,
  Calendar,
  Users,
  UtensilsCrossed,
  Droplet
} from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const destinationQuery = searchParams.get('destination') || '';
  const checkInQuery = searchParams.get('checkIn') || '';
  const checkOutQuery = searchParams.get('checkOut') || '';
  const guestsQuery = searchParams.get('guests') || '1';
  
  const navigate = useNavigate();
  const [destination, setDestination] = useState(destinationQuery);
  const [checkIn, setCheckIn] = useState(checkInQuery);
  const [checkOut, setCheckOut] = useState(checkOutQuery);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [acFilter, setAcFilter] = useState(false);
  const [foodFilter, setFoodFilter] = useState(false);
  const [riverViewFilter, setRiverViewFilter] = useState(false);

  // Spatial Map State
  const [showMapGrid, setShowMapGrid] = useState(false);
  const [selectedMapAshram, setSelectedMapAshram] = useState<any>(null);

  // Autocomplete Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allAshrams, setAllAshrams] = useState<any[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load all ashrams once for autocomplete matching
    const loadAll = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams?verified=true`);
        if (res.data.success) {
          setAllAshrams(res.data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadAll();

    // Close autocomplete on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchAshrams();
  }, [destinationQuery, acFilter, foodFilter, riverViewFilter]);

  const fetchAshrams = async () => {
    setLoading(true);
    try {
      let queryStr = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams?verified=true`;
      if (destinationQuery) {
        queryStr += `&destination=${encodeURIComponent(destinationQuery)}`;
      }
      
      const amenities = [];
      if (acFilter) amenities.push('AC');
      if (foodFilter) amenities.push('Pure Vegetarian Food');
      if (riverViewFilter) amenities.push('River View');
      
      if (amenities.length > 0) {
        queryStr += `&amenities=${encodeURIComponent(amenities.join(','))}`;
      }

      const res = await axios.get(queryStr);
      if (res.data.success) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Search API error:', err);
      // Fallback mocks
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ destination, checkIn, checkOut, guests: guestsQuery });
  };

  // Landmark distance calculation for Spatial Map Grid
  const getCentralLandmark = () => {
    const dest = destinationQuery.toLowerCase();
    if (dest.includes('vrindavan')) {
      return { name: 'Sri Banke Bihari Mandir', lat: 27.5795, lon: 77.6980 };
    }
    if (dest.includes('rishikesh')) {
      return { name: 'Ram Jhula (Sacred Bridge)', lat: 30.1190, lon: 78.3110 };
    }
    if (dest.includes('haridwar')) {
      return { name: 'Har Ki Pauri (Holy Ghat)', lat: 29.9645, lon: 78.1691 };
    }
    // Default to average coordinates of results
    if (results.length > 0) {
      let totalLat = 0;
      let totalLon = 0;
      let count = 0;
      results.forEach(a => {
        const coords = a.address?.coordinates?.coordinates;
        if (coords && coords.length === 2) {
          totalLon += coords[0];
          totalLat += coords[1];
          count++;
        }
      });
      if (count > 0) {
        return { name: 'Geographic Center', lat: totalLat / count, lon: totalLon / count };
      }
    }
    return { name: 'Holy Sangam Point', lat: 29.9645, lon: 78.1691 };
  };

  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(2));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const valueLower = val.toLowerCase();
    const matches: Set<string> = new Set();

    const cities = ['Haridwar', 'Rishikesh', 'Vrindavan'];
    cities.forEach(city => {
      if (city.toLowerCase().startsWith(valueLower)) {
        matches.add(city);
      }
    });

    allAshrams.forEach(ashram => {
      if (ashram.name.toLowerCase().includes(valueLower)) {
        matches.add(ashram.name);
      }
    });

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
    setSearchParams({ destination: sug, guests: guestsQuery });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Premium Top Search Panel */}
      <div className="bg-card border border-border p-4 rounded-3xl shadow-md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col text-left space-y-1.5 relative" ref={autocompleteRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Destination City / Ashram</label>
            <div className="relative">
              <input
                type="text"
                value={destination}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Haridwar"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff9933]/40"
              />
              <MapPin className="absolute left-3 top-3 text-gray-400" size={14} />
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 text-xs"
                >
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Check In Date</label>
            <div className="relative">
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none"
              />
              <Calendar className="absolute left-3 top-3 text-gray-400" size={14} />
            </div>
          </div>

          {/* Check Out Date */}
          <div className="flex flex-col text-left space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Check Out Date</label>
            <div className="relative">
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none"
              />
              <Calendar className="absolute left-3 top-3 text-gray-400" size={14} />
            </div>
          </div>

          <div className="flex flex-col text-left space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Guest Count</label>
            <div className="relative">
              <select
                value={guestsQuery}
                onChange={(e) => setSearchParams({ destination: destinationQuery, checkIn: checkInQuery, checkOut: checkOutQuery, guests: e.target.value })}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="3">3 Guests</option>
                <option value="4">4+ Guests</option>
              </select>
              <Users className="absolute left-3 top-3 text-gray-400" size={14} />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#ff9933] hover:bg-[#e68a00] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search size={14} /> Modify Search
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className="space-y-6">
          <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-5">
            <h3 className="font-extrabold text-sm text-secondary dark:text-white flex items-center gap-2 border-b border-border pb-3">
              <Filter size={16} className="text-[#ff9933]" /> Filters Accommodation
            </h3>

            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Common Facilities</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acFilter}
                    onChange={() => setAcFilter(!acFilter)}
                    className="rounded border-border text-[#ff9933] focus:ring-[#ff9933]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1"><Wifi size={14} className="text-gray-400" /> AC Accommodation</span>
                </label>
                
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={foodFilter}
                    onChange={() => setFoodFilter(!foodFilter)}
                    className="rounded border-border text-[#ff9933] focus:ring-[#ff9933]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1"><UtensilsCrossed size={14} className="text-gray-400" /> Satvik Vegetarian Food</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riverViewFilter}
                    onChange={() => setRiverViewFilter(!riverViewFilter)}
                    className="rounded border-border text-[#ff9933] focus:ring-[#ff9933]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1"><Droplet size={14} className="text-gray-400" /> Holy River View</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-5 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#ff9933]/5 opacity-40 pointer-events-none" />
            <MapPin className="text-[#ff9933]" size={28} />
            <h4 className="text-xs font-extrabold">Spatial Map Grid View</h4>
            <p className="text-[10px] text-gray-500 max-w-[180px] leading-relaxed">View coordinates of all retreats relative to holy temples</p>
            <button 
              type="button"
              onClick={() => {
                if (results.length > 0) {
                  const central = getCentralLandmark();
                  const mapItems = results.map(ashram => {
                    const coords = ashram.address?.coordinates?.coordinates;
                    const lon = coords?.[0] || central.lon;
                    const lat = coords?.[1] || central.lat;
                    const dist = getDistanceInKm(central.lat, central.lon, lat, lon);
                    return { ...ashram, lat, lon, distance: dist };
                  }).sort((a, b) => a.distance - b.distance);
                  setSelectedMapAshram(mapItems[0]);
                }
                setShowMapGrid(true);
              }}
              className="px-4 py-2 bg-[#ff9933]/15 text-[#ff9933] border border-[#ff9933]/20 rounded-xl text-[10px] font-bold hover:bg-[#ff9933]/20 transition-all cursor-pointer"
            >
              Activate Map Grid
            </button>
          </div>
        </aside>

        {/* Results Listings */}
        <section className="lg:col-span-3 space-y-6">
          <div className="flex justify-between items-center bg-card border border-border px-5 py-3 rounded-2xl">
            <div className="text-xs font-bold text-gray-500">
              Found <span className="text-[#ff9933] font-extrabold">{results.length} stays</span> matching{' '}
              {destinationQuery ? `"${destinationQuery}"` : 'all sacred locations'}
            </div>
          </div>

          {loading ? (
            /* Loading Skeletons */
            <div className="space-y-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="bg-card border border-border rounded-3xl p-5 flex flex-col md:flex-row gap-5 animate-pulse h-44" />
              ))}
            </div>
          ) : results.length === 0 ? (
            /* Empty State */
            <div className="text-center py-20 bg-card border border-border rounded-3xl space-y-4">
              <Compass className="mx-auto text-gray-300" size={48} />
              <h4 className="font-extrabold text-base">No retreats found</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                We couldn't find any approved Ashram matching your query. Try adjusting filters or typing city names like 'Rishikesh', 'Haridwar', or 'Vrindavan'.
              </p>
            </div>
          ) : (
            /* Search Feed list */
            <div className="space-y-4">
              {results.map((ashram) => (
                <div
                  key={ashram._id}
                  className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col md:flex-row gap-5 transform hover:-translate-y-0.5"
                >
                  {/* Image Block */}
                  <div className="w-full md:w-56 h-36 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 relative overflow-hidden shrink-0">
                    <img 
                      src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'} 
                      alt={ashram.name} 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                    />
                    <span className="absolute top-3 left-3 bg-[#ff9933] text-white text-[8px] font-extrabold px-2 py-0.5 rounded shadow flex items-center gap-0.5 uppercase tracking-wider">
                      <ShieldCheck size={10} /> Verified
                    </span>
                  </div>

                  {/* Details info */}
                  <div className="flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white leading-tight">
                          {ashram.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs font-bold text-[#0c1a30] dark:text-accent">
                          <Star className="text-accent fill-accent" size={13} />
                          <span>{ashram.rating?.average || 4.5}</span>
                          <span className="text-[10px] text-gray-400 font-medium">({ashram.rating?.count || 10})</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5 uppercase"><MapPin size={10} className="text-[#ff9933]" /> {ashram.address?.city}, {ashram.address?.state}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {ashram.description || 'Spiritual lodging offering simple bedding, prayers, and vegetarian boarding.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {ashram.amenities?.slice(0, 4).map((am: string, i: number) => (
                        <span key={i} className="text-[9px] font-bold bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-400 px-2 py-0.5 rounded">
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Price block */}
                  <div className="w-full md:w-40 md:border-l border-border pl-0 md:pl-5 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-3 shrink-0">
                    <div className="flex flex-col md:text-right">
                      <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Starting Rate</span>
                      <span className="text-base font-extrabold text-[#0c1a30] dark:text-accent">₹{ashram.lowestNightPrice || 150}</span>
                      <span className="text-[9px] text-gray-400 font-bold">per night / bed</span>
                    </div>
                    <Link
                      to={`/ashram/${ashram._id}`}
                      className="w-full md:w-auto px-4 py-2 bg-[#ff9933] hover:bg-[#e68a00] text-white text-center text-xs font-bold rounded-xl hover:shadow transition-all"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Spatial Map Grid Modal */}
      <AnimatePresence>
        {showMapGrid && (() => {
          const central = getCentralLandmark();
          const mapItems = results.map(ashram => {
            const coords = ashram.address?.coordinates?.coordinates;
            const lon = coords?.[0] || central.lon;
            const lat = coords?.[1] || central.lat;
            const dist = getDistanceInKm(central.lat, central.lon, lat, lon);
            return { ...ashram, lat, lon, distance: dist };
          }).sort((a, b) => a.distance - b.distance);

          let lats = mapItems.map(item => item.lat).concat([central.lat]);
          let lons = mapItems.map(item => item.lon).concat([central.lon]);
          
          let minLat = Math.min(...lats);
          let maxLat = Math.max(...lats);
          let minLon = Math.min(...lons);
          let maxLon = Math.max(...lons);

          const latRange = maxLat - minLat || 0.01;
          const lonRange = maxLon - minLon || 0.01;
          minLat -= latRange * 0.15;
          maxLat += latRange * 0.15;
          minLon -= lonRange * 0.15;
          maxLon += lonRange * 0.15;

          const getPercentCoords = (lat: number, lon: number) => {
            const x = ((lon - minLon) / (maxLon - minLon)) * 100;
            const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
            return { x: `${x}%`, y: `${y}%` };
          };

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-10 z-50"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 30 }}
                className="bg-card border border-border w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[600px] relative text-left"
              >
                {/* Radar Grid Canvas - Left Side */}
                <div className="flex-grow bg-slate-950 text-slate-200 relative p-6 flex flex-col items-center justify-center border-r border-border h-[40vh] md:h-full overflow-hidden select-none">
                  {/* Tech Grid Background */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,153,51,0.06),transparent_70%)]" />
                  <div className="absolute inset-0 border border-slate-900 grid grid-cols-6 grid-rows-6 opacity-20 pointer-events-none">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div key={i} className="border border-slate-800" />
                    ))}
                  </div>

                  {/* Plot Area */}
                  <div className="w-full h-full relative border border-slate-800/80 rounded-2xl p-4">
                    {/* Central Landmark (Temple) */}
                    {(() => {
                      const pct = getPercentCoords(central.lat, central.lon);
                      return (
                        <div 
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
                          style={{ left: pct.x, top: pct.y }}
                        >
                          <span className="relative flex h-5 w-5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff9933] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff9933] border border-white"></span>
                          </span>
                          <div className="mt-1 bg-slate-900/90 border border-slate-700 text-[8px] font-black text-white px-2 py-0.5 rounded shadow whitespace-nowrap uppercase tracking-wide">
                            🕉️ {central.name}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Seeded Retreat Nodes */}
                    {mapItems.map((item) => {
                      const pct = getPercentCoords(item.lat, item.lon);
                      const isSelected = selectedMapAshram?._id === item._id;
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => setSelectedMapAshram(item)}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                          style={{ left: pct.x, top: pct.y }}
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
                            isSelected ? 'bg-emerald-400 scale-125 ring-4 ring-emerald-400/20' : 'bg-blue-500 hover:bg-emerald-400 hover:scale-110'
                          }`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          
                          {/* Hover Tooltip */}
                          <div className="absolute left-1/2 bottom-full mb-1.5 transform -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-wide">
                            {item.name} ({item.distance} km)
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend overlay */}
                  <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-800 text-[8px] font-semibold p-2 rounded flex flex-col gap-1 z-40 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff9933] inline-block" /> Central Temple</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Ashram Retreat</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Selected Ashram</div>
                  </div>
                </div>

                {/* Sidebar Listing - Right Side */}
                <div className="w-full md:w-[360px] flex flex-col h-[50vh] md:h-full bg-card">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-slate-800/20">
                    <div>
                      <h3 className="font-extrabold text-xs text-secondary dark:text-white uppercase tracking-wider">Spatial Distance List</h3>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Sorted from closest to furthest</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowMapGrid(false)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 cursor-pointer font-bold text-xs"
                    >
                      Close
                    </button>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-grow overflow-y-auto p-3 space-y-2.5">
                    {mapItems.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">No active retreats to display on the map.</div>
                    ) : (
                      mapItems.map((item, i) => {
                        const isSelected = selectedMapAshram?._id === item._id;
                        return (
                          <div
                            key={item._id}
                            onClick={() => setSelectedMapAshram(item)}
                            className={`p-3 border rounded-2xl cursor-pointer transition-all text-left ${
                              isSelected 
                                ? 'border-emerald-400 bg-emerald-500/5 shadow-sm' 
                                : 'border-border hover:border-gray-300 dark:hover:border-slate-700 bg-card'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="font-extrabold text-[11px] leading-tight text-gray-800 dark:text-gray-200">{i + 1}. {item.name}</h4>
                              <span className="text-[9px] font-bold text-[#ff9933] bg-[#ff9933]/10 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm shrink-0">
                                {item.distance} km
                              </span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase mt-1">Address: {item.address?.city}</p>
                            
                            {isSelected && (
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-border flex justify-between items-center">
                                <span className="text-[9px] font-bold text-gray-500">Starting: ₹{item.lowestNightPrice || 1150}</span>
                                <Link 
                                  to={`/ashram/${item._id}`}
                                  className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-bold hover:bg-emerald-600 shadow"
                                >
                                  View Details
                                </Link>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
export default SearchPage;
