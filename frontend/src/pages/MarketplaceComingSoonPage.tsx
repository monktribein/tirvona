import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShoppingBag,
  Sparkles,
  Bell,
  Mail,
  ChevronRight,
  CheckCircle2,
  Package,
  BookOpen,
  Heart,
  Award,
  ArrowRight,
} from "lucide-react";

import api from "../lib/api";

export const MarketplaceComingSoonPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await api.post("/marketplace/hub/waitlist", { email, role: "buyer" });
      setSubscribed(true);
    } catch (err) {
      console.error("Error joining waitlist:", err);
      setSubscribed(true);
    }
  };

  const productCategories = [
    {
      title: "Authentic Temple Prasad",
      desc: "Consecrated Varanasi Lal Peda, Tirupati Laddu, Ayodhya Prasad & Puri Mahaprasad.",
      badge: "PHASE 1",
      icon: Heart,
    },
    {
      title: "Spiritual Scriptures & Books",
      desc: "Hardbound Bhagavad Gita, Upanishads, Pravachan audiobooks, and children Vedic stories.",
      badge: "PHASE 2",
      icon: BookOpen,
    },
    {
      title: "Sacred Puja Items & Kits",
      desc: "Pure brass diyas, organic camphor, Gangajal, bilva patra, and consecrated monthly kits.",
      badge: "PHASE 2",
      icon: Package,
    },
    {
      title: "Organic Ayurveda & Wellness",
      desc: "Certified Himalayan herbs, Chyawanprash, dhoop sticks, and natural essential oils.",
      badge: "PHASE 3",
      icon: Award,
    },
    {
      title: "Handloom Temple Apparel",
      desc: "Banarasi silk angavastrams, saffron dhoti sets, and hand-woven puja scarves.",
      badge: "PHASE 3",
      icon: Sparkles,
    },
    {
      title: "Nationwide Artisan Craft",
      desc: "Hand-carved wooden temples, brass idols, marble deity statues, and spiritual decor.",
      badge: "PHASE 4",
      icon: ShoppingBag,
    },
  ];

  const roadmapSteps = [
    {
      phase: "Phase 1",
      title: "Temple Prasad & Consecrated Offerings",
      status: "Launching Q3 2026",
      current: true,
    },
    {
      phase: "Phase 2",
      title: "Vedic Scriptures, Books & Puja Kits",
      status: "Upcoming Q4 2026",
      current: false,
    },
    {
      phase: "Phase 3",
      title: "Organic Ayurveda & Spiritual Apparel",
      status: "Upcoming Q1 2027",
      current: false,
    },
    {
      phase: "Phase 4",
      title: "Nationwide Sacred Marketplace",
      status: "Upcoming Q2 2027",
      current: false,
    },
  ];

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16">
      {/* Breadcrumb Bar */}
      <div className="bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800/80 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <Link to="/" className="hover:text-[#0A4DA6]">
            Home
          </Link>
          <ChevronRight size={13} />
          <span className="text-purple-600 dark:text-purple-400 font-black">
            Sacred Marketplace
          </span>
          <ChevronRight size={13} />
          <span className="text-gray-700 dark:text-gray-200 font-black">
            Launching Soon
          </span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-[#0B192C] text-white py-16 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-black border border-purple-400/30">
            <Sparkles size={14} className="text-amber-400" />
            <span>Tirvona Sacred Marketplace • Launching Soon</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            India's First Consecrated
            <br />
            Temple Prasad & Sacred Store
          </h1>

          <p className="text-sm sm:text-base text-purple-100 max-w-2xl mx-auto font-medium leading-relaxed">
            We are building a government-certified spiritual marketplace to
            deliver authentic temple prasad, lab-tested rudraksha, Vedic books,
            and handloom puja apparel directly to your doorstep.
          </p>

          {/* Notify Me Form */}
          <div className="max-w-md mx-auto pt-4">
            {subscribed ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black flex items-center justify-center gap-2">
                <CheckCircle2 size={18} />
                <span>
                  You're on the VIP waitlist! We'll notify you first when the
                  Marketplace goes live.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSubscribe}
                className="flex items-center bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-2xl border border-purple-400/30"
              >
                <Mail size={18} className="text-purple-400 ml-4 shrink-0" />
                <input
                  type="email"
                  placeholder="Enter your email for early VIP access..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent px-3 text-xs sm:text-sm font-bold text-[#0B192C] dark:text-white focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition-colors shrink-0 shadow-md flex items-center gap-1.5"
                >
                  <Bell size={14} />
                  <span>Notify Me</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 space-y-12">
        {/* What's Coming Grid */}
        <div className="space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black">
              Upcoming Product Categories
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white">
              Curated Consecrated Sacred Products
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productCategories.map((cat, idx) => {
              const IconComp = cat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                      <IconComp size={22} />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black">
                      {cat.badge}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-[#0B192C] dark:text-white">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expansion Roadmap */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-10 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <h3 className="font-black text-xl text-[#0B192C] dark:text-white">
              Marketplace Launch Roadmap
            </h3>
            <p className="text-xs text-gray-400">
              Our 4-phase rollout plan for nationwide spiritual commerce.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {roadmapSteps.map((step, i) => (
              <div
                key={i}
                className={`p-5 rounded-2xl border space-y-2 ${
                  step.current
                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800"
                    : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800"
                }`}
              >
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${step.current ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300"}`}
                >
                  {step.phase}
                </span>
                <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white">
                  {step.title}
                </h4>
                <p className="text-[11px] text-gray-400 font-bold">
                  {step.status}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-Footer Action Banner */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-8 text-center space-y-4 shadow-2xl border border-purple-500/20">
          <h3 className="text-2xl font-black">
            In the Meantime, Explore Sacred Ashrams & Circuits
          </h3>
          <p className="text-xs text-purple-200 max-w-xl mx-auto">
            Book verified ashram rooms and explore pilgrimage itineraries across
            India today.
          </p>
          <button
            onClick={() => navigate("/search")}
            className="px-8 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-xl transition-all cursor-pointer"
          >
            Explore Verified Ashrams Now →
          </button>
        </div>
      </div>
    </div>
  );
};
