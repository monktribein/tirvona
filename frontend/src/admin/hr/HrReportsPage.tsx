import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Download } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Chips, Field, Panel, PanelState, ResponsiveTable, Stat, inputClass } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrTaskReport, HrTaskReportRow } from "../../services/hr.service";
import { HrPage, SelectField, addDaysKey, departmentOptions, downloadCsv, fmtDate, istToday, officeOptions, useHrLookups, weekStart } from "./hrUi";

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const hours = (h: number | null) => (h === null ? "—" : h < 48 ? `${h} h` : `${Math.round((h / 24) * 10) / 10} days`);
const mix = (r: HrTaskReportRow) => `U ${r.completedByPriority.urgent} · H ${r.completedByPriority.high} · M ${r.completedByPriority.medium} · L ${r.completedByPriority.low}`;

/**
 * Task performance and attendance reports. Shows several plain measures side by side
 * (completion with its priority mix, on-time and first-pass review rates) instead of a single
 * productivity score.
 */
export const HrReportsPage: React.FC = () => {
  const today = istToday();
  const lookups = useHrLookups({ directory: false });
  const [from, setFrom] = useState(weekStart(today));
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<"employee" | "office" | "department">("employee");
  const [officeId, setOfficeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [report, setReport] = useState<HrTaskReport | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    hrService
      .taskReport({ from, to, groupBy, officeId, departmentId })
      .then((r) => {
        if (!live) return;
        setReport(r);
        setState("ready");
      })
      .catch((err) => live && setState(err?.response?.status === 403 ? "forbidden" : "error"));
    return () => {
      live = false;
    };
  }, [from, to, groupBy, officeId, departmentId]);

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(
      `tirvona-task-report-${groupBy}-${from}-to-${to}.csv`,
      [
        groupBy === "employee" ? "Employee" : groupBy === "office" ? "Office" : "Department",
        ...(groupBy === "employee" ? ["Employee ID"] : []),
        "Assigned", "Completed", "Completed urgent", "Completed high", "Completed medium", "Completed low",
        "Completed on time", "First-pass approved", "Times sent back", "Open", "Overdue", "Blocked", "Waiting for review", "Cancelled", "Avg hours to submit",
      ],
      report.data.map((r) => [
        r.label,
        ...(groupBy === "employee" ? [r.employeeCode ?? ""] : []),
        r.assigned, r.completed, r.completedByPriority.urgent, r.completedByPriority.high, r.completedByPriority.medium, r.completedByPriority.low,
        r.completedOnTime, r.firstPassApproved, r.rejections, r.open, r.overdue, r.blocked, r.pendingReview, r.cancelled, r.avgCompletionHours ?? "",
      ]),
    );
  };

  const t = report?.totals;
  return (
    <HrPage
      title="Reports & Performance"
      subtitle="Work and attendance by employee, office or department. Counts alone do not measure productivity: read completion together with priority, timeliness and review outcomes."
      icon={<BarChart3 size={20} />}
      actions={
        report && report.data.length > 0 && (
          <EnterpriseButton size="sm" variant="outline" icon={<Download size={13} />} onClick={exportCsv}>Export CSV</EnterpriseButton>
        )
      }
    >
      <Panel>
        <div className="space-y-3">
          <Chips
            value=""
            onChange={(v) => {
              if (v === "today") { setFrom(today); setTo(today); }
              if (v === "week") { setFrom(weekStart(today)); setTo(today); }
              if (v === "lastweek") { setFrom(addDaysKey(weekStart(today), -7)); setTo(addDaysKey(weekStart(today), -1)); }
              if (v === "month") { setFrom(`${today.slice(0, 8)}01`); setTo(today); }
            }}
            options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "lastweek", label: "Last week" }, { value: "month", label: "This month" }]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="From (task date)"><input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} /></Field>
            <Field label="To"><input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value || to)} /></Field>
            <SelectField label="Office" value={officeId} onChange={setOfficeId} placeholder="All offices" options={officeOptions(lookups.offices)} />
            <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(lookups.departments)} />
          </div>
          <Chips
            value={groupBy}
            onChange={(v) => setGroupBy(v as typeof groupBy)}
            options={[{ value: "employee", label: "By employee" }, { value: "office", label: "By office" }, { value: "department", label: "By department" }]}
          />
        </div>
      </Panel>

      {state !== "ready" || !report || !t ? (
        <Panel><PanelState state={state} /></Panel>
      ) : (
        <>
          {report.truncated && <p className="text-xs font-bold text-amber-700">This range has more tasks than one report reads; narrow the dates for exact numbers.</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Tasks in range" value={t.assigned} hint={`${fmtDate(from)} – ${fmtDate(to)}`} to={`/admin/hr/tasks?from=${from}&to=${to}`} />
            <Stat label="Completed" value={t.completed} hint={`${pct(t.completedOnTime, t.completed)} on time · ${pct(t.firstPassApproved, t.completed)} first-pass`} tone="ok" />
            <Stat label="Overdue now" value={t.overdue} tone={t.overdue ? "warn" : undefined} to="/admin/hr/tasks?overdue=1" />
            <Stat label="Blocked now" value={t.blocked} tone={t.blocked ? "warn" : undefined} to="/admin/hr/tasks?status=blocked" />
          </div>

          <Panel title={`Task completion ${groupBy === "employee" ? "by employee" : groupBy === "office" ? "by office" : "by department"}`}>
            {!report.data.length ? (
              <PanelState state="missing" missingText="No tasks in this range." />
            ) : (
              <ResponsiveTable
                rows={report.data}
                rowKey={(r) => r.key}
                columns={[
                  { header: groupBy === "employee" ? "Employee" : groupBy === "office" ? "Office" : "Department", cell: (r) => <div><p className="font-black">{r.label}</p>{r.employeeCode && <p className="text-[10px] text-gray-400">{r.employeeCode}</p>}</div> },
                  { header: "Assigned", cell: (r) => <span className="tabular-nums">{r.assigned}</span> },
                  { header: "Completed", cell: (r) => <div><span className="tabular-nums font-black">{r.completed}</span><p className="text-[10px] text-gray-400">{mix(r)}</p></div> },
                  { header: "On time", cell: (r) => pct(r.completedOnTime, r.completed) },
                  { header: "First-pass", cell: (r) => pct(r.firstPassApproved, r.completed), hideOnMobile: true },
                  { header: "Open / overdue", cell: (r) => <span className="tabular-nums">{r.open} / <span className={r.overdue ? "text-rose-600 font-black" : ""}>{r.overdue}</span></span> },
                  { header: "Blocked", cell: (r) => <span className="tabular-nums">{r.blocked}</span>, hideOnMobile: true },
                  { header: "In review", cell: (r) => <span className="tabular-nums">{r.pendingReview}</span>, hideOnMobile: true },
                  { header: "Avg time to submit", cell: (r) => hours(r.avgCompletionHours), hideOnMobile: true },
                ]}
              />
            )}
          </Panel>

          <Panel title="How these numbers are calculated">
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <li>Tasks are included by their task date (the day the work was assigned for), in India time.</li>
              <li><b>Completed</b>: a reviewer approved the work. Nothing is completed automatically, not even after its deadline. U/H/M/L shows how many were urgent, high, medium and low priority.</li>
              <li><b>On time</b>: of the completed tasks, the share whose final submission came in by the due time.</li>
              <li><b>First-pass</b>: of the completed tasks, the share approved without being sent back.</li>
              <li><b>Overdue</b>: still assigned, in progress or blocked after the due time. Work waiting for review is not overdue.</li>
              <li><b>Avg time to submit</b>: average time from the task being assigned to the employee's final submission, over completed tasks. Reviewer waiting time is not counted.</li>
              <li>A reassigned task counts for the employee who has it now. Attendance totals are in <Link className="font-black text-[#F28C28]" to="/admin/hr/attendance?tab=summary">Attendance → Weekly / monthly summary</Link>.</li>
            </ul>
          </Panel>
        </>
      )}
    </HrPage>
  );
};

export default HrReportsPage;
