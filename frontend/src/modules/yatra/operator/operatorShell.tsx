/* oxlint-disable react/only-export-components -- the partner console shell: a hook, a permission check and the wrapper */
import React from "react";
import { Link } from "react-router-dom";
import { Bus } from "lucide-react";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Panel, PanelState, useRemote } from "../../marketplace/ui";
import { yatraOperator } from "../services/yatra.service";
import { YatraGate } from "../yatraUi";

/** The caller's partner membership. `registered: false` means not a partner yet. */
export function useOperatorMe() {
  return useRemote<any>(() => yatraOperator.me(), []);
}

/** Partner screens: hidden while Yatra is off, and tell accounts without a partner how to get one. */
export const OperatorShell: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode; allowUnregistered?: boolean }> = ({ children, allowUnregistered }) => (
  <YatraGate>
    <OperatorShellInner allowUnregistered={allowUnregistered}>{children}</OperatorShellInner>
  </YatraGate>
);

const OperatorShellInner: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode; allowUnregistered?: boolean }> = ({ children, allowUnregistered }) => {
  const me = useOperatorMe();
  if (me.state !== "ready") return <PanelState state={me.state} error={me.error} onRetry={me.reload} />;
  if (!me.data?.registered && !allowUnregistered) return <NotAnOrganiser />;
  return <>{children(me.data, me.reload)}</>;
};

export const can = (me: any, permission: string) => Boolean(me?.permissions?.includes(permission));

// ============================================================ not a partner
/** Partner accounts are created by Tirvona (Super Admin). Anyone else who opens this console is told how to get one. */
const NotAnOrganiser: React.FC = () => (
  <div className="max-w-2xl mx-auto space-y-5">
    <EnterprisePageHeader title="This account is not a Yatra partner" subtitle="Partner accounts are created by Tirvona after a short verification." icon={<Bus size={20} />} />
    <Panel>
      <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        <p>If you run pilgrimage tours and want to sell seats on Tirvona, contact the Tirvona team. They will create your partner login and give you the email and a first password.</p>
        <p>If you already received a login, sign out and sign in with those details.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to="/contact" className="inline-flex items-center rounded-full bg-[#F28C28] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#E57C18]">Contact Tirvona</Link>
          <Link to="/yatra-partner" className="inline-flex items-center rounded-full border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-extrabold">How it works</Link>
        </div>
      </div>
    </Panel>
  </div>
);
