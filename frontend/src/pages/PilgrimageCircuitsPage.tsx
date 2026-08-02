import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  MapPin,
  Compass,
  ArrowRight,
  Search,
  Sparkles,
  Clock,
} from "lucide-react";

export const PilgrimageCircuitsPage: React.FC = () => {
  const navigate = useNavigate();
  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const circuitTypes = [
    "All",
    "Char Dham",
    "12 Jyotirlinga",
    "Shakti Peeth",
    "Sapta Puri",
    "Ramayana Circuit",
    "Krishna Circuit",
    "Buddhist Circuit",
  ];

  useEffect(() => {
    fetchCircuits();
  }, [selectedType]);

  const fetchCircuits = async () => {
    setLoading(true);
    try {
      const res = await api.get("/services/circuits", {
        params: { circuitType: selectedType, search: searchTerm },
      });
      if (res.data.success) {
        setCircuits(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching circuits:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCircuits();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Pilgrimage Circuits of India
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Explore sacred itineraries including Char Dham, 12 Jyotirlinga, 51
            Shakti Peeth, Ramayana &amp; Krishna Circuits with complete
            day-by-day itineraries.
          </p>
          {/* Centered Search Bar */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-xl mx-auto pt-3 relative z-10"
          >
            <div className="bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-lg border border-gray-200 dark:border-slate-800 flex items-center">
              <Search size={18} className="text-gray-400 ml-4 shrink-0" />
              <input
                type="text"
                placeholder="Search circuit name (e.g. Char Dham, Jyotirlinga)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent px-3 text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          {circuitTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-5 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedType === type
                  ? "bg-[#0A4DA6] text-white shadow-md"
                  : "bg-white dark:bg-[#0B192C] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-800 hover:bg-gray-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Circuit Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl"
              />
            ))}
          </div>
        ) : circuits.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
            <Compass size={48} className="text-gray-400 mx-auto mb-3" />
            <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">
              No Pilgrimage Circuits Found
            </h3>
            <p className="text-xs text-gray-400">
              Try searching for a different yatra route or select "All".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {circuits.map((item) => (
              <div
                key={item._id}
                onClick={() => navigate(`/pilgrimage-circuits/${item.slug}`)}
                className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                      {item.circuitType}
                    </span>
                    <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                      ★ {item.rating} ({item.reviewsCount})
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="font-black text-xl text-[#0B192C] dark:text-white leading-tight group-hover:text-[#0A4DA6] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                        <Clock size={14} className="text-[#0A4DA6]" />
                        <span>{item.duration}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                        <MapPin size={14} className="text-[#0A4DA6]" />
                        <span>{item.distance}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <div className="text-left">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">
                      Budget
                    </span>
                    <span className="text-xs font-black text-[#0A4DA6] dark:text-amber-400">
                      {item.budgetRange}
                    </span>
                  </div>
                  <button className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center gap-1.5 shadow-md">
                    <span>View Itinerary</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* In Future Badge Banner */}
        <div className="mt-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <span className="px-3 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase">
              In Future
            </span>
            <h4 className="font-black text-lg">
              AI Smart Yatra Itinerary Planner
            </h4>
            <p className="text-xs text-amber-100">
              Personalized day-wise route generator based on your budget, health
              condition, and travel dates.
            </p>
          </div>
          <span className="px-5 py-2 rounded-full bg-white text-orange-600 font-black text-xs shadow-md shrink-0">
            Coming Soon 🚀
          </span>
        </div>
      </div>
    </div>
  );
};
