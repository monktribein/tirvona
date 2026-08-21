import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ScanLine,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { eventGateService, eventOwnerService } from "../services/event.service";
import type { EventAccess, EventFestival } from "../types/event.types";
import { formatDateTime, toDateInputValue } from "../utils/eventFormat";

interface ScanResult {
  ok: boolean;
  result: string;
  message: string;
  registration?: {
    registrationReference: string;
    seats: number;
    checkedInCount?: number;
    eventName?: string;
    startsAt?: string;
  };
}

interface Roster {
  event: { _id: string; name: string; startTime: string };
  date: string;
  totals: { registrations: number; seats: number; admitted: number };
}

const StatTile: React.FC<{
  label: string;
  value: number;
  tone?: "default" | "success";
}> = ({ label, value, tone = "default" }) => (
  <div
    className={`rounded-2xl px-3 py-4 text-center border ${
      tone === "success"
        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50"
        : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800"
    }`}
  >
    <p
      className={`text-2xl font-black ${
        tone === "success"
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-[#0B192C] dark:text-white"
      }`}
    >
      {value}
    </p>
    <p className="text-[10px] tracking-wider font-bold text-gray-400 mt-0.5">
      {label}
    </p>
  </div>
);

export const EventGatePage: React.FC = () => {
  const [access, setAccess] = useState<EventAccess | null>(null);
  const [events, setEvents] = useState<EventFestival[]>([]);
  const [eventId, setEventId] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      eventGateService.access(),
      eventOwnerService.listEvents({ status: "approved", limit: 100 }),
    ])
      .then(([accessRes, eventRes]) => {
        setAccess(accessRes.data?.data ?? null);
        const rows = eventRes.data?.data ?? [];
        setEvents(rows);
        if (rows.length === 1) setEventId(rows[0]._id);
      })
      .catch((err) =>
        setError(getErrorMessage(err, "We could not load your gate access.")),
      );
  }, []);

  const loadRoster = useCallback(async () => {
    if (!eventId || !date) {
      setRoster(null);
      return;
    }
    try {
      const response = await eventGateService.roster(eventId, date);
      setRoster(response.data?.data ?? null);
    } catch {
      setRoster(null);
    }
  }, [eventId, date]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const scan = async (action: "entry" | "verify") => {
    if (!code.trim()) return;
    setScanning(true);
    setResult(null);
    try {
      const isToken = code.includes(".") && code.startsWith("TVNEV1");
      const response = await eventGateService.scan({
        [isToken ? "token" : "displayCode"]: code.trim(),
        eventId: eventId || undefined,
        action,
        deviceInfo: navigator.userAgent.slice(0, 200),
      } as Parameters<typeof eventGateService.scan>[0]);
      setResult(response.data as ScanResult);
      if (response.data?.ok && action === "entry") {
        setCode("");
        await loadRoster();
      }
    } catch (err) {
      setResult({
        ok: false,
        result: "error",
        message: getErrorMessage(err, "The scan could not be completed."),
      });
    } finally {
      setScanning(false);
    }
  };

  const canScan = access?.capabilities.includes("scan_qr");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-5">
      <div>
        <h1 className="inline-flex items-center gap-2 font-extrabold text-xl sm:text-2xl text-[#0B192C] dark:text-white">
          <ScanLine size={22} className="text-[#0A4DA6] stroke-[2.5]" />
          Event Gate
        </h1>
        <p className="mt-1 text-xs font-medium text-gray-400">
          Scan the attendee&apos;s QR or type the 8-character gate code.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      ) : null}

      {access && !canScan ? (
        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl px-4 py-3">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
          <p className="text-xs font-semibold">
            Your account does not have event gate access. Ask the ashram owner to
            add you as gate staff.
          </p>
        </div>
      ) : null}

      <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
              Event
            </span>
            <select
              value={eventId}
              onChange={(changeEvent) => setEventId(changeEvent.target.value)}
              className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer"
            >
              <option value="">Any event I manage</option>
              {events.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(changeEvent) => setDate(changeEvent.target.value)}
              className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
            Gate Code or Scanned QR
          </span>
          <input
            value={code}
            onChange={(changeEvent) => setCode(changeEvent.target.value)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter") void scan("entry");
            }}
            placeholder="ABCD-1234"
            autoFocus
            className="mt-1.5 w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-center font-mono text-xl font-black uppercase tracking-[0.2em] text-[#0B192C] dark:text-white placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => scan("verify")}
            disabled={scanning || !canScan || !code.trim()}
            className="inline-flex items-center justify-center gap-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-4 py-3 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verify Only
          </button>
          <button
            type="button"
            onClick={() => scan("entry")}
            disabled={scanning || !canScan || !code.trim()}
            className="inline-flex items-center justify-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <Loader2 size={14} className="animate-spin stroke-[2.5]" />
            ) : null}
            Admit Attendees
          </button>
        </div>
      </section>

      {result ? (
        <section
          className={`rounded-[24px] border p-5 shadow-sm ${
            result.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.ok ? (
              <CheckCircle2
                size={24}
                className="shrink-0 text-emerald-600 stroke-[2.5]"
              />
            ) : (
              <XCircle size={24} className="shrink-0 text-rose-600 stroke-[2.5]" />
            )}
            <div className="min-w-0">
              <p
                className={`font-extrabold text-sm ${
                  result.ok
                    ? "text-emerald-800 dark:text-emerald-300"
                    : "text-rose-800 dark:text-rose-300"
                }`}
              >
                {result.message}
              </p>
              {result.registration ? (
                <div className="mt-2 space-y-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  <p className="font-mono tracking-wider text-gray-400">
                    {result.registration.registrationReference}
                  </p>
                  {result.registration.eventName ? (
                    <p>{result.registration.eventName}</p>
                  ) : null}
                  {result.registration.startsAt ? (
                    <p>{formatDateTime(result.registration.startsAt)}</p>
                  ) : null}
                  <p className="inline-flex items-center gap-1.5">
                    <Users size={12} className="stroke-[2.5]" />
                    {result.registration.seats} place
                    {result.registration.seats === 1 ? "" : "s"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {roster ? (
        <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-3">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Today&apos;s roster
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="REGISTRATIONS" value={roster.totals.registrations} />
            <StatTile label="PLACES" value={roster.totals.seats} />
            <StatTile
              label="ADMITTED"
              value={roster.totals.admitted}
              tone="success"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default EventGatePage;
