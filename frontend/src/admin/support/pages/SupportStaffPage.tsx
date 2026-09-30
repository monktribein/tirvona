import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Users } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { Empty, Panel, PanelState, Pill, ResponsiveTable, useRemote } from "../../../modules/marketplace/ui";
import { supportAdminApi, type SupportStaffMember } from "../../../services/support.service";
import { humanizeLabel } from "../../../utils/labels";
import { SUPPORT_MANAGE_ALL_PERMISSION } from "../supportAccess";

/** Who can work tickets, their current load, and how access is granted. */
export const SupportStaffPage: React.FC = () => {
  const { data, state, error, reload } = useRemote<SupportStaffMember[]>(() => supportAdminApi.staff(), []);

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Support Staff" subtitle="People who can be assigned tickets, and their active workload." icon={<Users size={20} />} />
      <Panel title={<span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#F28C28]" /> How access works</span>}>
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc pl-4">
          <li><b>Super Admin</b> sees and manages every ticket and the categories.</li>
          <li><b>Support</b> role: their own assigned tickets plus the unassigned queue. They can take a ticket, reply, add internal notes, change status/priority and escalate.</li>
          <li>
            <b>Support supervisor</b>: a Support user with the <code className="font-mono">{SUPPORT_MANAGE_ALL_PERMISSION}</code> permission sees every ticket and can assign anyone.
          </li>
          <li><b>Marketplace / Finance / Service managers, National admin</b>: only tickets in categories that list their role (set in Categories).</li>
          <li>Customers only ever see their own tickets, never internal notes, priority or escalation.</li>
        </ul>
        <p className="text-[11px] text-gray-500 pt-2">
          Roles and permissions are managed in{" "}
          <Link to="/admin/users" className="font-black text-[#F28C28] hover:underline">
            User Management
          </Link>
          .
        </p>
      </Panel>
      <Panel title="Staff">
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : !data?.length ? (
          <Empty title="No support staff yet" text="Create a user with the Support role in User Management." />
        ) : (
          <ResponsiveTable
            rows={data}
            rowKey={(s) => s._id}
            columns={[
              { header: "Name", cell: (s) => <span className="block"><b>{s.name}</b><span className="block text-[10px] text-gray-400">{s.email}</span></span> },
              { header: "Role", cell: (s) => humanizeLabel(s.role) },
              { header: "Access", cell: (s) => <Pill tone={s.isSupervisor ? "saffron" : "gray"} label={s.isSupervisor ? "All tickets" : "Own queue"} /> },
              {
                header: "Active tickets",
                cell: (s) => (
                  <Link to={`/admin/support/tickets?assignedTo=${s._id}&status=OPEN,IN_PROGRESS,WAITING_FOR_USER,REOPENED`} className="font-black text-[#F28C28] hover:underline tabular-nums">
                    {s.openTickets}
                  </Link>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
};

export default SupportStaffPage;
