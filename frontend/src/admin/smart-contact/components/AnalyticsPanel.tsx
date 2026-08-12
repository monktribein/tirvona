import React, { useCallback, useEffect, useState } from "react";
import {
  smartContactService,
  type SmartContactAnalytics,
} from "../../../services/smartContact.service";
import { getErrorMessage } from "../../../lib/api";
import { Loader2, TrendingUp } from "lucide-react";

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom" },
];

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
 * A minimal bar chart, drawn with divs.
 *
 * The console has no charting library and this is two series over at most 31
 * days — pulling one in for that would cost more bundle than the whole
 * Smart Contact console. Bars are proportional to the largest value in view.
 */
const ScansOverTime: React.FC<{ series: SmartContactAnalytics["series"] }> = ({
  series,
}) => {
  const peak = Math.max(1, ...series.map((p) => Math.max(p.qrScans, p.profileViews)));
  return (
    <div className="flex items-end gap-[3px] h-36 overflow-x-auto pb-1">
      {series.map((point) => (
        <div
          key={point.date}
          className="flex-1 min-w-[6px] flex flex-col justify-end gap-[2px] group relative"
          title={`${point.date} · ${point.qrScans} scans, ${point.profileViews} views, ${point.saveContacts} saved`}
        >
          <div
            className="w-full bg-[#0A4DA6] rounded-t"
            style={{ height: `${(point.profileViews / peak) * 100}%` }}
          />
          <div
            className="w-full bg-amber-400 rounded-t"
            style={{ height: `${(point.qrScans / peak) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
};

const Breakdown: React.FC<{
  title: string;
  rows: { key: string; count: number }[];
}> = ({ title, rows }) => {
  const peak = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5">
      <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6] mb-3">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">No data in this range.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-[#0B192C] dark:text-white">
                <span className="capitalize truncate">{row.key}</span>
                <span>{row.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#0A4DA6]"
                  style={{ width: `${(row.count / peak) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Per-profile analytics (spec §24–§27, §51). */
export const AnalyticsPanel: React.FC<{ profileId: string }> = ({
  profileId,
}) => {
  const [data, setData] = useState<SmartContactAnalytics | null>(null);
  const [preset, setPreset] = useState("last30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { preset };
      if (preset === "custom") {
        if (from) params.from = from;
        if (to) params.to = to;
      }
      const res = await smartContactService.analytics(profileId, params);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load analytics."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [profileId, preset, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const controlClass =
    "px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreset(option.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors ${
              preset === option.value
                ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                : "bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]"
            }`}
          >
            {option.label}
          </button>
        ))}
        {preset === "custom" && (
          <>
            <input
              type="date"
              className={controlClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              className={controlClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
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
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Scans" value={data.totals.qrScans} />
            <Stat label="Profile Views" value={data.totals.profileViews} />
            <Stat label="Unique Visitors" value={data.totals.uniqueVisitors} />
            <Stat
              label="Conversion Rate"
              value={`${data.totals.conversionRate.toFixed(1)}%`}
              accent
            />
            <Stat label="Contacts Saved" value={data.totals.saveContactClicks} />
            <Stat label="Call Clicks" value={data.totals.callClicks} />
            <Stat label="WhatsApp Clicks" value={data.totals.whatsappClicks} />
            <Stat label="Email Clicks" value={data.totals.emailClicks} />
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6]">
                Scans over time
              </h4>
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#0A4DA6]" /> Views
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Scans
                </span>
              </div>
            </div>
            <ScansOverTime series={data.series} />
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6] mb-3 flex items-center gap-2">
              <TrendingUp size={13} /> Engagement funnel
            </h4>
            <div className="grid sm:grid-cols-4 gap-3">
              {data.funnel.map((stage, index) => (
                <div
                  key={stage.stage}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                    {stage.stage}
                  </p>
                  <p className="text-lg font-black text-[#0B192C] dark:text-white">
                    {stage.count}
                  </p>
                  {index > 0 && (
                    <p className="text-[10px] font-bold text-[#0A4DA6]">
                      {stage.conversionFromPrevious.toFixed(1)}% from previous
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Breakdown title="Devices" rows={data.devices} />
            <Breakdown title="Cities" rows={data.geography} />
            <Breakdown title="QR Placement" rows={data.sources} />
            <Breakdown title="Referrers" rows={data.referrers} />
          </div>
        </>
      )}
    </div>
  );
};
