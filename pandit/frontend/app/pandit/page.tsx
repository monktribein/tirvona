"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  BookOpen,
  ShieldCheck,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Plus,
  ShieldAlert,
  CalendarCheck,
  Award,
  Layers,
  Globe,
} from "lucide-react";
import {
  usePanditProfile,
  usePanditOfferings,
  usePanditVerification,
  usePanditAvailability,
  usePanditBookings,
} from "../../hooks/usePanditProvider";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "../../types/pandit.types";

export default function ProviderDashboardPage() {
  const router = useRouter();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refresh: refreshProfile,
  } = usePanditProfile(true);

  const {
    offerings,
    loading: offeringsLoading,
    refresh: refreshOfferings,
  } = usePanditOfferings(Boolean(profile));

  const {
    latestCase,
    loading: verificationLoading,
    refresh: refreshVerification,
  } = usePanditVerification(Boolean(profile));

  const {
    availability,
    calendarBlocks,
    loading: availabilityLoading,
    refresh: refreshAvailability,
  } = usePanditAvailability(profile?.id ?? null, Boolean(profile));

  const {
    bookings,
    loading: bookingsLoading,
  } = usePanditBookings(Boolean(profile));

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3 text-sm text-gray-500 dark:text-gray-400">
        <div className="w-10 h-10 rounded-full border-2 border-[#0A4DA6] border-t-transparent animate-spin" />
        <p className="font-medium">Loading your Pandit workspace...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white dark:bg-[#0B192C] border border-rose-100 dark:border-rose-900/30 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-base font-bold text-[#0B192C] dark:text-white mb-1">
          Unable to Load Workspace
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {profileError}
        </p>
        <button
          type="button"
          onClick={refreshProfile}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition"
        >
          <RefreshCw size={14} />
          Retry Connection
        </button>
      </div>
    );
  }

  // ── Onboarding / Profile Not Created Yet ─────────────────────────────────────
  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto mt-6 pb-12">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
          {/* Subtle top sacred saffron gradient */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0A4DA6] via-[#E58C28] to-[#0A4DA6]" />

          <div className="text-center max-w-xl mx-auto">
            {/* Real Tirvona Logo Branding Crest */}
            <div className="w-20 h-20 rounded-3xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-3 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <img
                src="/logo.png"
                alt="Tirvona"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E58C28]/10 text-[#E58C28] text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles size={12} />
              Tirvona Vedic Provider Platform
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight mb-3">
              Register Your Pandit & Spiritual Practice
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
              Join Tirvona&apos;s verified network of Pandits, Acharyas, Purohits, and Jyotishis. Complete your profile to list your sacred offerings, manage your calendar, and serve devotees worldwide.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left mb-9">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800/80">
                <div className="w-7 h-7 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] font-bold text-xs flex items-center justify-center mb-2.5">
                  1
                </div>
                <p className="text-xs font-bold text-[#0B192C] dark:text-white">Profile & Vidhi</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Languages & puja traditions</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800/80">
                <div className="w-7 h-7 rounded-xl bg-[#E58C28]/15 text-[#E58C28] font-bold text-xs flex items-center justify-center mb-2.5">
                  2
                </div>
                <p className="text-xs font-bold text-[#0B192C] dark:text-white">Puja Catalog</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Set rituals & consultations</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800/80">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-xs flex items-center justify-center mb-2.5">
                  3
                </div>
                <p className="text-xs font-bold text-[#0B192C] dark:text-white">Verification</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Earn your trusted badge</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/pandit/profile")}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#0A4DA6] text-white text-sm font-bold shadow-lg shadow-[#0A4DA6]/20 hover:bg-[#083b80] transition active:scale-95 cursor-pointer"
            >
              Get Started with Provider Setup
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active Dashboard ────────────────────────────────────────────────────────
  const isVerified = profile.verificationLevel !== "UNVERIFIED";
  const hasOfferings = offerings.length > 0;
  const hasAvailability = Boolean(availability && availability.rules.some((r) => r.isAvailable));

  const pendingActions: {
    id: string;
    title: string;
    description: string;
    cta: string;
    href: string;
    status: "urgent" | "recommended" | "completed";
  }[] = [];

  if (!isVerified) {
    pendingActions.push({
      id: "verify",
      title: "Submit Provider Verification",
      description: "Upload your credentials or priest certificate to receive verified status and unlock bookings.",
      cta: "Verify Now",
      href: "/pandit/verification",
      status: "urgent",
    });
  }

  if (!hasOfferings) {
    pendingActions.push({
      id: "offerings",
      title: "Create Your First Puja Offering",
      description: "Define the rituals, pujas, or astrological consultations devotees can book with you.",
      cta: "Add Offering",
      href: "/pandit/offerings",
      status: "urgent",
    });
  }

  if (!hasAvailability) {
    pendingActions.push({
      id: "availability",
      title: "Configure Weekly Availability",
      description: "Set your weekly working hours and prayer slots so devotees can schedule consultations.",
      cta: "Set Schedule",
      href: "/pandit/availability",
      status: "recommended",
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Top Hero Identity Banner ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0A4DA6] to-[#083b80] text-white font-bold text-xl flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.displayName?.slice(0, 2).toUpperCase() || "PA"
              )}
            </div>

            {/* Provider Meta */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl font-black text-[#0B192C] dark:text-white tracking-tight">
                  {profile.displayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-400 text-xs font-bold uppercase tracking-wide">
                  {PROVIDER_TYPE_LABELS[profile.providerType] || profile.providerType}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    profile.verificationLevel === "TRUSTED" || profile.verificationLevel === "PREMIUM"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40"
                  }`}
                >
                  <Award size={12} />
                  {VERIFICATION_LEVEL_LABELS[profile.verificationLevel] || profile.verificationLevel}
                </span>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl line-clamp-2">
                {profile.bio || "Dedicated spiritual guide and Vedic ritual provider on the Tirvona platform."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <Link
              href={`/pandit/${profile.id || "p_1"}`}
              className="px-4 py-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-[#E58C28] border border-[#E58C28]/30 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Globe size={13} />
              View Public Profile
            </Link>
            <Link
              href="/pandit/explore"
              className="px-4 py-2 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-400 border border-[#0A4DA6]/20 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              Public Portal
            </Link>
            <Link
              href="/pandit/profile"
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-[#0A4DA6] transition"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {/* ── Action Center (Only shown when pending actions exist) ────────────── */}
      {pendingActions.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles size={14} className="text-[#E58C28]" />
              Action Required to Complete Setup
            </div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {pendingActions.length} pending step{pendingActions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="bg-white dark:bg-[#0B192C] border border-amber-100 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <h3 className="text-xs font-bold text-[#0B192C] dark:text-white mb-1">
                    {action.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                    {action.description}
                  </p>
                </div>
                <Link
                  href={action.href}
                  className="inline-flex items-center justify-between text-xs font-bold text-[#0A4DA6] dark:text-blue-400 hover:underline pt-2 border-t border-gray-50 dark:border-slate-800"
                >
                  <span>{action.cta}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Module Workspaces ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Offerings */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0A4DA6]/40 transition group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-400 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <span className="text-xs font-bold text-gray-400">Services</span>
            </div>
            <h3 className="text-base font-bold text-[#0B192C] dark:text-white mb-1">
              Offerings
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {offeringsLoading ? (
                "Checking offerings..."
              ) : offerings.length > 0 ? (
                `${offerings.length} active service${offerings.length !== 1 ? "s" : ""} listed`
              ) : (
                "No offerings created yet"
              )}
            </p>
          </div>
          <Link
            href="/pandit/offerings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] group-hover:translate-x-1 transition-transform"
          >
            <span>Manage Offerings</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Verification */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0A4DA6]/40 transition group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <span className="text-xs font-bold text-gray-400">Trust</span>
            </div>
            <h3 className="text-base font-bold text-[#0B192C] dark:text-white mb-1">
              Verification
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {verificationLoading ? (
                "Checking status..."
              ) : latestCase ? (
                `Status: ${VERIFICATION_STATUS_LABELS[latestCase.status] || latestCase.status}`
              ) : (
                "Verification not started"
              )}
            </p>
          </div>
          <Link
            href="/pandit/verification"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] group-hover:translate-x-1 transition-transform"
          >
            <span>View Verification</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Availability */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0A4DA6]/40 transition group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#E58C28] flex items-center justify-center">
                <Calendar size={18} />
              </div>
              <span className="text-xs font-bold text-gray-400">Calendar</span>
            </div>
            <h3 className="text-base font-bold text-[#0B192C] dark:text-white mb-1">
              Availability
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {availabilityLoading ? (
                "Loading schedule..."
              ) : hasAvailability ? (
                "Weekly schedule configured"
              ) : (
                "Schedule not configured"
              )}
            </p>
          </div>
          <Link
            href="/pandit/availability"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] group-hover:translate-x-1 transition-transform"
          >
            <span>Set Schedule</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Profile & Specializations */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#0A4DA6]/40 transition group">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <User size={18} />
              </div>
              <span className="text-xs font-bold text-gray-400">Identity</span>
            </div>
            <h3 className="text-base font-bold text-[#0B192C] dark:text-white mb-1">
              Profile
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {profile.languages.length} Language{profile.languages.length !== 1 ? "s" : ""} · {profile.specializations.length} Puja{profile.specializations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/pandit/profile"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] group-hover:translate-x-1 transition-transform"
          >
            <span>Update Profile</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── Operational Grid: Active Offerings & Bookings ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Offerings Summary */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
                <BookOpen size={16} className="text-[#0A4DA6]" />
                Configured Puja Services
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Rituals and consultations visible to devotees
              </p>
            </div>
            <Link
              href="/pandit/offerings"
              className="text-xs font-bold text-[#0A4DA6] hover:underline"
            >
              View All ({offerings.length})
            </Link>
          </div>

          <div className="mt-4">
            {offerings.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-2 text-gray-400">
                  <Layers size={18} />
                </div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  No puja services listed yet
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4">
                  Add the sacred ceremonies you perform (e.g., Vivah, Griha Pravesh, Rudrabhishek).
                </p>
                <Link
                  href="/pandit/offerings"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-bold shadow-xs hover:bg-[#083b80] transition"
                >
                  <Plus size={13} />
                  Add First Offering
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-800/80">
                {offerings.slice(0, 3).map((offering) => (
                  <div key={offering.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#0B192C] dark:text-white">
                        {offering.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                        {offering.durationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {offering.durationMinutes} mins
                          </span>
                        )}
                        {offering.tags && offering.tags.length > 0 && (
                          <span>· {offering.tags.slice(0, 2).join(", ")}</span>
                        )}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-[10px] font-bold">
                      {offering.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Operational Bookings / Consultations */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
                <CalendarCheck size={16} className="text-[#0A4DA6]" />
                Upcoming Bookings & Consultations
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time devotee requests and appointments
              </p>
            </div>
          </div>

          <div className="mt-4">
            {bookings.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-2 text-gray-400">
                  <Calendar size={18} />
                </div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  No upcoming bookings yet
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Bookings made by devotees will automatically appear here once your profile is verified and active.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-800/80">
                {bookings.slice(0, 3).map((booking: any) => (
                  <div key={booking.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#0B192C] dark:text-white">
                        Booking #{booking.bookingReference || booking.id.slice(0, 8)}
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        {booking.scheduledDate || "Pending confirmation"}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0A4DA6] text-[10px] font-bold">
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

