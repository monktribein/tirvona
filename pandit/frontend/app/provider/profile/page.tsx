"use client";

import React, { useState } from "react";
import { Loader2, AlertCircle, RefreshCw, User, Edit3, ShieldCheck } from "lucide-react";
import { usePanditProfile } from "../../../hooks/usePanditProvider";
import { PanditProfileForm } from "../../../components/PanditProfileForm";
import { panditService } from "../../../services/pandit.service";
import { getErrorMessage } from "@/lib/api";
import type { ProviderProfileInput } from "../../../types/pandit.types";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../../types/pandit.types";

const VERIFICATION_LEVEL_BADGE: Record<
  string,
  { bg: string; text: string }
> = {
  UNVERIFIED: {
    bg: "bg-gray-100 dark:bg-slate-800",
    text: "text-gray-500 dark:text-slate-400",
  },
  BASIC: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  STANDARD: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  PREMIUM: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  TRUSTED: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-600 dark:text-purple-400",
  },
};

export default function ProfilePage() {
  const {
    profile,
    loading,
    error,
    refresh,
  } = usePanditProfile(true);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (data: ProviderProfileInput) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (profile) {
        await panditService.updateProfile(data);
      } else {
        await panditService.createProfile(data);
      }
      setIsEditing(false);
      refresh();
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save profile. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading profile...
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && !isEditing) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-[18px] p-8 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
          Failed to Load Profile
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {error}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Page header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
              <User size={16} className="text-[#0A4DA6]" />
              Provider Profile
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Your public profile visible to customers on Tirvona.
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer"
            >
              <Edit3 size={12} />
              {profile ? "Edit" : "Create Profile"}
            </button>
          )}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="px-4 py-3 rounded-[14px] bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle size={14} />
          {saveError}
        </div>
      )}

      {/* Edit form */}
      {isEditing ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
          <PanditProfileForm
            profile={profile}
            onSave={handleSave}
            saving={saving}
            onCancel={() => {
              setIsEditing(false);
              setSaveError(null);
            }}
          />
        </div>
      ) : profile ? (
        /* Profile view mode */
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5 space-y-5">
          {/* Avatar + name + type */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0A4DA6] to-[#083b80] flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
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
            <div>
              <h2 className="text-base font-semibold text-[#0B192C] dark:text-white">
                {profile.displayName}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {PROVIDER_TYPE_LABELS[profile.providerType]}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {/* Verification level badge */}
                {(() => {
                  const badge =
                    VERIFICATION_LEVEL_BADGE[profile.verificationLevel] ??
                    VERIFICATION_LEVEL_BADGE.UNVERIFIED;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.text}`}
                    >
                      <ShieldCheck size={10} />
                      {VERIFICATION_LEVEL_LABELS[profile.verificationLevel]}
                    </span>
                  );
                })()}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    profile.isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                About
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Contact */}
          {(profile.contactEmail || profile.contactPhone) && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Contact
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                {profile.contactEmail && <p>{profile.contactEmail}</p>}
                {profile.contactPhone && <p>{profile.contactPhone}</p>}
              </div>
            </div>
          )}

          {/* Languages */}
          {profile.languages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
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

          {/* Specializations */}
          {profile.specializations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Specializations
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.specializations.map((spec) => (
                  <span
                    key={spec}
                    className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-700 dark:text-amber-300 font-medium"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          {profile.updatedAt && (
            <p className="text-[11px] text-gray-300 dark:text-slate-600 pt-2 border-t border-gray-50 dark:border-slate-800">
              Last updated:{" "}
              {new Date(profile.updatedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      ) : (
        /* No profile yet */
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#0A4DA6]/10 flex items-center justify-center mx-auto mb-3">
            <User size={22} className="text-[#0A4DA6]" />
          </div>
          <p className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
            No profile yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Create your provider profile to appear on the Tirvona platform.
          </p>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
          >
            Create Profile
          </button>
        </div>
      )}
    </div>
  );
}
