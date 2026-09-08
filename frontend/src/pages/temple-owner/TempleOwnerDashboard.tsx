import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit3, ExternalLink, MapPin, ShieldCheck, Sparkles, Landmark } from "lucide-react";
import { templeService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";

export const TempleOwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [temples, setTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyTemples = useCallback(async () => {
    setLoading(true);
    try {
      const res = await templeService.myTemples();
      if (res.data?.success) setTemples(res.data.data || []);
    } catch (err) {
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load your temple."),
        "error",
      );
      setTemples([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchMyTemples();
  }, [fetchMyTemples]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400 font-semibold">
        Loading your temple...
      </div>
    );
  }

  if (!temples.length) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-10 shadow-sm">
        <Landmark className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={40} />
        <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white mb-2">
          No temple assigned yet
        </h2>
        <p className="text-xs text-gray-400 font-semibold">
          Contact the Tirvona Super Admin to get your temple linked to this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left w-full">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
          Temple Management
        </h2>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          Manage your temple's information, history, timings, aartis and festivals.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {temples.map((temple) => {
          const isPublished = ["published", "active"].includes(String(temple.status));
          return (
            <div
              key={temple._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col"
            >
              <div className="h-36 bg-gray-100 dark:bg-slate-900 overflow-hidden">
                {temple.media?.coverImage ? (
                  <img
                    src={temple.media.coverImage}
                    alt={temple.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-700">
                    <Landmark size={32} />
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white truncate">
                  {temple.name}
                </h3>
                <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1 truncate">
                  <MapPin size={11} className="shrink-0" />
                  {[temple.address?.city, temple.address?.state].filter(Boolean).join(", ") || "Location not set"}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      isPublished
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {isPublished ? "Published" : "Draft"}
                  </span>
                  {temple.isVerified && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 flex items-center gap-1">
                      <ShieldCheck size={10} /> Verified
                    </span>
                  )}
                  {temple.isFeatured && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 flex items-center gap-1">
                      <Sparkles size={10} /> Featured
                    </span>
                  )}
                </div>
                <div className="mt-auto pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/temples/${temple._id}/edit`)}
                    className="flex-1 py-2 rounded-full bg-[#0A4DA6] text-white text-[11px] font-black flex items-center justify-center gap-1.5 hover:bg-[#083b80] transition cursor-pointer"
                  >
                    <Edit3 size={12} /> Edit Temple
                  </button>
                  {temple.slug && (
                    <button
                      type="button"
                      onClick={() => navigate(`/temples/${temple.slug}`)}
                      className="px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-[11px] font-black flex items-center justify-center gap-1.5 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer"
                      title="View Public Page"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TempleOwnerDashboard;
