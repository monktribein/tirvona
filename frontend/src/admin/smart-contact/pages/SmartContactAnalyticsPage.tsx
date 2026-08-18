import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  smartContactService,
  type SmartContactProfile,
  type SmartContactStats,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { EnterpriseButton, EnterprisePageHeader } from "../../shared";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";

const Stat: React.FC<{ label: string; value: string | number; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
      {label}
    </p>
    <p
      className={`text-xl font-black ${accent ? "text-[#0A4DA6]" : "text-[#0B192C] dark:text-white"}`}
    >
      {value}
    </p>
  </div>
);

/**
 * Smart Contacts → QR Analytics (spec §18, §24).
 *
 * Platform-wide totals plus a leaderboard. Per-profile charts live on the
 * profile's own Analytics tab; this page answers "how is the programme doing"
 * rather than "how is this person doing".
 *
 * The leaderboard is sorted client-side over the first page of profiles: the
 * list endpoint already returns metrics per row, so ranking them here avoids
 * adding a second aggregation endpoint for a view that shows ten rows.
 */
export const SmartContactAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<SmartContactStats | null>(null);
  const [profiles, setProfiles] = useState<SmartContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, listRes] = await Promise.all([
        smartContactService.stats(),
        smartContactService.list({ limit: 100, status: "ACTIVE" }),
      ]);
      setStats(statsRes.data.data);
      setProfiles(listRes.data.data.items ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load Smart Contact analytics."));
      setStats(null);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const leaderboard = [...profiles]
    .sort((a, b) => (b.metrics?.qrScans ?? 0) - (a.metrics?.qrScans ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="QR Analytics"
        subtitle="Scan and engagement performance across every Smart Contact profile."
        icon={<BarChart3 size={20} />}
        actions={
          <EnterpriseButton variant="outline" onClick={() => void load()}>
            <RefreshCw size={14} /> Refresh
          </EnterpriseButton>
        }
      />

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex items-center justify-center text-gray-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Scans" value={stats?.events.totalScans ?? 0} />
            <Stat label="Profile Views" value={stats?.events.totalViews ?? 0} />
            <Stat label="Contacts Saved" value={stats?.events.totalSaves ?? 0} />
            <Stat
              label="Conversion Rate"
              value={`${(stats?.events.conversionRate ?? 0).toFixed(1)}%`}
              accent
            />
            <Stat label="Call Clicks" value={stats?.events.totalCalls ?? 0} />
            <Stat
              label="WhatsApp Clicks"
              value={stats?.events.totalWhatsapp ?? 0}
            />
            <Stat label="Email Clicks" value={stats?.events.totalEmails ?? 0} />
            <Stat
              label="Active Profiles"
              value={stats?.profiles.active ?? 0}
            />
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6] mb-3">
              Top representatives by scans
            </h4>

            {leaderboard.length === 0 ? (
              <p className="py-10 text-center text-xs text-gray-400">
                No active profiles with recorded scans yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-800">
                      <th className="py-2 pr-3">Representative</th>
                      <th className="py-2 px-3 text-right">Scans</th>
                      <th className="py-2 px-3 text-right">Views</th>
                      <th className="py-2 px-3 text-right">Saved</th>
                      <th className="py-2 pl-3 text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((profile) => (
                      <tr
                        key={profile.id}
                        className="border-b border-gray-50 dark:border-slate-800/60"
                      >
                        <td className="py-2.5 pr-3">
                          <Link
                            to={`/admin/smart-contacts/${profile.id}`}
                            className="text-xs font-black text-[#0B192C] dark:text-white hover:text-[#0A4DA6]"
                          >
                            {profile.displayName}
                          </Link>
                          <span className="block text-[10px] text-gray-500">
                            {profile.designation || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                          {profile.metrics?.qrScans ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                          {profile.metrics?.profileViews ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-bold text-[#0B192C] dark:text-white">
                          {profile.metrics?.saveContacts ?? 0}
                        </td>
                        <td className="py-2.5 pl-3 text-right text-xs font-black text-[#0A4DA6]">
                          {(profile.metrics?.conversionRate ?? 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SmartContactAnalyticsPage;
