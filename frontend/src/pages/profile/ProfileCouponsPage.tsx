import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";

export const ProfileCouponsPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const coupons = [
    {
      code: "YATRA20",
      discount: "20% OFF",
      description: "Applicable on all Rishikesh & Haridwar Ashram stays.",
      expiry: "Valid till Aug 31, 2026",
    },
    {
      code: "BHAKTI500",
      discount: "₹500 OFF",
      description: "Flat ₹500 discount on bookings above ₹2,000.",
      expiry: "Valid till Sep 15, 2026",
    },
    {
      code: "FESTIVAL15",
      discount: "15% OFF",
      description: "Special Dev Deepawali & Aarti Festival offer.",
      expiry: "Valid till Nov 30, 2026",
    },
  ];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    addNotification(
      "Coupon Copied",
      `Code ${code} copied to clipboard!`,
      "info",
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-3 relative z-10">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white font-bold mb-2"
          >
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            My <span className="text-[#E58C28]">Promo Coupons</span>
          </h1>
          <p className="text-xs text-blue-100/80 font-medium">
            Claim and apply exclusive discounts for your spiritual stays.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coupons.map((c, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[10px] font-black uppercase">
                  {c.discount}
                </span>
                <h3 className="text-xl font-black text-[#0A4DA6] tracking-wider pt-1">
                  {c.code}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {c.description}
                </p>
                <span className="text-[10px] text-gray-400 block font-bold">
                  {c.expiry}
                </span>
              </div>

              <button
                onClick={() => handleCopy(c.code)}
                className="w-full py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-[#083b80] transition-colors cursor-pointer"
              >
                <Copy size={14} /> Copy Coupon Code
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileCouponsPage;
