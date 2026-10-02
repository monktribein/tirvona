import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Search, MapPin, Building2, Compass, ArrowRight, Crosshair, X, Sparkles } from "lucide-react";

export default function TempleSearchPage() {
  const navigate = useNavigate();
  const [cityQuery, setCityQuery] = useState("");
  const [temples, setTemples] = useState<any[]>([]);
  const [popularTemples, setPopularTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState("Explore Sacred Temples");
  
  // Geolocation states
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Only the latest request may update the grid. On a first visit the full
  // list and the nearby lookup are in flight together, and a slower earlier
  // response must not overwrite a newer one.
  const requestSeq = useRef(0);

  useEffect(() => {
    // Check if we previously allowed location in this session
    const storedLocation = sessionStorage.getItem("tirvona_location");
    if (storedLocation) {
      try {
        const { lat, lng } = JSON.parse(storedLocation);
        fetchNearbyTemples(lat, lng);
      } catch { sessionStorage.removeItem("tirvona_location"); fetchAllTemples(); }
    } else {
      fetchAllTemples();
      if (localStorage.getItem("tirvona_location_denied") !== "true") requestLocation();
    }
  }, []);

  /** Every published temple; the featured ones also fill the carousel. */
  const loadAllTemples = async (): Promise<any[]> => {
    const res = await api.get("/temples?public=true&limit=48");
    const rows: any[] = res.data?.success ? res.data.data?.data || [] : [];
    setPopularTemples(rows.filter((t) => t.isFeatured));
    return rows;
  };

  const fetchAllTemples = async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setError("");
      setNotice("");
      setHasLocation(false);
      setSearchTitle("Explore Sacred Temples");
      const rows = await loadAllTemples();
      if (seq === requestSeq.current) setTemples(rows);
    } catch (err) {
      console.error(err);
      if (seq === requestSeq.current) setError("Unable to load temples. Please try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const fetchNearbyTemples = async (lat: number, lng: number) => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setError("");
      setNotice("");
      setHasLocation(true);
      setSearchTitle("Temples Near You");
      const res = await api.get(`/temples/nearby?lat=${lat}&lng=${lng}&radius=20`);
      const nearby: any[] = res.data?.success ? res.data.data?.temples || [] : [];
      if (seq !== requestSeq.current) return;
      if (nearby.length) {
        setTemples(nearby);
        return;
      }
      // Nothing within 20 km: show every temple rather than an empty page.
      const rows = await loadAllTemples();
      if (seq !== requestSeq.current) return;
      setSearchTitle("All Temples");
      setNotice("No temples within 20 km of your location, so we're showing all temples instead.");
      setTemples(rows);
    } catch (err) {
      console.error(err);
      if (seq === requestSeq.current) setError("Unable to load nearby temples. Please try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;

    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setError("");
      setNotice("");
      setSearchTitle(`Results for "${cityQuery}"`);
      setHasLocation(false);
      const res = await api.get(`/temples?search=${encodeURIComponent(cityQuery)}&public=true&limit=48`);
      if (seq === requestSeq.current && res.data?.success) {
        setTemples(res.data.data?.data || []);
      }
    } catch (err) {
      console.error(err);
      if (seq === requestSeq.current) setError("Unable to search temples. Please try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const requestLocation = () => {
    setIsLocating(true);
    setLocationError("");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          sessionStorage.setItem("tirvona_location", JSON.stringify({ lat, lng }));
          localStorage.removeItem("tirvona_location_denied");
          setIsLocating(false);
          fetchNearbyTemples(lat, lng);
        },
        (error) => {
          setIsLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            localStorage.setItem("tirvona_location_denied", "true");
            setLocationError("Location permission denied. Please enter a city manually.");
          } else {
            setLocationError("Unable to retrieve your location. Please try manual search.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsLocating(false);
      setLocationError("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">

      {/* Headline — same treatment as the Aarti and Parking hubs */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <h1 className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Explore Sacred Temples
          </h1>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Discover sacred temples, their historical significance, live daily aartis, darshan timings and nearby stays across India.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 relative z-20">
        <form
          onSubmit={handleManualSearch}
          className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] p-3 sm:p-4 shadow-lg shadow-[#0B192C]/5"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="temple-search" className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1">
                Temple, City or Deity
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#F28C28] stroke-[2.5] pointer-events-none" />
                <input
                  id="temple-search"
                  type="text"
                  placeholder="Banke Bihari, Varanasi, Lord Shiva…"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#F28C28]/30 focus:border-[#F28C28] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestLocation}
                disabled={isLocating}
                className="flex-1 sm:flex-none border border-[#F28C28]/40 text-[#F28C28] hover:bg-[#F28C28]/10 font-bold text-xs sm:text-sm px-5 py-3 rounded-full flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-wait"
              >
                <Crosshair size={15} className="stroke-[2.5]" /> {isLocating ? "Locating…" : "Near Me"}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none bg-[#F28C28] hover:bg-[#D97706] disabled:opacity-60 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <Search size={15} className="stroke-[2.5]" /> Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Featured / Popular Carousel (Only show if not doing a specific search) */}
      {!hasLocation && cityQuery === "" && popularTemples.length > 0 && (
        <div className="pt-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#E58C28]" /> Popular Spiritual Destinations
              </h2>
            </div>
            <div className="flex overflow-x-auto gap-5 pb-4 snap-x scrollbar-thin scrollbar-thumb-slate-300">
              {popularTemples.map((temple) => (
                <div 
                  key={temple._id}
                  onClick={() => navigate(`/temples/${temple.slug}`)}
                  className="snap-start shrink-0 w-[260px] sm:w-[300px] bg-slate-50 dark:bg-slate-900/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:shadow-lg hover:border-[#E58C28]/60 hover:-translate-y-1 transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#E58C28] flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      {temple.deity && (
                        <span className="bg-[#FFF4E5]/60 text-[#F28C28] dark:text-amber-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full border border-blue-200/50 dark:border-blue-900">
                          {temple.deity}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-[#E58C28] transition-colors line-clamp-1 mb-1">
                      {temple.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#E58C28]" /> {temple.address?.city}, {temple.address?.state}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#E58C28]">
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 pb-16 lg:pb-24">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{searchTitle}</h2>
          {hasLocation && (
            <button onClick={requestLocation} disabled={isLocating} className="text-sm text-[#F28C28] dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-wait">
              <Crosshair className="w-4 h-4" /> {isLocating ? "Locating…" : "Refresh Location"}
            </button>
          )}
        </div>

        {locationError && <p className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-center text-sm text-amber-800">{locationError}</p>}

        {error && <p className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-red-700">{error}</p>}
        {notice && !loading && <p className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-center text-sm text-amber-800">{notice}</p>}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-52 rounded-2xl" />
            ))}
          </div>
        ) : temples.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#0B192C] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 bg-orange-50 dark:bg-orange-950/40 rounded-full flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-10 h-10 text-[#E58C28]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No temples found</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto text-sm">We couldn't find any temples matching your search. Try a different city or location.</p>
            <button onClick={() => { setCityQuery(""); fetchAllTemples(); }} className="px-6 py-2.5 bg-[#F28C28] text-white rounded-xl font-bold hover:bg-[#B45309] transition-colors cursor-pointer text-sm">
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {temples.map(temple => (
              <div
                key={temple._id}
                onClick={() => navigate(`/temples/${temple.slug}`)}
                className="bg-white dark:bg-[#0B192C] rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-lg hover:border-[#E58C28]/60 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-[#E58C28] flex items-center justify-center">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {temple.isVerified && (
                        <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ✓ Verified
                        </span>
                      )}
                      {temple.deity && (
                        <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          {temple.deity}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#F28C28] dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
                    {temple.name}
                  </h3>

                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 text-xs font-semibold mb-3">
                    <MapPin className="w-3.5 h-3.5 text-[#E58C28]" />
                    {temple.address?.city}, {temple.address?.state}
                  </div>

                  <p className="text-gray-600 dark:text-slate-300 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-4">
                    {temple.shortDescription || temple.description || "Sacred pilgrimage temple with daily darshan and rituals."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#E58C28]">
                  <span>Explore Temple & Rituals</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
