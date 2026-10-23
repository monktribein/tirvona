import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, Download, Search } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Chips, Field, Pager, Panel, PanelState, Pill, ResponsiveTable, inputClass, useRemote } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrAttendanceStatus, HrAttendanceSummaryRow, HrCorrection, HrDirectoryEntry, HrLeave, HrRegisterRow } from "../../services/hr.service";
import {
  ConfirmDrawer,
  HrPage,
  LEAVE_TYPES,
  REGISTER_LABEL,
  RegisterPill,
  SelectField,
  addDaysKey,
  departmentOptions,
  downloadCsv,
  employeeOptions,
  fmtDate,
  fmtDateTime,
  fmtTime,
  istInstant,
  istToday,
  officeOptions,
  useHrAccess,
  useHrLookups,
  weekStart,
} from "./hrUi";

type Tab = "register" | "leave" | "corrections" | "summary";

/** Attendance register, leave approvals, correction requests and summaries. HR attendance permission. */
export const HrAttendancePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "register");
  const { access } = useHrAccess();
  const lookups = useHrLookups();

  const changeTab = (next: string) => {
    setTab(next as Tab);
    setParams({ tab: next }, { replace: true });
  };

  return (
    <HrPage
      title="Attendance"
      subtitle="Check-ins, HR entries, approved leave and corrections, in India time. Attendance only reflects what was recorded; task activity is never used as proof of attendance."
      icon={<CalendarCheck size={20} />}
    >
      <Chips
        value={tab}
        onChange={changeTab}
        options={[
          { value: "register", label: "Daily register" },
          { value: "leave", label: "Leave requests" },
          { value: "corrections", label: "Correction requests" },
          { value: "summary", label: "Weekly / monthly summary" },
        ]}
      />
      {tab === "register" && <RegisterTab params={params} lookups={lookups} />}
      {tab === "leave" && <LeaveTab lookups={lookups} />}
      {tab === "corrections" && <CorrectionsTab />}
      {tab === "summary" && <SummaryTab params={params} lookups={lookups} canExport={!!access && (access.can.reports || access.can.attendance)} />}
    </HrPage>
  );
};

type Lookups = ReturnType<typeof useHrLookups>;

// ---------------------------------------------------------------- register

const RegisterTab: React.FC<{ params: URLSearchParams; lookups: Lookups }> = ({ params, lookups }) => {
  const [date, setDate] = useState(params.get("date") ?? istToday());
  const [officeId, setOfficeId] = useState(params.get("officeId") ?? "");
  const [departmentId, setDepartmentId] = useState(params.get("departmentId") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [marking, setMarking] = useState<HrRegisterRow | null>(null);
  const [recordingLeave, setRecordingLeave] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [date, officeId, departmentId, status, appliedSearch]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const { data, meta, state, error, reload } = useRemote<HrRegisterRow[]>(
    async () => {
      const res = await hrService.register({ date, officeId, departmentId, status, search: appliedSearch, page, limit: 25 });
      setCounts(res.data?.counts ?? {});
      return res;
    },
    [date, officeId, departmentId, status, appliedSearch, page],
  );

  return (
    <Panel
      actions={
        <EnterpriseButton size="sm" variant="outline" onClick={() => setRecordingLeave(true)}>
          Record leave
        </EnterpriseButton>
      }
      title={`Register for ${fmtDate(date)}`}
    >
      <div className="space-y-3">
        <Chips value={officeId} onChange={setOfficeId} options={[{ value: "", label: "All offices" }, ...officeOptions(lookups.offices)]} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} max={istToday()} onChange={(e) => setDate(e.target.value || istToday())} />
          </Field>
          <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(lookups.departments)} />
          <Field label="Search">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or employee ID" />
            </div>
          </Field>
        </div>
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Everyone" },
            ...(["present", "half_day", "absent", "on_leave", "not_marked"] as const).map((s) => ({ value: s, label: `${REGISTER_LABEL[s]} (${counts[s] ?? 0})` })),
          ]}
        />
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <PanelState state="missing" missingText="Nobody matches these filters." />
        ) : (
          <>
            <ResponsiveTable
              rows={data}
              rowKey={(r) => r.employeeId}
              columns={[
                {
                  header: "Employee",
                  cell: (r) => (
                    <div>
                      <p className="font-black">{r.fullName}</p>
                      <p className="text-[10px] text-gray-400">{r.employeeCode} · {r.departmentName ?? "No department"}</p>
                    </div>
                  ),
                },
                { header: "Office", cell: (r) => r.officeName ?? "—", hideOnMobile: true },
                { header: "Status", cell: (r) => <RegisterPill state={r.state} /> },
                { header: "Check-in", cell: (r) => fmtTime(r.attendance?.checkInAt) },
                { header: "Check-out", cell: (r) => fmtTime(r.attendance?.checkOutAt) },
                { header: "Entered by", cell: (r) => (r.attendance ? r.attendance.source === "self" ? "Employee" : r.attendance.source === "hr" ? "HR" : "Correction" : "—"), hideOnMobile: true },
                {
                  header: "Actions",
                  cell: (r) => (
                    <EnterpriseButton size="sm" variant="ghost" onClick={() => setMarking(r)}>
                      {r.attendance ? "Change" : "Mark"}
                    </EnterpriseButton>
                  ),
                },
              ]}
            />
            <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
          </>
        )}
      </div>
      {marking && (
        <MarkDrawer
          row={marking}
          date={date}
          onClose={() => setMarking(null)}
          onSaved={() => {
            setMarking(null);
            reload();
          }}
        />
      )}
      {recordingLeave && (
        <RecordLeaveDrawer
          directory={lookups.directory}
          onClose={() => setRecordingLeave(false)}
          onSaved={() => {
            setRecordingLeave(false);
            reload();
          }}
        />
      )}
    </Panel>
  );
};

const MarkDrawer: React.FC<{ row: HrRegisterRow; date: string; onClose: () => void; onSaved: () => void }> = ({ row, date, onClose, onSaved }) => {
  const toHm = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(11, 16) : "");
  const [status, setStatus] = useState<HrAttendanceStatus>(row.attendance?.status ?? "present");
  const [checkIn, setCheckIn] = useState(toHm(row.attendance?.checkInAt));
  const [checkOut, setCheckOut] = useState(toHm(row.attendance?.checkOutAt));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (reason.trim().length < 3) return setError("Give a reason; it is kept in the audit log.");
    if (checkOut && !checkIn) return setError("Enter the check-in time too.");
    if (checkIn && checkOut && checkOut <= checkIn) return setError("Check-out must be after check-in.");
    setSaving(true);
    try {
      await hrService.markAttendance({
        employeeId: row.employeeId,
        date,
        status,
        checkInAt: status !== "absent" && checkIn ? istInstant(date, checkIn) : undefined,
        checkOutAt: status !== "absent" && checkOut ? istInstant(date, checkOut) : undefined,
        reason: reason.trim(),
      });
      onSaved();
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };

  return (
    <EnterpriseModal
      isOpen
      onClose={saving ? () => undefined : onClose}
      title={`${row.fullName}, ${fmtDate(date)}`}
      subtitle="HR entry. The previous value and your reason are kept in the audit log."
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</EnterpriseButton>
        </div>
      }
    >
      {row.onApprovedLeave && <p className="text-xs text-indigo-700 dark:text-indigo-300">This employee is on approved leave for this date.</p>}
      <SelectField label="Status" value={status} onChange={(v) => setStatus(v as HrAttendanceStatus)} options={[{ value: "present", label: "Present" }, { value: "half_day", label: "Half day" }, { value: "absent", label: "Absent" }]} />
      {status !== "absent" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in (IST)"><input type="time" className={inputClass} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
          <Field label="Check-out (IST)"><input type="time" className={inputClass} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
        </div>
      )}
      <Field label="Reason" required>
        <textarea className={`${inputClass} min-h-[72px]`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </EnterpriseModal>
  );
};

const RecordLeaveDrawer: React.FC<{ directory: HrDirectoryEntry[]; onClose: () => void; onSaved: () => void }> = ({ directory, onClose, onSaved }) => {
  const [employeeId, setEmployeeId] = useState("");
  const [fromDate, setFromDate] = useState(istToday());
  const [toDate, setToDate] = useState(istToday());
  const [type, setType] = useState("casual");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!employeeId) return setError("Choose the employee.");
    if (toDate < fromDate) return setError("The leave cannot end before it starts.");
    if (reason.trim().length < 3) return setError("Give a reason.");
    setSaving(true);
    try {
      await hrService.recordLeave({ employeeId, fromDate, toDate, type, reason: reason.trim() });
      onSaved();
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };
  return (
    <EnterpriseModal
      isOpen
      onClose={saving ? () => undefined : onClose}
      title="Record approved leave"
      subtitle="Leave HR records is approved straight away."
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Record leave"}</EnterpriseButton>
        </div>
      }
    >
      <SelectField label="Employee" required value={employeeId} onChange={setEmployeeId} placeholder="Choose employee" options={employeeOptions(directory)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
      </div>
      <SelectField label="Type" value={type} onChange={setType} options={LEAVE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
      <Field label="Reason" required>
        <textarea className={`${inputClass} min-h-[60px]`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </EnterpriseModal>
  );
};

// ---------------------------------------------------------------- leave

const LeaveTab: React.FC<{ lookups: Lookups }> = ({ lookups }) => {
  const [status, setStatus] = useState("pending");
  const [officeId, setOfficeId] = useState("");
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ leave: HrLeave; decision: "approve" | "reject" } | null>(null);
  useEffect(() => setPage(1), [status, officeId]);
  const { data, meta, state, error, reload } = useRemote<HrLeave[]>(
    () => hrService.leaves({ status, officeId, page, limit: 20 }),
    [status, officeId, page],
  );
  return (
    <Panel>
      <div className="space-y-3">
        <Chips value={officeId} onChange={setOfficeId} options={[{ value: "", label: "All offices" }, ...officeOptions(lookups.offices)]} />
        <Chips
          value={status}
          onChange={setStatus}
          options={[{ value: "pending", label: "Waiting for decision" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "cancelled", label: "Cancelled" }, { value: "", label: "All" }]}
        />
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <PanelState state="missing" missingText="No leave requests here." />
        ) : (
          <>
            <ResponsiveTable
              rows={data}
              rowKey={(l) => l.id}
              columns={[
                { header: "Employee", cell: (l) => <div><p className="font-black">{l.employeeName}</p><p className="text-[10px] text-gray-400">{l.employeeCode}</p></div> },
                { header: "Dates", cell: (l) => `${fmtDate(l.fromDate)} – ${fmtDate(l.toDate)}` },
                { header: "Type", cell: (l) => l.type.charAt(0).toUpperCase() + l.type.slice(1) },
                { header: "Reason", cell: (l) => <span className="text-[11px]">{l.reason}</span>, hideOnMobile: true },
                { header: "Status", cell: (l) => <Pill status={l.status} /> },
                {
                  header: "Actions",
                  cell: (l) =>
                    l.status === "pending" ? (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <EnterpriseButton size="sm" variant="success" onClick={() => setDeciding({ leave: l, decision: "approve" })}>Approve</EnterpriseButton>
                        <EnterpriseButton size="sm" variant="danger" onClick={() => setDeciding({ leave: l, decision: "reject" })}>Reject</EnterpriseButton>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">{l.decidedByName ? `${l.decidedByName}` : "—"}</span>
                    ),
                },
              ]}
            />
            <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
          </>
        )}
      </div>
      {deciding && (
        <ConfirmDrawer
          open
          title={deciding.decision === "approve" ? "Approve leave?" : "Reject leave?"}
          description={`${deciding.leave.employeeName}: ${fmtDate(deciding.leave.fromDate)} – ${fmtDate(deciding.leave.toDate)}. The employee is notified.`}
          confirmLabel={deciding.decision === "approve" ? "Approve" : "Reject"}
          danger={deciding.decision === "reject"}
          reasonLabel="Note to the employee"
          reasonRequired={deciding.decision === "reject"}
          onClose={() => setDeciding(null)}
          onConfirm={async (note) => {
            await hrService.decideLeave(deciding.leave.id, deciding.decision, note || undefined);
            setDeciding(null);
            reload();
          }}
        />
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------- corrections

const CorrectionsTab: React.FC = () => {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ row: HrCorrection; decision: "approve" | "reject" } | null>(null);
  useEffect(() => setPage(1), [status]);
  const { data, meta, state, error, reload } = useRemote<HrCorrection[]>(() => hrService.corrections({ status, page, limit: 20 }), [status, page]);
  const describe = (v: Record<string, any> | null) =>
    v ? `${REGISTER_LABEL[v.status as keyof typeof REGISTER_LABEL] ?? v.status}${v.checkInAt ? ` ${fmtTime(v.checkInAt)}` : ""}${v.checkOutAt ? `–${fmtTime(v.checkOutAt)}` : ""}` : "No record";
  return (
    <Panel>
      <div className="space-y-3">
        <Chips value={status} onChange={setStatus} options={[{ value: "pending", label: "Waiting for decision" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "", label: "All" }]} />
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <PanelState state="missing" missingText="No correction requests here." />
        ) : (
          <>
            <ResponsiveTable
              rows={data}
              rowKey={(c) => c.id}
              columns={[
                { header: "Employee", cell: (c) => <div><p className="font-black">{c.employeeName}</p><p className="text-[10px] text-gray-400">{c.employeeCode}</p></div> },
                { header: "Day", cell: (c) => fmtDate(c.date) },
                { header: "Asked for", cell: (c) => describe({ status: c.requestedStatus, checkInAt: c.requestedCheckInAt, checkOutAt: c.requestedCheckOutAt }) },
                { header: "Reason", cell: (c) => <span className="text-[11px]">{c.reason}</span>, hideOnMobile: true },
                { header: "Status", cell: (c) => <Pill status={c.status} /> },
                {
                  header: "Actions",
                  cell: (c) =>
                    c.status === "pending" ? (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <EnterpriseButton size="sm" variant="success" onClick={() => setDeciding({ row: c, decision: "approve" })}>Approve</EnterpriseButton>
                        <EnterpriseButton size="sm" variant="danger" onClick={() => setDeciding({ row: c, decision: "reject" })}>Reject</EnterpriseButton>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">
                        {c.status === "approved" ? `Was: ${describe(c.before)}` : c.decisionNote || "—"}
                        {c.decidedByName ? ` · ${c.decidedByName}, ${fmtDateTime(c.decidedAt)}` : ""}
                      </span>
                    ),
                },
              ]}
            />
            <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
          </>
        )}
      </div>
      {deciding && (
        <ConfirmDrawer
          open
          title={deciding.decision === "approve" ? "Apply this correction?" : "Reject this correction?"}
          description={
            deciding.decision === "approve"
              ? `${deciding.row.employeeName}'s attendance for ${fmtDate(deciding.row.date)} becomes "${describe({ status: deciding.row.requestedStatus, checkInAt: deciding.row.requestedCheckInAt, checkOutAt: deciding.row.requestedCheckOutAt })}". The old value is kept in the audit log.`
              : `${deciding.row.employeeName}'s attendance for ${fmtDate(deciding.row.date)} stays as it is.`
          }
          confirmLabel={deciding.decision === "approve" ? "Apply correction" : "Reject"}
          danger={deciding.decision === "reject"}
          reasonLabel="Note to the employee"
          reasonRequired={deciding.decision === "reject"}
          onClose={() => setDeciding(null)}
          onConfirm={async (note) => {
            await hrService.decideCorrection(deciding.row.id, deciding.decision, note || undefined);
            setDeciding(null);
            reload();
          }}
        />
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------- summary

const SummaryTab: React.FC<{ params: URLSearchParams; lookups: Lookups; canExport: boolean }> = ({ params, lookups, canExport }) => {
  const today = istToday();
  const [from, setFrom] = useState(weekStart(today));
  const [to, setTo] = useState(today);
  const [officeId, setOfficeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState(params.get("employeeId") ?? "");
  const [rows, setRows] = useState<HrAttendanceSummaryRow[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<number[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    hrService
      .attendanceSummary({ from, to, officeId, departmentId, employeeId })
      .then((res) => {
        if (!live) return;
        setRows(res.data);
        setWeeklyOff(res.weeklyOffDays);
        setState("ready");
      })
      .catch((err) => live && setState(err?.response?.status === 403 ? "forbidden" : "error"));
    return () => {
      live = false;
    };
  }, [from, to, officeId, departmentId, employeeId]);

  const exportCsv = () =>
    downloadCsv(
      `tirvona-attendance-${from}-to-${to}.csv`,
      ["Employee ID", "Name", "Office", "Department", "Working days", "Present", "Half day", "Leave days", "Absent", "Not marked"],
      rows.map((r) => [r.employeeCode, r.fullName, r.officeName ?? "", r.departmentName ?? "", r.workingDays, r.present, r.halfDay, r.leaveDays, r.absent, r.notMarked]),
    );

  return (
    <Panel
      title={`Summary ${fmtDate(from)} – ${fmtDate(to)}`}
      actions={canExport && rows.length > 0 && <EnterpriseButton size="sm" variant="outline" icon={<Download size={13} />} onClick={exportCsv}>Export CSV</EnterpriseButton>}
    >
      <div className="space-y-3">
        <Chips
          value=""
          onChange={(v) => {
            if (v === "week") { setFrom(weekStart(today)); setTo(today); }
            if (v === "lastweek") { setFrom(addDaysKey(weekStart(today), -7)); setTo(addDaysKey(weekStart(today), -1)); }
            if (v === "month") { setFrom(`${today.slice(0, 8)}01`); setTo(today); }
          }}
          options={[{ value: "week", label: "This week" }, { value: "lastweek", label: "Last week" }, { value: "month", label: "This month" }]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="From"><input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} /></Field>
          <Field label="To"><input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value || to)} /></Field>
          <SelectField label="Office" value={officeId} onChange={setOfficeId} placeholder="All offices" options={officeOptions(lookups.offices)} />
          <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(lookups.departments)} />
          <SelectField label="Employee" value={employeeId} onChange={setEmployeeId} placeholder="All employees" options={employeeOptions(lookups.directory)} />
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Working days are days from joining up to today, excluding weekly offs ({weeklyOff.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ") || "none"}).
          "Not marked" means no attendance record and no approved leave on a working day.
        </p>
        {state !== "ready" ? (
          <PanelState state={state} />
        ) : !rows.length ? (
          <PanelState state="missing" missingText="No active employees match these filters." />
        ) : (
          <ResponsiveTable
            rows={rows}
            rowKey={(r) => r.employeeId}
            columns={[
              { header: "Employee", cell: (r) => <div><p className="font-black">{r.fullName}</p><p className="text-[10px] text-gray-400">{r.employeeCode}</p></div> },
              { header: "Working days", cell: (r) => <span className="tabular-nums">{r.workingDays}</span> },
              { header: "Present", cell: (r) => <span className="tabular-nums">{r.present}</span> },
              { header: "Half day", cell: (r) => <span className="tabular-nums">{r.halfDay}</span> },
              { header: "Leave", cell: (r) => <span className="tabular-nums">{r.leaveDays}</span> },
              { header: "Absent", cell: (r) => <span className="tabular-nums">{r.absent}</span> },
              { header: "Not marked", cell: (r) => <span className="tabular-nums">{r.notMarked}</span> },
            ]}
          />
        )}
      </div>
    </Panel>
  );
};

export default HrAttendancePage;
