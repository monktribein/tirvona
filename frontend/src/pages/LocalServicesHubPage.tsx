import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "../lib/toast";
import {
  MapPin,
  Car,
  Users,
  Utensils,
  Ambulance,
  ShoppingBag,
  Camera,
  Bed,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";

export const LocalServicesHubPage: React.FC = () => {
  const navigate = useNavigate();

  const [selectedCity, setSelectedCity] = useState("Varanasi");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: "All", label: "All Services", icon: MapPin },
    { id: "transport", label: "Transport & Cabs", icon: Car },
    { id: "guides", label: "Verified Guides", icon: Users },
    { id: "food", label: "Satvik Dining", icon: Utensils },
    { id: "medical", label: "Emergency & Medical", icon: Ambulance },
    { id: "shops", label: "Puja Shops & Stores", icon: ShoppingBag },
    { id: "photography", label: "Photography", icon: Camera },
    { id: "stays", label: "Nearby Ashrams", icon: Bed },
    { id: "events", label: "Aartis & Events", icon: Sparkles },
  ];

  const fetchLocalServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/local", {
        params: {
          city: selectedCity,
          category: selectedCategory,
        },
      });
      if (res.data?.success) {
        setItems(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching local services:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedCity]);

  useEffect(() => {
    fetchLocalServices();
  }, [fetchLocalServices]);

  return (
    <div className="min-h-screen pb-16 space-y-6">
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Local Services, Transport &amp; Guides
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
            Find verified cabs, certified temple guides, satvik dining, 24/7
            emergency medical care, and sacred stores near you.
          </p>

          {/* Location Selector */}
          <div className="max-w-xs mx-auto pt-2 flex items-center">
            <div className="w-full bg-white dark:bg-[#0B192C] rounded-full px-4 py-2 shadow-md border border-gray-200 dark:border-slate-800 flex items-center">
              <MapPin size={16} className="text-[#0A4DA6] shrink-0" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-transparent px-2 text-xs font-black text-[#0B192C] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="Varanasi">Varanasi (Kashi Dham)</option>
                <option value="Haridwar">Haridwar &amp; Rishikesh</option>
                <option value="Ayodhya">Ayodhya Ram Janmabhoomi</option>
                <option value="Kedarnath">Kedarnath &amp; Badrinath</option>
                <option value="Ujjain">Ujjain Mahakal</option>
                <option value="Puri">Puri Jagannath</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Tabs Bar */}
        <div className="mt-6 flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const IconComp = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  active
                    ? "bg-[#0A4DA6] text-white shadow-md"
                    : "bg-white dark:bg-[#0B192C] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-800 hover:bg-gray-100"
                }`}
              >
                <IconComp size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="animate-spin text-[#0A4DA6]" size={36} />
            <p className="text-sm font-bold text-gray-500">
              Loading verified local services...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 p-8 shadow-sm">
            <p className="text-base font-bold text-gray-700 dark:text-gray-200">
              No local services found for {selectedCity} in{" "}
              {selectedCategory === "All" ? "this area" : selectedCategory}.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Super Admin can add new listings for this city directly from the
              Local Hub module.
            </p>
          </div>
        ) : (
          /* Services Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item._id || item.id}
                className="bg-white dark:bg-[#0B192C] rounded-[32px] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img
                      src={
                        item.image ||
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                      }
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-[#0A4DA6] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">
                      {item.badge || "Verified operator"}
                    </span>
                    <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                      ★ {item.rating || "4.9"}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                      <MapPin size={13} className="text-[#0A4DA6]" />
                      <span>{item.location || item.city}</span>
                    </div>
                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.description || item.desc}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-4">
                  <span className="text-xs font-black text-[#0A4DA6] dark:text-amber-400">
                    {item.price || "Contact for Fare"}
                  </span>
                  <button
                    onClick={() =>
                      toast.info(item.phone || "+91 98765 00000", {
                        title: `Contact ${item.title}`,
                        duration: 7000,
                      })
                    }
                    className="px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Contact &amp; Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explore Marketplace Button */}
        <div className="pt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/marketplace")}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-sm shadow-xl hover:shadow-2xl transition-all cursor-pointer group"
          >
            <span>Explore Marketplace</span>
            <ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocalServicesHubPage;
