import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Compass,
  Clock,
  MapPin,
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const TemplesPage: React.FC = () => {
  const navigate = useNavigate();
  const [temples, setTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchTemples();
  }, []);

  const fetchTemples = async () => {
    setLoading(true);
    try {
      const res = await api.get("/services/temples", {
        params: { search: searchTerm },
      });
      if (res.data.success) {
        setTemples(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching temples:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemples();
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Holy Temples of India
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
            Explore authentic Darshan timings, Aarti schedules, temple rules,
            history, dress code, and official trust details.
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
                placeholder="Search temple name, deity, or city (e.g. Kashi, Mahakal)..."
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

      {/* Temple Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl"
              />
            ))}
          </div>
        ) : (
          (() => {
            const defaultTemplesList = [
              {
                _id: "def-1",
                name: "Shri Ram Janmabhoomi Mandir",
                slug: "ram-janmabhoomi-ayodhya",
                deity: "Bhagwan Shri Ram Lalla",
                city: "Ayodhya",
                state: "Uttar Pradesh",
                history:
                  "The sacred birthplace of Lord Ram, newly consecrated grand pink sandstone mandir designed by Sompura family.",
                darshanTimings: "06:30 AM - 12:00 PM & 02:00 PM - 10:00 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1627894483216-2138af692e32?auto=format&fit=crop&w=1200&q=80",
                rating: 5.0,
                reviewsCount: 2400,
              },
              {
                _id: "def-2",
                name: "Shri Mahakaleshwar Temple Ujjain",
                slug: "mahakaleshwar-ujjain",
                deity: "Lord Shiva (Mahakal)",
                city: "Ujjain",
                state: "Madhya Pradesh",
                history:
                  "One of the twelve Jyotirlingas, famous for its unique south-facing idol (Dakshinamurti) and world-renowned Bhasma Aarti.",
                darshanTimings: "04:00 AM - 11:00 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1608958416801-9c60e3a6a908?auto=format&fit=crop&w=1200&q=80",
                rating: 4.9,
                reviewsCount: 980,
              },
              {
                _id: "def-3",
                name: "Shri Kashi Vishwanath Temple",
                slug: "kashi-vishwanath-varanasi",
                deity: "Lord Shiva (Kashi Vishwanath)",
                city: "Varanasi",
                state: "Uttar Pradesh",
                history:
                  "One of the most famous Hindu temples dedicated to Lord Shiva, located on the western bank of holy River Ganga.",
                darshanTimings: "03:00 AM - 11:00 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=1200&q=80",
                rating: 4.9,
                reviewsCount: 1250,
              },
              {
                _id: "def-4",
                name: "Kedarnath Dham Jyotirlinga Temple",
                slug: "kedarnath-dham",
                deity: "Lord Shiva (Kedarnath)",
                city: "Kedarnath",
                state: "Uttarakhand",
                history:
                  "Ancient Himalayan shrine of Lord Shiva located near Mandakini river amidst snow-capped peaks.",
                darshanTimings: "05:00 AM - 09:00 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80",
                rating: 5.0,
                reviewsCount: 3100,
              },
              {
                _id: "def-5",
                name: "Shri Badrinath Dham Temple",
                slug: "badrinath-dham",
                deity: "Lord Vishnu (Badri Narayan)",
                city: "Badrinath",
                state: "Uttarakhand",
                history:
                  "Sacred Char Dham shrine dedicated to Lord Vishnu, situated along the Alaknanda river in Chamoli district.",
                darshanTimings: "04:30 AM - 09:00 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80",
                rating: 4.9,
                reviewsCount: 1850,
              },
              {
                _id: "def-6",
                name: "Shri Bankey Bihari Mandir",
                slug: "bankey-bihari-vrindavan",
                deity: "Lord Krishna (Bankey Bihari)",
                city: "Vrindavan",
                state: "Uttar Pradesh",
                history:
                  "Holy Krishna temple in Vrindavan established by Swami Haridas, famous for its divine curtain darshan (Parda Seva).",
                darshanTimings: "07:45 AM - 12:00 PM & 05:30 PM - 09:30 PM",
                coverImage:
                  "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80",
                rating: 4.9,
                reviewsCount: 1620,
              },
            ];

            const getTempleCoverImage = (item: any, idx: number) => {
              const name = item?.name || "";
              if (name.includes("Mahakal") || name.includes("Ujjain")) {
                return "/banner/ashram_himalayas.png";
              }
              if (
                name.includes("Kashi") ||
                name.includes("Vishwanath") ||
                name.includes("Varanasi")
              ) {
                return "/banner/ashram_varanasi.png";
              }
              if (name.includes("Ram") || name.includes("Ayodhya")) {
                return "/banner/ashram_vrindavan.png";
              }
              if (name.includes("Kedar")) {
                return "/banner/ashram_himalayas.png";
              }
              if (name.includes("Badri")) {
                return "/banner/ashram_rishikesh.png";
              }
              if (name.includes("Bankey") || name.includes("Vrindavan")) {
                return "/banner/ashram_vrindavan.png";
              }
              const defaultBanners = [
                "/banner/ashram_vrindavan.png",
                "/banner/ashram_himalayas.png",
                "/banner/ashram_varanasi.png",
                "/banner/ashram_rishikesh.png",
              ];
              return defaultBanners[idx % defaultBanners.length];
            };

            const listToRender =
              temples.length > 0 ? temples : defaultTemplesList;

            return listToRender.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
                <Compass size={48} className="text-gray-400 mx-auto mb-3" />
                <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">
                  No Temples Found
                </h3>
                <p className="text-xs text-gray-400">
                  Try searching for a different temple name or location.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listToRender.map((item, idx) => {
                  const validImg = getTempleCoverImage(item, idx);

                  return (
                    <div
                      key={item._id || idx}
                      onClick={() => navigate(`/temples/${item.slug}`)}
                      className="bg-white dark:bg-[#0B192C] rounded-[28px] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-md hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
                    >
                      <div>
                        {/* Image Header with location & rating badges */}
                        <div className="relative h-60 overflow-hidden bg-slate-900">
                          <img
                            src={validImg}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src =
                                "/banner/ashram_varanasi.png";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
                          <span className="absolute top-4 left-4 bg-[#0A4DA6]/90 backdrop-blur-md text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md border border-white/10 flex items-center gap-1">
                            <MapPin size={11} className="text-amber-400" />
                            {item.city}, {item.state}
                          </span>
                          <span className="absolute top-4 right-4 bg-black/75 backdrop-blur-md text-amber-300 text-[11px] font-black px-3 py-1 rounded-full border border-amber-400/30 flex items-center gap-1 shadow-md">
                            ★ {item.rating || 4.9}{" "}
                            <span className="text-gray-300 font-bold">
                              ({item.reviewsCount || 1000})
                            </span>
                          </span>
                        </div>

                        {/* Card Content Details */}
                        <div className="p-6 space-y-3.5">
                          {/* Title */}
                          <h3 className="font-black text-xl text-[#0B192C] dark:text-white leading-snug group-hover:text-[#0A4DA6] transition-colors">
                            {item.name}
                          </h3>

                          {/* Description */}
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed font-medium">
                            {item.history}
                          </p>

                          {/* Darshan Timings Pill Container */}
                          <div className="pt-1">
                            <div className="flex items-center gap-2.5 bg-[#F0F5FC] dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 p-3 rounded-2xl text-xs font-bold text-[#0B192C] dark:text-blue-200">
                              <Clock
                                size={15}
                                className="text-[#0A4DA6] dark:text-blue-400 shrink-0"
                              />
                              <span className="truncate">
                                <strong>Darshan:</strong> {item.darshanTimings}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Toolbar */}
                      <div className="px-6 py-4 bg-gray-50/80 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between mt-auto">
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-1">
                          <ShieldCheck size={13} /> Official Info
                        </span>
                        <button className="px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all group-hover:translate-x-0.5">
                          <span>View Temple Details</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
