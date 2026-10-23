import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckSquare, LogIn, LogOut } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Chips, Field, Pager, Panel, PanelState, Pill, ResponsiveTable, Stat, inputClass, useRemote } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrAttendanceDay, HrAttendanceStatus, HrCorrection, HrLeave, HrOffice, HrTask } from "../../services/hr.service";
import { HrTaskDrawer } from "./HrTaskDrawer";
import {
  ConfirmDrawer,
  HrPage,
  LEAVE_TYPES,
  PriorityPill,
  REGISTER_LABEL,
  SelectField,
  TaskStatusPill,
  addDaysKey,
  fmtDate,
  fmtDateTime,
  fmtTime,
  istInstant,
  istToday,
  useHrAccess,
  useHrLookups,
} from "./hrUi";

/**
 * The signed-in employee's own work: today's tasks and updates, check-in / check-out, leave and
 * attendance corrections. Everything is read from the caller's own linked employee profile.
 */
export const HrMyWorkPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { access, loading } = useHrAccess();
  const [tab, setTab] = useState(params.get("tab") === "attendance" ? "attendance" : "tasks");

  if (loading) return <HrPage title="My Work" icon={<CheckSquare size={20} />}><Panel><PanelState state="loading" /></Panel></HrPage>;
  if (!access?.employee)
    return (
      <HrPage title="My Work" icon={<CheckSquare size={20} />}>
        <Panel>
          <PanelState state="missing" missingText="Your login is not linked to an employee profile. Ask HR to link it to see your tasks and attendance here." />
        </Panel>
      </HrPage>
    );

  return (
    <HrPage
      title="My Work"
      subtitle={`${access.employee.fullName} · ${access.employee.employeeCode}. Your tasks, attendance and leave.`}
      icon={<CheckSquare size={20} />}
    >
      <Chips
        value={tab}
        onChange={(v) => {
          setTab(v);
          setParams({ tab: v }, { replace: true });
        }}
        options={[{ value: "tasks", label: "My tasks" }, { value: "attendance", label: "Attendance & leave" }]}
      />
      {tab === "tasks" ? <MyTasks initialTask={params.get("task")} /> : <MyAttendance officeIds={[access.employee.primaryOfficeId, ...access.employee.officeIds].filter(Boolean) as string[]} primaryOfficeId={access.employee.primaryOfficeId} />}
    </HrPage>
  );
};

const MyTasks: React.FC<{ initialTask: string | null }> = ({ initialTask }) => {
  const [view, setView] = useState<"today" | "open" | "history">("today");
  const [page, setPage] = useState(1);
  const [openTask, setOpenTask] = useState<string | null>(initialTask);
  useEffect(() => setPage(1), [view]);
  const { data, meta, state, error, reload } = useRemote<HrTask[]>(() => hrService.myTasks({ view, page, limit: 20 }), [view, page]);
  return (
    <Panel>
      <div className="space-y-3">
        <Chips
          value={view}
          onChange={(v) => setView(v as typeof view)}
          options={[{ value: "today", label: "Today's tasks" }, { value: "open", label: "All open work" }, { value: "history", label: "Completed & cancelled" }]}
        />
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <PanelState state="missing" missingText={view === "today" ? "Nothing is assigned to you for today." : view === "open" ? "You have no open tasks." : "No finished tasks yet."} />
        ) : (
          <>
            <ResponsiveTable
              rows={data}
              rowKey={(t) => t.id}
              onRowClick={(t) => setOpenTask(t.id)}
              columns={[
                { header: "Task", cell: (t) => <div className="min-w-0 max-w-xs"><p className="font-black truncate">{t.title}</p><p className="text-[10px] text-gray-400">{t.taskNumber} · from {t.createdByName || "—"}</p></div> },
                { header: "Due", cell: (t) => <span className={t.overdue ? "font-black text-rose-600" : ""}>{fmtDateTime(t.dueAt)}</span> },
                { header: "Priority", cell: (t) => <PriorityPill priority={t.priority} /> },
                { header: "Status", cell: (t) => <TaskStatusPill status={t.status} overdue={t.overdue} /> },
                { header: "Progress", cell: (t) => <span className="tabular-nums">{t.progressPercent}%</span>, hideOnMobile: true },
              ]}
            />
            <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
          </>
        )}
      </div>
      {openTask && <HrTaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={reload} />}
    </Panel>
  );
};

const MyAttendance: React.FC<{ officeIds: string[]; primaryOfficeId: string | null }> = ({ officeIds, primaryOfficeId }) => {
  const { offices } = useHrLookups({ directory: false });
  const myOffices = offices.filter((o: HrOffice) => officeIds.includes(o.id));
  const [today, setToday] = useState<{ date: string; attendance: HrAttendanceDay | null; onLeave: boolean } | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof hrService.myAttendance>> | null>(null);
  const [leaves, setLeaves] = useState<HrLeave[]>([]);
  const [corrections, setCorrections] = useState<HrCorrection[]>([]);
  const [officeId, setOfficeId] = useState(primaryOfficeId ?? "");
  const [busy, setBusy] = useState(false);
  const [cancelLeave, setCancelLeave] = useState<HrLeave | null>(null);

  const load = useCallback(async () => {
    const [t, h, l, c] = await Promise.all([
      hrService.myToday().catch(() => null),
      hrService.myAttendance().catch(() => null),
      hrService.myLeaves().catch(() => [] as HrLeave[]),
      hrService.myCorrections().catch(() => [] as HrCorrection[]),
    ]);
    setToday(t);
    setHistory(h);
    setLeaves(l ?? []);
    setCorrections(c ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch {
      // shown by the API layer
    } finally {
      setBusy(false);
    }
  };

  const a = today?.attendance;
  return (
    <div className="space-y-5">
      <Panel title={`Today, ${fmtDate(today?.date ?? istToday())}`}>
        {!today ? (
          <PanelState state="loading" />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {today.onLeave && "You are on approved leave today. "}
              {a
                ? `${REGISTER_LABEL[a.status]}${a.checkInAt ? ` · checked in ${fmtTime(a.checkInAt)}` : ""}${a.checkOutAt ? ` · checked out ${fmtTime(a.checkOutAt)}` : ""}${a.source === "hr" ? " (entered by HR)" : ""}`
                : "You have not checked in yet."}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              {!a && myOffices.length > 1 && (
                <SelectField label="Office" value={officeId} onChange={setOfficeId} options={myOffices.map((o) => ({ value: o.id, label: o.name }))} />
              )}
              {!a && (
                <EnterpriseButton icon={<LogIn size={14} />} disabled={busy} onClick={() => act(() => hrService.checkIn(officeId || undefined))}>
                  Check in
                </EnterpriseButton>
              )}
              {a?.checkInAt && !a.checkOutAt && (
                <EnterpriseButton variant="outline" icon={<LogOut size={14} />} disabled={busy} onClick={() => act(() => hrService.checkOut())}>
                  Check out
                </EnterpriseButton>
              )}
            </div>
            <p className="text-[10px] text-gray-400">Only the time you press the button is recorded. No location is collected.</p>
          </div>
        )}
      </Panel>

      {history && (
        <Panel title={`Last 30 days (${fmtDate(history.from)} – ${fmtDate(history.to)})`}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Stat label="Present" value={history.summary.present} />
            <Stat label="Half day" value={history.summary.halfDay} />
            <Stat label="Leave days" value={history.summary.leaveDays} />
            <Stat label="Absent" value={history.summary.absent} />
            <Stat label="Not marked" value={history.summary.notMarked} hint={`of ${history.summary.workingDays} working days`} />
          </div>
          {history.days.length === 0 ? (
            <PanelState state="missing" missingText="No attendance recorded in this period." />
          ) : (
            <ResponsiveTable
              rows={history.days}
              rowKey={(d) => d.id}
              columns={[
                { header: "Day", cell: (d) => fmtDate(d.date) },
                { header: "Status", cell: (d) => REGISTER_LABEL[d.status] },
                { header: "In", cell: (d) => fmtTime(d.checkInAt) },
                { header: "Out", cell: (d) => fmtTime(d.checkOutAt) },
                { header: "Entered by", cell: (d) => (d.source === "self" ? "You" : d.source === "hr" ? "HR" : "Correction"), hideOnMobile: true },
              ]}
            />
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Leave">
          <LeaveRequestForm onSaved={load} />
          <div className="mt-4">
            {leaves.length === 0 ? (
              <p className="text-xs text-gray-400">No leave requests yet.</p>
            ) : (
              <ResponsiveTable
                rows={leaves}
                rowKey={(l) => l.id}
                columns={[
                  { header: "Dates", cell: (l) => `${fmtDate(l.fromDate)} – ${fmtDate(l.toDate)}` },
                  { header: "Type", cell: (l) => l.type.charAt(0).toUpperCase() + l.type.slice(1) },
                  { header: "Status", cell: (l) => <div><Pill status={l.status} />{l.decisionNote && <p className="text-[10px] text-gray-400 mt-0.5">{l.decisionNote}</p>}</div> },
                  {
                    header: "Actions",
                    cell: (l) => (l.status === "pending" ? <EnterpriseButton size="sm" variant="ghost" onClick={() => setCancelLeave(l)}>Cancel</EnterpriseButton> : null),
                  },
                ]}
              />
            )}
          </div>
        </Panel>

        <Panel title="Attendance corrections">
          <CorrectionRequestForm onSaved={load} />
          <div className="mt-4">
            {corrections.length === 0 ? (
              <p className="text-xs text-gray-400">No correction requests yet.</p>
            ) : (
              <ResponsiveTable
                rows={corrections}
                rowKey={(c) => c.id}
                columns={[
                  { header: "Day", cell: (c) => fmtDate(c.date) },
                  { header: "Asked for", cell: (c) => `${REGISTER_LABEL[c.requestedStatus]}${c.requestedCheckInAt ? ` ${fmtTime(c.requestedCheckInAt)}` : ""}${c.requestedCheckOutAt ? `–${fmtTime(c.requestedCheckOutAt)}` : ""}` },
                  { header: "Status", cell: (c) => <div><Pill status={c.status} />{c.decisionNote && <p className="text-[10px] text-gray-400 mt-0.5">{c.decisionNote}</p>}</div> },
                ]}
              />
            )}
          </div>
        </Panel>
      </div>

      {cancelLeave && (
        <ConfirmDrawer
          open
          title="Cancel this leave request?"
          description={`${fmtDate(cancelLeave.fromDate)} – ${fmtDate(cancelLeave.toDate)}`}
          confirmLabel="Cancel request"
          danger
          onClose={() => setCancelLeave(null)}
          onConfirm={async () => {
            await hrService.cancelMyLeave(cancelLeave.id);
            setCancelLeave(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

const LeaveRequestForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [fromDate, setFromDate] = useState(istToday());
  const [toDate, setToDate] = useState(istToday());
  const [type, setType] = useState("casual");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (toDate < fromDate) return setError("The leave cannot end before it starts.");
    if (reason.trim().length < 3) return setError("Give a short reason.");
    setError("");
    setSaving(true);
    try {
      await hrService.requestLeave({ fromDate, toDate, type, reason: reason.trim() });
      setReason("");
      onSaved();
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="From"><input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputClass} value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} /></Field>
        <SelectField label="Type" value={type} onChange={setType} options={LEAVE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
      </div>
      <Field label="Reason" required>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
      <EnterpriseButton size="sm" onClick={submit} disabled={saving}>{saving ? "Sending…" : "Request leave"}</EnterpriseButton>
    </div>
  );
};

const CorrectionRequestForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [date, setDate] = useState(addDaysKey(istToday(), -1));
  const [status, setStatus] = useState<HrAttendanceStatus>("present");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 5) return setError("Explain what should be corrected (at least 5 characters).");
    if (checkOut && !checkIn) return setError("Enter the check-in time too.");
    if (checkIn && checkOut && checkOut <= checkIn) return setError("Check-out must be after check-in.");
    setError("");
    setSaving(true);
    try {
      await hrService.requestCorrection({
        date,
        requestedStatus: status,
        requestedCheckInAt: status !== "absent" && checkIn ? istInstant(date, checkIn) : undefined,
        requestedCheckOutAt: status !== "absent" && checkOut ? istInstant(date, checkOut) : undefined,
        reason: reason.trim(),
      });
      setReason("");
      onSaved();
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Day"><input type="date" className={inputClass} value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} /></Field>
        <SelectField label="Should be" value={status} onChange={(v) => setStatus(v as HrAttendanceStatus)} options={[{ value: "present", label: "Present" }, { value: "half_day", label: "Half day" }, { value: "absent", label: "Absent" }]} />
      </div>
      {status !== "absent" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in (IST)"><input type="time" className={inputClass} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
          <Field label="Check-out (IST)"><input type="time" className={inputClass} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
        </div>
      )}
      <Field label="Reason" required>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
      <EnterpriseButton size="sm" onClick={submit} disabled={saving}>{saving ? "Sending…" : "Ask HR to correct"}</EnterpriseButton>
    </div>
  );
};

export default HrMyWorkPage;
