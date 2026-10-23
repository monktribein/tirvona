import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Field, Panel, PanelState, Pill, ResponsiveTable, inputClass } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrOffice } from "../../services/hr.service";
import { ConfirmDrawer, HrPage, WEEKDAYS, hasAnyHrCapability, useHrAccess, useHrLookups } from "./hrUi";

/** Tirvona's offices and the HR working-week / reminder settings. */
export const HrSettingsPage: React.FC = () => {
  const { access, loading } = useHrAccess();
  const { offices, reload } = useHrLookups({ directory: false });
  const canManage = !!access?.can.employees;
  const [editing, setEditing] = useState<HrOffice | "new" | null>(null);
  const [toggling, setToggling] = useState<HrOffice | null>(null);
  const [weeklyOff, setWeeklyOff] = useState<number[]>([]);
  const [dueSoonHours, setDueSoonHours] = useState("2");
  const [settingsState, setSettingsState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasAnyHrCapability(access)) return;
    hrService
      .settings()
      .then((s) => {
        setWeeklyOff(s.weeklyOffDays);
        setDueSoonHours(String(s.dueSoonHours));
        setSettingsState("ready");
      })
      .catch(() => setSettingsState("error"));
  }, [access]);

  if (!loading && !hasAnyHrCapability(access))
    return (
      <HrPage title="Settings" icon={<Settings size={20} />}>
        <Panel><PanelState state="forbidden" /></Panel>
      </HrPage>
    );

  const saveSettings = async () => {
    const hours = Number(dueSoonHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 72) return;
    setSaving(true);
    try {
      await hrService.updateSettings({ weeklyOffDays: weeklyOff, dueSoonHours: hours });
    } catch {
      // shown by the API layer
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPage title="Settings" subtitle="Tirvona's offices and how HR counts working days and sends reminders." icon={<Settings size={20} />}>
      <Panel title="Offices" actions={canManage && <EnterpriseButton size="sm" onClick={() => setEditing("new")}>Add office</EnterpriseButton>}>
        {!offices.length ? (
          <PanelState state="missing" missingText="No offices yet. Add Tirvona's two offices with their real names and addresses." />
        ) : (
          <ResponsiveTable
            rows={offices}
            rowKey={(o) => o.id}
            columns={[
              { header: "Office", cell: (o) => <div><p className="font-black">{o.name}</p><p className="text-[10px] text-gray-400">{o.code}</p></div> },
              { header: "Address", cell: (o) => <span className="text-[11px]">{[o.address, o.city].filter(Boolean).join(", ") || "—"}</span>, hideOnMobile: true },
              { header: "Contact", cell: (o) => <span className="text-[11px]">{[o.phone, o.email].filter(Boolean).join(" · ") || "—"}</span>, hideOnMobile: true },
              { header: "Employees", cell: (o) => <Link className="tabular-nums text-[#F28C28] font-black" to={`/admin/hr/employees?officeId=${o.id}`}>{o.employeeCount ?? 0}</Link> },
              { header: "Departments", cell: (o) => <span className="tabular-nums">{o.departmentCount ?? 0}</span> },
              { header: "Status", cell: (o) => <Pill status={o.active ? "active" : "inactive"} /> },
              ...(canManage
                ? [{
                    header: "Actions",
                    cell: (o: HrOffice) => (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <EnterpriseButton size="sm" variant="ghost" onClick={() => setEditing(o)}>Edit</EnterpriseButton>
                        <EnterpriseButton size="sm" variant="ghost" onClick={() => setToggling(o)}>{o.active ? "Deactivate" : "Activate"}</EnterpriseButton>
                      </div>
                    ),
                  }]
                : []),
            ]}
          />
        )}
      </Panel>

      <Panel title="Working week and reminders">
        {settingsState !== "ready" ? (
          <PanelState state={settingsState} />
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 mb-1.5">Weekly off days (not counted as working days in attendance summaries)</legend>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day, index) => (
                  <label key={day} className="inline-flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      checked={weeklyOff.includes(index)}
                      onChange={(e) => setWeeklyOff(e.target.checked ? [...weeklyOff, index].sort() : weeklyOff.filter((d) => d !== index))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Send the “task due soon” reminder this many hours before the deadline" hint="1 to 72 hours. Reminders only run on servers where HR_REMINDERS_ENABLED is on.">
              <input className={`${inputClass} max-w-[120px]`} inputMode="numeric" value={dueSoonHours} disabled={!canManage} onChange={(e) => setDueSoonHours(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </Field>
            {canManage && (
              <EnterpriseButton size="sm" onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</EnterpriseButton>
            )}
          </div>
        )}
      </Panel>

      {editing && (
        <OfficeForm
          office={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {toggling && (
        <ConfirmDrawer
          open
          title={`${toggling.active ? "Deactivate" : "Activate"} ${toggling.name}?`}
          description={toggling.active ? "Refused while active employees still work from this office. Move them first." : "Employees can be assigned to this office again."}
          confirmLabel={toggling.active ? "Deactivate" : "Activate"}
          danger={toggling.active}
          onClose={() => setToggling(null)}
          onConfirm={async () => {
            await hrService.updateOffice(toggling.id, { active: !toggling.active });
            setToggling(null);
            reload();
          }}
        />
      )}
    </HrPage>
  );
};

const OfficeForm: React.FC<{ office: HrOffice | null; onClose: () => void; onSaved: () => void }> = ({ office, onClose, onSaved }) => {
  const [form, setForm] = useState({
    code: office?.code ?? "",
    name: office?.name ?? "",
    address: office?.address ?? "",
    city: office?.city ?? "",
    phone: office?.phone ?? "",
    email: office?.email ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!office && !/^[A-Za-z0-9-]{2,20}$/.test(form.code.trim())) return setError("Office code: 2-20 letters, digits or dashes.");
    if (form.name.trim().length < 2) return setError("Enter the office name.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email.");
    setSaving(true);
    try {
      const body = { name: form.name.trim(), address: form.address.trim(), city: form.city.trim(), phone: form.phone.trim(), email: form.email.trim() };
      if (office) await hrService.updateOffice(office.id, body);
      else await hrService.createOffice({ ...body, code: form.code.trim(), email: body.email || undefined });
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
      title={office ? `Edit ${office.name}` : "Add office"}
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</EnterpriseButton>
        </div>
      }
    >
      <Field label="Office code" required hint={office ? "Cannot be changed." : "Short unique code, e.g. VRN-HQ."}>
        <input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} disabled={!!office} maxLength={20} />
      </Field>
      <Field label="Name" required>
        <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
      </Field>
      <Field label="Address">
        <textarea className={`${inputClass} min-h-[56px]`} value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={300} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="City"><input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} /></Field>
        <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} /></Field>
        <Field label="Email"><input className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={120} /></Field>
      </div>
      {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
    </EnterpriseModal>
  );
};

export default HrSettingsPage;
