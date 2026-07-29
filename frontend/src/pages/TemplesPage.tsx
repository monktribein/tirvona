import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Compass, Clock, MapPin, Search, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export const TemplesPage: React.FC = () => {
  const navigate = useNavigate();
  const [temples, setTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTemples();
  }, []);

  const fetchTemples = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/services/temples`,
        { params: { search: searchTerm } }
      );
      if (res.data.success) {
        setTemples(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching temples:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemples();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      {/* Hero Banner Header Container matching Navbar Layout Width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3">
        <div className="relative text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden min-h-[340px] sm:min-h-[380px] flex flex-col justify-between items-center text-center border border-white/10">
          {/* Background Banner Image */}
          <img
            src="/banner/popular.png"
            alt="Holy Temples of India Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay gradient for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/40" />

          {/* Banner Content */}
          <div className="max-w-3xl space-y-2.5 relative z-10 mx-auto text-center my-auto pt-2 pb-4">
            <span className="px-4 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-200 text-xs font-bold uppercase tracking-wider border border-white/20">
              Sacred Shrines &amp; Mandir Directory
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg" style={{ fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif", letterSpacing: '-0.03em' }}>
              Holy Temples of India
            </h1>
            <p className="text-sm sm:text-base text-gray-100 max-w-2xl mx-auto font-medium drop-shadow">
              Explore authentic Darshan timings, Aarti schedules, temple rules, history, dress code, and official trust details.
            </p>
          </div>

          {/* Search Bar Container inside Banner */}
          <form onSubmit={handleSearch} className="w-full max-w-xl mx-auto relative z-10 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-md rounded-full p-2 shadow-2xl border border-white/20 flex items-center">
            <Search size={18} className="text-gray-400 ml-4 shrink-0" />
            <input
              type="text"
              placeholder="Search temple name, deity, or city (e.g. Kashi, Mahakal)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent px-3 text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
            />
            <button type="submit" className="px-6 py-2.5 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs transition-colors shrink-0">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Temple Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : temples.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
            <Compass size={48} className="text-gray-400 mx-auto mb-3" />
            <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">No Temples Found</h3>
            <p className="text-xs text-gray-400">Try searching for a different temple name or location.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {temples.map((item) => (
              <div
                key={item._id}
                onClick={() => navigate(`/temples/${item.slug}`)}
                className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                      {item.city}, {item.state}
                    </span>
                    <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                      ★ {item.rating} ({item.reviewsCount})
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                      Deity: {item.deity}
                    </span>
                    <h3 className="font-black text-xl text-[#0B192C] dark:text-white leading-tight group-hover:text-[#0A4DA6] transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.history}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                        <Clock size={14} className="text-[#0A4DA6]" />
                        <span>Darshan: {item.darshanTimings}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <span className="text-[11px] font-extrabold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={14} /> Official Info
                  </span>
                  <button className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center gap-1.5 shadow-md">
                    <span>View Temple Details</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coming Soon Features Banner */}
        <div className="mt-12 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-500/20 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">In Future</span>
            <h4 className="font-black text-lg">Live Darshan Streaming & Real-Time Queue Status</h4>
            <p className="text-xs text-gray-300">Direct integration with temple trust cameras and live crowd density tracker.</p>
          </div>
          <span className="px-5 py-2 rounded-full bg-white/10 text-amber-300 font-black text-xs border border-amber-400/30 shrink-0">
            Coming Soon 🚀
          </span>
        </div>
      </div>
    </div>
  );
};
