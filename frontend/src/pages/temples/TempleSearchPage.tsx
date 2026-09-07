import { useState, useEffect } from "react";
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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if we previously allowed location in this session
    const storedLocation = sessionStorage.getItem("tirvona_location");
    if (storedLocation) {
      try {
        const { lat, lng } = JSON.parse(storedLocation);
        fetchNearbyTemples(lat, lng);
      } catch { sessionStorage.removeItem("tirvona_location"); fetchPopularTemples(); }
    } else {
      fetchPopularTemples();
      if (localStorage.getItem("tirvona_location_denied") !== "true") requestLocation();
    }
  }, []);

  const fetchPopularTemples = async () => {
    try {
      setLoading(true);
      setSearchTitle("Explore Sacred Temples");
      const res = await api.get("/temples?public=true&isFeatured=true&limit=20");
      if (res.data?.success) {
        setPopularTemples(res.data.data?.data || []);
        // Also set temples so the grid isn't empty initially
        setTemples(res.data.data?.data || []); 
      }
    } catch (err) {
      console.error(err); setError("Unable to load temples. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyTemples = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      setSearchTitle("Temples Near You");
      setHasLocation(true);
      const res = await api.get(`/temples/nearby?lat=${lat}&lng=${lng}&radius=20`);
      if (res.data?.success) {
        setTemples(res.data.data?.temples || []);
      }
    } catch (err) {
      console.error(err); setError("Unable to load nearby temples. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    
    try {
      setLoading(true);
      setSearchTitle(`Results for "${cityQuery}"`);
      setHasLocation(false);
      const res = await api.get(`/temples?search=${encodeURIComponent(cityQuery)}&public=true&limit=48`);
      if (res.data?.success) {
        setTemples(res.data.data?.data || []);
      }
    } catch (err) {
      console.error(err); setError("Unable to search temples. Please try again.");
    } finally {
      setLoading(false);
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
          setShowLocationModal(false);
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#070F1B] flex flex-col">

      {/* Hero Section styled with Tirvona Home Theme */}
      <section className="relative pt-24 sm:pt-32 pb-28 sm:pb-36 flex items-center overflow-hidden rounded-b-[36px] sm:rounded-b-[48px] shadow-xl bg-gradient-to-br from-[#0B192C] via-[#0D233E] to-[#0B192C]">
        <div className="absolute inset-0 z-0 opacity-25">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E58C28]/20 via-[#0A4DA6]/20 to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 bg-[#E58C28]/15 text-[#E58C28] text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full mb-5 border border-[#E58C28]/30 backdrop-blur-md shadow-xs">
            <Sparkles className="w-4 h-4 text-[#E58C28]" /> Spiritual Discovery
          </span>

          <h1 
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-4 drop-shadow-md leading-tight"
            style={{
              fontFamily: "'Kalam', cursive, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Explore <span className="text-[#E58C28]">Sacred Temples</span>
          </h1>

          <p 
            className="text-slate-200 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-medium drop-shadow-xs"
            style={{
              fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif",
            }}
          >
            Discover sacred temples, their historical significance, live daily aartis, darshan timings and nearby ashrams across India.
          </p>

          <form onSubmit={handleManualSearch} className="w-full max-w-3xl flex flex-col sm:flex-row gap-3 bg-white/10 dark:bg-black/30 p-2 rounded-3xl border border-white/20 backdrop-blur-md shadow-2xl">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-300 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search temples by city, name, or deity..."
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-transparent border-0 text-white placeholder-slate-300 font-medium focus:outline-none focus:ring-0 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none bg-[#E58C28] hover:bg-[#d67d1d] text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-[#E58C28]/30 cursor-pointer text-sm sm:text-base"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="bg-white/15 hover:bg-white/25 text-white px-5 py-3.5 rounded-2xl font-semibold border border-white/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer text-sm sm:text-base"
              >
                <Crosshair className="w-4 h-4 text-[#E58C28]" /> Near Me
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Featured / Popular Carousel (Only show if not doing a specific search) */}
      {!hasLocation && cityQuery === "" && popularTemples.length > 0 && (
        <div className="pt-12 pb-8 bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
                        <span className="bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full border border-blue-200/50 dark:border-blue-900">
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{searchTitle}</h2>
          {hasLocation && (
            <button onClick={() => setShowLocationModal(true)} className="text-sm text-[#0A4DA6] dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer">
              <Crosshair className="w-4 h-4" /> Change Location
            </button>
          )}
        </div>

        {error && <p className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-red-700">{error}</p>}
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
            <button onClick={() => { setCityQuery(""); fetchPopularTemples(); }} className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-xl font-bold hover:bg-[#083b80] transition-colors cursor-pointer text-sm">
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

                  <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#0A4DA6] dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
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
