"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Award,
  BookOpen,
  Languages,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Flame,
  Star,
  Users,
  Clock,
  Compass,
} from "lucide-react";
import { StructuredPujaSearch } from "../../../components/StructuredPujaSearch";
import { panditService } from "../../../services/pandit.service";
import type { ProviderProfile, ProviderType } from "../../../types/pandit.types";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../../types/pandit.types";

const POPULAR_PUJAS = [
  {
    id: "rudrabhishek",
    name: "Rudrabhishek & Shiva Puja",
    description: "Sacred Vedic chanting of Sri Rudram and milk/panchamrit abhishek for planetary peace and health.",
    duration: "60 - 90 mins",
    location: "Home / Temple / Varanasi Ghat",
    category: "Vedic Puja",
    highlight: "Most Booked",
  },
  {
    id: "griha-pravesh",
    name: "Griha Pravesh & Vastu Shanti",
    description: "Auspicious housewarming ritual, Navgraha Homa, and Vastu Purusha invocation for your new home.",
    duration: "2 - 3 hours",
    location: "At Your Residence",
    category: "Sanskara",
    highlight: "Auspicious Muhurat",
  },
  {
    id: "maha-mrityunjaya",
    name: "Maha Mrityunjaya Jaap & Hawan",
    description: "Potent mantra recitation and sacred ahuti for longevity, divine protection, and overcoming health hurdles.",
    duration: "108 Jaap / 3 hours",
    location: "Haridwar / Trimbakeshwar / Home",
    category: "Vedic Hawan",
    highlight: "Maha Anushthan",
  },
  {
    id: "satyanarayan",
    name: "Sri Satyanarayan Katha & Puja",
    description: "Traditional Sanskrit Katha recitation and prasadam blessing for family peace, gratitude, and prosperity.",
    duration: "90 mins",
    location: "Home / Community Hall",
    category: "Katha & Puja",
    highlight: "Purnima Special",
  },
  {
    id: "navgraha",
    name: "Navgraha Shanti & Dosh Nivaran",
    description: "Balancing the 9 celestial planetary deities to mitigate malefic planetary influences and doshas.",
    duration: "2 hours",
    location: "Temple / Home / Online",
    category: "Astrology Ritual",
    highlight: "Planetary Harmony",
  },
  {
    id: "durga-saptashati",
    name: "Durga Saptashati Chandi Path",
    description: "Powerful 700-shloka invocation of Goddess Durga for courage, protection, and victory over adversities.",
    duration: "3 - 4 hours",
    location: "Home / Shakti Peeth",
    category: "Devi Upasana",
    highlight: "Navratri Special",
  },
];

const JYOTISH_SERVICES = [
  {
    id: "kundali",
    title: "Vedic Kundali & Janampatri Analysis",
    description: "Detailed birth chart examination, planetary dasha assessment, and lifetime guidance by expert Jyotishis.",
    icon: Compass,
    duration: "45 mins consultation",
  },
  {
    id: "milan",
    title: "Kundali Milan & Gun Melapak",
    description: "Comprehensive 36-Guna matching and Manglik dosha analysis for prospective bride and groom.",
    icon: Users,
    duration: "30 mins consultation",
  },
  {
    id: "muhurat",
    title: "Shubh Muhurat Determination",
    description: "Vedic Panchang calculation for Marriage, Griha Pravesh, Naamkaran, and business inauguration.",
    icon: Calendar,
    duration: "Instant report & consultation",
  },
  {
    id: "prashna",
    title: "Prashna Kundali & Remedial Guidance",
    description: "Specific question analysis and sacred Vedic remedies including gemstones, yantras, and mantras.",
    icon: Sparkles,
    duration: "30 mins consultation",
  },
];

export default function PublicPanditPortalPage() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await panditService.listProviders();
        if (res.data?.success) {
          setProviders(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to load providers", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-14 sm:space-y-20 pb-20">
      {/* ── 1. Sacred Hero Section with Real Hawan Imagery ──────────────────── */}
      <section className="relative rounded-[32px] overflow-hidden bg-[#071322] text-white shadow-2xl border border-slate-800/80">
        {/* Real Generated Vedic Puja Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/puja_hero.jpg"
            alt="Sacred Vedic Hawan and Puja Ceremony"
            className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity hover:opacity-50 transition duration-700 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071322] via-[#071322]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071322] via-transparent to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 p-6 sm:p-12 lg:p-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E58C28]/20 border border-[#E58C28]/40 text-[#E58C28] text-xs font-extrabold uppercase tracking-wider mb-5">
            <Flame size={14} />
            <span>Tirvona Sacred Puja & Jyotish Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-serif tracking-tight leading-[1.1] mb-5">
            Find the Right <span className="text-[#E58C28]">Pandit</span> for Your Sacred Puja
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mb-8">
            Perform authentic Vedic pujas, auspicious home ceremonies, Hawan, and astrological consultations with certified Pandits, Acharyas, and Purohits across India.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#search-section"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs sm:text-sm font-bold transition shadow-xl shadow-[#0A4DA6]/30 active:scale-95 cursor-pointer"
            >
              <span>Explore Pujas & Pandits</span>
              <ArrowRight size={15} />
            </a>
            <Link
              href="/pandit"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold backdrop-blur-md transition cursor-pointer"
            >
              <span>Pandit Provider Portal</span>
            </Link>
          </div>
        </div>

        {/* ── Structured Search Bar Floating over Hero Bottom ──────────────── */}
        <div id="search-section" className="relative z-20 px-4 sm:px-12 pb-8 pt-4">
          <StructuredPujaSearch />
        </div>
      </section>

      {/* ── 2. Popular Vedic Pujas ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] uppercase tracking-wider mb-1">
              <Sparkles size={14} className="text-[#E58C28]" />
              Sacred Rituals & Ceremonies
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight">
              Popular Pujas & Anushthans
            </h2>
          </div>
          <Link
            href="/search"
            className="text-xs font-bold text-[#0A4DA6] hover:underline flex items-center gap-1"
          >
            <span>View All Ceremonies</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {POPULAR_PUJAS.map((puja) => (
            <div
              key={puja.id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs hover:border-[#0A4DA6]/40 hover:shadow-md transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 text-[11px] font-bold">
                    {puja.category}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                    {puja.highlight}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#0B192C] dark:text-white mb-2 group-hover:text-[#0A4DA6] transition">
                  {puja.name}
                </h3>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2">
                  {puja.description}
                </p>

                <div className="space-y-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-6">
                  <p className="flex items-center gap-1.5">
                    <Clock size={12} className="text-[#0A4DA6]" />
                    <span>Duration: {puja.duration}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Flame size={12} className="text-[#E58C28]" />
                    <span>Locations: {puja.location}</span>
                  </p>
                </div>
              </div>

              <Link
                href={`/search?puja=${encodeURIComponent(puja.name)}`}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-slate-900/80 hover:bg-[#0A4DA6] text-[#0A4DA6] hover:text-white dark:text-blue-300 dark:hover:text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span>Find Pandits for this Puja</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Featured Verified Vedic Scholars & Pandits ───────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
              <ShieldCheck size={14} />
              Verified Vedic Practitioners
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight">
              Featured Pandits & Acharyas
            </h2>
          </div>
          <Link
            href="/search"
            className="text-xs font-bold text-[#0A4DA6] hover:underline flex items-center gap-1"
          >
            <span>Browse All Pandits</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {providers.slice(0, 4).map((pandit) => (
            <div
              key={pandit.id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-[#0A4DA6]/40 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A4DA6] to-[#083b80] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                    {pandit.avatarUrl ? (
                      <img src={pandit.avatarUrl} alt={pandit.displayName} className="w-full h-full object-cover" />
                    ) : (
                      pandit.displayName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#0B192C] dark:text-white truncate">
                      {pandit.displayName}
                    </h3>
                    <p className="text-xs text-[#0A4DA6] dark:text-blue-400 font-semibold mt-0.5">
                      {PROVIDER_TYPE_LABELS[pandit.providerType] || pandit.providerType}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      <Award size={10} />
                      {VERIFICATION_LEVEL_LABELS[pandit.verificationLevel] || pandit.verificationLevel}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
                  {pandit.bio || "Dedicated Vedic scholar providing authentic ritual vidhi and guidance."}
                </p>

                {/* Languages */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <Languages size={13} className="text-[#0A4DA6]" />
                  <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium truncate">
                    {pandit.languages.join(", ")}
                  </span>
                </div>

                {/* Specializations */}
                <div className="flex flex-wrap gap-1 mb-5">
                  {pandit.specializations.slice(0, 2).map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 rounded-md bg-gray-50 dark:bg-slate-800 text-[10px] font-medium text-gray-600 dark:text-slate-300"
                    >
                      {spec}
                    </span>
                  ))}
                  {pandit.specializations.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] text-gray-400">
                      +{pandit.specializations.length - 2}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={`/pandit/${pandit.id}`}
                className="w-full py-2.5 rounded-xl bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>View Profile & Book</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Dedicated Jyotish & Astrology Services ────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-[#0B192C] to-slate-900 text-white rounded-[32px] p-8 sm:p-12 border border-slate-800 shadow-xl">
        <div className="max-w-2xl mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
            <Compass size={13} />
            Tirvona Jyotish Shastra
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            Vedic Astrology & Horoscope Consultations
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Gain deep cosmic clarity on Career, Marriage, Health, and Muhurat with experienced Jyotishis and Vedic Astrologers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {JYOTISH_SERVICES.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.id}
                className="bg-white/5 border border-white/10 hover:border-purple-400/50 rounded-2xl p-5 backdrop-blur-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-3">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">
                    {srv.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {srv.description}
                  </p>
                </div>
                <Link
                  href={`/search?puja=${encodeURIComponent(srv.title)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-purple-200"
                >
                  <span>Book Consultation</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5. Trust & How It Works ─────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] p-8 sm:p-12 shadow-sm text-center">
        <div className="max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#0A4DA6] uppercase tracking-wider">
            Authentic Vedic Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight mt-1">
            How Tirvona Connects You with Pandits
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-[#0A4DA6] text-white font-black text-sm flex items-center justify-center mb-4 shadow-sm">
              1
            </div>
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white mb-1.5">
              Select Puja, Place & Muhurat
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Choose your desired ceremony (Rudrabhishek, Griha Pravesh, Katha) and preferred sacred location or home.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-[#E58C28] text-white font-black text-sm flex items-center justify-center mb-4 shadow-sm">
              2
            </div>
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white mb-1.5">
              Choose Verified Vedic Scholar
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Compare certified Pandits, check language fluencies, puja traditions, and verified certifications.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center mb-4 shadow-sm">
              3
            </div>
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white mb-1.5">
              Confirmed Sankalp & Ritual
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Receive complete samagri guidelines and perform the sacred ceremony with complete Vedic sanctity.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. Provider Registration Callout ────────────────────────────────── */}
      <section className="rounded-3xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Award size={13} className="text-[#E58C28]" />
            Are You a Vedic Priest or Jyotishi?
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white tracking-tight mb-2">
            Join the Tirvona Vedic Provider Network
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Create your verified provider profile, set your availability schedule, list puja rituals, and connect with devotees globally.
          </p>
        </div>

        <Link
          href="/pandit/profile"
          className="shrink-0 px-8 py-4 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#0A4DA6]/25 transition active:scale-95"
        >
          Register as a Provider →
        </Link>
      </section>
    </div>
  );
}
