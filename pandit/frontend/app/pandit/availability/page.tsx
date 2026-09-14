"use client";

import React from "react";
import { Calendar, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { usePanditProfile, usePanditAvailability } from "../../../hooks/usePanditProvider";
import { AvailabilityPanel } from "../../../components/AvailabilityPanel";

export default function AvailabilityPage() {
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refresh: refreshProfile,
  } = usePanditProfile(true);

  const {
    availability,
    calendarBlocks,
    loading: availabilityLoading,
    error: availabilityError,
    refresh: refreshAvailability,
  } = usePanditAvailability(profile?.id ?? null, Boolean(profile));

  const isLoading = profileLoading || availabilityLoading;
  const error = profileError || availabilityError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading availability settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-[18px] p-8 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
          Failed to Load Availability
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => {
            refreshProfile();
            refreshAvailability();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-8 text-center">
        <Calendar size={32} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-2">
          Profile Required
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Please complete your provider profile before managing availability.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <h1 className="text-base font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
          <Calendar size={16} className="text-[#0A4DA6]" />
          Availability Management
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Set your weekly working hours and block specific unavailable dates.
        </p>
        {availability?.timezone && (
          <p className="text-[11px] text-gray-400 mt-1">
            Timezone: <span className="font-semibold">{availability.timezone}</span>
          </p>
        )}
      </div>

      {/* Availability panel */}
      <AvailabilityPanel
        providerId={profile.id}
        initialRules={availability?.rules ?? []}
        calendarBlocks={calendarBlocks}
        onRefresh={refreshAvailability}
      />
    </div>
  );
}
