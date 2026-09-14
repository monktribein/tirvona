"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Filter,
  Users,
  Clock,
  Compass,
  MapPin,
  Search,
} from "lucide-react";
import { StructuredPujaSearch } from "../../components/StructuredPujaSearch";
import { panditService } from "../../services/pandit.service";
import type { ProviderProfile, ProviderType } from "../../types/pandit.types";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../types/pandit.types";

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const pujaQuery = searchParams.get("puja") || "";
  const placeQuery = searchParams.get("place") || "";
  const dateQuery = searchParams.get("date") || "";

  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ALL");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await panditService.listProviders();
        if (res.data?.success) {
          setProviders(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch search results", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter providers
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      // Filter by type
      if (selectedType !== "ALL" && p.providerType !== selectedType) {
        return false;
      }
      // Filter by language
      if (selectedLanguage !== "ALL" && !p.languages.includes(selectedLanguage)) {
        return false;
      }
      // Filter by verification
      if (verifiedOnly && p.verificationLevel === "UNVERIFIED") {
        return false;
      }
      // Filter by puja query if present
      if (pujaQuery) {
        const matchesSpec = p.specializations?.some((s) =>
          s.toLowerCase().includes(pujaQuery.toLowerCase())
        );
        const matchesBio = p.bio?.toLowerCase().includes(pujaQuery.toLowerCase());
        const matchesType = PROVIDER_TYPE_LABELS[p.providerType]?.toLowerCase().includes(pujaQuery.toLowerCase());
        if (!matchesSpec && !matchesBio && !matchesType) {
          // If query is broad, still allow if it's general Vedic provider
          const isVedic = ["PANDIT", "PUROHIT", "ACHARYA", "VEDIC_SCHOLAR", "JYOTISHI"].includes(p.providerType);
          if (!isVedic) return false;
        }
      }
      return true;
    });
  }, [providers, selectedType, selectedLanguage, verifiedOnly, pujaQuery]);

  // Extract unique languages for filter dropdown
  const allLanguages = useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => p.languages?.forEach((l) => set.add(l)));
    return Array.from(set);
  }, [providers]);

  return (
    <div className="space-y-8 sm:space-y-10 pb-20">
      {/* ── Top Structured Search Refinement ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#071322] to-[#0A4DA6]/90 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#E58C28]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#E58C28] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            Verified Vedic Results
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight">
            {pujaQuery
              ? `Pandits & Acharyas for ${pujaQuery}`
              : "Explore Verified Vedic Pandits & Acharyas"}
          </h1>
          <p className="text-sm text-blue-100/80">
            {placeQuery && `Location: ${placeQuery} • `}
            {dateQuery && `Muhurat Date: ${dateQuery} • `}
            Showing {filteredProviders.length} authentic verified ritual experts.
          </p>

          <div className="pt-2">
            <StructuredPujaSearch
              initialPuja={pujaQuery}
              initialPlace={placeQuery}
              initialDate={dateQuery}
            />
          </div>
        </div>
      </div>

      {/* ── Main Content Grid with Sidebar Filters ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-[#0B192C] dark:text-white flex items-center gap-2 text-base">
              <Filter size={18} className="text-[#0A4DA6]" />
              Filter Pandits
            </h3>
            {(selectedType !== "ALL" || selectedLanguage !== "ALL" || verifiedOnly) && (
              <button
                onClick={() => {
                  setSelectedType("ALL");
                  setSelectedLanguage("ALL");
                  setVerifiedOnly(false);
                }}
                className="text-xs font-semibold text-[#0A4DA6] hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {/* Provider Type */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Provider Category
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none focus:border-[#0A4DA6]"
            >
              <option value="ALL">All Categories</option>
              <option value="ACHARYA">Acharya (Senior Scholar)</option>
              <option value="PANDIT">Pandit (Ritual Priest)</option>
              <option value="PUROHIT">Purohit (Family Priest)</option>
              <option value="VEDIC_SCHOLAR">Vedic Scholar</option>
              <option value="JYOTISHI">Jyotishi (Vedic Astrologer)</option>
            </select>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Language / Bhasha
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 text-sm font-semibold text-[#0B192C] dark:text-white outline-none focus:border-[#0A4DA6]"
            >
              <option value="ALL">All Languages</option>
              {allLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Badge Filter */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 hover:border-[#0A4DA6]/40 transition">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#0A4DA6] focus:ring-[#0A4DA6]"
              />
              <span className="text-xs font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#0A4DA6]" />
                Tirvona Verified Only
              </span>
            </label>
          </div>
        </aside>

        {/* Results List */}
        <div className="lg:col-span-9 space-y-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 border border-gray-100 dark:border-slate-800 animate-pulse flex flex-col sm:flex-row gap-6"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gray-200 dark:bg-slate-800" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-12 border border-gray-100 dark:border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] flex items-center justify-center mx-auto">
                <Search size={28} />
              </div>
              <h3 className="text-lg font-bold text-[#0B192C] dark:text-white">
                No matching Pandits found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Try clearing your search query or adjusting your filters to view more Vedic practitioners.
              </p>
              <button
                onClick={() => {
                  setSelectedType("ALL");
                  setSelectedLanguage("ALL");
                  setVerifiedOnly(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0A4DA6] text-white font-bold text-xs"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProviders.map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-[#0A4DA6]/40 transition-all duration-300 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between group"
                >
                  <div className="flex gap-5 items-start">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A4DA6] to-[#071322] text-white flex items-center justify-center text-2xl font-serif font-extrabold shadow-md border-2 border-amber-400/30">
                        {p.displayName ? p.displayName.charAt(0) : "P"}
                      </div>
                      {p.verificationLevel !== "UNVERIFIED" && (
                        <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0B192C]">
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-lg font-bold text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] transition">
                          {p.displayName}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-blue-50 dark:bg-blue-900/40 text-[#0A4DA6] dark:text-blue-300 border border-[#0A4DA6]/20">
                          {PROVIDER_TYPE_LABELS[p.providerType] || p.providerType}
                        </span>
                        {p.verificationLevel !== "UNVERIFIED" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <ShieldCheck size={11} />
                            {VERIFICATION_LEVEL_LABELS[p.verificationLevel]} Verified
                          </span>
                        )}
                      </div>

                      {p.bio && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 max-w-xl">
                          {p.bio}
                        </p>
                      )}

                      {/* Specializations & Languages */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
                        {p.specializations && p.specializations.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <BookOpen size={13} className="text-[#0A4DA6]" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200">
                              {p.specializations.slice(0, 3).join(", ")}
                              {p.specializations.length > 3 && ` +${p.specializations.length - 3} more`}
                            </span>
                          </div>
                        )}

                        {p.languages && p.languages.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Languages size={13} className="text-[#E58C28]" />
                            <span>{p.languages.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2.5 w-full md:w-auto flex-shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-slate-800">
                    <Link
                      href={`/pandit/${p.id}`}
                      className="flex-1 md:flex-initial py-2.5 px-5 rounded-2xl bg-[#0A4DA6] hover:bg-[#083b80] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#0A4DA6]/20 transition cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ArrowRight size={14} />
                    </Link>
                    <Link
                      href={`/pandit/${p.id}?book=true`}
                      className="flex-1 md:flex-initial py-2.5 px-5 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-[#E58C28] dark:text-amber-400 border border-[#E58C28]/30 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Calendar size={13} />
                      <span>Book Puja</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm font-semibold text-gray-500">
          Loading verified Vedic Pandits...
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}

