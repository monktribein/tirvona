/* oxlint-disable react/only-export-components -- the ride partner console shell: a hook and the wrapper */
import React, { useState } from "react";
import { Car } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Field, inputClass, Panel, PanelState, useRemote } from "../../marketplace/ui";
import { yatraRidePartner } from "../services/yatra.service";
import { YatraGate } from "../yatraUi";

export function useRidePartnerMe() {
  return useRemote<any>(() => yatraRidePartner.me(), []);
}

/** Ride partner screens: hidden while Yatra is off; unregistered accounts see the registration form. */
export const RidePartnerShell: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode }> = ({ children }) => (
  <YatraGate>
    <Inner>{children}</Inner>
  </YatraGate>
);

const Inner: React.FC<{ children: (me: any, reload: () => unknown) => React.ReactNode }> = ({ children }) => {
  const me = useRidePartnerMe();
  if (me.state !== "ready") return <PanelState state={me.state} error={me.error} onRetry={me.reload} />;
  if (!me.data?.registered) return <Register onDone={me.reload} />;
  return <>{children(me.data, me.reload)}</>;
};

const Register: React.FC<{ onDone: () => unknown }> = ({ onDone }) => {
  const [f, setF] = useState({ businessName: "", city: "", contactPhone: "", serviceAreas: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await yatraRidePartner.register({
        businessName: f.businessName,
        city: f.city,
        contactPhone: f.contactPhone || undefined,
        serviceAreas: [f.city, ...f.serviceAreas.split(",")].map((a) => a.trim()).filter(Boolean),
      });
      toast.success("Registered as a ride partner.");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <EnterprisePageHeader title="Become a Tirvona ride partner" subtitle="Take local rides for Yatra pilgrims: station and bus-stand transfers, temple visits and sightseeing." icon={<Car size={20} />} />
      <Panel>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business or driver name" required className="sm:col-span-2"><input className={inputClass} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} required minLength={3} /></Field>
          <Field label="Base city" required><input className={inputClass} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required minLength={2} /></Field>
          <Field label="Contact phone"><input type="tel" className={inputClass} value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></Field>
          <Field label="Other cities you serve" hint="Comma separated, e.g. Mathura, Govardhan" className="sm:col-span-2"><input className={inputClass} value={f.serviceAreas} onChange={(e) => setF({ ...f, serviceAreas: e.target.value })} /></Field>
          {error && <p role="alert" className="sm:col-span-2 text-xs font-semibold text-rose-600">{error}</p>}
          <div className="sm:col-span-2 flex justify-end"><EnterpriseButton type="submit" disabled={busy}>{busy ? "Registering…" : "Register"}</EnterpriseButton></div>
        </form>
      </Panel>
    </div>
  );
};
