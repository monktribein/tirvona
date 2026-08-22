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
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { aartiGateService, aartiOwnerService } from "../services/aarti.service";
import type { AartiAccess, AartiSession } from "../types/aarti.types";
import { formatDateTime, toDateInputValue } from "../utils/aartiFormat";

interface ScanResult {
  ok: boolean;
  result: string;
  message: string;
  booking?: {
    bookingReference: string;
    passCount: number;
    checkedInCount?: number;
    sessionName?: string;
    startsAt?: string;
    contactName?: string;
  };
}

interface Roster {
  session: { _id: string; name: string; startTime: string };
  date: string;
  totals: { bookings: number; passes: number; admitted: number };
}

const StatTile: React.FC<{
  label: string;
  value: number;
  tone?: "default" | "success";
}> = ({ label, value, tone = "default" }) => (
  <div
    className={`rounded-2xl border px-3 py-5 text-center ${
      tone === "success"
        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50"
        : "border-orange-200 bg-gray-50/70 dark:border-slate-800 dark:bg-slate-900"
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

export const AartiGatePage: React.FC = () => {
  const [access, setAccess] = useState<AartiAccess | null>(null);
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      aartiGateService.access(),
      aartiOwnerService.listSessions({ status: "approved", limit: 100 }),
    ])
      .then(([accessRes, sessionRes]) => {
        setAccess(accessRes.data?.data ?? null);
        const rows = sessionRes.data?.data ?? [];
        setSessions(rows);
        if (rows.length === 1) setSessionId(rows[0]._id);
      })
      .catch((err) =>
        setError(getErrorMessage(err, "We could not load your gate access.")),
      );
  }, []);

  const loadRoster = useCallback(async () => {
    if (!sessionId || !date) {
      setRoster(null);
      return;
    }
    try {
      const response = await aartiGateService.roster(sessionId, date);
      setRoster(response.data?.data ?? null);
    } catch {
      setRoster(null);
    }
  }, [sessionId, date]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const scan = async (action: "entry" | "verify") => {
    if (!code.trim()) return;
    setScanning(true);
    setResult(null);
    try {
      const isToken = code.includes(".") && code.startsWith("TVNAR1");
      const response = await aartiGateService.scan({
        [isToken ? "token" : "displayCode"]: code.trim(),
        sessionId: sessionId || undefined,
        action,
        deviceInfo: navigator.userAgent.slice(0, 200),
      } as Parameters<typeof aartiGateService.scan>[0]);
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
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Aarti Gate Scanner"
        subtitle="Verify digital passes and admit devotees securely at the selected aarti gate."
        icon={<ScanLine size={22} className="stroke-[2.5]" />}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">

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
            Your account does not have aarti gate access. Ask the ashram owner to
            add you as gate staff.
          </p>
        </div>
      ) : null}

      <section className="space-y-5 rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 dark:border-slate-800 dark:bg-[#0B192C]">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Verify an Aarti pass
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Select the event, then scan its QR code or enter the gate code.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
              Aarti
            </span>
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="cursor-pointer rounded-xl border border-orange-200 bg-gray-50/70 px-4 py-3 text-sm font-semibold text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Any aarti I manage</option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.name}
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
              onChange={(event) => setDate(event.target.value)}
              className="rounded-xl border border-orange-200 bg-gray-50/70 px-4 py-3 text-sm font-semibold text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
            Gate Code or Scanned QR
          </span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void scan("entry");
            }}
            placeholder="ABCD-1234"
            autoFocus
            className="mt-1.5 w-full rounded-2xl border border-orange-200 bg-gray-50/70 px-4 py-4 text-center font-mono text-xl font-black uppercase tracking-[0.2em] text-[#0B192C] transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-300 focus:border-[#0A4DA6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 sm:text-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => scan("verify")}
            disabled={scanning || !canScan || !code.trim()}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#0A4DA6]/25 bg-white px-4 py-3.5 text-sm font-extrabold text-[#0A4DA6] shadow-sm transition-all hover:border-[#0A4DA6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#0B192C] dark:text-blue-300"
          >
            Verify Only
          </button>
          <button
            type="button"
            onClick={() => scan("entry")}
            disabled={scanning || !canScan || !code.trim()}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0A4DA6] px-4 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[#083D85] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scanning ? (
              <Loader2 size={14} className="animate-spin stroke-[2.5]" />
            ) : null}
            Admit Devotees
          </button>
        </div>
      </section>

      {result ? (
        <section
          className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${
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
              {result.booking ? (
                <div className="mt-2 space-y-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  <p className="font-mono tracking-wider text-gray-400">
                    {result.booking.bookingReference}
                  </p>
                  {result.booking.sessionName ? (
                    <p>{result.booking.sessionName}</p>
                  ) : null}
                  {result.booking.startsAt ? (
                    <p>{formatDateTime(result.booking.startsAt)}</p>
                  ) : null}
                  <p className="inline-flex items-center gap-1.5">
                    <Users size={12} className="stroke-[2.5]" />
                    {result.booking.passCount} pass
                    {result.booking.passCount === 1 ? "" : "es"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
        </div>

      {roster ? (
        <section className="space-y-4 rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 xl:sticky xl:top-6 dark:border-slate-800 dark:bg-[#0B192C]">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Gate roster
          </h2>
          <p className="text-xs font-medium leading-relaxed text-slate-400">
            Live attendance totals for the selected Aarti and date.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="BOOKINGS" value={roster.totals.bookings} />
            <StatTile label="PASSES SOLD" value={roster.totals.passes} />
            <StatTile
              label="ADMITTED"
              value={roster.totals.admitted}
              tone="success"
            />
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
};

export default AartiGatePage;
