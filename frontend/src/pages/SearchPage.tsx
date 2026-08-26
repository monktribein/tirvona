import React, { useState, useEffect, useRef } from "react";
import { ashramUrl, type SluggableAshram } from "../lib/urls";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ashramService } from "../services";
import { formatCurrency } from "../utils/format";
import { SearchResultStatus } from "../components/shared/SearchResultStatus";
import { GuestRoomSelector } from "../components/shared/GuestRoomSelector";
import { DateRangePicker } from "../components/DateRangePicker";
import {
  useBookingSearch,
  normalizeBookingDates,
} from "../contexts/BookingSearchContext";
import { useLanguage } from "../contexts/LanguageContext";
import { hiUi } from "../i18n/resources";
import { useNearbyAshramDiscovery } from "../hooks/useNearbyAshramDiscovery";
import {
  Filter,
  MapPin,
  Star,
  Compass,
  Wifi,
  Search,
  UtensilsCrossed,
  Car,
  X,
  Building2,
  Landmark,
  Home,
  Navigation,
  Clock,
  BedDouble,
  CheckCircle2,
} from "lucide-react";

export const SearchPage: React.FC = () => {
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawDestination = searchParams.get("destination") || "";
  const rawCategory =
    searchParams.get("category") || searchParams.get("service") || "";
  const rawQuery =
    searchParams.get("query") || searchParams.get("search") || "";
  const activeKeyword = rawDestination || rawCategory || rawQuery || "";

  const typeQuery = searchParams.get("type") || "";
  const queryDates = normalizeBookingDates(
    searchParams.get("checkIn") || "",
    searchParams.get("checkOut") || "",
  );
  const checkInQuery = queryDates.checkIn;
  const checkOutQuery = queryDates.checkOut;
  const roomsQuery = searchParams.get("rooms");
  const adultsQuery = searchParams.get("adults");
  const childrenQuery = searchParams.get("children");
  const guestsQuery = searchParams.get("guests");

  const { searchState, updateBookingSearch, totalGuests } = useBookingSearch();

  const [destination, setDestination] = useState(activeKeyword);
  const [stayType, setStayType] = useState(typeQuery);
  const initialDates = normalizeBookingDates(
    checkInQuery || searchState.checkIn,
    checkOutQuery || searchState.checkOut,
  );
  const [checkIn, setCheckIn] = useState(initialDates.checkIn);
  const [checkOut, setCheckOut] = useState(initialDates.checkOut);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovery, setDiscovery] = useState<any>(null);
  const {
    status: locationStatus,
    coordinates,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useNearbyAshramDiscovery();

  const [ashramFilter, setAshramFilter] = useState(false);
  const [dharamshalaFilter, setDharamshalaFilter] = useState(false);
  const [homestayFilter, setHomestayFilter] = useState(false);
  const [acFilter, setAcFilter] = useState(false);
  const [foodFilter, setFoodFilter] = useState(false);
  const [parkingFilter, setParkingFilter] = useState(false);

  const [showMapGrid, setShowMapGrid] = useState(false);
  const [selectedMapAshram, setSelectedMapAshram] = useState<any>(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allAshrams, setAllAshrams] = useState<any[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const res = await ashramService.search({ verified: "true" });
        if (res.data.success) {
          setAllAshrams(res.data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadAll();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const effIn = checkInQuery || searchState.checkIn || "";
    const effOut = checkOutQuery || searchState.checkOut || "";

    const updates: any = {};
    if (activeKeyword) updates.destination = activeKeyword;
    if (effIn) updates.checkIn = effIn;
    if (effOut) updates.checkOut = effOut;
    if (roomsQuery) updates.rooms = Number(roomsQuery);
    if (adultsQuery) updates.adults = Number(adultsQuery);
    if (childrenQuery !== null && childrenQuery !== undefined)
      updates.children = Number(childrenQuery);
    if (Object.keys(updates).length > 0) {
      updateBookingSearch(updates);
    }

    setDestination(activeKeyword);
    setStayType(typeQuery);
    if (typeQuery) {
      const lower = typeQuery.toLowerCase();
      if (lower.includes("ashram")) setAshramFilter(true);
      if (lower.includes("dharamshala")) setDharamshalaFilter(true);
      if (lower.includes("homestay") || lower.includes("home stay") || lower.includes("temple"))
        setHomestayFilter(true);
    }
    setCheckIn(effIn);
    setCheckOut(effOut);
  }, [
    activeKeyword,
    typeQuery,
    checkInQuery,
    checkOutQuery,
    roomsQuery,
    adultsQuery,
    childrenQuery,
  ]);

  useEffect(() => {
    fetchAshrams();
  }, [
    activeKeyword,
    typeQuery,
    checkInQuery,
    checkOutQuery,
    guestsQuery,
    ashramFilter,
    dharamshalaFilter,
    homestayFilter,
    acFilter,
    foodFilter,
    parkingFilter,
    coordinates?.latitude,
    coordinates?.longitude,
  ]);

  const fetchAshrams = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { verified: "true" };
      params.limit = "100";
      const searchKey = destination.trim() || activeKeyword.trim();
      if (searchKey) params.destination = searchKey;
      if (coordinates && !searchKey) {
        params.latitude = String(coordinates.latitude);
        params.longitude = String(coordinates.longitude);
        params.radiusKm = "100";
      }
      if (checkInQuery) params.checkIn = checkInQuery;
      if (checkOutQuery) params.checkOut = checkOutQuery;
      if (guestsQuery) params.guests = guestsQuery;

      const selectedTypes: string[] = [];
      if (ashramFilter) selectedTypes.push("ashram");
      if (dharamshalaFilter) selectedTypes.push("dharamshala");
      if (homestayFilter) selectedTypes.push("homestay");

      if (selectedTypes.length > 0 && selectedTypes.length < 3) {
        params.type = selectedTypes.join(",");
      } else if (selectedTypes.length === 0 && typeQuery) {
        params.type = typeQuery;
      }

      const amenities = [];
      if (acFilter) amenities.push("AC");
      if (foodFilter) amenities.push("Pure Vegetarian Food");
      if (parkingFilter) amenities.push("Parking");
      if (amenities.length > 0) params.amenities = amenities.join(",");

      const res = await ashramService.search(params);
      if (res.data.success) {
        let fetchedData = res.data.data || [];

        if (selectedTypes.length > 0 && selectedTypes.length < 3) {
          fetchedData = fetchedData.filter((a: any) => {
            const rawType = String(
              a.ashramType || a.type || a.category || a.propertyType || a.name || "ashram",
            ).toLowerCase();
            const category = /dharam|dharma/.test(rawType)
              ? "dharamshala"
              : /home\s*stay|guest\s*house|rest\s*house|temple\s*trust\s*stay/.test(rawType)
                ? "homestay"
                : "ashram";
            return selectedTypes.includes(category);
          });
        }

        setResults(fetchedData);
        setDiscovery(res.data.discovery ?? null);
      }
    } catch (err) {
      console.error("Search API error:", err);
      setResults([]);
      setDiscovery(null);
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
    fetchAshrams();
  };

  const getCentralLandmark = () => {
    if (coordinates) {
      return {
        name: discovery?.detectedArea?.city || "Your location",
        lat: coordinates.latitude,
        lon: coordinates.longitude,
      };
    }
    const dest = activeKeyword.toLowerCase();
    if (dest.includes("vrindavan")) {
      return { name: "Sri Banke Bihari Mandir", lat: 27.5795, lon: 77.698 };
    }
    if (dest.includes("rishikesh")) {
      return { name: "Ram Jhula (Sacred Bridge)", lat: 30.119, lon: 78.311 };
    }
    if (dest.includes("haridwar")) {
      return { name: "Har Ki Pauri (Holy Ghat)", lat: 29.9645, lon: 78.1691 };
    }
    if (results.length > 0) {
      let totalLat = 0;
      let totalLon = 0;
      let count = 0;
      results.forEach((a) => {
        const coords = a.address?.coordinates?.coordinates;
        if (coords && coords.length === 2) {
          totalLon += coords[0];
          totalLat += coords[1];
          count++;
        }
      });
      if (count > 0) {
        return {
          name: "Geographic Center",
          lat: totalLat / count,
          lon: totalLon / count,
        };
      }
    }
    return { name: "Holy Sangam Point", lat: 29.9645, lon: 78.1691 };
  };

  const getDistanceInKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  };

  const getMapItems = () => {
    const central = getCentralLandmark();
    return results
      .flatMap((ashram) => {
        const coords = ashram.address?.coordinates?.coordinates;
        if (
          !Array.isArray(coords) ||
          coords.length !== 2 ||
          !Number.isFinite(Number(coords[0])) ||
          !Number.isFinite(Number(coords[1]))
        )
          return [];
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        const isPlaceholder =
          lon === 77.209 &&
          lat === 28.613 &&
          !/^(new\s+)?delhi$/i.test(String(ashram.address?.city ?? ""));
        if (isPlaceholder) return [];
        return [
          {
            ...ashram,
            lat,
            lon,
            distance:
              ashram.discovery?.distanceKm ??
              getDistanceInKm(central.lat, central.lon, lat, lon),
          },
        ];
      })
      .sort((a, b) => a.distance - b.distance);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (val.trim() && coordinates) clearLocation();

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const valueLower = val.toLowerCase();
    const matches = new Set<string>();

    allAshrams.forEach((ashram) => {
      const city = ashram.address?.city || ashram.address?.district;
      if (city && city.toLowerCase().includes(valueLower)) {
        matches.add(city);
      }
      if (ashram.name && ashram.name.toLowerCase().includes(valueLower)) {
        matches.add(ashram.name);
      }
    });

    const commonAmenities = [
      "Meditation Hall",
      "River View",
      "Cow Shelter",
      "Yoga",
      "Pure Vegetarian Food",
    ];
    commonAmenities.forEach((am) => {
      if (am.toLowerCase().includes(valueLower)) {
        matches.add(am);
      }
    });

    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };

  const selectSuggestion = (sug: string) => {
    clearLocation();
    setDestination(sug);
    setShowSuggestions(false);
    const params: Record<string, string> = { destination: sug };
    if (checkInQuery) params.checkIn = checkInQuery;
    if (checkOutQuery) params.checkOut = checkOutQuery;
    if (guestsQuery) params.guests = guestsQuery;
    setSearchParams(params);
  };

  const buildDetailLink = (ashram: SluggableAshram) => {
    const params = new URLSearchParams();
    const activeCheckIn = checkIn || searchState.checkIn;
    const activeCheckOut = checkOut || searchState.checkOut;
    if (activeCheckIn) params.set("checkIn", activeCheckIn);
    if (activeCheckOut) params.set("checkOut", activeCheckOut);
    params.set("rooms", String(searchState.rooms));
    params.set("adults", String(searchState.adults));
    params.set("children", String(searchState.children));
    params.set("guests", String(totalGuests));
    const qStr = params.toString();
    return ashramUrl(ashram, qStr ? `?${qStr}` : "");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-12 space-y-4 lg:pb-12 lg:h-[calc(100vh-5.5rem)] lg:flex lg:flex-col lg:overflow-hidden">
      <div className="relative z-[100] isolate overflow-visible bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 p-1.5 sm:p-2 rounded-[28px] lg:rounded-full shadow-lg shadow-[#0B192C]/8 shrink-0">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.45fr_1.35fr_1.15fr_auto] gap-1 lg:gap-0 items-center"
        >
          <div
            className="flex flex-col justify-center text-left relative min-h-[62px] px-5 py-2 rounded-2xl lg:rounded-full lg:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B192C] hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:shadow-lg z-10 focus-within:z-[90]"
            ref={autocompleteRef}
          >
            <label className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
              Where
            </label>
            <div className="relative">
              <input
                type="text"
                value={language === "hi" && destination && hiUi[destination] ? hiUi[destination] : destination}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t("Search destinations")}
                className="w-full bg-transparent border-0 p-0 mt-0.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300 focus:outline-none"
              />
            </div>

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs"
                >
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectSuggestion(sug)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 last:border-b-0 cursor-pointer"
                    >
                      <Compass size={12} className="text-[#0A4DA6]" />
                      <span>{t(sug)}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative rounded-2xl lg:rounded-full px-5 py-2 min-h-[62px] flex items-center lg:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B192C] hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:shadow-lg z-10 focus-within:z-[90]">
            <DateRangePicker
              checkIn={checkIn}
              checkOut={checkOut}
              compact
              pill
              onChange={(nextIn, nextOut) => {
                setCheckIn(nextIn);
                setCheckOut(nextOut);
                updateBookingSearch({ checkIn: nextIn, checkOut: nextOut });
              }}
            />
          </div>

          <div className="relative rounded-2xl lg:rounded-full px-5 py-2 min-h-[62px] flex items-center bg-white dark:bg-[#0B192C] hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:shadow-lg z-10 focus-within:z-[90]">
            <GuestRoomSelector compact pill />
          </div>

          <button
            type="submit"
            className="w-full lg:w-auto h-12 lg:h-14 px-6 bg-[#0A4DA6] hover:bg-opacity-95 text-white font-extrabold rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#0A4DA6]/10"
          >
            <Search size={14} /> Modify Search
          </button>
        </form>
      </div>

      <div
        className={`shrink-0 rounded-[24px] border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          coordinates && discovery?.locationApplied
            ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-blue-100 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0A4DA6] shadow-sm dark:bg-slate-900">
            <Navigation size={18} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-[#0B192C] dark:text-white">
              {coordinates && discovery?.locationApplied
                ? `${discovery.nearbyCount} nearby Ashram${discovery.nearbyCount === 1 ? "" : "s"} found first`
                : locationStatus === "requesting"
                  ? "Detecting your area…"
                  : "Find Ashrams near your current area"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-300">
              {coordinates && discovery?.locationApplied
                ? `Near ${
                    [
                      discovery.detectedArea?.city,
                      discovery.detectedArea?.district,
                      discovery.detectedArea?.state,
                    ]
                      .filter(Boolean)
                      .join(", ") || "your current area"
                  } within ${discovery.radiusKm} km. Nearby stays are ranked by distance; the full catalogue follows.`
                : locationError ||
                  "Allow location for distance-ranked results, or use the city/area search above. Your precise location is not saved."}
            </p>
          </div>
        </div>
        {!coordinates && (
          <button
            type="button"
            onClick={requestLocation}
            disabled={locationStatus === "requesting"}
            className="shrink-0 rounded-full bg-[#0A4DA6] px-5 py-2.5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {locationStatus === "requesting" ? "Locating…" : "Use my location"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:flex-1 lg:min-h-0">
        <aside className="space-y-6 lg:overflow-y-auto lg:pr-1 scrollbar-none">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Filter size={16} className="text-[#0A4DA6]" /> Filters
            </h3>

            <div className="space-y-4">
              <h4 className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">
                Stay Type
              </h4>
              <div className="space-y-3.5">
                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ashramFilter}
                    onChange={() => setAshramFilter(!ashramFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5 text-[#0B192C] dark:text-gray-200">
                    <Building2 size={14} className="text-gray-400" /> Ashram
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dharamshalaFilter}
                    onChange={() => setDharamshalaFilter(!dharamshalaFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5 text-[#0B192C] dark:text-gray-200">
                    <Landmark size={14} className="text-gray-400" /> Dharamshala
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={homestayFilter}
                    onChange={() => setHomestayFilter(!homestayFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5 text-[#0B192C] dark:text-gray-200">
                    <Home size={14} className="text-gray-400" /> Homestay
                  </span>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-extrabold text-gray-400 tracking-wider">
                Common Facilities
              </h4>
              <div className="space-y-3.5">
                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acFilter}
                    onChange={() => setAcFilter(!acFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <Wifi size={14} className="text-gray-400" /> AC Rooms
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={foodFilter}
                    onChange={() => setFoodFilter(!foodFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <UtensilsCrossed size={14} className="text-gray-400" />{" "}
                    Satvik Vegetarian Food
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={parkingFilter}
                    onChange={() => setParkingFilter(!parkingFilter)}
                    className="rounded border-gray-200 dark:border-slate-700 text-[#0A4DA6] focus:ring-[#0A4DA6]/20 cursor-pointer w-4 h-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <Car size={14} className="text-gray-400" /> Parking
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#0A4DA6]/5 opacity-40 pointer-events-none" />
            <MapPin className="text-[#0A4DA6]" size={28} />
            <h4 className="text-xs font-extrabold text-[#0B192C] dark:text-white">
              How far is each stay?
            </h4>
            <p className="text-[10px] text-gray-400 max-w-[200px] leading-relaxed">
              See every ashram on a map, sorted by distance from{" "}
              <strong className="text-[#0A4DA6] font-bold">
                {getCentralLandmark().name}
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={() => {
                if (results.length > 0) {
                  const mapItems = getMapItems();
                  setSelectedMapAshram(mapItems[0]);
                }
                setShowMapGrid(true);
              }}
              className="px-5 py-2.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[10px] font-bold hover:bg-[#0A4DA6]/15 transition-all cursor-pointer"
            >
              Show distances
            </button>
          </div>
        </aside>

        <section className="lg:col-span-3 space-y-6 lg:overflow-y-auto lg:pr-2 lg:pb-6 scrollbar-none">
          <SearchResultStatus
            loading={loading}
            destination={
              activeKeyword || discovery?.detectedArea?.city || "All locations"
            }
            count={results.length}
          />

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="bg-gray-50 rounded-3xl p-5 flex flex-col md:flex-row gap-5 animate-pulse h-44 border border-gray-100"
                />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
              <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                No Tirvona Verified Ashrams found matching{" "}
                {activeKeyword ? `"${activeKeyword}"` : "your query"}
              </h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Try adjusting filters or typing city names like 'Rishikesh',
                'Haridwar', or 'Vrindavan'.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {results.map((ashram, index) => (
                <React.Fragment key={ashram._id}>
                  {coordinates && ashram.discovery?.isNearby && index === 0 && (
                    <div className="flex items-center gap-2 px-1 pt-1 text-sm font-extrabold text-[#0B192C] dark:text-white">
                      <Navigation size={17} className="text-[#0A4DA6]" />
                      Nearby Ashrams, ranked by distance
                    </div>
                  )}
                  {coordinates &&
                    !ashram.discovery?.isNearby &&
                    index > 0 &&
                    results[index - 1]?.discovery?.isNearby && (
                      <div className="flex items-center gap-2 border-t border-slate-200 px-1 pt-5 text-sm font-extrabold text-[#0B192C] dark:border-slate-700 dark:text-white">
                        <Compass size={17} className="text-[#0A4DA6]" />
                        More verified Ashrams
                      </div>
                    )}
                <div
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm premium-card-hover flex flex-col md:flex-row gap-6"
                >
                  <div className="w-full md:w-60 h-40 rounded-[20px] bg-gray-50 dark:bg-slate-900 relative overflow-hidden shrink-0">
                    <img
                      src={
                        ashram.images?.[0] ||
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                      }
                      alt={ashram.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                      }}
                    />
                    {ashram.discovery?.distanceKm != null && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-[#0A4DA6] shadow-sm">
                        {ashram.discovery.distanceKm} km away
                      </span>
                    )}
                    {(ashram.images?.length ?? 0) > 1 && (
                      <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white">
                        {ashram.images.length} images
                      </span>
                    )}
                  </div>

                  <div className="flex-grow flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight flex items-center gap-2">
                          <span>{ashram.name}</span>
                          {(ashram.isVerified ?? ashram.status === "approved") && (
                            <img
                              src="/Verified badge/verified.png"
                              alt="Tirvona Verified"
                              className="h-9 sm:h-11 w-auto object-contain inline-block shrink-0 align-middle max-w-[140px]"
                            />
                          )}
                        </h3>
                        <div className="flex items-center gap-1 text-xs font-bold text-[#0B192C] dark:text-accent">
                          <Star
                            className="text-[#D4AF37] fill-[#D4AF37]"
                            size={13}
                          />
                          <span>
                            {Number(ashram.rating?.average) > 0
                              ? Number(ashram.rating.average).toFixed(1)
                              : "New"}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            ({Number(ashram.rating?.count ?? 0)})
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                        <MapPin size={10} className="text-[#0A4DA6]" />{" "}
                        {ashram.address?.city}, {ashram.address?.state}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {ashram.description ||
                          "Spiritual lodging offering simple bedding, prayers, and vegetarian boarding."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-4">
                      <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
                        <BedDouble size={13} className="text-[#0A4DA6]" />
                        {ashram.discovery?.rooms?.totalInventory ?? 0} rooms
                      </span>
                      <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
                        <Car size={13} className="text-[#0A4DA6]" />
                        {ashram.discovery?.parking?.available
                          ? "Parking"
                          : "No parking listed"}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
                        <UtensilsCrossed size={13} className="text-[#0A4DA6]" />
                        {ashram.discovery?.food?.available
                          ? ashram.discovery.food.type || "Food available"
                          : "No food listed"}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        {ashram.discovery?.bookingAvailability?.checkedForDates
                          ? ashram.discovery.bookingAvailability.available
                            ? `${ashram.discovery.bookingAvailability.availableRooms} available`
                            : "Unavailable"
                          : ashram.discovery?.rooms?.totalInventory
                            ? `${ashram.discovery.rooms.totalInventory} rooms`
                            : "Check availability"}
                      </span>
                    </div>

                    {(ashram.discovery?.spiritualSchedule?.dailySchedule ||
                      ashram.discovery?.spiritualSchedule?.activities?.length >
                        0) && (
                      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-300">
                        <Clock size={13} className="mt-0.5 shrink-0 text-[#0A4DA6]" />
                        <span className="line-clamp-2">
                          {ashram.discovery.spiritualSchedule.dailySchedule ||
                            ashram.discovery.spiritualSchedule.activities.join(
                              " · ",
                            )}
                        </span>
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {ashram.amenities
                        ?.slice(0, 4)
                        .map((am: string, i: number) => (
                          <span
                            key={i}
                            className="text-[9px] font-bold bg-gray-50 dark:bg-slate-900 text-gray-500 px-2 py-0.5 rounded-md"
                          >
                            {am}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="w-full md:w-40 md:border-l border-gray-100 dark:border-slate-800 pl-0 md:pl-6 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-4 shrink-0">
                    <div className="flex flex-col md:text-right">
                      <span className="text-[9px] text-gray-400 font-bold tracking-wider">
                        Starts From
                      </span>
                      {ashram.lowestNightPrice != null ? (
                        <>
                          <span className="text-base font-extrabold text-[#0B192C] dark:text-white">
                            {formatCurrency(ashram.lowestNightPrice)}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold">
                            per night / bed
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                          Contact for price
                        </span>
                      )}
                    </div>
                    <Link
                      to={buildDetailLink(ashram)}
                      className="w-full md:w-auto px-5 py-2.5 bg-[#0A4DA6] hover:bg-opacity-95 text-white text-center text-xs font-bold rounded-full transition-all"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showMapGrid &&
          (() => {
            const central = getCentralLandmark();
            const mapItems = getMapItems();

            let lats = mapItems.map((item) => item.lat).concat([central.lat]);
            let lons = mapItems.map((item) => item.lon).concat([central.lon]);

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
                  <div className="flex-grow bg-slate-950 text-slate-200 relative p-6 flex flex-col items-center justify-center border-r border-slate-900 h-[40vh] md:h-full overflow-hidden select-none">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,77,166,0.06),transparent_70%)]" />
                    <div className="absolute top-4 left-5 right-5 z-10 pointer-events-none">
                      <p className="text-[11px] font-black text-white">
                        Distance from {central.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Gold pin marks the temple · tap a stay to see how far it
                        is
                      </p>
                    </div>
                    <div className="absolute inset-0 border border-slate-900 grid grid-cols-6 grid-rows-6 opacity-20 pointer-events-none">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className="border border-slate-800" />
                      ))}
                    </div>

                    <div className="w-full h-full relative border border-slate-800/80 rounded-2xl p-4">
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
                            <div className="mt-1 bg-slate-900/90 border border-slate-700 text-[8px] font-black text-white px-2 py-0.5 rounded shadow whitespace-nowrap tracking-wide">
                              🕉️ {central.name}
                            </div>
                          </div>
                        );
                      })()}

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
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
                                isSelected
                                  ? "bg-emerald-400 scale-125 ring-4 ring-emerald-400/20"
                                  : "bg-[#0A4DA6] hover:bg-emerald-400 hover:scale-110"
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>

                            <div className="absolute left-1/2 bottom-full mb-1.5 transform -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-wide">
                              {item.name} ({item.distance} km)
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-800 text-[8px] font-semibold p-2 rounded flex flex-col gap-1 z-40 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#0A4DA6] inline-block" />{" "}
                        Central Landmark
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />{" "}
                        Ashram Stay
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />{" "}
                        Selected Ashram
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-[360px] flex flex-col h-[50vh] md:h-full bg-white dark:bg-[#0B192C]">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                      <div>
                        <h3 className="font-extrabold text-xs text-[#0B192C] dark:text-white tracking-wider">
                          Distance Matrix
                        </h3>
                        <p className="text-[9px] text-gray-400 font-bold tracking-wider">
                          Closest to Central Landmark
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMapGrid(false)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-3">
                      {mapItems.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-xs">
                          No active retreats to display.
                        </div>
                      ) : (
                        mapItems.map((item, i) => {
                          const isSelected =
                            selectedMapAshram?._id === item._id;
                          return (
                            <div
                              key={item._id}
                              onClick={() => setSelectedMapAshram(item)}
                              className={`p-4.5 border rounded-[20px] cursor-pointer transition-all text-left ${
                                isSelected
                                  ? "border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-sm"
                                  : "border-gray-100 dark:border-slate-800 hover:border-gray-250 bg-card"
                              }`}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <h4 className="font-extrabold text-[11px] leading-tight text-gray-800 dark:text-gray-200">
                                  {i + 1}. {item.name}
                                </h4>
                                <span className="text-[9px] font-bold text-[#0A4DA6] bg-[#0A4DA6]/10 px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm shrink-0">
                                  {item.distance} km
                                </span>
                              </div>
                              <p className="text-[9px] text-gray-400 font-semibold mt-1">
                                Locality: {item.address?.city}
                              </p>

                              {isSelected && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-150 flex justify-between items-center">
                                  <span className="text-[9px] font-bold text-gray-500">
                                    {item.lowestNightPrice != null
                                      ? `From: ${formatCurrency(item.lowestNightPrice)}/night`
                                      : "Contact for price"}
                                  </span>
                                  <Link
                                    to={buildDetailLink(item)}
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
