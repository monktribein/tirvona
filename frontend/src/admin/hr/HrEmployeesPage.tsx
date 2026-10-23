import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, UserPlus, Users } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Chips, Field, Pager, Panel, PanelState, Pill, ResponsiveTable, inputClass, useRemote } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrDepartment, HrDesignation, HrDirectoryEntry, HrEmployee, HrEmployeeInput, HrEmployeeProfile, HrOffice } from "../../services/hr.service";
import {
  ConfirmDrawer,
  EMPLOYMENT_TYPES,
  HR_PERMISSIONS,
  HrPage,
  SelectField,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  departmentOptions,
  fmtDate,
  officeOptions,
  useHrAccess,
  useHrLookups,
} from "./hrUi";

/** Employee directory: search, filter, add and edit employees and open their profile. */
export const HrEmployeesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { access } = useHrAccess();
  const lookups = useHrLookups();
  const canManage = !!access?.can.employees;

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [appliedSearch, setAppliedSearch] = useState(search);
  const [officeId, setOfficeId] = useState(params.get("officeId") ?? "");
  const [departmentId, setDepartmentId] = useState(params.get("departmentId") ?? "");
  const [designationId, setDesignationId] = useState(params.get("designationId") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "active");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(params.get("employee"));
  const [editing, setEditing] = useState<HrEmployeeProfile | "new" | null>(params.get("new") === "1" ? "new" : null);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [appliedSearch, officeId, departmentId, designationId, status, sort]);

  const { data, meta, state, error, reload } = useRemote<HrEmployee[]>(
    () => hrService.employees({ search: appliedSearch, officeId, departmentId, designationId, status, sort, page, limit: 20 }),
    [appliedSearch, officeId, departmentId, designationId, status, sort, page],
  );

  const openProfile = (id: string | null) => {
    setOpenId(id);
    const next = new URLSearchParams(params);
    if (id) next.set("employee", id);
    else next.delete("employee");
    next.delete("new");
    setParams(next, { replace: true });
  };

  return (
    <HrPage
      title="Employees"
      subtitle="Everyone who works for Tirvona, across both offices. Adding an employee never gives them access to any dashboard."
      icon={<Users size={20} />}
      actions={
        canManage && (
          <EnterpriseButton size="sm" icon={<UserPlus size={13} />} onClick={() => setEditing("new")}>
            Add employee
          </EnterpriseButton>
        )
      }
    >
      <Panel>
        <div className="space-y-3">
          <Chips
            value={officeId}
            onChange={setOfficeId}
            options={[{ value: "", label: "All offices" }, ...officeOptions(lookups.offices)]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label="Search" className="lg:col-span-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={`${inputClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={canManage ? "Name, employee ID or email" : "Name or employee ID"} />
              </div>
            </Field>
            <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" options={departmentOptions(lookups.departments)} />
            <SelectField
              label="Designation"
              value={designationId}
              onChange={setDesignationId}
              placeholder="All designations"
              options={lookups.designations.filter((d) => d.active).map((d) => ({ value: d.id, label: d.name }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Status" value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "all", label: "All" }]} />
              <SelectField label="Sort by" value={sort} onChange={setSort} options={[{ value: "name", label: "Name" }, { value: "code", label: "Employee ID" }, { value: "joiningDate", label: "Joining date" }]} />
            </div>
          </div>

          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <PanelState state="missing" missingText="No employees match these filters." />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(e) => e.id}
                onRowClick={(e) => openProfile(e.id)}
                columns={[
                  {
                    header: "Employee",
                    cell: (e) => (
                      <div className="min-w-0">
                        <p className="font-black truncate">{e.fullName}</p>
                        <p className="text-[10px] text-gray-400">{e.employeeCode}</p>
                      </div>
                    ),
                  },
                  { header: "Office", cell: (e) => e.offices.map((o) => o.name).join(", ") || "—" },
                  {
                    header: "Department",
                    cell: (e) => (
                      <div>
                        <p>{e.departmentName ?? "—"}</p>
                        <p className="text-[10px] text-gray-400">{e.designationName ?? ""}</p>
                      </div>
                    ),
                  },
                  { header: "Reports to", cell: (e) => e.reportingManagerName ?? "—", hideOnMobile: true },
                  ...(canManage ? [{ header: "Contact", cell: (e: HrEmployee) => <span className="text-[11px]">{e.workEmail || e.phone || "—"}</span>, hideOnMobile: true }] : []),
                  { header: "Joined", cell: (e) => fmtDate(e.joiningDate), hideOnMobile: true },
                  { header: "Status", cell: (e) => <Pill status={e.status} /> },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>

      {openId && (
        <EmployeeProfileDrawer
          id={openId}
          canManage={canManage}
          onClose={() => openProfile(null)}
          onEdit={(p) => setEditing(p)}
          onChanged={reload}
        />
      )}
      {editing && (
        <EmployeeFormDrawer
          employee={editing === "new" ? null : editing}
          offices={lookups.offices}
          departments={lookups.departments}
          designations={lookups.designations}
          directory={lookups.directory}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            reload();
            lookups.reload();
            openProfile(saved.id);
          }}
        />
      )}
    </HrPage>
  );
};

// ---------------------------------------------------------------- profile

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 dark:border-slate-800/70">
    <span className="text-[10px] uppercase tracking-wider font-black text-gray-400 shrink-0">{label}</span>
    <span className="text-right text-xs text-[#0B192C] dark:text-gray-200 min-w-0 break-words">{children}</span>
  </div>
);

const EmployeeProfileDrawer: React.FC<{
  id: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: (profile: HrEmployeeProfile) => void;
  onChanged: () => void;
}> = ({ id, canManage, onClose, onEdit, onChanged }) => {
  const [profile, setProfile] = useState<HrEmployeeProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setProfile(null);
    setFailed(false);
    hrService.employee(id).then(setProfile).catch(() => setFailed(true));
  }, [id]);

  const deactivate = profile?.status === "active";
  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      title={profile?.fullName ?? "Employee"}
      subtitle={profile ? `${profile.employeeCode} · ${profile.designationName ?? "No designation"}` : undefined}
      maxWidth="xl"
      footer={
        canManage && profile ? (
          <div className="flex flex-wrap justify-end gap-2">
            <EnterpriseButton variant={deactivate ? "danger" : "success"} size="sm" onClick={() => setConfirming(true)}>
              {deactivate ? "Deactivate" : "Reactivate"}
            </EnterpriseButton>
            <EnterpriseButton size="sm" onClick={() => onEdit(profile)}>
              Edit details
            </EnterpriseButton>
          </div>
        ) : undefined
      }
    >
      {failed ? (
        <PanelState state="error" error="This employee could not be loaded." />
      ) : !profile ? (
        <PanelState state="loading" />
      ) : (
        <div className="space-y-5">
          {profile.photoUrl && <img src={profile.photoUrl} alt="" className="h-20 w-20 object-cover border border-gray-100 dark:border-slate-800" loading="lazy" />}
          <div>
            <Detail label="Status"><Pill status={profile.status} /></Detail>
            {profile.status === "inactive" && profile.deactivationReason && <Detail label="Deactivated because">{profile.deactivationReason}</Detail>}
            <Detail label="Offices">{profile.offices.map((o) => (o.id === profile.primaryOfficeId ? `${o.name} (primary)` : o.name)).join(", ")}</Detail>
            <Detail label="Department">{profile.departmentName ?? "—"}</Detail>
            <Detail label="Designation">{profile.designationName ?? "—"}</Detail>
            <Detail label="Reports to">{profile.reportingManagerName ?? "—"}</Detail>
            <Detail label="Employment">{EMPLOYMENT_TYPES.find((t) => t.value === profile.employmentType)?.label ?? profile.employmentType}</Detail>
            <Detail label="Joined">{fmtDate(profile.joiningDate)}</Detail>
            {profile.workEmail !== undefined && <Detail label="Work email">{profile.workEmail || "—"}</Detail>}
            {profile.phone !== undefined && <Detail label="Contact number">{profile.phone || "—"}</Detail>}
            <Detail label="Login">{profile.hasLogin ? "Linked" : "Not linked"}</Detail>
            {profile.account && (
              <Detail label="System access">
                {profile.account.role.replace(/_/g, " ")}
                {profile.account.hrPermissions.length
                  ? ` · HR: ${profile.account.hrPermissions.map((p) => HR_PERMISSIONS.find((h) => h.key === p)?.label ?? p).join(", ")}`
                  : " · no HR permissions"}
              </Detail>
            )}
          </div>

          {profile.responsibilities && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-1">Responsibilities</p>
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{profile.responsibilities}</p>
            </div>
          )}
          {profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <Pill key={s} tone="gray" label={s} />
              ))}
            </div>
          )}
          {profile.notes !== undefined && profile.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-1">HR notes (only HR sees these)</p>
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{profile.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Tasks (all time)</p>
              <Link to={`/admin/hr/tasks?employeeId=${profile.id}`} className="text-[11px] font-black text-[#F28C28]">Task history</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[...TASK_STATUSES, "overdue" as const].map((s) => (
                <div key={s} className="border border-gray-100 dark:border-slate-800 p-2">
                  <p className="text-[10px] text-gray-400 font-bold">{s === "overdue" ? "Overdue now" : TASK_STATUS_LABEL[s]}</p>
                  <p className="text-sm font-black tabular-nums">{profile.taskSummary[s] ?? 0}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-black text-gray-400">
                Attendance, {fmtDate(profile.attendanceSummary.from)} – {fmtDate(profile.attendanceSummary.to)}
              </p>
              <Link to={`/admin/hr/attendance?tab=summary&employeeId=${profile.id}`} className="text-[11px] font-black text-[#F28C28]">Attendance</Link>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Present {profile.attendanceSummary.present} · Half day {profile.attendanceSummary.halfDay} · Marked absent {profile.attendanceSummary.absent}
            </p>
          </div>
        </div>
      )}

      {profile && (
        <ConfirmDrawer
          open={confirming}
          title={deactivate ? `Deactivate ${profile.fullName}?` : `Reactivate ${profile.fullName}?`}
          description={
            deactivate
              ? "They drop out of task assignment, attendance and their own HR pages. Their record and history are kept. Open tasks are not cancelled: reassign them."
              : "They can be assigned tasks and use their HR pages again."
          }
          confirmLabel={deactivate ? "Deactivate" : "Reactivate"}
          danger={deactivate}
          reasonLabel={deactivate ? "Reason" : undefined}
          onClose={() => setConfirming(false)}
          onConfirm={async (reason) => {
            const updated = await hrService.setEmployeeStatus(profile.id, deactivate ? "inactive" : "active", reason || undefined);
            setProfile(updated);
            setConfirming(false);
            onChanged();
          }}
        />
      )}
    </EnterpriseModal>
  );
};

// ---------------------------------------------------------------- add / edit

const EmployeeFormDrawer: React.FC<{
  employee: HrEmployeeProfile | null;
  offices: HrOffice[];
  departments: HrDepartment[];
  designations: HrDesignation[];
  directory: HrDirectoryEntry[];
  onClose: () => void;
  onSaved: (saved: HrEmployeeProfile) => void;
}> = ({ employee, offices, departments, designations, directory, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({
    employeeCode: employee?.employeeCode ?? "",
    fullName: employee?.fullName ?? "",
    workEmail: employee?.workEmail ?? "",
    phone: employee?.phone ?? "",
    photoUrl: employee?.photoUrl ?? "",
    primaryOfficeId: employee?.primaryOfficeId ?? "",
    otherOfficeIds: (employee?.offices ?? []).map((o) => o.id).filter((id) => id !== employee?.primaryOfficeId),
    departmentId: employee?.departmentId ?? "",
    designationId: employee?.designationId ?? "",
    reportingManagerId: employee?.reportingManagerId ?? "",
    employmentType: employee?.employmentType ?? "full_time",
    joiningDate: employee?.joiningDate ?? "",
    responsibilities: employee?.responsibilities ?? "",
    skills: (employee?.skills ?? []).join(", "),
    notes: employee?.notes ?? "",
  }));
  const [loginEmail, setLoginEmail] = useState("");
  const [linkUserId, setLinkUserId] = useState<string | null | undefined>(undefined);
  const [lookupResult, setLookupResult] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const activeOffices = offices.filter((o) => o.active);
  const designationChoices = useMemo(
    () => designations.filter((d) => d.active && (!d.departmentId || !form.departmentId || d.departmentId === form.departmentId)),
    [designations, form.departmentId],
  );
  const managerChoices = directory.filter((d) => d.id !== employee?.id);

  const lookup = async () => {
    setLookupResult("");
    if (!loginEmail.trim()) return;
    try {
      const found = await hrService.accountLookup({ email: loginEmail.trim() });
      if (!found) {
        setLookupResult("No Tirvona login uses this email.");
        setLinkUserId(undefined);
      } else if (found.linkedEmployee && found.linkedEmployee.id !== employee?.id) {
        setLookupResult(`This login is already linked to ${found.linkedEmployee.fullName} (${found.linkedEmployee.employeeCode}).`);
        setLinkUserId(undefined);
      } else {
        setLookupResult(`Will link ${found.name} (${found.role.replace(/_/g, " ")}). Their access does not change.`);
        setLinkUserId(found.id);
      }
    } catch {
      // shown by the API layer
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter the employee's full name.";
    if (!form.primaryOfficeId) next.primaryOfficeId = "Choose the employee's office.";
    if (form.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail.trim())) next.workEmail = "Enter a valid email.";
    if (form.phone && !/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim())) next.phone = "Enter a valid contact number.";
    if (form.employeeCode && !/^[A-Za-z0-9-]{2,30}$/.test(form.employeeCode.trim())) next.employeeCode = "Letters, digits and dashes only.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: HrEmployeeInput = {
      fullName: form.fullName.trim(),
      workEmail: form.workEmail.trim(),
      phone: form.phone.trim(),
      photoUrl: form.photoUrl.trim(),
      primaryOfficeId: form.primaryOfficeId,
      officeIds: form.otherOfficeIds.filter((id) => id !== form.primaryOfficeId),
      departmentId: form.departmentId,
      designationId: form.designationId,
      reportingManagerId: form.reportingManagerId,
      employmentType: form.employmentType,
      joiningDate: form.joiningDate,
      responsibilities: form.responsibilities.trim(),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes.trim(),
    };
    if (linkUserId !== undefined) body.userId = linkUserId ?? "";
    setSaving(true);
    try {
      const saved = employee
        ? await hrService.updateEmployee(employee.id, body)
        : await hrService.createEmployee({ ...body, employeeCode: form.employeeCode.trim() || undefined });
      onSaved(saved);
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
      title={employee ? `Edit ${employee.fullName}` : "Add employee"}
      subtitle="Department is the team, designation is the job title. Neither grants access to anything."
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={submit} disabled={saving}>{saving ? "Saving…" : employee ? "Save changes" : "Add employee"}</EnterpriseButton>
        </div>
      }
    >
      {activeOffices.length === 0 ? (
        <PanelState state="missing" missingText="Add an office in HR Settings first." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" required>
            <input className={inputClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={120} />
            {err("fullName")}
          </Field>
          <Field label="Employee ID" hint={employee ? "Cannot be changed." : "Leave empty to generate the next EMP-#### ID."}>
            <input className={inputClass} value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} disabled={!!employee} maxLength={30} />
            {err("employeeCode")}
          </Field>
          <Field label="Work email">
            <input type="email" className={inputClass} value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} maxLength={120} />
            {err("workEmail")}
          </Field>
          <Field label="Contact number">
            <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" maxLength={20} />
            {err("phone")}
          </Field>
          <SelectField label="Primary office" required value={form.primaryOfficeId} onChange={(v) => set("primaryOfficeId", v)} placeholder="Choose office" options={officeOptions(activeOffices)} />
          <Field label="Also works from" hint="Only for someone who works from more than one office.">
            <div className="flex flex-wrap gap-3 pt-1">
              {activeOffices.filter((o) => o.id !== form.primaryOfficeId).map((o) => (
                <label key={o.id} className="inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={form.otherOfficeIds.includes(o.id)}
                    onChange={(e) => set("otherOfficeIds", e.target.checked ? [...form.otherOfficeIds, o.id] : form.otherOfficeIds.filter((x) => x !== o.id))}
                  />
                  {o.name}
                </label>
              ))}
            </div>
          </Field>
          {err("primaryOfficeId")}
          <SelectField label="Department" value={form.departmentId} onChange={(v) => set("departmentId", v)} placeholder="No department" options={departmentOptions(departments)} />
          <SelectField label="Designation (job title)" value={form.designationId} onChange={(v) => set("designationId", v)} placeholder="No designation" options={designationChoices.map((d) => ({ value: d.id, label: d.name }))} />
          <SelectField
            label="Reporting manager"
            value={form.reportingManagerId}
            onChange={(v) => set("reportingManagerId", v)}
            placeholder="No manager"
            options={managerChoices.map((d) => ({ value: d.id, label: `${d.fullName} (${d.employeeCode})` }))}
          />
          <SelectField label="Employment type" value={form.employmentType} onChange={(v) => set("employmentType", v)} options={EMPLOYMENT_TYPES} />
          <Field label="Joining date">
            <input type="date" className={inputClass} value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          </Field>
          <Field label="Photo link" hint="Optional https image link.">
            <input className={inputClass} value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} maxLength={500} />
          </Field>
          <Field label="Responsibilities" className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-[72px]`} value={form.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} maxLength={2000} />
          </Field>
          <Field label="Skills" hint="Separate with commas." className="sm:col-span-2">
            <input className={inputClass} value={form.skills} onChange={(e) => set("skills", e.target.value)} />
          </Field>
          <Field label="HR notes" hint="Only people with the HR employees permission see these." className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-[60px]`} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2 border-t border-gray-100 dark:border-slate-800 pt-3 space-y-2">
            <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Link a Tirvona login (optional)</p>
            <p className="text-[10px] text-gray-400">
              Lets the employee see their own tasks and attendance under My Work. It does not change their role or permissions; a Super Admin grants HR access from User Management.
              {employee && ` Currently: ${employee.hasLogin ? "linked" : "not linked"}.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="email" className={inputClass} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Login email" />
              <EnterpriseButton variant="outline" size="sm" onClick={lookup}>Find login</EnterpriseButton>
              {employee?.hasLogin && (
                <EnterpriseButton variant="ghost" size="sm" onClick={() => { setLinkUserId(null); setLookupResult("The login will be unlinked when you save."); }}>
                  Unlink
                </EnterpriseButton>
              )}
            </div>
            {lookupResult && <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{lookupResult}</p>}
          </div>
        </div>
      )}
    </EnterpriseModal>
  );
};

export default HrEmployeesPage;
