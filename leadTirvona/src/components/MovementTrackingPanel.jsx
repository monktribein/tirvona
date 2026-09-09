import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  UploadCloud
} from 'lucide-react';
import { useMovementTracker } from '../hooks/useMovementTracker';
import { leadApi } from '../services/leadApi';

/**
 * The agent's own view of movement tracking: the consent switch, what is being
 * recorded, and today's totals. Consent is theirs to give and to withdraw, so
 * the switch is the first thing on the panel and its state is never implied.
 */
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

export default function MovementTrackingPanel() {
  const { consent, tracking, error, pending, lastFixAt, updateConsent, flush } =
    useMovementTracker();

  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const granted = Boolean(consent?.granted);

  useEffect(() => {
    if (!granted) {
      setToday(null);
      return;
    }
    let alive = true;
    setLoading(true);
    leadApi
      .myTrackingToday()
      .then((data) => alive && setToday(data))
      .catch(() => alive && setToday(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [granted, lastFixAt]);

  const toggle = async () => {
    setSaving(true);
    try {
      await updateConsent(!granted);
    } catch {
      // The hook surfaces the message; nothing further to do here.
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Route size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Movement tracking
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              With your permission, your route is recorded while you are
              working so your supervisor can see the ground covered. You can
              switch it off at any time.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={granted}
          className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
            granted
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ShieldCheck size={14} />
          )}
          {granted ? 'Tracking on' : 'Tracking off'}
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {!granted ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Nothing is being recorded. Turning this on starts capturing your
          location roughly once a minute while the app is open.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                tracking
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Navigation size={12} />
              {tracking ? 'Recording' : 'Waiting for GPS'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              <Clock size={12} />
              Last point {lastFixAt ? clock(lastFixAt) : '—'}
            </span>
            {pending > 0 && (
              <button
                type="button"
                onClick={() => void flush()}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 hover:bg-blue-100"
              >
                <UploadCloud size={12} />
                {pending} waiting to upload
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Distance', today ? `${today.totalKm} km` : '—'],
              ['Stops', today ? String(today.visited?.length ?? 0) : '—'],
              ['Moving', today ? minutesLabel(today.movingMinutes) : '—'],
              ['Idle', today ? minutesLabel(today.idleMinutes) : '—']
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  {label}
                </p>
                <p className="text-base font-bold text-slate-900">
                  {loading ? '…' : value}
                </p>
              </div>
            ))}
          </div>

          {today?.visited?.length > 0 && (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {today.visited.map((visit, index) => (
                <li
                  key={`${visit.arrivedAt}-${index}`}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <MapPin size={12} className="text-blue-600 shrink-0" />
                  Stopped {minutesLabel(visit.minutes)} from{' '}
                  {clock(visit.arrivedAt)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
