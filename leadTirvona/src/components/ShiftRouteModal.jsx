import React, { useCallback, useEffect, useState } from 'react';
import { X, Route, MapPin, Clock, Navigation, LogIn, LogOut, Loader2, RefreshCw } from 'lucide-react';
import { supervisorApi } from '../services/supervisorApi';
import RouteMap from './RouteMap';

const clock = (value) =>
  value
    ? new Date(value).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const duration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${total % 60}m` : `${total}m`;
};

const km = (value) => `${Number(value || 0).toFixed(2)} km`;

/**
 * One shift's route for a supervisor: location goes on at check-in and off at
 * check-out, so the path, start, end and distance all belong to that shift.
 */
export default function ShiftRouteModal({ agentId, agentName, attendanceId, onClose }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await supervisorApi.getShiftRoute(agentId, attendanceId);
      setShift(data?.shift ?? null);
    } catch (err) {
      setError(err.message || 'Could not load this shift’s route.');
    } finally {
      setLoading(false);
    }
  }, [agentId, attendanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A shift still in progress keeps growing; refresh it every minute.
  useEffect(() => {
    if (!shift?.onDuty) return undefined;
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [shift?.onDuty, load]);

  const summary = shift?.summary;

  const point = (label, icon, at, lat, lng, address, fallback) => (
    <div className="flex gap-3 p-3 rounded-2xl border border-[#E2E8F0] bg-white min-w-0">
      <span className="w-8 h-8 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase text-[#64748B]">{label}</p>
        {at ? (
          <>
            <p className="text-sm font-extrabold text-[#0F172A]">{clock(at)}</p>
            {address && <p className="text-[11px] text-[#64748B] truncate">{address}</p>}
            {Number.isFinite(lat) && Number.isFinite(lng) ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#0A4DA6] hover:underline"
              >
                Open in Google Maps ↗
              </a>
            ) : (
              <p className="text-[11px] text-[#94A3B8]">No GPS fix sent</p>
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-[#94A3B8]">{fallback}</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      data-lenis-prevent="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#F8FAFC] rounded-3xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-[#E2E8F0]">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0F172A]">
              <Route size={18} className="text-[#0A4DA6]" /> Route Monitoring
            </h3>
            <p className="text-xs text-[#64748B] truncate">
              {agentName || 'Field agent'}
              {shift ? ` · ${shift.date}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="p-2 rounded-full hover:bg-slate-100 text-[#64748B] disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-[#64748B]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading && !shift ? (
            <div className="py-16 flex justify-center text-[#94A3B8]">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : error && !shift ? (
            <p className="py-10 text-center text-sm font-bold text-rose-600">{error}</p>
          ) : shift && summary ? (
            <>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold ${
                  shift.onDuty ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {shift.onDuty && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {shift.onDuty ? 'On duty · location on' : 'Checked out · location off'}
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Distance', km(summary.totalKm), <Route size={14} key="d" />],
                  ['Stops', summary.visited.length, <MapPin size={14} key="s" />],
                  ['Moving', duration(summary.movingMinutes), <Navigation size={14} key="m" />],
                  ['Shift', duration(shift.shiftMinutes), <Clock size={14} key="c" />]
                ].map(([label, value, icon]) => (
                  <div key={label} className="p-3 rounded-2xl border border-[#E2E8F0] bg-white">
                    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-[#64748B]">
                      {icon} {label}
                    </p>
                    <p className="mt-1 text-lg font-black text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {point(
                  'Started · check-in',
                  <LogIn size={14} />,
                  shift.checkIn.at,
                  shift.checkIn.lat ?? summary.startLocation?.lat,
                  shift.checkIn.lng ?? summary.startLocation?.lng,
                  shift.checkIn.address,
                  '—'
                )}
                {point(
                  shift.checkOut ? 'Ended · check-out' : 'Ends at check-out',
                  <LogOut size={14} />,
                  shift.checkOut?.at,
                  shift.checkOut?.lat ?? summary.endLocation?.lat,
                  shift.checkOut?.lng ?? summary.endLocation?.lng,
                  shift.checkOut?.address,
                  'Still on duty'
                )}
              </div>

              {summary.route.length ? (
                <div className="rounded-2xl overflow-hidden border border-[#E2E8F0]">
                  <RouteMap route={summary.route} stops={summary.visited} height="380px" />
                </div>
              ) : (
                <p className="py-10 text-center text-xs font-bold text-[#94A3B8]">
                  No GPS points were recorded for this shift.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
