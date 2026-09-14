"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
  Clock,
  MapPin,
  Flame,
  Phone,
  Mail,
  Share2,
  ChevronLeft,
  X,
} from "lucide-react";
import { panditService } from "../../../services/pandit.service";
import type {
  ProviderProfile,
  Offering,
  ProviderAvailability,
} from "../../../types/pandit.types";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../../types/pandit.types";

function PublicProviderProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const providerId = (params?.id as string) || "";
  const shouldOpenBooking = searchParams.get("book") === "true";

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [availability, setAvailability] = useState<ProviderAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(shouldOpenBooking);
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [bookingDate, setBookingDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("Haridwar");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!providerId) return;
      try {
        setLoading(true);

        // 1. Fetch provider details
        try {
          const res = await panditService.getProviderById(providerId);
          if (res.data?.success) {
            setProvider(res.data.data);
          }
        } catch {
          // If not directly found by ID in API, look in all providers
          const allRes = await panditService.listProviders();
          const found = allRes.data?.data?.find((p) => p.id === providerId);
          if (found) {
            setProvider(found);
          }
        }

        // 2. Fetch provider offerings
        try {
          const offRes = await panditService.getMyOfferings();
          if (offRes.data?.success) {
            setOfferings(offRes.data.data || []);
            if (offRes.data.data && offRes.data.data.length > 0) {
              setSelectedOffering(offRes.data.data[0]);
            }
          }
        } catch (e) {
          console.error("Offerings error", e);
        }

        // 3. Fetch availability
        try {
          const availRes = await panditService.getAvailability(providerId);
          if (availRes.data?.success) {
            setAvailability(availRes.data.data);
          }
        } catch (e) {
          console.error("Availability error", e);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [providerId]);

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSuccess(true);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 space-y-8 animate-pulse">
        <div className="h-48 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-64 bg-gray-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-[#0B192C] dark:text-white">
          Pandit Profile Not Found
        </h2>
        <p className="text-sm text-gray-500">
          The requested Vedic provider profile does not exist or has been removed.
        </p>
        <Link
          href="/pandit/explore"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A4DA6] text-white font-bold text-xs"
        >
          <ChevronLeft size={16} />
          Return to Explore
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24">
      {/* ── Breadcrumb & Back ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/pandit/explore"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] hover:underline"
        >
          <ChevronLeft size={14} />
          Back to Pandit Directory
        </Link>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `${provider.displayName} - Tirvona Vedic Provider`,
                url: window.location.href,
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert("Profile link copied to clipboard!");
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition"
        >
          <Share2 size={13} />
          Share Profile
        </button>
      </div>

      {/* ── 1. Hero Identity Banner ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between relative z-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Avatar Crest */}
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-[#0A4DA6] via-[#071322] to-[#040A12] text-white flex items-center justify-center text-4xl font-serif font-extrabold shadow-xl border-4 border-amber-400/40">
                {provider.displayName ? provider.displayName.charAt(0) : "P"}
              </div>
              {provider.verificationLevel !== "UNVERIFIED" && (
                <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0B192C]">
                  <CheckCircle2 size={18} />
                </div>
              )}
            </div>

            {/* Provider Details */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-blue-50 dark:bg-blue-900/40 text-[#0A4DA6] dark:text-blue-300 border border-[#0A4DA6]/20">
                  {PROVIDER_TYPE_LABELS[provider.providerType] || provider.providerType}
                </span>

                {provider.verificationLevel !== "UNVERIFIED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    {VERIFICATION_LEVEL_LABELS[provider.verificationLevel]} Verified
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#0B192C] dark:text-white tracking-tight">
                {provider.displayName}
              </h1>

              {provider.bio && (
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  {provider.bio}
                </p>
              )}

              {/* Languages */}
              {provider.languages && provider.languages.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1">
                  <Languages size={14} className="text-[#E58C28]" />
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    Languages spoken: {provider.languages.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Book Action CTA Card */}
          <div className="w-full md:w-auto flex-shrink-0 flex flex-col gap-3">
            <button
              onClick={() => setBookingModalOpen(true)}
              className="py-4 px-8 rounded-2xl bg-[#0A4DA6] hover:bg-[#083b80] text-white font-bold text-sm shadow-xl shadow-[#0A4DA6]/25 transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Flame size={18} className="text-[#E58C28]" />
              <span>Book Puja / Hawan</span>
            </button>
            <p className="text-[11px] text-center text-gray-400">
              Vedic Sankalp & Ritual Confirmation
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Two-Column Layout: Offerings & Specializations vs Schedule ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Offerings & Vedic Specializations */}
        <div className="lg:col-span-8 space-y-8">
          {/* Vedic Specializations */}
          {provider.specializations && provider.specializations.length > 0 && (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
              <h3 className="font-bold text-[#0B192C] dark:text-white text-base flex items-center gap-2">
                <BookOpen size={18} className="text-[#0A4DA6]" />
                Puja & Anushthan Specializations
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {provider.specializations.map((spec) => (
                  <span
                    key={spec}
                    className="px-3.5 py-1.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-semibold"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Offerings Catalog */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#0B192C] dark:text-white text-lg">
                  Puja & Ritual Offerings
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customized Vedic ceremonies conducted in authentic Sanskrit Vidhi
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 text-[#0A4DA6] text-xs font-bold">
                {offerings.length} Services Listed
              </span>
            </div>

            {offerings.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No specific individual offerings listed yet. You can still book a custom ritual above.
              </div>
            ) : (
              <div className="space-y-4">
                {offerings.map((off) => (
                  <div
                    key={off.id}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 hover:border-[#0A4DA6]/40 transition space-y-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-base font-bold text-[#0B192C] dark:text-white">
                        {off.name}
                      </h4>
                      {off.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {off.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                        {off.durationMinutes && (
                          <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                            <Clock size={12} className="text-[#0A4DA6]" />
                            {off.durationMinutes} Minutes Duration
                          </span>
                        )}
                        {off.tags && off.tags.length > 0 && (
                          <span>Tags: {off.tags.join(", ")}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOffering(off);
                        setBookingModalOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#0A4DA6] hover:bg-[#083b80] text-white font-bold text-xs flex-shrink-0 cursor-pointer shadow-md transition"
                    >
                      Book This Puja
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Weekly Availability & Trust Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Availability Schedule */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-[#0B192C] dark:text-white text-base flex items-center gap-2">
              <Calendar size={18} className="text-[#0A4DA6]" />
              Weekly Ritual Schedule
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Times in IST (Asia/Kolkata timezone)
            </p>

            <div className="space-y-2 pt-2">
              {availability?.rules && availability.rules.length > 0 ? (
                availability.rules.map((rule) => (
                  <div
                    key={rule.dayOfWeek}
                    className="flex items-center justify-between text-xs py-2 border-b border-gray-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="font-bold text-gray-700 dark:text-gray-300 capitalize">
                      {rule.dayOfWeek.toLowerCase()}
                    </span>
                    {rule.isAvailable ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {rule.slots?.[0]
                          ? `${rule.slots[0].startTime} - ${rule.slots[0].endTime}`
                          : "Available"}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Unavailable</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-emerald-600 font-semibold py-2">
                  Available Mon - Sun (08:00 AM - 08:00 PM IST)
                </div>
              )}
            </div>
          </div>

          {/* Tirvona Sacred Trust Guarantee */}
          <div className="bg-gradient-to-br from-[#071322] to-[#0A4DA6] rounded-3xl p-6 text-white shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#E58C28]">
              <ShieldCheck size={22} />
            </div>
            <h4 className="font-bold font-serif text-lg">
              Tirvona Vedic Trust Guarantee
            </h4>
            <ul className="text-xs space-y-2.5 text-blue-100/80">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>100% Authentic Sanskrit Shlokas & Vedic Vidhi</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Pure Hawan Samagri & Temple Sanctioned Rituals</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Video Sankalp & Live Darshan link provided if online</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── 3. Booking Confirmation Modal ─────────────────────────────────── */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => {
                setBookingModalOpen(false);
                setBookingSuccess(false);
              }}
              className="absolute right-5 top-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X size={18} />
            </button>

            {bookingSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-[#0B192C] dark:text-white">
                  Puja Request Submitted!
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Your ritual request with <strong>{provider.displayName}</strong> has been
                  scheduled for <strong>{bookingDate}</strong>. You will receive an SMS and WhatsApp
                  confirmation with the exact Muhurat Sankalp details.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setBookingModalOpen(false);
                      setBookingSuccess(false);
                    }}
                    className="w-full py-3 rounded-2xl bg-[#0A4DA6] text-white font-bold text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0A4DA6]">
                    Vedic Puja Booking
                  </span>
                  <h3 className="text-xl font-bold text-[#0B192C] dark:text-white">
                    Book Ceremony with {provider.displayName}
                  </h3>
                </div>

                {/* Selected Service */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Selected Ritual / Puja
                  </label>
                  <select
                    value={selectedOffering?.id || ""}
                    onChange={(e) => {
                      const found = offerings.find((o) => o.id === e.target.value);
                      if (found) setSelectedOffering(found);
                    }}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none"
                  >
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    {offerings.length === 0 && (
                      <option value="custom">General Vedic Puja & Hawan</option>
                    )}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Auspicious Date / Muhurat
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none"
                  />
                </div>

                {/* Customer Details */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Yajman Name (Full Name)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Location / City
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Haridwar"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-[#0A4DA6] hover:bg-[#083b80] text-white font-bold text-xs sm:text-sm shadow-xl shadow-[#0A4DA6]/25 transition cursor-pointer"
                  >
                    Confirm Puja Booking
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicProviderProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm font-semibold text-gray-500">
          Loading Pandit Profile...
        </div>
      }
    >
      <PublicProviderProfileContent />
    </Suspense>
  );
}

