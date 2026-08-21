import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Clock,
  ArrowLeft,
  ShieldCheck,
  Phone,
  Globe,
  Info,
} from "lucide-react";

export const TempleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [temple, setTemple] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTempleDetail();
  }, [slug]);

  const fetchTempleDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/services/temples/${slug}`);
      if (res.data.success) {
        setTemple(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching temple detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 text-center">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">
          Loading Temple Profile...
        </p>
      </div>
    );
  }

  if (!temple) {
    return (
      <div className="min-h-screen pt-32 text-center">
        <h2 className="text-xl font-black text-gray-700 dark:text-gray-200 mb-4">
          Temple Profile Not Found
        </h2>
        <button
          onClick={() => navigate("/temples")}
          className="px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-bold text-xs"
        >
          Back to All Temples
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 sm:pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <button
          onClick={() => navigate("/temples")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#0A4DA6] hover:text-amber-600 transition-colors"
        >
          <ArrowLeft size={16} /> Back to All Temples
        </button>

        <div className="relative rounded-3xl overflow-hidden shadow-2xl min-h-[320px] sm:min-h-[400px] flex items-end p-6 sm:p-10 border border-gray-100 dark:border-slate-800">
          <img
            src={temple.coverImage}
            alt={temple.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="relative z-10 space-y-3 max-w-3xl text-white">
            <span className="px-3.5 py-1 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black tracking-wider">
              {temple.city}, {temple.state}
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight">
              {temple.name}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-amber-300">
              Presiding Deity: {temple.deity}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 space-y-4">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white">
                Temple History & Sacred Significance
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {temple.history}
              </p>
              <div className="pt-2 text-xs font-bold text-gray-500">
                Architecture Style:{" "}
                <span className="text-[#0B192C] dark:text-white">
                  {temple.architectureStyle}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 space-y-6">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white">
                Darshan & Aarti Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-gray-400 font-extrabold block">
                    Darshan Timings
                  </span>
                  <p className="font-black text-sm text-[#0A4DA6] dark:text-amber-400">
                    {temple.darshanTimings}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-gray-400 font-extrabold block">
                    Aarti Schedule
                  </span>
                  <p className="font-black text-sm text-[#0A4DA6] dark:text-amber-400">
                    {temple.aartiTimings}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-slate-900/80 border border-amber-200/50 dark:border-slate-800 space-y-2">
                <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Info size={16} /> Dress Code & Rules
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                  {temple.dressCode}
                </p>
                {temple.rules?.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-gray-600 dark:text-gray-400 space-y-1 pt-1">
                    {temple.rules.map((rule: string, i: number) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 border border-gray-100 dark:border-slate-800 space-y-4 shadow-sm">
              <h4 className="font-black text-base text-[#0B192C] dark:text-white">
                Temple Contact & Trust
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <ShieldCheck size={16} className="text-[#0A4DA6]" />
                  <span className="font-bold">{temple.trustName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Phone size={16} className="text-[#0A4DA6]" />
                  <span>{temple.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Globe size={16} className="text-[#0A4DA6]" />
                  <a
                    href={temple.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0A4DA6] hover:underline font-bold"
                  >
                    Official Website
                  </a>
                </div>
              </div>

              <button
                onClick={() => navigate("/search")}
                className="w-full py-3.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-lg transition-all"
              >
                Find Ashrams Near This Temple
              </button>
            </div>

            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-3 border border-slate-800">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black">
                In Future Integrations
              </span>
              <h5 className="font-black text-sm">
                Live Darshan, VIP Queue & Online Seva
              </h5>
              <p className="text-[11px] text-gray-400">
                Direct online token booking for VIP darshan and daily prasad
                dispatch from trust kitchen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
