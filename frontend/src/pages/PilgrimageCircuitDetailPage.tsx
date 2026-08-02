import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  MapPin,
  Clock,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Car,
  ChevronRight,
} from "lucide-react";

export const PilgrimageCircuitDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [circuit, setCircuit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCircuitDetail();
  }, [slug]);

  const fetchCircuitDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/services/circuits/${slug}`);
      if (res.data.success) {
        setCircuit(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching circuit detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">
          Loading Pilgrimage Itinerary...
        </p>
      </div>
    );
  }

  if (!circuit) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <h2 className="text-xl font-black text-gray-700 dark:text-gray-200 mb-4">
          Circuit Not Found
        </h2>
        <button
          onClick={() => navigate("/pilgrimage-circuits")}
          className="px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-bold text-xs"
        >
          Back to Circuits
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-24 sm:pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Top Back Link */}
        <button
          onClick={() => navigate("/pilgrimage-circuits")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#0A4DA6] hover:text-amber-600 transition-colors"
        >
          <ArrowLeft size={16} /> Back to All Circuits
        </button>

        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl min-h-[320px] sm:min-h-[400px] flex items-end p-6 sm:p-10 border border-gray-100 dark:border-slate-800">
          <img
            src={circuit.coverImage}
            alt={circuit.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="relative z-10 space-y-3 max-w-3xl text-white">
            <span className="px-3.5 py-1 rounded-full bg-[#E58C28] text-white text-[10px] font-black uppercase tracking-wider">
              {circuit.circuitType}
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
              {circuit.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-200">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-amber-400" />{" "}
                {circuit.duration}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-amber-400" />{" "}
                {circuit.distance}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-amber-400" /> Best Season:{" "}
                {circuit.recommendedSeason}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Itinerary Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 space-y-4">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white">
                Overview & Spiritual Significance
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {circuit.description}
              </p>
            </div>

            {/* Day-by-Day Stops */}
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 space-y-6">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white">
                Day-by-Day Sacred Itinerary
              </h3>

              <div className="space-y-4">
                {circuit.stops?.map((stop: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#0A4DA6] text-white font-black text-xs flex items-center justify-center shrink-0">
                      Day {stop.day}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-[#0B192C] dark:text-white">
                        {stop.stopName}
                      </h4>
                      <p className="text-xs font-semibold text-[#0A4DA6] dark:text-amber-400">
                        {stop.templeOrSpot} ({stop.city})
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stop.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 border border-gray-100 dark:border-slate-800 space-y-4 shadow-sm">
              <h4 className="font-black text-base text-[#0B192C] dark:text-white">
                Yatra Essentials
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-400 font-bold">
                    Estimated Budget
                  </span>
                  <span className="font-black text-[#0A4DA6] dark:text-amber-400">
                    {circuit.budgetRange}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-400 font-bold">
                    Nearby Ashrams
                  </span>
                  <span className="font-black text-gray-700 dark:text-gray-200">
                    {circuit.nearbyStayCount} Verified Stays
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 font-bold">
                    Pilgrim Rating
                  </span>
                  <span className="font-black text-emerald-600">
                    ★ {circuit.rating} / 5
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate("/search")}
                className="w-full py-3.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-lg transition-all"
              >
                Book Ashram Stays for this Circuit
              </button>
            </div>

            {/* In Future Widgets */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-3 border border-slate-800">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">
                In Future Integration
              </span>
              <h5 className="font-black text-sm">
                Live Himalayan Weather & Route Map
              </h5>
              <p className="text-[11px] text-gray-400">
                Real-time weather radar, landslide updates, and government
                border permits integration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
