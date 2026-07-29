import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ashramService } from '../services';
import { SearchResultStatus } from '../components/shared/SearchResultStatus';
import { GuestRoomSelector } from '../components/shared/GuestRoomSelector';
import { VerifiedBadge } from '../components/shared/VerifiedBadge';
import { useBookingSearch } from '../contexts/BookingSearchContext';
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
  Droplet,
  ChevronLeft,
  X
} from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawDestination = searchParams.get('destination') || '';
  const rawCategory = searchParams.get('category') || searchParams.get('service') || '';
  const rawQuery = searchParams.get('query') || searchParams.get('search') || '';
  const activeKeyword = rawDestination || rawCategory || rawQuery || '';

  const typeQuery = searchParams.get('type') || '';
  const checkInQuery = searchParams.get('checkIn') || '';
  const checkOutQuery = searchParams.get('checkOut') || '';
  const roomsQuery = searchParams.get('rooms');
  const adultsQuery = searchParams.get('adults');
  const childrenQuery = searchParams.get('children');
  const guestsQuery = searchParams.get('guests');
  
  const navigate = useNavigate();
  const { searchState, updateBookingSearch, totalGuests } = useBookingSearch();

  const [destination, setDestination] = useState(activeKeyword || searchState.destination);
  const [stayType, setStayType] = useState(typeQuery);
  const [checkIn, setCheckIn] = useState(checkInQuery || searchState.checkIn);
  const [checkOut, setCheckOut] = useState(checkOutQuery || searchState.checkOut);
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
        const res = await ashramService.search({ verified: 'true' });
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const updates: any = {};
    if (activeKeyword) updates.destination = activeKeyword;
    if (checkInQuery) updates.checkIn = checkInQuery;
    if (checkOutQuery) updates.checkOut = checkOutQuery;
    if (roomsQuery) updates.rooms = Number(roomsQuery);
    if (adultsQuery) updates.adults = Number(adultsQuery);
    if (childrenQuery !== null && childrenQuery !== undefined) updates.children = Number(childrenQuery);
    if (Object.keys(updates).length > 0) {
      updateBookingSearch(updates);
    }

    setDestination(activeKeyword || searchState.destination);
    setStayType(typeQuery);
    setCheckIn(checkInQuery || searchState.checkIn);
    setCheckOut(checkOutQuery || searchState.checkOut);
  }, [activeKeyword, typeQuery, checkInQuery, checkOutQuery, roomsQuery, adultsQuery, childrenQuery]);

  useEffect(() => {
    fetchAshrams();
  }, [activeKeyword, typeQuery, checkInQuery, checkOutQuery, guestsQuery, acFilter, foodFilter, riverViewFilter]);

  const fetchAshrams = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { verified: 'true' };
      if (activeKeyword) params.destination = activeKeyword;
      if (typeQuery) params.type = typeQuery;
      if (checkInQuery) params.checkIn = checkInQuery;
      if (checkOutQuery) params.checkOut = checkOutQuery;
      if (guestsQuery) params.guests = guestsQuery;

      const amenities = [];
      if (acFilter) amenities.push('AC');
      if (foodFilter) amenities.push('Pure Vegetarian Food');
      if (riverViewFilter) amenities.push('River View');
      if (amenities.length > 0) params.amenities = amenities.join(',');

      const res = await ashramService.search(params);
      if (res.data.success) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Search API error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBookingSearch({
      destination,
      checkIn,
      checkOut,
    });
    const params: Record<string, string> = {};
    if (destination) params.destination = destination;
    if (stayType) params.type = stayType;
    if (checkIn) params.checkIn = checkIn;
    if (checkOut) params.checkOut = checkOut;
    params.rooms = String(searchState.rooms);
    params.adults = String(searchState.adults);
    params.children = String(searchState.children);
    params.guests = String(totalGuests);
    setSearchParams(params);
  };

  // Landmark distance calculation for Spatial Map Grid
  const getCentralLandmark = () => {
    const dest = activeKeyword.toLowerCase();
    if (dest.includes('vrindavan')) {
      return { name: 'Sri Banke Bihari Mandir', lat: 27.5795, lon: 77.6980 };
    }
    if (dest.includes('rishikesh')) {
      return { name: 'Ram Jhula (Sacred Bridge)', lat: 30.1190, lon: 78.3110 };
    }
    if (dest.includes('haridwar')) {
      return { name: 'Har Ki Pauri (Holy Ghat)', lat: 29.9645, lon: 78.1691 };
    }
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
    const params: Record<string, string> = { destination: sug };
    if (checkInQuery) params.checkIn = checkInQuery;
    if (checkOutQuery) params.checkOut = checkOutQuery;
    if (guestsQuery) params.guests = guestsQuery;
    setSearchParams(params);
  };

  const buildDetailLink = (ashramId: string) => {
    const params = new URLSearchParams();
    const activeCheckIn = checkIn || searchState.checkIn;
    const activeCheckOut = checkOut || searchState.checkOut;
    if (activeCheckIn) params.set('checkIn', activeCheckIn);
    if (activeCheckOut) params.set('checkOut', activeCheckOut);
    params.set('rooms', String(searchState.rooms));
    params.set('adults', String(searchState.adults));
    params.set('children', String(searchState.children));
    params.set('guests', String(totalGuests));
    const qStr = params.toString();
    return `/ashram/${ashramId}${qStr ? `?${qStr}` : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-12 space-y-4 lg:pb-12 lg:h-[calc(100vh-5.5rem)] lg:flex lg:flex-col lg:overflow-hidden">
      {/* Search Filter Panel — stays fixed below the navbar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[28px] shadow-sm shrink-0">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Destination */}
          <div className="flex flex-col text-left space-y-1.5 relative" ref={autocompleteRef}>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Destination City / Ashram</label>
            <div className="relative">
              <input
                type="text"
                value={destination}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Haridwar"
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
              <MapPin className="absolute left-3 top-3.5 text-gray-400" size={14} />
            </div>

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs"
                >
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectSuggestion(sug)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 last:border-b-0 cursor-pointer"
                    >
                      <Compass size={12} className="text-[#0A4DA6]" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Check In */}
          <div className="flex flex-col text-left space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Check In Date</label>
            <div className="relative">
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute left-3 top-3.5 text-gray-400" size={14} />
            </div>
          </div>

          {/* Check Out */}
          <div className="flex flex-col text-left space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Check Out Date</label>
            <div className="relative">
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute left-3 top-3.5 text-gray-400" size={14} />
            </div>
          </div>

          {/* Guest & Room Count */}
          <div className="flex flex-col text-left space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Guests & Rooms</label>
            <GuestRoomSelector compact />
          </div>

          {/* Search Action */}
          <button
            type="submit"
            className="w-full py-3 bg-[#0A4DA6] hover:bg-opacity-95 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#0A4DA6]/10"
          >
            <Search size={14} /> Modify Search
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:flex-1 lg:min-h-0">
        {/* Sidebar Filter and Map Toggle — static */}
        <aside className="space-y-6 lg:overflow-y-auto lg:pr-1 scrollbar-none">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Filter size={16} className="text-[#0A4DA6]" /> Filters
            </h3>

            <div className="space-y-4">
              <h4 className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Common Facilities</h4>
              <div className="space-y-3.5">
                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acFilter}
                    onChange={() => setAcFilter(!acFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5"><Wifi size={14} className="text-gray-400" /> AC Rooms</span>
                </label>
                
                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={foodFilter}
                    onChange={() => setFoodFilter(!foodFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5"><UtensilsCrossed size={14} className="text-gray-400" /> Satvik Vegetarian Food</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={riverViewFilter}
                    onChange={() => setRiverViewFilter(!riverViewFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5"><Droplet size={14} className="text-gray-400" /> Holy River View</span>
                </label>
              </div>
            </div>
          </div>

          {/* Spatial Map Activation Box */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#0A4DA6]/5 opacity-40 pointer-events-none" />
            <MapPin className="text-[#0A4DA6]" size={28} />
            <h4 className="text-xs font-extrabold text-[#0B192C] dark:text-white">Spatial Map Grid View</h4>
            <p className="text-[10px] text-gray-400 max-w-[190px] leading-relaxed">
              View coordinates of all retreats relative to holy temples.
            </p>
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
              className="px-5 py-2.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[10px] font-bold hover:bg-[#0A4DA6]/15 transition-all cursor-pointer"
            >
              Activate Map Grid
            </button>
          </div>
        </aside>

        {/* Results Feed — only this scrolls */}
        <section className="lg:col-span-3 space-y-6 lg:overflow-y-auto lg:pr-2 lg:pb-6 scrollbar-none">
          <SearchResultStatus
            loading={loading}
            destination={activeKeyword}
            count={results.length}
          />

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="bg-gray-50 rounded-3xl p-5 flex flex-col md:flex-row gap-5 animate-pulse h-44 border border-gray-100" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
              <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">No verified Ashrams found matching {activeKeyword ? `"${activeKeyword}"` : 'your query'}</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Try adjusting filters or typing city names like 'Rishikesh', 'Haridwar', or 'Vrindavan'.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {results.map((ashram) => (
                <div
                  key={ashram._id}
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm premium-card-hover flex flex-col md:flex-row gap-6"
                >
                  {/* Ashram Thumbnail Image */}
                  <div className="w-full md:w-60 h-40 rounded-[20px] bg-gray-50 dark:bg-slate-900 relative overflow-hidden shrink-0">
                    <img 
                      src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'} 
                      alt={ashram.name} 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                    />
                    <span className="absolute top-3.5 left-3.5">
                      <VerifiedBadge isVerified={ashram.isVerified ?? (ashram.status === 'approved')} text="Verified" size="sm" />
                    </span>
                  </div>

                  {/* Info details */}
                  <div className="flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight">
                          {ashram.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs font-bold text-[#0B192C] dark:text-accent">
                          <Star className="text-[#D4AF37] fill-[#D4AF37]" size={13} />
                          <span>{ashram.rating?.average || 4.5}</span>
                          <span className="text-[10px] text-gray-400 font-medium">({ashram.rating?.count || 10})</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1 uppercase">
                        <MapPin size={10} className="text-[#0A4DA6]" /> {ashram.address?.city}, {ashram.address?.state}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {ashram.description || 'Spiritual lodging offering simple bedding, prayers, and vegetarian boarding.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {ashram.amenities?.slice(0, 4).map((am: string, i: number) => (
                        <span key={i} className="text-[9px] font-bold bg-gray-50 dark:bg-slate-900 text-gray-500 px-2 py-0.5 rounded-md">
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pricing info & Action button */}
                  <div className="w-full md:w-40 md:border-l border-gray-100 dark:border-slate-800 pl-0 md:pl-6 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-4 shrink-0">
                    <div className="flex flex-col md:text-right">
                      <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Starts From</span>
                      <span className="text-base font-extrabold text-[#0B192C] dark:text-white">₹{ashram.lowestNightPrice ?? 150}</span>
                      <span className="text-[9px] text-gray-400 font-bold">per night / bed</span>
                    </div>
                    <Link
                      to={buildDetailLink(ashram._id)}
                      className="w-full md:w-auto px-5 py-2.5 bg-[#0A4DA6] hover:bg-opacity-95 text-white text-center text-xs font-bold rounded-full transition-all"
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
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[600px] relative text-left"
              >
                {/* Map Grid Plot - Left */}
                <div className="flex-grow bg-slate-950 text-slate-200 relative p-6 flex flex-col items-center justify-center border-r border-slate-900 h-[40vh] md:h-full overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,77,166,0.06),transparent_70%)]" />
                  <div className="absolute inset-0 border border-slate-900 grid grid-cols-6 grid-rows-6 opacity-20 pointer-events-none">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div key={i} className="border border-slate-800" />
                    ))}
                  </div>

                  <div className="w-full h-full relative border border-slate-800/80 rounded-2xl p-4">
                    {/* Central Temple/Landmark */}
                    {(() => {
                      const pct = getPercentCoords(central.lat, central.lon);
                      return (
                        <div 
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
                          style={{ left: pct.x, top: pct.y }}
                        >
                          <span className="relative flex h-5 w-5 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0A4DA6] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0A4DA6] border border-white"></span>
                          </span>
                          <div className="mt-1 bg-slate-900/90 border border-slate-700 text-[8px] font-black text-white px-2 py-0.5 rounded shadow whitespace-nowrap uppercase tracking-wide">
                            🕉️ {central.name}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Stays Nodes */}
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
                            isSelected ? 'bg-emerald-400 scale-125 ring-4 ring-emerald-400/20' : 'bg-[#0A4DA6] hover:bg-emerald-400 hover:scale-110'
                          }`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          </span>
                          
                          <div className="absolute left-1/2 bottom-full mb-1.5 transform -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-wide">
                            {item.name} ({item.distance} km)
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-800 text-[8px] font-semibold p-2 rounded flex flex-col gap-1 z-40 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0A4DA6] inline-block" /> Central Landmark</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Ashram Stay</div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Selected Ashram</div>
                  </div>
                </div>

                {/* Stays Listing details - Right */}
                <div className="w-full md:w-[360px] flex flex-col h-[50vh] md:h-full bg-white dark:bg-[#0B192C]">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                    <div>
                      <h3 className="font-extrabold text-xs text-[#0B192C] dark:text-white uppercase tracking-wider">Distance Matrix</h3>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Closest to Central Landmark</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowMapGrid(false)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* List */}
                  <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {mapItems.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">No active retreats to display.</div>
                    ) : (
                      mapItems.map((item, i) => {
                        const isSelected = selectedMapAshram?._id === item._id;
                        return (
                          <div
                            key={item._id}
                            onClick={() => setSelectedMapAshram(item)}
                            className={`p-4.5 border rounded-[20px] cursor-pointer transition-all text-left ${
                              isSelected 
                                ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-sm' 
                                : 'border-gray-100 dark:border-slate-800 hover:border-gray-250 bg-card'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="font-extrabold text-[11px] leading-tight text-gray-800 dark:text-gray-200">{i + 1}. {item.name}</h4>
                              <span className="text-[9px] font-bold text-[#0A4DA6] bg-[#0A4DA6]/10 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm shrink-0">
                                {item.distance} km
                              </span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase mt-1">Locality: {item.address?.city}</p>
                            
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-dashed border-gray-150 flex justify-between items-center">
                                <span className="text-[9px] font-bold text-gray-500">From: ₹{item.lowestNightPrice ?? 150}/night</span>
                                <Link 
                                  to={buildDetailLink(item._id)}
                                  className="px-3.5 py-1.5 bg-[#0A4DA6] text-white rounded-full text-[9px] font-bold shadow"
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
