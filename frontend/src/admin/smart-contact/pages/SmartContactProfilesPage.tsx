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
  AlertTriangle,
  ContactRound,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
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
  // Bulk deletion. Held as a Set of ids rather than a flag on each row so the
  // selection survives a re-fetch, and pruned against the rows actually on
  // screen before it is ever sent.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Only ever act on rows the current filter and page actually show, so a
  // stale id left over from an earlier view can never be deleted unseen.
  const visibleSelected = profiles.filter((profile) => selected.has(profile.id));
  const allVisibleSelected =
    profiles.length > 0 && visibleSelected.length === profiles.length;

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) profiles.forEach((p) => next.delete(p.id));
      else profiles.forEach((p) => next.add(p.id));
      return next;
    });

  const deleteSelected = async () => {
    if (visibleSelected.length === 0) return;
    setDeleting(true);
    try {
      const res = await smartContactService.bulkDelete(
        visibleSelected.map((profile) => profile.id),
      );
      toast.success(res.data.message || "Profiles deleted.");
      setSelected(new Set());
      setConfirmingDelete(false);
      // The page may now be past the end of a shorter list.
      setPage((current) => Math.max(1, Math.min(current, pages)));
      void load();
      void loadStats();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the selected profiles."));
    } finally {
      setDeleting(false);
    }
  };

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

        {/* Only appears once something is ticked, so the destructive control is
          never sitting idle next to a list of live profiles. */}
        {visibleSelected.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0A4DA6]/5 border border-[#0A4DA6]/20">
            <span className="text-xs font-black text-[#0B192C] dark:text-white">
              {visibleSelected.length} profile
              {visibleSelected.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-[11px] font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
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
                  <th className="py-3 pr-3 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      // Some but not all: the box shows neither state honestly,
                      // so it is dashed rather than silently reading "empty".
                      ref={(node) => {
                        if (node)
                          node.indeterminate =
                            visibleSelected.length > 0 && !allVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      aria-label="Select all profiles on this page"
                      className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 accent-[#0A4DA6] cursor-pointer"
                    />
                  </th>
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
                    className={`border-b border-gray-50 dark:border-slate-800/60 transition-colors ${
                      selected.has(profile.id)
                        ? "bg-[#0A4DA6]/5"
                        : "hover:bg-gray-50/70 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={selected.has(profile.id)}
                        onChange={() => toggleOne(profile.id)}
                        aria-label={`Select ${profile.displayName}`}
                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 accent-[#0A4DA6] cursor-pointer"
                      />
                    </td>
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

      {/* Deletion is permanent and this module is otherwise archive-only, so
        the dialog names every profile going and says plainly what a freed slug
        does to a printed card — the one consequence that cannot be undone. */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm permanent deletion"
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl my-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 shrink-0">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                  Permanently delete {visibleSelected.length} profile
                  {visibleSelected.length === 1 ? "" : "s"}?
                </h3>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  This cannot be undone. Their QR codes and analytics history go
                  with them.
                </p>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-2.5 leading-relaxed">
                  Any printed card carrying one of these URLs will stop working
                  — the address returns nothing rather than the inactive notice.
                  To retire a representative whose cards are still circulating,
                  archive the profile instead.
                </p>
              </div>
            </div>

            <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800/60">
              {visibleSelected.map((profile) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="text-xs font-bold text-[#0B192C] dark:text-white truncate">
                    {profile.displayName}
                  </span>
                  <code className="text-[10px] font-bold text-gray-500 shrink-0">
                    /c/{profile.slug}
                  </code>
                </li>
              ))}
            </ul>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={deleting}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {deleting
                  ? "Deleting..."
                  : `Delete ${visibleSelected.length} Profile${visibleSelected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartContactProfilesPage;
