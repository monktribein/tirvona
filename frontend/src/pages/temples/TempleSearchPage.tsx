import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { Search, MapPin, Building2, Compass, ArrowRight, Crosshair, X } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Hero Section */}
      <div className="relative bg-[#0B192C] text-white py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
          <span className="bg-[#E58C28]/20 text-[#E58C28] text-sm font-bold px-4 py-1.5 rounded-full mb-6 flex items-center gap-2 border border-[#E58C28]/30">
            <SparklesIcon className="w-4 h-4" /> Spiritual Discovery
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Explore Sacred Temples</h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12">
            Discover sacred temples, their history, timings, rituals and nearby spiritual experiences across India.
          </p>

          <form onSubmit={handleManualSearch} className="w-full max-w-3xl flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search temples by city or location..."
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E58C28] focus:bg-white/15 backdrop-blur-sm transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-[#E58C28] hover:bg-[#d67d1d] text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-[#E58C28]/20"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-medium border border-white/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Crosshair className="w-5 h-5" /> Near Me
            </button>
          </form>
        </div>
      </div>

      {/* Featured / Popular Carousel (Only show if not doing a specific search) */}
      {!hasLocation && cityQuery === "" && popularTemples.length > 0 && (
        <div className="pt-16 pb-8 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Popular Spiritual Destinations</h2>
            </div>
            <div className="flex overflow-x-auto gap-6 pb-6 snap-x hide-scrollbar">
              {popularTemples.map((temple) => (
                <div 
                  key={temple._id}
                  onClick={() => navigate(`/temples/${temple.slug}`)}
                  className="snap-start shrink-0 w-[300px] md:w-[350px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="h-48 relative overflow-hidden bg-gray-100">
                    {temple.media?.coverImage ? (
                      <img src={temple.media.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={temple.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#E58C28] transition-colors line-clamp-1">{temple.name}</h3>
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                      <MapPin className="w-4 h-4 text-[#E58C28]" /> {temple.address?.city}, {temple.address?.state}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">{searchTitle}</h2>
          {hasLocation && (
            <button onClick={() => setShowLocationModal(true)} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
              <Crosshair className="w-4 h-4" /> Change Location
            </button>
          )}
        </div>

        {error && <p className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-red-700">{error}</p>}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white border border-gray-100 h-96 rounded-3xl" />
            ))}
          </div>
        ) : temples.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-[#E58C28]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No temples found</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">We couldn't find any temples matching your current search criteria. Try adjusting your location.</p>
            <button onClick={() => { setCityQuery(""); fetchPopularTemples(); }} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {temples.map(temple => (
              <div
                key={temple._id}
                onClick={() => navigate(`/temples/${temple.slug}`)}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col"
              >
                <div className="relative h-56 bg-gray-100 overflow-hidden">
                  {temple.media?.coverImage ? (
                    <img src={temple.media.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={temple.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <Building2 className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {temple.isVerified && (
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Verified
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-bold text-xl text-gray-900 group-hover:text-[#0A4DA6] transition-colors line-clamp-1 mb-2">
                    {temple.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-gray-500 text-sm font-medium mb-4">
                    <MapPin className="w-4 h-4 text-[#E58C28]" />
                    {temple.address?.city}, {temple.address?.state}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed flex-1 mb-6">
                    {temple.shortDescription || temple.description}
                  </p>
                  
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    {temple.deity ? (
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                        {temple.deity}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[#E58C28] text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Explore <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
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
