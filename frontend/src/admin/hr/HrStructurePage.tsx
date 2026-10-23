import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Field, Panel, PanelState, Pill, ResponsiveTable, inputClass } from "../../modules/marketplace/ui";
import { useAuth } from "../../contexts/AuthContext";
import { hrService } from "../../services/hr.service";
import type { HrDepartment, HrDesignation } from "../../services/hr.service";
import { ConfirmDrawer, HR_PERMISSIONS, HrPage, SelectField, departmentOptions, hasAnyHrCapability, useHrAccess, useHrLookups } from "./hrUi";

type Editing =
  | { kind: "department"; row: HrDepartment | null }
  | { kind: "designation"; row: HrDesignation | null };

/**
 * Departments (teams) and designations (job titles), and how they differ from system roles
 * (what a login may do in the app). Only the HR employees permission can change them.
 */
export const HrStructurePage: React.FC = () => {
  const { user } = useAuth();
  const { access, loading } = useHrAccess();
  const { departments, designations, reload } = useHrLookups({ directory: false });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [toggling, setToggling] = useState<Editing | null>(null);
  const canManage = !!access?.can.employees;
  const departmentName = (id: string | null) => (id ? departments.find((d) => d.id === id)?.name ?? "—" : "Any department");

  if (!loading && !hasAnyHrCapability(access))
    return (
      <HrPage title="Departments & Roles" icon={<Building2 size={20} />}>
        <Panel><PanelState state="forbidden" /></Panel>
      </HrPage>
    );

  return (
    <HrPage
      title="Departments & Roles"
      subtitle="Department is the team someone belongs to. Designation is their job title. System role is what their login may do in the app; job titles never grant access."
      icon={<Building2 size={20} />}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel
          title="Departments"
          actions={canManage && <EnterpriseButton size="sm" onClick={() => setEditing({ kind: "department", row: null })}>Add department</EnterpriseButton>}
        >
          {!departments.length ? (
            <PanelState state="missing" missingText="No departments yet." />
          ) : (
            <ResponsiveTable
              rows={departments}
              rowKey={(d) => d.id}
              columns={[
                { header: "Department", cell: (d) => <div><p className="font-black">{d.name}</p>{d.description && <p className="text-[10px] text-gray-400">{d.description}</p>}</div> },
                { header: "Active employees", cell: (d) => <Link className="tabular-nums text-[#F28C28] font-black" to={`/admin/hr/employees?departmentId=${d.id}`}>{d.employeeCount ?? 0}</Link> },
                { header: "Status", cell: (d) => <Pill status={d.active ? "active" : "inactive"} /> },
                ...(canManage
                  ? [{
                      header: "Actions",
                      cell: (d: HrDepartment) => (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <EnterpriseButton size="sm" variant="ghost" onClick={() => setEditing({ kind: "department", row: d })}>Edit</EnterpriseButton>
                          <EnterpriseButton size="sm" variant="ghost" onClick={() => setToggling({ kind: "department", row: d })}>{d.active ? "Deactivate" : "Activate"}</EnterpriseButton>
                        </div>
                      ),
                    }]
                  : []),
              ]}
            />
          )}
        </Panel>

        <Panel
          title="Designations (job titles)"
          actions={canManage && <EnterpriseButton size="sm" onClick={() => setEditing({ kind: "designation", row: null })}>Add designation</EnterpriseButton>}
        >
          {!designations.length ? (
            <PanelState state="missing" missingText="No designations yet." />
          ) : (
            <ResponsiveTable
              rows={designations}
              rowKey={(d) => d.id}
              columns={[
                { header: "Designation", cell: (d) => <span className="font-black">{d.name}</span> },
                { header: "Department", cell: (d) => departmentName(d.departmentId) },
                { header: "Status", cell: (d) => <Pill status={d.active ? "active" : "inactive"} /> },
                ...(canManage
                  ? [{
                      header: "Actions",
                      cell: (d: HrDesignation) => (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <EnterpriseButton size="sm" variant="ghost" onClick={() => setEditing({ kind: "designation", row: d })}>Edit</EnterpriseButton>
                          <EnterpriseButton size="sm" variant="ghost" onClick={() => setToggling({ kind: "designation", row: d })}>{d.active ? "Deactivate" : "Activate"}</EnterpriseButton>
                        </div>
                      ),
                    }]
                  : []),
              ]}
            />
          )}
        </Panel>
      </div>

      <Panel title="System roles and HR access">
        <div className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
          <p>
            An employee record grants no access to anything. To let someone use HR Management, a Super Admin gives their login one or more of these permissions in
            {user?.role === "super_admin" ? <> <Link to="/admin/users" className="font-black text-[#F28C28]">User Management</Link></> : " User Management"}.
            HR access never includes Super Admin rights. A reporting manager can see and manage only their direct reports' tasks.
          </p>
          <ResponsiveTable
            rows={HR_PERMISSIONS}
            rowKey={(p) => p.key}
            columns={[
              { header: "Permission", cell: (p) => <span className="font-black">{p.label}</span> },
              { header: "Allows", cell: (p) => p.hint },
              { header: "Key", cell: (p) => <code className="text-[10px]">{p.key}</code>, hideOnMobile: true },
            ]}
          />
        </div>
      </Panel>

      {editing && (
        <StructureForm
          editing={editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {toggling?.row && (
        <ConfirmDrawer
          open
          title={`${toggling.row.active ? "Deactivate" : "Activate"} ${toggling.row.name}?`}
          description={
            toggling.row.active
              ? "It can no longer be chosen for employees. This is refused while active employees still use it."
              : "It can be chosen for employees again."
          }
          confirmLabel={toggling.row.active ? "Deactivate" : "Activate"}
          danger={toggling.row.active}
          onClose={() => setToggling(null)}
          onConfirm={async () => {
            const row = toggling.row!;
            if (toggling.kind === "department") await hrService.updateDepartment(row.id, { active: !row.active });
            else await hrService.updateDesignation(row.id, { active: !row.active });
            setToggling(null);
            reload();
          }}
        />
      )}
    </HrPage>
  );
};

const StructureForm: React.FC<{ editing: Editing; departments: HrDepartment[]; onClose: () => void; onSaved: () => void }> = ({ editing, departments, onClose, onSaved }) => {
  const [name, setName] = useState(editing.row?.name ?? "");
  const [description, setDescription] = useState(editing.kind === "department" ? editing.row?.description ?? "" : "");
  const [departmentId, setDepartmentId] = useState(editing.kind === "designation" ? editing.row?.departmentId ?? "" : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const label = editing.kind === "department" ? "department" : "designation";

  const save = async () => {
    if (name.trim().length < 2) return setError("Enter a name of at least 2 characters.");
    setSaving(true);
    try {
      if (editing.kind === "department") {
        if (editing.row) await hrService.updateDepartment(editing.row.id, { name: name.trim(), description: description.trim() });
        else await hrService.createDepartment({ name: name.trim(), description: description.trim() || undefined });
      } else if (editing.row) await hrService.updateDesignation(editing.row.id, { name: name.trim(), departmentId });
      else await hrService.createDesignation({ name: name.trim(), departmentId: departmentId || undefined });
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
      title={editing.row ? `Edit ${label}` : `Add ${label}`}
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</EnterpriseButton>
        </div>
      }
    >
      <Field label="Name" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      {editing.kind === "department" ? (
        <Field label="Description">
          <textarea className={`${inputClass} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </Field>
      ) : (
        <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="Any department" options={departmentOptions(departments)} />
      )}
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </EnterpriseModal>
  );
};

export default HrStructurePage;
