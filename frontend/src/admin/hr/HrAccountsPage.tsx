import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { Panel, PanelState, Pill, ResponsiveTable } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrAccountRow } from "../../services/hr.service";
import { HrPage, SelectField, useHrAccess, useHrLookups } from "./hrUi";

type AreaRole = "hr" | "executive";

/** What differs between the HR and the Executive version of this page. */
const ROLE_PAGE: Record<
  AreaRole,
  {
    title: string;
    loginLabel: string;
    roleOption: string;
    section: { label: string; to: string };
    list: () => Promise<HrAccountRow[]>;
    assign: (userId: string, officeId: string) => Promise<HrAccountRow>;
  }
> = {
  hr: {
    title: "HR Accounts",
    loginLabel: "HR",
    roleOption: "HR (Office Location Access)",
    section: { label: "HR Management", to: "/admin/hr" },
    list: hrService.hrAccounts,
    assign: hrService.assignHrOffice,
  },
  executive: {
    title: "Executive Accounts",
    loginLabel: "Executive",
    roleOption: "Executive (Office Location Access)",
    section: { label: "Executive Management", to: "/admin/executive/accounts" },
    list: hrService.executiveAccounts,
    assign: hrService.assignExecutiveOffice,
  },
};

/**
 * Logins created with the HR or Executive role in User Management, and the office each one
 * works from. The office's city is the only area that login can see in Leads, Food, Temples,
 * Pandits and Stays.
 */
export const HrAccountsPage: React.FC<{ role?: AreaRole }> = ({ role = "hr" }) => {
  const page = ROLE_PAGE[role];
  const { access, loading } = useHrAccess();
  const { offices } = useHrLookups({ directory: false });
  const canManage = !!access?.can.employees;
  const [rows, setRows] = useState<HrAccountRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [assigning, setAssigning] = useState<HrAccountRow | null>(null);

  const load = useCallback(() => {
    setState("loading");
    page
      .list()
      .then((data) => {
        setRows(data);
        setState(data.length ? "ready" : "missing");
      })
      .catch(() => setState("error"));
  }, [page]);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  if (!loading && !canManage)
    return (
      <HrPage title={page.title} section={page.section} icon={<MapPin size={20} />}>
        <Panel><PanelState state="forbidden" /></Panel>
      </HrPage>
    );

  return (
    <HrPage
      title={page.title}
      section={page.section}
      subtitle={`Logins with the ${page.loginLabel} role. Assign each one an office: it can then manage Leads, Food, Temples, Pandits and Stays for that office's city only.`}
      icon={<MapPin size={20} />}
    >
      <Panel title={`${page.loginLabel} logins`}>
        {state !== "ready" ? (
          <PanelState
            state={state}
            onRetry={load}
            missingText={`No ${page.loginLabel} logins yet. Create one in User Management with the role “${page.roleOption}” and make it Active.`}
          />
        ) : (
          <ResponsiveTable
            rows={rows}
            rowKey={(r) => r.userId}
            columns={[
              { header: `${page.loginLabel} login`, cell: (r) => <div><p className="font-black">{r.name}</p><p className="text-[10px] text-gray-400">{r.email}</p></div> },
              { header: "Account", cell: (r) => <Pill status={r.accountStatus} /> },
              {
                header: "Office",
                cell: (r) =>
                  r.office ? (
                    <div><p className="font-bold">{r.office.name}</p><p className="text-[10px] text-gray-400">{r.office.city || "No city"}</p></div>
                  ) : (
                    <span className="text-[11px] text-gray-400">Not assigned</span>
                  ),
              },
              {
                header: "Can see",
                cell: (r) =>
                  r.area ? (
                    <span className="text-[11px]">{r.area}</span>
                  ) : (
                    <Pill tone="amber" label="Nothing yet" />
                  ),
                hideOnMobile: true,
              },
              {
                header: "Actions",
                cell: (r) => (
                  <div className="flex justify-end">
                    {r.accountStatus === "active" ? (
                      <EnterpriseButton size="sm" variant="ghost" onClick={() => setAssigning(r)}>
                        {r.office ? "Change office" : "Assign office"}
                      </EnterpriseButton>
                    ) : (
                      <Link to="/admin/users" className="text-[11px] font-bold text-[#F28C28]">Activate in User Management</Link>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>

      {assigning && (
        <AssignOfficeModal
          row={assigning}
          assign={page.assign}
          options={offices.filter((o) => o.active).map((o) => ({ value: o.id, label: o.city ? `${o.name} (${o.city})` : `${o.name} (no city)` }))}
          hasCityless={offices.some((o) => o.active && !o.city)}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            load();
          }}
        />
      )}
    </HrPage>
  );
};

const AssignOfficeModal: React.FC<{
  row: HrAccountRow;
  assign: (userId: string, officeId: string) => Promise<HrAccountRow>;
  options: Array<{ value: string; label: string }>;
  hasCityless: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, assign, options, hasCityless, onClose, onSaved }) => {
  const [officeId, setOfficeId] = useState(row.office?.id ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!officeId) return;
    setSaving(true);
    try {
      await assign(row.userId, officeId);
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
      title={`Office for ${row.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose} disabled={saving}>Cancel</EnterpriseButton>
          <EnterpriseButton onClick={save} disabled={saving || !officeId}>{saving ? "Saving…" : "Save"}</EnterpriseButton>
        </div>
      }
    >
      <SelectField label="Office" required value={officeId} onChange={setOfficeId} options={options} placeholder="Choose an office" />
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        This login will see only records whose address is in the office's city. A Vrindavan or Mathura office covers both places.
      </p>
      {hasCityless && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          An office without a city cannot be assigned. Add its city in <Link to="/admin/hr/settings" className="font-bold text-[#F28C28]">HR Settings</Link>.
        </p>
      )}
    </EnterpriseModal>
  );
};

export default HrAccountsPage;
