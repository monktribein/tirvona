"use client";

import React from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  usePanditProfile,
  usePanditOfferings,
  usePanditVerification,
} from "../../hooks/usePanditProvider";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../types/pandit.types";

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  action: string;
  path: string;
}> = ({ icon, title, value, action, path }) => {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(path)}
      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-4 cursor-pointer hover:border-[#0A4DA6]/30 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 dark:bg-[#0A4DA6]/20 flex items-center justify-center text-[#0A4DA6]">
          {icon}
        </div>
        <ArrowRight
          size={14}
          className="text-gray-300 dark:text-slate-600 group-hover:text-[#0A4DA6] transition-colors mt-1"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">
        {title}
      </p>
      <p className="text-sm font-semibold text-[#0B192C] dark:text-white">
        {value}
      </p>
      <p className="text-[11px] text-[#0A4DA6] font-semibold mt-2 group-hover:underline">
        {action}
      </p>
    </div>
  );
};

export default function ProviderDashboardPage() {
  const router = useRouter();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refresh: refreshProfile,
  } = usePanditProfile(true);
  const { offerings, loading: offeringsLoading } = usePanditOfferings(true);
  const { latestCase, loading: verificationLoading } = usePanditVerification(true);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading your provider dashboard...
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-[18px] p-8 text-center">
        <AlertCircle size={36} className="text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-[#0B192C] dark:text-white mb-1">
          Failed to Load Dashboard
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {profileError}
        </p>
        <button
          type="button"
          onClick={refreshProfile}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  // Provider hasn't created their profile yet
  if (!profile) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[#0A4DA6]/10 flex items-center justify-center mx-auto mb-4">
          <UserCheck size={28} className="text-[#0A4DA6]" />
        </div>
        <h2 className="text-base font-semibold text-[#0B192C] dark:text-white mb-2">
          Complete Your Provider Profile
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
          Set up your Pandit / Purohit profile to start receiving bookings and
          connecting with devotees through Tirvona.
        </p>
        <button
          type="button"
          onClick={() => router.push("/provider/profile")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-sm font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          Create Profile
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  const completionPercent = profile.profileCompletionPercent ?? 60;

  return (
    <div className="space-y-4">
      {/* Welcome header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0A4DA6] to-[#083b80] flex items-center justify-center shrink-0 text-white font-bold text-lg overflow-hidden">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              profile.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#0B192C] dark:text-white truncate">
              {profile.displayName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {PROVIDER_TYPE_LABELS[profile.providerType]} ·{" "}
              <span className="text-[#0A4DA6]">
                {VERIFICATION_LEVEL_LABELS[profile.verificationLevel]}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/provider/profile")}
            className="shrink-0 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer"
          >
            Edit Profile
          </button>
        </div>

        {/* Profile completion bar */}
        {completionPercent < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
              <span>Profile Completion</span>
              <span className="font-semibold">{completionPercent}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0A4DA6] rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<User size={16} />}
          title="Profile"
          value={
            profile.languages.length > 0
              ? `${profile.languages.length} language${profile.languages.length !== 1 ? "s" : ""}`
              : "Incomplete"
          }
          action="Manage Profile →"
          path="/provider/profile"
        />
        <StatCard
          icon={<BookOpen size={16} />}
          title="Offerings"
          value={
            offeringsLoading ? (
              <Loader2 size={14} className="animate-spin text-gray-300" />
            ) : (
              `${offerings.length} service${offerings.length !== 1 ? "s" : ""}`
            )
          }
          action="Manage Offerings →"
          path="/provider/offerings"
        />
        <StatCard
          icon={<ShieldCheck size={16} />}
          title="Verification"
          value={
            verificationLoading ? (
              <Loader2 size={14} className="animate-spin text-gray-300" />
            ) : latestCase ? (
              latestCase.status.replace("_", " ")
            ) : (
              "Not Started"
            )
          }
          action="View Verification →"
          path="/provider/verification"
        />
        <StatCard
          icon={<Calendar size={16} />}
          title="Availability"
          value={`${profile.isActive ? "Active" : "Inactive"}`}
          action="Manage Availability →"
          path="/provider/availability"
        />
      </div>

      {/* Languages & Specializations quick view */}
      {(profile.languages.length > 0 ||
        profile.specializations.length > 0) && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {profile.languages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Languages
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-[11px] text-[#0A4DA6] dark:text-blue-300 font-medium"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.specializations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Specializations
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.specializations.slice(0, 5).map((spec) => (
                  <span
                    key={spec}
                    className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-700 dark:text-amber-300 font-medium"
                  >
                    {spec}
                  </span>
                ))}
                {profile.specializations.length > 5 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-[11px] text-gray-400 font-medium">
                    +{profile.specializations.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
