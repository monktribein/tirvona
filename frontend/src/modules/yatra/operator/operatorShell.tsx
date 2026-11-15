/* oxlint-disable react/only-export-components -- the organiser console shell: a hook, a permission check and the wrapper */
import React, { useState } from "react";
import { Bus } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Field, inputClass, Panel, PanelState, useRemote } from "../../marketplace/ui";
import { yatraOperator } from "../services/yatra.service";
import { YatraGate } from "../yatraUi";

/** The caller's organiser membership. `registered: false` means not an organiser yet. */
export function useOperatorMe() {
  return useRemote<any>(() => yatraOperator.me(), []);
}

/** Organiser screens: hidden while Yatra is off, and send unregistered accounts to registration. */
export const OperatorShell: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode; allowUnregistered?: boolean }> = ({ children, allowUnregistered }) => (
  <YatraGate>
    <OperatorShellInner allowUnregistered={allowUnregistered}>{children}</OperatorShellInner>
  </YatraGate>
);

const OperatorShellInner: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode; allowUnregistered?: boolean }> = ({ children, allowUnregistered }) => {
  const me = useOperatorMe();
  if (me.state !== "ready") return <PanelState state={me.state} error={me.error} onRetry={me.reload} />;
  if (!me.data?.registered && !allowUnregistered) return <RegisterOperator onDone={me.reload} />;
  return <>{children(me.data, me.reload)}</>;
};

export const can = (me: any, permission: string) => Boolean(me?.permissions?.includes(permission));

// ============================================================== registration
const RegisterOperator: React.FC<{ onDone: () => unknown }> = ({ onDone }) => {
  const [f, setF] = useState({ organisationName: "", organisationType: "proprietorship", contactPhone: "", city: "", state: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await yatraOperator.register(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
      toast.success("Organiser registered.");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <EnterprisePageHeader title="Register as a Yatra organiser" subtitle="Use this Tirvona account to run your organisation. You can add managers and staff later." icon={<Bus size={20} />} />
      <Panel>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Organisation name" required className="sm:col-span-2"><input className={inputClass} value={f.organisationName} onChange={(e) => setF({ ...f, organisationName: e.target.value })} required minLength={3} /></Field>
          <Field label="Type">
            <select className={inputClass} value={f.organisationType} onChange={(e) => setF({ ...f, organisationType: e.target.value })}>
              {["proprietorship", "partnership", "private_limited", "llp", "trust", "society", "other"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Contact phone"><input type="tel" className={inputClass} value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></Field>
          <Field label="City"><input className={inputClass} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="State"><input className={inputClass} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></Field>
          {error && <p role="alert" className="sm:col-span-2 text-xs font-semibold text-rose-600">{error}</p>}
          <div className="sm:col-span-2 flex justify-end"><EnterpriseButton type="submit" disabled={busy}>{busy ? "Registering…" : "Register organisation"}</EnterpriseButton></div>
        </form>
      </Panel>
    </div>
  );
};

