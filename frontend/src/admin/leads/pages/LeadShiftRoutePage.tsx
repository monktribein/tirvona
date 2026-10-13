import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  MapPinned,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
} from "lucide-react";
import {
  leadCollectionService,
  type ShiftRoute,
  type ShiftRouteAgent,
} from "../../../services/leadCollection.service";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseStatsCard } from "../../shared/components/EnterpriseStatsCard";
import { TirvonaMapView, type MapMarker } from "../../../components/TirvonaMapView";

/** While the agent is on duty the route grows; refresh it this often. */
const LIVE_REFRESH_MS = 30_000;

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

const km = (value: number) => `${value.toFixed(value < 10 ? 2 : 1)} km`;

const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const card =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";

/** One shift (check-in → check-out): the path travelled, where it began and ended, and the distance. */
export const LeadShiftRoutePage: React.FC = () => {
  const { agentId = "", attendanceId = "" } = useParams();
  // Opened from a "Live" button: start zoomed in on where the agent is now.
  const [searchParams] = useSearchParams();
  const [focusNow, setFocusNow] = useState(searchParams.get("live") === "1");
  const [agent, setAgent] = useState<ShiftRouteAgent | null>(null);
  const [shift, setShift] = useState<ShiftRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Length of the path when drawn along the roads (null until Google has routed it). */
  const [roadKm, setRoadKm] = useState<number | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await leadCollectionService.getShiftRoute(agentId, attendanceId);
        setAgent(res.data.data.agent);
        setShift(res.data.data.shift);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, "Could not load this shift's route."));
      } finally {
        setLoading(false);
      }
    },
    [agentId, attendanceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onDuty = Boolean(shift?.onDuty);
  useEffect(() => {
    if (!onDuty) return;
    const timer = window.setInterval(() => void load(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [onDuty, load]);

  const summary = shift?.summary;

  /** Where to centre the map in live mode: the newest position, while on duty. */
  const liveFocus = focusNow && onDuty && summary?.latest ? summary.latest : null;

  /** Check-in, every stop, and check-out (or the live position) get a pin; the fixes form the line. */
  const markers = useMemo<MapMarker[]>(() => {
    if (!shift || !summary) return [];
    const pins: MapMarker[] = [];
    const start =
      shift.checkIn.lat != null && shift.checkIn.lng != null
        ? { lat: shift.checkIn.lat, lng: shift.checkIn.lng }
        : summary.startLocation;
    if (start)
      pins.push({
        id: "start",
        latitude: start.lat,
        longitude: start.lng,
        title: "Checked in · location on",
        subtitle: `${clock(shift.checkIn.at)}${shift.checkIn.address ? ` · ${shift.checkIn.address}` : ""}`,
        badge: "Start",
      });

    summary.visited.forEach((visit, index) =>
      pins.push({
        id: `stop-${index}`,
        latitude: visit.lat,
        longitude: visit.lng,
        title: `Stop ${index + 1}`,
        subtitle: `${clock(visit.arrivedAt)} – ${clock(visit.leftAt)} · ${duration(visit.minutes)}`,
        badge: `Stop ${index + 1}`,
      }),
    );

    const end = shift.checkOut
      ? shift.checkOut.lat != null && shift.checkOut.lng != null
        ? { lat: shift.checkOut.lat, lng: shift.checkOut.lng }
        : summary.endLocation
      : summary.latest
        ? { lat: summary.latest.lat, lng: summary.latest.lng }
        : null;
    if (end)
      pins.push({
        id: "end",
        latitude: end.lat,
        longitude: end.lng,
        title: shift.checkOut ? "Checked out · location off" : "Current position",
        subtitle: shift.checkOut
          ? `${clock(shift.checkOut.at)}${shift.checkOut.address ? ` · ${shift.checkOut.address}` : ""}`
          : `Last update ${clock(summary.latest?.recordedAt ?? null)}`,
        badge: shift.checkOut ? "End" : "Now",
      });

    return pins;
  }, [shift, summary]);

  const pointCell = (
    label: string,
    icon: React.ReactNode,
    at: string | null | undefined,
    lat: number | null | undefined,
    lng: number | null | undefined,
    address: string | undefined,
    fallback: string,
  ) => (
    <div className={`${card} p-4 flex gap-3 min-w-0`}>
      <span className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
        {at ? (
          <>
            <p className="text-sm font-black text-[#0B192C] dark:text-white">{clock(at)}</p>
            {address && <p className="text-[11px] text-gray-500 truncate">{address}</p>}
            {lat != null && lng != null ? (
              <a
                href={mapsLink(lat, lng)}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#F28C28] hover:underline"
              >
                {lat.toFixed(5)}, {lng.toFixed(5)} ↗
              </a>
            ) : (
              <p className="text-[11px] text-gray-400">No GPS fix sent</p>
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-gray-400">{fallback}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 w-full text-left">
      <Link
        to="/admin/lead-collection/agents"
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-500 hover:text-[#F28C28]"
      >
        <ArrowLeft size={14} /> Back to field agents
      </Link>

      <EnterprisePageHeader
        title={`Route Monitoring${agent ? ` — ${agent.name}` : ""}`}
        subtitle={
          shift
            ? `Shift on ${shift.date}${agent?.district ? ` · ${agent.district}` : ""} · location on at check-in, off at check-out`
            : "Path, distance and stops for one check-in → check-out shift."
        }
        icon={<Route size={22} />}
        badgeText={summary ? km(summary.totalKm) : undefined}
        actions={
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />

      {loading && !shift ? (
        <div className={`${card} p-16 flex justify-center text-gray-400`}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : error && !shift ? (
        <div className={`${card} p-10 text-center`}>
          <p className="text-sm font-bold text-rose-600">{error}</p>
          <button onClick={() => void load()} className="mt-3 text-xs font-extrabold text-[#F28C28] hover:underline">
            Try again
          </button>
        </div>
      ) : shift && summary ? (
        <>
          {onDuty ? (
            (() => {
              const latest = summary.latest;
              // A latest point no newer than check-in means the phone has sent nothing since.
              const sentSinceCheckIn =
                latest && new Date(latest.recordedAt).getTime() > new Date(shift.checkIn.at).getTime() + 1000;
              const minutesAgo = latest
                ? Math.max(0, Math.round((Date.now() - new Date(latest.recordedAt).getTime()) / 60_000))
                : null;
              const freshness =
                !sentSinceCheckIn || minutesAgo == null
                  ? { label: "Waiting for the phone", tone: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300" }
                  : minutesAgo <= 5
                    ? { label: "Live", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" }
                    : minutesAgo <= 15
                      ? { label: "A few minutes old", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" }
                      : { label: "Not updating", tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" };

              return (
                <div className={`${card} p-5 border-emerald-200 dark:border-emerald-900/60`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <MapPin size={20} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                            Where {agent?.name ?? "the agent"} is right now
                          </h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${freshness.tone}`}>
                            {freshness.label === "Live" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {freshness.label}
                          </span>
                        </div>
                        {latest ? (
                          <>
                            <p className="mt-1 text-lg font-black text-[#0B192C] dark:text-white">
                              {sentSinceCheckIn
                                ? `Last seen ${clock(latest.recordedAt)} · ${minutesAgo === 0 ? "just now" : `${duration(minutesAgo ?? 0)} ago`}`
                                : `At check-in point · ${clock(shift.checkIn.at)}`}
                            </p>
                            <a
                              href={mapsLink(latest.lat, latest.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-[#F28C28] hover:underline"
                            >
                              {latest.lat.toFixed(5)}, {latest.lng.toFixed(5)} · Open in Google Maps ↗
                            </a>
                          </>
                        ) : (
                          <p className="mt-1 text-sm font-bold text-gray-500">No location received yet.</p>
                        )}
                        {(!sentSinceCheckIn || (minutesAgo ?? 0) > 15) && (
                          <p className="mt-2 text-[11px] text-gray-500 max-w-xl">
                            The agent&apos;s phone is not sending its location. Ask them to keep the Tirvona lead app open
                            with location allowed — positions resume within a minute.
                          </p>
                        )}
                      </div>
                    </div>
                    {latest && summary.route.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFocusNow((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold hover:border-[#F28C28]"
                      >
                        {focusNow ? <Route size={14} /> : <Navigation size={14} />}
                        {focusNow ? "Show whole route" : "Zoom to current position"}
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-[10px] font-semibold text-gray-400">
                    This page refreshes every 30 seconds while the agent is on duty.
                  </p>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 text-[11px] font-black">
                Checked out · location off
              </span>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <EnterpriseStatsCard title="Distance covered" value={km(summary.totalKm)} icon={<Route size={18} />} />
            <EnterpriseStatsCard title="Stops" value={summary.visited.length} icon={<MapPin size={18} />} />
            <EnterpriseStatsCard title="Moving time" value={duration(summary.movingMinutes)} icon={<Navigation size={18} />} />
            <EnterpriseStatsCard title="Shift length" value={duration(shift.shiftMinutes)} icon={<Clock size={18} />} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {pointCell(
              "Started · check-in",
              <LogIn size={16} />,
              shift.checkIn.at,
              shift.checkIn.lat ?? summary.startLocation?.lat,
              shift.checkIn.lng ?? summary.startLocation?.lng,
              shift.checkIn.address,
              "—",
            )}
            {pointCell(
              shift.checkOut ? "Ended · check-out" : "Ends at check-out",
              <LogOut size={16} />,
              shift.checkOut?.at,
              shift.checkOut?.lat ?? summary.endLocation?.lat,
              shift.checkOut?.lng ?? summary.endLocation?.lng,
              shift.checkOut?.address,
              "Still on duty",
            )}
          </div>

          <div className={`${card} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-[#0B192C] dark:text-white">Full path</h3>
                <p className="text-[11px] text-gray-400 font-semibold">
                  {summary.fixes} GPS points · {km(summary.totalKm)} from check-in to{" "}
                  {shift.checkOut ? "check-out" : "now"}
                  {roadKm != null && ` · ≈ ${km(roadKm)} by road`}
                </p>
              </div>
            </div>
            {summary.route.length === 0 ? (
              <div className="p-14 text-center">
                <MapPin className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-500">No GPS points recorded for this shift.</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-md mx-auto">
                  The agent's phone did not send any location. Location permission may have been blocked, or the shift
                  was recorded before route tracking started.
                </p>
              </div>
            ) : (
              <TirvonaMapView
                markers={markers}
                path={summary.route}
                followRoads
                onRoadDistance={setRoadKm}
                height="clamp(320px, 60vh, 560px)"
                fitToMarkers={!liveFocus}
                center={liveFocus ? [liveFocus.lat, liveFocus.lng] : undefined}
                zoom={liveFocus ? 16 : undefined}
                activeMarkerId={liveFocus ? "end" : undefined}
                ariaLabel={`Route travelled by ${agent?.name ?? "the agent"} on ${shift.date}`}
              />
            )}
          </div>

          <div className={`${card} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-[#0B192C] dark:text-white">Movement timeline</h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              <li className="px-5 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <LogIn size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">Checked in · location on</p>
                  <p className="text-[10px] text-gray-400 font-semibold">{clock(shift.checkIn.at)}</p>
                </div>
              </li>
              {summary.timeline.map((leg, index) => (
                <li key={`${leg.startedAt}-${index}`} className="px-5 py-3 flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      leg.kind === "stop"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}
                  >
                    {leg.kind === "stop" ? <MapPin size={14} /> : <Navigation size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                      {leg.kind === "stop" ? "Stopped" : `Travelled ${km(leg.km)}`}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {clock(leg.startedAt)} – {clock(leg.endedAt)} · {duration(leg.minutes)}
                    </p>
                  </div>
                </li>
              ))}
              <li className="px-5 py-3 flex items-center gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    shift.checkOut
                      ? "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {shift.checkOut ? <LogOut size={14} /> : <MapPinned size={14} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                    {shift.checkOut ? "Checked out · location off" : "Still on duty"}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {shift.checkOut ? clock(shift.checkOut.at) : `Last update ${clock(summary.latest?.recordedAt ?? null)}`}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default LeadShiftRoutePage;
