import React, { useState } from "react";
import { Pencil, Plus, Tags } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { Empty, Field, Panel, PanelState, Pill, ResponsiveTable, inputClass, useAction, useRemote } from "../../../modules/marketplace/ui";
import { PRIORITY_META, PriorityPill } from "../../../modules/support/supportUi";
import { ENTITY_TYPE_LABELS, TICKET_PRIORITIES, supportAdminApi, type SupportCategory } from "../../../services/support.service";
import { humanizeLabel } from "../../../utils/labels";

/** Roles (besides Support) that can be made responsible for a category's tickets. */
const HANDLER_ROLES = ["national_admin", "marketplace_manager", "finance_manager", "service_manager"];

type Draft = Partial<SupportCategory> & { key: string; label: string };
const blank: Draft = { key: "", label: "", description: "", defaultPriority: "MEDIUM", isActive: true, sortOrder: 200, entityTypes: [], handlerRoles: [] };

export const SupportCategoriesPage: React.FC = () => {
  const { data, state, error, reload } = useRemote<SupportCategory[]>(() => supportAdminApi.categories(), []);
  const [editing, setEditing] = useState<Draft | null>(null);
  const { busy, run } = useAction();

  const toggle = (list: string[] | undefined, value: string) =>
    (list ?? []).includes(value) ? (list ?? []).filter((v) => v !== value) : [...(list ?? []), value];

  const save = async () => {
    if (!editing) return;
    const payload = {
      label: editing.label.trim(),
      description: editing.description?.trim() ?? "",
      defaultPriority: editing.defaultPriority,
      isActive: editing.isActive,
      sortOrder: Number(editing.sortOrder ?? 0),
      entityTypes: editing.entityTypes ?? [],
      handlerRoles: editing.handlerRoles ?? [],
    };
    const ok = await run(
      "save",
      () => (editing._id ? supportAdminApi.updateCategory(editing._id, payload) : supportAdminApi.createCategory({ ...payload, key: editing.key.trim() })),
      reload,
    );
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Support Categories"
        subtitle="What customers can raise tickets about, and who handles each kind."
        icon={<Tags size={20} />}
        actions={
          <EnterpriseButton size="sm" icon={<Plus size={13} />} onClick={() => setEditing({ ...blank })}>
            Add category
          </EnterpriseButton>
        }
      />
      <Panel>
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <Empty title="No categories" />
        ) : (
          <ResponsiveTable
            rows={data}
            rowKey={(c) => c._id}
            onRowClick={(c) => setEditing({ ...c })}
            columns={[
              { header: "Category", cell: (c) => <span className="block"><b>{c.label}</b><span className="block text-[10px] font-mono text-gray-400">{c.key}</span></span> },
              { header: "Default priority", cell: (c) => <PriorityPill priority={c.defaultPriority} /> },
              { header: "Also handled by", cell: (c) => (c.handlerRoles?.length ? c.handlerRoles.map(humanizeLabel).join(", ") : "Support team"), hideOnMobile: true },
              { header: "Tickets", cell: (c) => c.ticketCount ?? 0 },
              { header: "Status", cell: (c) => <Pill tone={c.isActive ? "green" : "gray"} label={c.isActive ? "Active" : "Hidden"} /> },
              { header: "", cell: () => <Pencil size={13} className="text-gray-400" /> },
            ]}
          />
        )}
      </Panel>

      <EnterpriseModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.label}` : "New category"} maxWidth="2xl">
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" required>
                <input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} maxLength={60} className={inputClass} />
              </Field>
              <Field label="Key" required hint={editing._id ? "Tickets reference the key, so it cannot change." : "Lower-case letters, digits and _ (e.g. darshan_pass)."}>
                <input value={editing.key} disabled={Boolean(editing._id)} onChange={(e) => setEditing({ ...editing, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} maxLength={40} className={inputClass} />
              </Field>
            </div>
            <Field label="Description" hint="Shown to customers under the category.">
              <input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={300} className={inputClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Default priority">
                <select value={editing.defaultPriority} onChange={(e) => setEditing({ ...editing, defaultPriority: e.target.value as SupportCategory["defaultPriority"] })} className={inputClass}>
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order">
                <input type="number" min={0} max={10000} value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label="Visible to customers">
                <select value={editing.isActive ? "1" : "0"} onChange={(e) => setEditing({ ...editing, isActive: e.target.value === "1" })} className={inputClass}>
                  <option value="1">Active</option>
                  <option value="0">Hidden</option>
                </select>
              </Field>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Records a customer can link</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full border border-gray-200 dark:border-slate-700 px-2.5 py-1 cursor-pointer">
                    <input type="checkbox" checked={(editing.entityTypes ?? []).includes(key)} onChange={() => setEditing({ ...editing, entityTypes: toggle(editing.entityTypes, key) })} />
                    {label.replace(" (enter a reference)", "")}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Also handled by (besides the Support team)</legend>
              <div className="flex flex-wrap gap-1.5">
                {HANDLER_ROLES.map((role) => (
                  <label key={role} className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full border border-gray-200 dark:border-slate-700 px-2.5 py-1 cursor-pointer">
                    <input type="checkbox" checked={(editing.handlerRoles ?? []).includes(role)} onChange={() => setEditing({ ...editing, handlerRoles: toggle(editing.handlerRoles, role) })} />
                    {humanizeLabel(role)}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">Those roles see this category's unassigned tickets and can be assigned them.</p>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <EnterpriseButton variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton loading={busy === "save"} disabled={!editing.label.trim() || editing.key.length < 2} onClick={save}>
                Save
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>
    </div>
  );
};

export default SupportCategoriesPage;
