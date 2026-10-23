/* oxlint-disable react/only-export-components -- small shared kit for the HR Management pages */
/**
 * Shared pieces for the HR pages: labels and pills, the breadcrumb + header wrapper, the
 * reason/confirmation drawer, CSV export and the lookups every filter needs. Built on the
 * existing console kit (modules/marketplace/ui) and the Enterprise* dashboard components.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Field, Pill, inputClass } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type {
  HrAccessInfo,
  HrDepartment,
  HrDesignation,
  HrDirectoryEntry,
  HrOffice,
  HrRegisterState,
  HrTaskPriority,
  HrTaskStatus,
} from "../../services/hr.service";

// ---------------------------------------------------------------- labels and pills

export const TASK_STATUS_LABEL: Record<HrTaskStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  blocked: "Blocked",
  submitted: "Submitted for review",
  completed: "Completed",
  cancelled: "Cancelled",
};
const TASK_STATUS_TONE: Record<HrTaskStatus, "blue" | "saffron" | "red" | "amber" | "green" | "gray"> = {
  assigned: "blue",
  in_progress: "saffron",
  blocked: "red",
  submitted: "amber",
  completed: "green",
  cancelled: "gray",
};
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABEL) as HrTaskStatus[];

export const TaskStatusPill: React.FC<{ status: HrTaskStatus; overdue?: boolean }> = ({ status, overdue }) => (
  <span className="inline-flex flex-wrap gap-1">
    <Pill tone={TASK_STATUS_TONE[status]} label={TASK_STATUS_LABEL[status] ?? status} />
    {overdue && <Pill tone="red" label="Overdue" />}
  </span>
);

export const PRIORITIES: HrTaskPriority[] = ["low", "medium", "high", "urgent"];
const PRIORITY_TONE: Record<HrTaskPriority, "gray" | "blue" | "amber" | "red"> = { low: "gray", medium: "blue", high: "amber", urgent: "red" };
export const PriorityPill: React.FC<{ priority: HrTaskPriority }> = ({ priority }) => (
  <Pill tone={PRIORITY_TONE[priority]} label={priority.charAt(0).toUpperCase() + priority.slice(1)} />
);

export const REGISTER_LABEL: Record<HrRegisterState, string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  on_leave: "On leave",
  not_marked: "Not marked",
};
const REGISTER_TONE: Record<HrRegisterState, "green" | "amber" | "red" | "blue" | "gray"> = {
  present: "green",
  half_day: "amber",
  absent: "red",
  on_leave: "blue",
  not_marked: "gray",
};
export const RegisterPill: React.FC<{ state: HrRegisterState }> = ({ state }) => <Pill tone={REGISTER_TONE[state]} label={REGISTER_LABEL[state]} />;

export const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid", "other"];
export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const HR_PERMISSIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: "hr.employees.manage", label: "Employees & structure", hint: "Employees (with contact details), offices, departments, designations and HR settings" },
  { key: "hr.tasks.manage", label: "All tasks", hint: "Assign, review and manage every employee's tasks" },
  { key: "hr.attendance.manage", label: "Attendance & leave", hint: "Attendance register, leave approval and corrections" },
  { key: "hr.reports.view", label: "Reports", hint: "Task and attendance reports and CSV exports" },
];

// ---------------------------------------------------------------- dates (Tirvona works in IST)

/** Today's date in India as YYYY-MM-DD. */
export const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const addDaysKey = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Monday of the IST week containing `key`. */
export const weekStart = (key: string) => {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay();
  return addDaysKey(key, day === 0 ? -6 : 1 - day);
};

export const fmtDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export const fmtTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDate = (key?: string | null) =>
  key ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }) : "—";

/** An IST date and "HH:mm" as an ISO instant. */
export const istInstant = (dateKey: string, time: string) => new Date(`${dateKey}T${time}:00+05:30`).toISOString();

/** One per opened form, so a double click or a retry creates the record once. */
export const newRequestId = () =>
  globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? `req${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------- page frame

/** Breadcrumb + the shared page header, so every HR page sits in the same frame. */
export const HrPage: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, actions, children }) => (
  <div className="space-y-5">
    <nav aria-label="Breadcrumb" className="text-[11px] font-bold text-gray-400">
      <Link to="/admin/hr" className="hover:text-[#F28C28]">
        HR Management
      </Link>
      <span aria-hidden="true"> / </span>
      <span className="text-gray-600 dark:text-gray-300">{title}</span>
    </nav>
    <EnterprisePageHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
    {children}
  </div>
);

// ---------------------------------------------------------------- form bits

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, placeholder, required, className, disabled }) => (
  <Field label={label} required={required} className={className}>
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </Field>
);

/**
 * Right-side drawer that asks for confirmation and, when `reasonLabel` is given, a reason.
 * Used for every consequential action (cancel, reject, reopen, deactivate ...).
 */
export const ConfirmDrawer: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}> = ({ open, title, description, confirmLabel, danger, reasonLabel, reasonRequired = true, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);
  const submit = async () => {
    if (reasonLabel && reasonRequired && reason.trim().length < 3) {
      setError("Please write at least 3 characters.");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch {
      // The API layer already showed why it failed; keep the drawer open.
    } finally {
      setBusy(false);
    }
  };
  return (
    <EnterpriseModal
      isOpen={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      subtitle={description}
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={busy}>
            Back
          </EnterpriseButton>
          <EnterpriseButton variant={danger ? "danger" : "primary"} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : confirmLabel}
          </EnterpriseButton>
        </div>
      }
    >
      {reasonLabel && (
        <Field label={reasonLabel} required={reasonRequired}>
          <textarea className={`${inputClass} min-h-[96px]`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          {error && <span className="block text-[11px] font-bold text-rose-600">{error}</span>}
        </Field>
      )}
    </EnterpriseModal>
  );
};

// ---------------------------------------------------------------- CSV

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------- data hooks

/** What the signed-in user may do in HR (decided by the server). */
export function useHrAccess() {
  const [access, setAccess] = useState<HrAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    hrService
      .access()
      .then((a) => live && setAccess(a))
      .catch(() => live && setAccess(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { access, loading };
}

export const hasAnyHrCapability = (access: HrAccessInfo | null) =>
  !!access && Object.values(access.can).some(Boolean);

/** Offices, departments, designations and (when allowed) the employee picker list. */
export function useHrLookups(options: { directory?: boolean } = {}) {
  const [offices, setOffices] = useState<HrOffice[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [designations, setDesignations] = useState<HrDesignation[]>([]);
  const [directory, setDirectory] = useState<HrDirectoryEntry[]>([]);
  const withDirectory = options.directory !== false;
  const reload = useCallback(async () => {
    const [o, d, g, e] = await Promise.all([
      hrService.offices().catch(() => [] as HrOffice[]),
      hrService.departments().catch(() => [] as HrDepartment[]),
      hrService.designations().catch(() => [] as HrDesignation[]),
      withDirectory ? hrService.directory().catch(() => [] as HrDirectoryEntry[]) : Promise.resolve([] as HrDirectoryEntry[]),
    ]);
    setOffices(o ?? []);
    setDepartments(d ?? []);
    setDesignations(g ?? []);
    setDirectory(e ?? []);
  }, [withDirectory]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { offices, departments, designations, directory, reload };
}

export const officeOptions = (offices: HrOffice[]) => offices.filter((o) => o.active).map((o) => ({ value: o.id, label: o.name }));
export const departmentOptions = (departments: HrDepartment[]) => departments.filter((d) => d.active).map((d) => ({ value: d.id, label: d.name }));
export const employeeOptions = (directory: HrDirectoryEntry[]) => directory.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` }));
