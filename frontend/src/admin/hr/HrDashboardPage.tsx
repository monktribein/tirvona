import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Briefcase, RefreshCw } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Chips, Field, Panel, PanelState, Stat, inputClass, useRemote } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrDashboard } from "../../services/hr.service";
import {
  HrPage,
  SelectField,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  departmentOptions,
  employeeOptions,
  istToday,
  useHrAccess,
  useHrLookups,
} from "./hrUi";

/** Refresh the numbers every minute while the page is open. */
const REFRESH_MS = 60_000;

const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};

/** HR at a glance: people, attendance and today's work, per office or across both. */
export const HrDashboardPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { access } = useHrAccess();
  const { offices, departments, directory } = useHrLookups();
  const [date, setDate] = useState(params.get("date") ?? istToday());
  const [officeId, setOfficeId] = useState(params.get("officeId") ?? "");
  const [departmentId, setDepartmentId] = useState(params.get("departmentId") ?? "");
  const [employeeId, setEmployeeId] = useState(params.get("employeeId") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  useEffect(() => {
    setParams(Object.fromEntries(Object.entries({ date, officeId, departmentId, employeeId, status }).filter(([, v]) => v)), { replace: true });
  }, [date, officeId, departmentId, employeeId, status, setParams]);

  const { data, state, error, reload } = useRemote<HrDashboard>(
    () => hrService.dashboard({ date, officeId, departmentId, employeeId, status }),
    [date, officeId, departmentId, employeeId, status],
  );

  useEffect(() => {
    const timer = window.setInterval(reload, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const scope = { officeId: officeId || undefined, departmentId: departmentId || undefined, employeeId: employeeId || undefined };
  const activeOffices = useMemo(() => offices.filter((o) => o.active), [offices]);

  return (
    <HrPage
      title="HR Dashboard"
      subtitle="Employees, attendance and daily work across Tirvona's offices. Numbers come straight from HR records and refresh every minute."
      icon={<Briefcase size={20} />}
      actions={
        <EnterpriseButton variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={reload}>
          Refresh
        </EnterpriseButton>
      }
    >
      {access?.can.employees && offices.length === 0 && (
        <Panel>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            No offices are set up yet. <Link className="font-black text-[#F28C28]" to="/admin/hr/settings">Add Tirvona's offices</Link> before adding employees.
          </p>
        </Panel>
      )}

      <Panel>
        <div className="space-y-3">
          <Chips
            value={officeId}
            onChange={setOfficeId}
            options={[{ value: "", label: "All offices" }, ...activeOffices.map((o) => ({ value: o.id, label: o.name }))]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Date">
              <input type="date" className={inputClass} value={date} max={istToday()} onChange={(e) => setDate(e.target.value || istToday())} />
            </Field>
            <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(departments)} />
            <SelectField label="Employee" value={employeeId} onChange={setEmployeeId} placeholder="All employees" options={employeeOptions(directory)} />
            <SelectField
              label="Task status (tasks for the date)"
              value={status}
              onChange={setStatus}
              placeholder="Any status"
              options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
            />
          </div>
        </div>
      </Panel>

      {state !== "ready" || !data ? (
        <Panel>
          <PanelState state={state} error={error} onRetry={reload} />
        </Panel>
      ) : (
        <>
          <section aria-labelledby="hr-people" className="space-y-2">
            <h2 id="hr-people" className="text-xs font-black uppercase tracking-wider text-gray-400">People on {data.date}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label="Active employees" value={data.employees.active} to={`/admin/hr/employees${query({ ...scope })}`} />
              {data.employees.byOffice.map((o) => (
                <Stat
                  key={o.officeId}
                  label={`In ${o.name}`}
                  value={o.count}
                  hint="Includes people who work from more than one office"
                  to={`/admin/hr/employees${query({ officeId: o.officeId, departmentId: scope.departmentId })}`}
                />
              ))}
              <Stat
                label="Present"
                value={data.employees.present}
                hint="Checked in or marked present / half day"
                tone="ok"
                to={`/admin/hr/attendance${query({ ...scope, date: data.date, status: "present" })}`}
              />
              <Stat
                label="On approved leave"
                value={data.employees.onLeave}
                to={`/admin/hr/attendance${query({ ...scope, date: data.date, status: "on_leave" })}`}
              />
              <Stat
                label="Absent or not checked in"
                value={data.employees.absentOrNotCheckedIn}
                hint="No attendance and no approved leave"
                tone={data.employees.absentOrNotCheckedIn ? "warn" : undefined}
                to={`/admin/hr/attendance${query({ ...scope, date: data.date, status: "not_marked" })}`}
              />
            </div>
          </section>

          <section aria-labelledby="hr-work" className="space-y-2">
            <h2 id="hr-work" className="text-xs font-black uppercase tracking-wider text-gray-400">Work</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Stat
                label={status ? `${TASK_STATUS_LABEL[status as keyof typeof TASK_STATUS_LABEL]} tasks for the date` : "Tasks for the date"}
                value={data.tasks.assigned}
                to={`/admin/hr/tasks${query({ ...scope, date: data.date, status: status || undefined })}`}
              />
              <Stat label="Approved on the date" value={data.tasks.completed} tone="ok" to={`/admin/hr/tasks${query({ ...scope, completedOn: data.date })}`} />
              <Stat label="In progress now" value={data.tasks.inProgress} to={`/admin/hr/tasks${query({ ...scope, status: "in_progress" })}`} />
              <Stat
                label="Overdue now"
                value={data.tasks.overdue}
                hint="Open work past its due time"
                tone={data.tasks.overdue ? "warn" : undefined}
                to={`/admin/hr/tasks${query({ ...scope, overdue: "1" })}`}
              />
              <Stat
                label="Waiting for review"
                value={data.tasks.pendingReview}
                tone={data.tasks.pendingReview ? "warn" : undefined}
                to={`/admin/hr/tasks${query({ ...scope, status: "submitted" })}`}
              />
            </div>
          </section>

          <Panel title={`Tasks for ${data.date} by status`}>
            <div className="flex flex-wrap gap-2">
              {TASK_STATUSES.map((s) => (
                <Link
                  key={s}
                  to={`/admin/hr/tasks${query({ ...scope, date: data.date, status: s })}`}
                  className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-[11px] font-extrabold text-gray-600 dark:text-gray-300 hover:border-[#F28C28]"
                >
                  {TASK_STATUS_LABEL[s]}: <span className="tabular-nums">{data.tasks.assignedByStatus[s] ?? 0}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </>
      )}
    </HrPage>
  );
};

export default HrDashboardPage;
