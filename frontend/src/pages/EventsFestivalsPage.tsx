import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, Calendar, MapPin, Search, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';

export const EventsFestivalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');

  const eventTypes = ['All', 'Kumbh Mela', 'Mahakumbh', 'Navratri', 'Diwali', 'Holi', 'Janmashtami', 'Ram Navami', 'Temple Event'];

  const [publishedFestival, setPublishedFestival] = useState<any>({});

  useEffect(() => {
    fetchEvents();
    fetchPublishedFestival();
  }, [selectedType]);

  const fetchPublishedFestival = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${baseUrl}/api/cms/published`);
      if (res.data?.success && res.data.data?.festival_banner) {
        setPublishedFestival(res.data.data.festival_banner);
      }
    } catch (err) {
      console.warn('Fetch published festival note:', err);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/services/events`,
        { params: { eventType: selectedType } }
      );
      if (res.data.success) {
        setEvents(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      {/* Hero Banner Header Container matching Navbar Layout Width */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3">
        <div className="relative text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden min-h-[300px] flex flex-col justify-between items-center text-center border border-white/10">
          {/* Background Banner Image */}
          <img
            src={publishedFestival.bannerImage || '/banner/popular.png'}
            alt="Events & Sacred Festivals Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/40" />

          {/* Banner Content */}
          <div className="max-w-3xl space-y-2.5 relative z-10 mx-auto text-center my-auto pt-2 pb-4">
            <span className="px-4 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-200 text-xs font-bold uppercase tracking-wider border border-white/20">
              {publishedFestival.announcement || 'Religious Festivals & Temple Celebrations'}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg" style={{ fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif", letterSpacing: '-0.03em' }}>
              {publishedFestival.heading || 'Events & Sacred Festivals'}
            </h1>
            <p className="text-sm sm:text-base text-gray-100 max-w-2xl mx-auto font-medium drop-shadow">
              {publishedFestival.subtitle || 'Stay updated with Kumbh Mela dates, Temple Utsavs, Shivratri processions, and festival special ashram bookings across India.'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-5 py-2.5 rounded-full text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedType === type
                  ? 'bg-[#0A4DA6] text-white shadow-md'
                  : 'bg-white dark:bg-[#0B192C] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-800 hover:bg-gray-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-96 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
            <Sparkles size={48} className="text-gray-400 mx-auto mb-3" />
            <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">No Events Found</h3>
            <p className="text-xs text-gray-400">Select another category or check back soon for upcoming festivals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((item) => (
              <div
                key={item._id}
                className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#E58C28] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                      {item.eventType}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="font-black text-xl text-[#0B192C] dark:text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                        <MapPin size={14} className="text-[#0A4DA6]" />
                        <span>{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl">
                        <Calendar size={14} className="text-[#0A4DA6]" />
                        <span>
                          {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400">
                    {item.ticketPrice}
                  </span>
                  <button
                    onClick={() => navigate('/search')}
                    className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <span>Book Event Stay</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Future Live Stream Banner */}
        <div className="mt-12 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-purple-500/20 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <span className="px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase">In Future</span>
            <h4 className="font-black text-lg">Live Festival Streaming & Virtual Aarti Passes</h4>
            <p className="text-xs text-purple-200">Watch live broadcasting of Kumbh Shahi Snan and temple Mahotsavs directly on Tirvona.</p>
          </div>
          <span className="px-5 py-2 rounded-full bg-white/10 text-purple-300 font-black text-xs border border-purple-400/30 shrink-0">
            Coming Soon 🚀
          </span>
        </div>
      </div>
    </div>
  );
};
