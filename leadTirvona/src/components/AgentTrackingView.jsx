import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck
} from 'lucide-react';
import RouteMap from './RouteMap';
import { supervisorApi } from '../services/supervisorApi';

/**
 * One agent's movement for one day, for the supervisor.
 *
 * Authorisation is entirely server-side: the supervisor endpoint runs the same
 * `findOneInDistrict` check every other agent-scoped route uses, so a
 * supervisor cannot fetch an agent outside their own district even by editing
 * the id here.
 */
const todayString = () => new Date().toISOString().slice(0, 10);

const minutesLabel = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${total % 60}m` : `${total}m`;
};

const clock = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

export default function AgentTrackingView({ agentId, agentName }) {
  const [date, setDate] = useState(todayString());
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError('');
    try {
      const [day, rows] = await Promise.all([
        supervisorApi.getAgentTracking(agentId, date),
        supervisorApi.getAgentTrackingHistory(agentId)
      ]);
      setData(day);
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setData(null);
      setError(err.message || 'Could not load this agent’s movement.');
    } finally {
      setLoading(false);
    }
  }, [agentId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const day = data?.day ?? null;
  const consent = data?.agent?.consent ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Route size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {agentName || data?.agent?.name || 'Field agent'} · movement
            </h3>
            <p className="text-xs text-slate-500">
              {day?.fixes ? `${day.fixes} GPS points` : 'No points recorded'} on{' '}
              {date}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(event) => setDate(event.target.value || todayString())}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
            aria-label="Tracking date"
          />
          {history.length > 0 && (
            <select
              value=""
              onChange={(event) =>
                event.target.value && setDate(event.target.value)
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
              aria-label="Recent tracked days"
            >
              <option value="">Recent days…</option>
              {history.map((row) => (
                <option key={row.date} value={row.date}>
                  {row.date} · {row.totalKm} km
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {consent && !consent.granted && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          This agent has movement tracking switched off. Anything shown is
          history recorded before it was turned off.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          ['Distance', day ? `${day.totalKm} km` : '—'],
          ['Stops', day ? String(day.visited?.length ?? 0) : '—'],
          ['Moving', day ? minutesLabel(day.movingMinutes) : '—'],
          ['Idle', day ? minutesLabel(day.idleMinutes) : '—'],
          ['First seen', clock(day?.startedAt)],
          ['Last seen', clock(day?.endedAt)]
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] uppercase font-bold text-slate-400">
              {label}
            </p>
            <p className="text-base font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !day || day.fixes === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-xs font-semibold text-slate-400">
          No movement recorded for this agent on {date}.
        </p>
      ) : (
        <>
          <RouteMap route={day.route} stops={day.visited} />

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <p className="border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-900">
              Movement timeline
            </p>
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {day.timeline.map((leg, index) => (
                <li
                  key={`${leg.startedAt}-${index}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      leg.kind === 'stop'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {leg.kind === 'stop' ? (
                      <MapPin size={13} />
                    ) : (
                      <Navigation size={13} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900">
                      {leg.kind === 'stop'
                        ? 'Stopped'
                        : `Travelled${leg.km ? ` ${leg.km} km` : ''}`}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      <Clock size={9} className="inline mr-1" />
                      {clock(leg.startedAt)} – {clock(leg.endedAt)} ·{' '}
                      {minutesLabel(leg.minutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
