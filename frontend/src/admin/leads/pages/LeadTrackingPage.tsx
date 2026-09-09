import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Route,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Shield,
} from "lucide-react";
import {
  leadCollectionService,
  type LeadUser,
  type TrackingAgent,
  type TrackingDay,
  type TrackingHistoryRow,
  type TrackingLivePosition,
} from "../../../services/leadCollection.service";
import { getErrorMessage } from "../../../lib/api";
import { useNotifications } from "../../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseStatsCard } from "../../shared/components/EnterpriseStatsCard";
import { TirvonaMapView, type MapMarker } from "../../../components/TirvonaMapView";

const today = () => new Date().toISOString().slice(0, 10);

const clock = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const duration = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${total % 60}m` : `${total}m`;
};

const card =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";
const field =
  "w-full px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]";

export const LeadTrackingPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [agents, setAgents] = useState<LeadUser[]>([]);
  const [agentId, setAgentId] = useState("");
  const [date, setDate] = useState(today());

  const [agent, setAgent] = useState<TrackingAgent | null>(null);
  const [day, setDay] = useState<TrackingDay | null>(null);
  const [history, setHistory] = useState<TrackingHistoryRow[]>([]);
  const [live, setLive] = useState<TrackingLivePosition[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // The agent picker and the live board are estate-wide, so they load once.
  const loadShared = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const [usersRes, liveRes] = await Promise.all([
        leadCollectionService.listUsers({ limit: 500 }),
        leadCollectionService.getLiveTracking(),
      ]);
      const rows = usersRes?.data?.data?.items ?? [];
      setAgents(rows);
      setLive(liveRes?.data?.data ?? []);
      setAgentId((current) => current || (rows[0]?._id ?? ""));
    } catch (error) {
      addNotification(
        "Tracking Unavailable",
        getErrorMessage(error, "Could not load field agents."),
        "error",
      );
    } finally {
      setLoadingAgents(false);
    }
  }, [addNotification]);

  const loadAgentDay = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const [dayRes, historyRes] = await Promise.all([
        leadCollectionService.getAgentTracking(agentId, date),
        leadCollectionService.getAgentTrackingHistory(agentId),
      ]);
      setAgent(dayRes?.data?.data?.agent ?? null);
      setDay(dayRes?.data?.data?.day ?? null);
      setHistory(historyRes?.data?.data ?? []);
    } catch (error) {
      setDay(null);
      addNotification(
        "Tracking Unavailable",
        getErrorMessage(error, "Could not load this agent's movement."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [agentId, date, addNotification]);

  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  useEffect(() => {
    void loadAgentDay();
  }, [loadAgentDay]);

  /**
   * Start, end and every stop get a pin; the full run of fixes becomes the
   * line. Plotting a pin per fix would bury the day under hundreds of markers.
   */
  const markers = useMemo<MapMarker[]>(() => {
    if (!day) return [];
    const pins: MapMarker[] = [];

    if (day.startLocation)
      pins.push({
        id: "start",
        latitude: day.startLocation.lat,
        longitude: day.startLocation.lng,
        title: "Day start",
        subtitle: clock(day.startedAt),
        badge: "Start",
      });

    day.visited.forEach((visit, index) =>
      pins.push({
        id: `visit-${index}`,
        latitude: visit.lat,
        longitude: visit.lng,
        title: `Stop ${index + 1}`,
        subtitle: `${clock(visit.arrivedAt)} – ${clock(visit.leftAt)} · ${duration(visit.minutes)}`,
        badge: "Stop",
      }),
    );

    if (day.endLocation)
      pins.push({
        id: "end",
        latitude: day.endLocation.lat,
        longitude: day.endLocation.lng,
        title: "Latest position",
        subtitle: clock(day.endedAt),
        badge: "Latest",
        active: true,
      });

    return pins;
  }, [day]);

  const consentOff = agent && !agent.consent.granted;

  return (
    <div className="space-y-6 w-full text-left">
      <EnterprisePageHeader
        title="Field Agent Movement"
        subtitle="Daily route, distance and stops recorded from the agent's device with their consent."
        icon={<Navigation size={22} />}
        badgeText={day ? `${day.totalKm} km` : undefined}
        actions={
          <button
            onClick={() => {
              void loadShared();
              void loadAgentDay();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />

      <div className={`${card} p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
        <select
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
          className={field}
          aria-label="Field agent"
          disabled={loadingAgents}
        >
          {agents.length === 0 && <option value="">No field agents</option>}
          {agents.map((row) => (
            <option key={row._id} value={row._id}>
              {row.name}
              {row.district ? ` · ${row.district}` : ""}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(event) => setDate(event.target.value || today())}
          className={field}
          aria-label="Date"
        />
        <select
          value=""
          onChange={(event) =>
            event.target.value && setDate(event.target.value)
          }
          className={field}
          aria-label="Recent tracked days"
        >
          <option value="">Jump to a tracked day…</option>
          {history.map((row) => (
            <option key={row.date} value={row.date}>
              {row.date} · {row.totalKm} km · {row.fixes} points
            </option>
          ))}
        </select>
      </div>

      {consentOff && (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-5 py-4 flex items-start gap-3">
          <Shield
            size={16}
            className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
          />
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-300">
              Tracking is switched off for this agent
            </p>
            <p className="text-amber-800/80 dark:text-amber-400/80">
              Movement is only recorded while the agent has consent enabled on
              their device. Anything below is history from before it was turned
              off.
            </p>
          </div>
        </div>
      )}

      {day && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <EnterpriseStatsCard
            title="Distance"
            value={`${day.totalKm} km`}
            icon={<Route size={18} />}
          />
          <EnterpriseStatsCard
            title="Stops"
            value={day.visited.length}
            icon={<MapPin size={18} />}
          />
          <EnterpriseStatsCard
            title="Moving"
            value={duration(day.movingMinutes)}
            icon={<Navigation size={18} />}
          />
          <EnterpriseStatsCard
            title="Idle"
            value={duration(day.idleMinutes)}
            icon={<Clock size={18} />}
          />
          <EnterpriseStatsCard
            title="First seen"
            value={clock(day.startedAt)}
            icon={<Clock size={18} />}
          />
          <EnterpriseStatsCard
            title="Last seen"
            value={clock(day.endedAt)}
            icon={<Clock size={18} />}
          />
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
              Route for {date}
            </h3>
            <p className="text-[11px] text-gray-400 font-semibold">
              {agent?.name ?? "—"}
              {day?.fixes ? ` · ${day.fixes} GPS points` : ""}
            </p>
          </div>
          {agent && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black ${
                agent.consent.granted
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"
              }`}
            >
              {agent.consent.granted ? (
                <ShieldCheck size={12} />
              ) : (
                <Shield size={12} />
              )}
              {agent.consent.granted ? "Consent on" : "Consent off"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-16 flex justify-center text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : !day || day.fixes === 0 ? (
          <p className="p-16 text-center text-xs font-bold text-gray-400">
            No movement recorded for this agent on {date}.
          </p>
        ) : (
          <TirvonaMapView
            markers={markers}
            path={day.route}
            height="420px"
            fitToMarkers
            ariaLabel={`Route travelled by ${agent?.name ?? "the agent"} on ${date}`}
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
              Movement timeline
            </h3>
          </div>
          {!day?.timeline.length ? (
            <p className="p-10 text-center text-xs font-bold text-gray-400">
              Nothing recorded for this day.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto">
              {day.timeline.map((leg, index) => (
                <li
                  key={`${leg.startedAt}-${index}`}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      leg.kind === "stop"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-blue-100 text-[#0A4DA6] dark:bg-blue-950/60 dark:text-blue-300"
                    }`}
                  >
                    {leg.kind === "stop" ? (
                      <MapPin size={14} />
                    ) : (
                      <Navigation size={14} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                      {leg.kind === "stop" ? "Stopped" : "Travelled"}
                      {leg.kind === "move" && leg.km > 0
                        ? ` ${leg.km} km`
                        : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {clock(leg.startedAt)} – {clock(leg.endedAt)} ·{" "}
                      {duration(leg.minutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
              Everyone&apos;s latest position
            </h3>
            <p className="text-[11px] text-gray-400 font-semibold">
              Most recent fix per agent in the last 12 hours.
            </p>
          </div>
          {!live.length ? (
            <p className="p-10 text-center text-xs font-bold text-gray-400">
              No agent has reported a position recently.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto">
              {live.map((row) => (
                <li
                  key={row.agentId}
                  className="px-5 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-900/60"
                  onClick={() => {
                    setAgentId(row.agentId);
                    setDate(row.recordedAt.slice(0, 10));
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white truncate">
                      {row.agentName || "Field agent"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {row.lat.toFixed(5)}, {row.lng.toFixed(5)}
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-gray-400 shrink-0">
                    {row.minutesAgo < 1
                      ? "just now"
                      : `${duration(row.minutesAgo)} ago`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadTrackingPage;
