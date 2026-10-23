import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, Search } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Chips, Field, Pager, Panel, PanelState, ResponsiveTable, inputClass, useRemote } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrDirectoryEntry, HrTask, HrTaskPriority } from "../../services/hr.service";
import { HrTaskDrawer } from "./HrTaskDrawer";
import {
  HrPage,
  PRIORITIES,
  PriorityPill,
  SelectField,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TaskStatusPill,
  departmentOptions,
  employeeOptions,
  fmtDate,
  fmtDateTime,
  istToday,
  newRequestId,
  officeOptions,
  useHrAccess,
  useHrLookups,
} from "./hrUi";

/**
 * Daily Tasks: what every employee is meant to do and what they actually finished. HR task
 * staff see everyone; a manager sees only their direct reports (the server enforces this).
 */
export const HrTasksPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { access } = useHrAccess();
  const lookups = useHrLookups();

  const [officeId, setOfficeId] = useState(params.get("officeId") ?? "");
  const [departmentId, setDepartmentId] = useState(params.get("departmentId") ?? "");
  const [employeeId, setEmployeeId] = useState(params.get("employeeId") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [priority, setPriority] = useState(params.get("priority") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const [completedOn, setCompletedOn] = useState(params.get("completedOn") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [overdue, setOverdue] = useState(params.get("overdue") === "1");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openTask, setOpenTask] = useState<string | null>(params.get("task"));
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [officeId, departmentId, employeeId, status, priority, date, from, to, completedOn, overdue, appliedSearch]);
  useEffect(() => {
    const next: Record<string, string> = {};
    const values = { officeId, departmentId, employeeId, status, priority, date, from, to, completedOn, overdue: overdue ? "1" : "", task: openTask ?? "" };
    for (const [k, v] of Object.entries(values)) if (v) next[k] = v;
    setParams(next, { replace: true });
  }, [officeId, departmentId, employeeId, status, priority, date, from, to, completedOn, overdue, openTask, setParams]);

  const { data, meta, state, error, reload } = useRemote<HrTask[]>(
    () => hrService.tasks({ officeId, departmentId, employeeId, status, priority, date, from, to, completedOn, overdue: overdue || undefined, search: appliedSearch, page, limit: 20 }),
    [officeId, departmentId, employeeId, status, priority, date, from, to, completedOn, overdue, appliedSearch, page],
  );

  const canCreate = !!access && (access.can.tasks || access.isManager);
  const clearFilters = () => {
    setOfficeId("");
    setDepartmentId("");
    setEmployeeId("");
    setStatus("");
    setPriority("");
    setDate("");
    setFrom("");
    setTo("");
    setCompletedOn("");
    setOverdue(false);
    setSearch("");
  };

  return (
    <HrPage
      title="Daily Tasks"
      subtitle={
        access && !access.can.tasks && access.isManager
          ? "Tasks for the people who report to you."
          : "What each employee is supposed to do and what they have completed. Tasks are only completed when a reviewer approves the work."
      }
      icon={<ClipboardList size={20} />}
      actions={
        canCreate && (
          <EnterpriseButton size="sm" icon={<Plus size={13} />} onClick={() => setCreating(true)}>
            Assign task
          </EnterpriseButton>
        )
      }
    >
      <Panel>
        <div className="space-y-3">
          <Chips value={officeId} onChange={setOfficeId} options={[{ value: "", label: "All offices" }, ...officeOptions(lookups.offices)]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Search">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or task ID" />
              </div>
            </Field>
            <SelectField label="Employee" value={employeeId} onChange={setEmployeeId} placeholder="All employees" options={employeeOptions(lookups.directory)} />
            <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(lookups.departments)} />
            <SelectField label="Status" value={status} onChange={setStatus} placeholder="Any status" options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))} />
            <SelectField label="Priority" value={priority} onChange={setPriority} placeholder="Any priority" options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
            <Field label="Task date">
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {(from || to) && (
              <Field label="Task dates">
                <p className="text-xs pt-2">{from ? fmtDate(from) : "…"} – {to ? fmtDate(to) : "…"}</p>
              </Field>
            )}
            <Field label="Approved on">
              <input type="date" className={inputClass} value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
            </Field>
            <div className="flex items-end gap-3 pb-1">
              <label className="inline-flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
              </label>
              <EnterpriseButton size="sm" variant="ghost" onClick={clearFilters}>Clear</EnterpriseButton>
            </div>
          </div>

          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <PanelState state="missing" missingText="No tasks match these filters." />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(t) => t.id}
                onRowClick={(t) => setOpenTask(t.id)}
                columns={[
                  {
                    header: "Task",
                    cell: (t) => (
                      <div className="min-w-0 max-w-xs">
                        <p className="font-black truncate">{t.title}</p>
                        <p className="text-[10px] text-gray-400">{t.taskNumber}{t.groupId ? " · shared task" : ""}</p>
                      </div>
                    ),
                  },
                  {
                    header: "Employee",
                    cell: (t) => (
                      <div>
                        <p>{t.employeeName}</p>
                        <p className="text-[10px] text-gray-400">{t.officeName ?? "—"}</p>
                      </div>
                    ),
                  },
                  { header: "Date", cell: (t) => fmtDate(t.assignedDate), hideOnMobile: true },
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
      </Panel>

      {openTask && (
        <HrTaskDrawer taskId={openTask} directory={lookups.directory} onClose={() => setOpenTask(null)} onChanged={reload} />
      )}
      {creating && (
        <CreateTaskDrawer
          directory={lookups.directory}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </HrPage>
  );
};

const defaultDue = () => {
  // Today 18:00 IST, or two hours from now if that has passed.
  const today = istToday();
  const sixPm = new Date(`${today}T18:00:00+05:30`);
  const due = sixPm.getTime() > Date.now() ? sixPm : new Date(Date.now() + 2 * 3_600_000);
  return new Date(due.getTime() + 330 * 60_000).toISOString().slice(0, 16);
};

const CreateTaskDrawer: React.FC<{ directory: HrDirectoryEntry[]; onClose: () => void; onCreated: () => void }> = ({ directory, onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [confirmMultiple, setConfirmMultiple] = useState(false);
  const [assignedDate, setAssignedDate] = useState(istToday());
  const [due, setDue] = useState(defaultDue());
  const [priority, setPriority] = useState<HrTaskPriority>("medium");
  const [requestId] = useState(newRequestId());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? directory.filter((d) => `${d.fullName} ${d.employeeCode}`.toLowerCase().includes(q)) : directory;
  }, [directory, filter]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Give the task a title (at least 3 characters).";
    if (!selected.length) next.employees = "Choose who the task is for.";
    if (selected.length > 1 && !confirmMultiple) next.employees = "Tick the box to give this task to each selected employee.";
    if (!due) next.due = "Choose the due time.";
    else if (new Date(`${due}:00+05:30`).getTime() < Date.now()) next.due = "The due time is already in the past.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await hrService.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        expectedOutcome: expectedOutcome.trim() || undefined,
        employeeIds: selected,
        assignToMultiple: selected.length > 1 ? true : undefined,
        assignedDate,
        dueAt: new Date(`${due}:00+05:30`).toISOString(),
        priority,
        idempotencyKey: requestId,
      });
      onCreated();
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };

  const err = (key: string) => errors[key] && <span className="block text-[11px] font-bold text-rose-600">{errors[key]}</span>;

  return (
    <EnterpriseModal
      isOpen
      onClose={saving ? () => undefined : onClose}
      title="Assign a task"
      subtitle="The employee is notified in the app. Times are India time (IST)."
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={submit} disabled={saving}>{saving ? "Assigning…" : selected.length > 1 ? `Assign to ${selected.length} employees` : "Assign task"}</EnterpriseButton>
        </div>
      }
    >
      {directory.length === 0 ? (
        <PanelState state="missing" missingText="There is nobody you can assign tasks to yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Title" required className="sm:col-span-2">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
            {err("title")}
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-[80px]`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
          </Field>
          <Field label="Expected outcome / deliverable" className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-[56px]`} value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} maxLength={1000} />
          </Field>
          <Field label="Task date">
            <input type="date" className={inputClass} value={assignedDate} min={istToday()} onChange={(e) => setAssignedDate(e.target.value || istToday())} />
          </Field>
          <Field label="Due (IST)" required>
            <input type="datetime-local" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
            {err("due")}
          </Field>
          <SelectField label="Priority" value={priority} onChange={(v) => setPriority(v as HrTaskPriority)} options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
          <div className="sm:col-span-2 space-y-2">
            <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Employee<span className="text-rose-500"> *</span></p>
            <input className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find by name or ID" aria-label="Find employee" />
            <div className="max-h-56 overflow-y-auto border border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800">
              {visible.map((d) => (
                <label key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(d.id)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))}
                  />
                  <span>{d.fullName}</span>
                  <span className="text-[10px] text-gray-400">{d.employeeCode}</span>
                </label>
              ))}
            </div>
            {selected.length > 1 && (
              <label className="flex items-start gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <input type="checkbox" className="mt-0.5" checked={confirmMultiple} onChange={(e) => setConfirmMultiple(e.target.checked)} />
                Give this same task to each of the {selected.length} selected employees (each gets their own copy to complete).
              </label>
            )}
            {err("employees")}
          </div>
        </div>
      )}
    </EnterpriseModal>
  );
};

export default HrTasksPage;
