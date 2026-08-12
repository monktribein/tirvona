import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  smartContactService,
  type SmartContactProfile,
  type SmartContactStats,
  type SmartContactStatus,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  EnterpriseButton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
} from "../../shared";
import { ProfileFormModal } from "../components/ProfileFormModal";
import {
  ContactRound,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
} from "lucide-react";

const STATUS_TABS: { label: string; value: SmartContactStatus | ""; key: string }[] =
  [
    { label: "All Profiles", value: "", key: "total" },
    { label: "Active", value: "ACTIVE", key: "active" },
    { label: "Draft", value: "DRAFT", key: "draft" },
    { label: "Disabled", value: "SUSPENDED", key: "suspended" },
    { label: "Archived", value: "ARCHIVED", key: "archived" },
  ];

const CATEGORY_FILTERS = [
  { label: "Everyone", value: "" },
  { label: "Employees", value: "employee" },
  { label: "Partners", value: "partner" },
  { label: "District Partners", value: "district-partner" },
];

const badgeStatus = (status: SmartContactStatus): string =>
  status === "ACTIVE"
    ? "active"
    : status === "DRAFT"
      ? "pending"
      : status === "SUSPENDED"
        ? "suspended"
        : "archived";

/**
 * Smart Contacts → All Profiles (spec §18, §50).
 *
 * The list is the console's home: every profile with its headline engagement
 * numbers, which the API joins in from the event log in one aggregation rather
 * than a request per row.
 */
export const SmartContactProfilesPage: React.FC = () => {
  // The sidebar's Active / Disabled / Employees / Partners entries all point at
  // this page with a query string rather than at separate routes, so the
  // filters are driven by the URL. That also makes a filtered view linkable.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = (searchParams.get("status") ?? "") as SmartContactStatus | "";
  const urlCategory = searchParams.get("category") ?? "";

  const [profiles, setProfiles] = useState<SmartContactProfile[]>([]);
  const [stats, setStats] = useState<SmartContactStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const status = urlStatus;
  const category = urlCategory;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const limit = 20;
  const pages = Math.max(1, Math.ceil(total / limit));

  /** Writes a filter into the URL, dropping it entirely when cleared. */
  const setFilter = (key: "status" | "category", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (status) params.status = status;
      if (category) params.category = category;
      const res = await smartContactService.list(params);
      setProfiles(res.data.data.items ?? []);
      setTotal(res.data.data.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load Smart Contact profiles."));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, category]);

  const loadStats = useCallback(async () => {
    try {
      const res = await smartContactService.stats();
      setStats(res.data.data);
    } catch {
      // The counts are a convenience on top of the list; a failure here should
      // not blank the page that already loaded.
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const copyUrl = async (profile: SmartContactProfile) => {
    try {
      await navigator.clipboard.writeText(profile.profileUrl);
      toast.success("Profile URL copied");
    } catch {
      toast.error("Could not copy the URL. Copy it from the profile page.");
    }
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Smart Contacts"
        subtitle="Permanent QR profiles for Tirvona representatives. One QR, one URL, editable details behind it."
        icon={<ContactRound size={20} />}
        badgeText={stats ? `${stats.profiles.total ?? 0} profiles` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton
              variant="outline"
              onClick={() => {
                void load();
                void loadStats();
              }}
            >
              <RefreshCw size={14} /> Refresh
            </EnterpriseButton>
            <EnterpriseButton onClick={() => setCreating(true)}>
              <Plus size={14} /> Create Profile
            </EnterpriseButton>
          </div>
        }
      />

      {/* Status tabs, doubling as the spec §18 dashboard counters. */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          const count = stats?.profiles?.[tab.key];
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setFilter("status", tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors ${
                active
                  ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                  : "bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]"
              }`}
            >
              {tab.label}
              {typeof count === "number" && (
                <span className={`ml-2 ${active ? "opacity-80" : "text-gray-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, slug, email, employee ID…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setFilter("category", e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
          >
            {CATEGORY_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ContactRound size={30} className="mx-auto text-gray-300" />
            <p className="text-sm font-black text-[#0B192C] dark:text-white">
              No Smart Contact profiles yet
            </p>
            <p className="text-xs text-gray-500">
              Create one to generate a permanent QR code and contact page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-3 pr-3">Representative</th>
                  <th className="py-3 px-3">Profile URL</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Scans</th>
                  <th className="py-3 px-3 text-right">Views</th>
                  <th className="py-3 px-3 text-right">Saved</th>
                  <th className="py-3 px-3 text-right">Conv.</th>
                  <th className="py-3 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-gray-50/70 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        {profile.photoUrl ? (
                          <img
                            src={profile.photoUrl}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] grid place-items-center text-[11px] font-black">
                            {profile.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/admin/smart-contacts/${profile.id}`}
                            className="block text-xs font-black text-[#0B192C] dark:text-white hover:text-[#0A4DA6] truncate"
                          >
                            {profile.displayName}
                          </Link>
                          <span className="text-[10px] text-gray-500 truncate block">
                            {profile.designation || "—"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-bold text-gray-500">
                          /c/{profile.slug}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyUrl(profile)}
                          title="Copy profile URL"
                          className="text-gray-400 hover:text-[#0A4DA6]"
                        >
                          <Copy size={12} />
                        </button>
                        <a
                          href={profile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open profile"
                          className="text-gray-400 hover:text-[#0A4DA6]"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <EnterpriseStatusBadge status={badgeStatus(profile.status)} />
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                      {profile.metrics?.qrScans ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                      {profile.metrics?.profileViews ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                      {profile.metrics?.saveContacts ?? 0}
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-black text-[#0A4DA6]">
                      {(profile.metrics?.conversionRate ?? 0).toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/admin/smart-contacts/${profile.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#0A4DA6] hover:bg-[#0A4DA6]/10"
                          title="Open profile"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/admin/smart-contacts/${profile.id}#qr`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#0A4DA6] hover:bg-[#0A4DA6]/10"
                          title="QR codes"
                        >
                          <QrCode size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-bold text-gray-500">
              Page {page} of {pages} · {total} profiles
            </span>
            <div className="flex gap-2">
              <EnterpriseButton
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </EnterpriseButton>
              <EnterpriseButton
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next
              </EnterpriseButton>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <ProfileFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
            void loadStats();
          }}
        />
      )}
    </div>
  );
};

export default SmartContactProfilesPage;
