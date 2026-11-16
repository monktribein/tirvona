import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Bell, Car, CheckCircle2, ClipboardList, Eye, FileText, IndianRupee, LayoutDashboard, MapPin, Plus, Send, Trash2, Upload, Wallet } from "lucide-react";
import api from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseModal } from "../../../admin/shared/components/EnterpriseModal";
import { askReason, Chips, Empty, Field, inputClass, Pager, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../marketplace/ui";
import { yatraRidePartner } from "../services/yatra.service";
import { dateLong, dateTimeIst, InfoRow, rupees, StatusPill } from "../yatraUi";
import { RidePartnerShell } from "./ridePartnerShell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VEHICLE_TYPES = [["auto", "Auto"], ["e_rickshaw", "E-rickshaw"], ["sedan", "Sedan"], ["suv", "SUV"], ["tempo_traveller", "Tempo traveller"], ["mini_bus", "Mini bus"]];

// ================================================================== dashboard
export const RidePartnerDashboardPage: React.FC = () => (
  <RidePartnerShell>
    {(me) => {
      const p = me.partner;
      const c = me.checklist;
      return (
        <div className="space-y-5">
          <EnterprisePageHeader title={p.businessName} subtitle="Tirvona ride partner" icon={<LayoutDashboard size={20} />} actions={<StatusPill status={p.status} />} />
          {p.status !== "approved" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-4 text-xs font-semibold text-amber-800 dark:text-amber-300">
              {p.status === "draft" || p.status === "rejected" ? "Add your vehicles, upload PAN, driving licence, RC and insurance, then submit for approval. Only approved partners receive ride requests." : p.status === "submitted" ? "Submitted. Tirvona will verify your documents." : "Your account is suspended. Contact Tirvona support."}
              {p.reviewNote && <span className="block mt-1">Note from Tirvona: {p.reviewNote}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="New requests" value={c.newRequests} tone={c.newRequests ? "warn" : undefined} icon={<Bell size={16} />} to="/ride-partner/requests" />
            <Stat label="Active rides" value={c.activeRides} icon={<Car size={16} />} to="/ride-partner/requests?tab=active" />
            <Stat label="Vehicles" value={c.vehicles} icon={<Car size={16} />} to="/ride-partner/vehicles" />
            <Stat label="Service areas" value={p.serviceAreas.length} icon={<MapPin size={16} />} to="/ride-partner/profile" />
          </div>
          {["draft", "rejected"].includes(p.status) && (
            <Panel title="Before you submit">
              <ul className="space-y-1.5 text-xs">
                {[[c.profileComplete, "Phone and service areas", "/ride-partner/profile"], [c.vehicles > 0, "At least one vehicle", "/ride-partner/vehicles"], [c.panUploaded, "PAN card uploaded", "/ride-partner/documents"], [c.licenceUploaded, "Driving licence uploaded", "/ride-partner/documents"], [c.payoutDetails, "Bank or UPI for payouts", "/ride-partner/profile"]].map(([done, label, to]) => (
                  <li key={String(label)} className="flex items-center gap-2"><BadgeCheck size={14} className={done ? "text-emerald-500" : "text-gray-300"} /><Link to={String(to)} className="hover:underline">{String(label)}</Link></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      );
    }}
  </RidePartnerShell>
);

// ==================================================================== profile
export const RidePartnerProfilePage: React.FC = () => <RidePartnerShell>{(me, reload) => <Profile me={me} reload={reload} />}</RidePartnerShell>;

const Profile: React.FC<{ me: any; reload: () => unknown }> = ({ me, reload }) => {
  const p = me.partner;
  const locked = ["submitted", "approved"].includes(p.status);
  const [f, setF] = useState<Record<string, any>>({});
  const [payout, setPayout] = useState({ accountHolderName: p.payout.accountHolderName, accountNumber: "", ifsc: p.payout.ifsc, bankName: p.payout.bankName, upiId: p.payout.upiId });
  const [terms, setTerms] = useState(false);
  const { busy, run } = useAction();
  useEffect(() => {
    setF({ businessName: p.businessName, contactName: p.contactName, contactPhone: p.contactPhone, contactEmail: p.contactEmail, city: p.city, serviceAreas: p.serviceAreas.join(", "), weekdays: p.availability.weekdays, startTime: p.availability.startTime, endTime: p.availability.endTime, accepting: p.availability.accepting, panNumber: p.kyc.panNumber, drivingLicenceNumber: p.kyc.drivingLicenceNumber });
  }, [p]);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      contactName: f.contactName, contactPhone: f.contactPhone || undefined, contactEmail: f.contactEmail || undefined, city: f.city,
      serviceAreas: String(f.serviceAreas).split(",").map((a: string) => a.trim()).filter(Boolean),
      availability: { weekdays: f.weekdays, startTime: f.startTime, endTime: f.endTime, accepting: Boolean(f.accepting) },
    };
    if (!locked) Object.assign(body, { businessName: f.businessName, panNumber: f.panNumber || undefined, drivingLicenceNumber: f.drivingLicenceNumber || undefined });
    return run("profile", () => yatraRidePartner.updateProfile(body), reload, "Profile saved.");
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Profile, service areas and payout" subtitle="Where you work, when you are available, and where Tirvona sends your payouts." icon={<MapPin size={20} />} actions={<StatusPill status={p.status} />} />
      <Panel title="Profile and availability">
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Business name" hint={locked ? "Locked after submission" : undefined}><input className={inputClass} value={f.businessName ?? ""} onChange={set("businessName")} disabled={locked} /></Field>
          <Field label="Contact person"><input className={inputClass} value={f.contactName ?? ""} onChange={set("contactName")} /></Field>
          <Field label="Contact phone" required><input type="tel" className={inputClass} value={f.contactPhone ?? ""} onChange={set("contactPhone")} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={f.contactEmail ?? ""} onChange={set("contactEmail")} /></Field>
          <Field label="Base city"><input className={inputClass} value={f.city ?? ""} onChange={set("city")} /></Field>
          <Field label="Cities you serve" hint="Comma separated"><input className={inputClass} value={f.serviceAreas ?? ""} onChange={set("serviceAreas")} /></Field>
          <Field label="PAN"><input className={inputClass} value={f.panNumber ?? ""} onChange={set("panNumber")} disabled={locked} /></Field>
          <Field label="Driving licence number"><input className={inputClass} value={f.drivingLicenceNumber ?? ""} onChange={set("drivingLicenceNumber")} disabled={locked} /></Field>
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Working days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => {
                const on = (f.weekdays ?? []).includes(i);
                return <button key={d} type="button" aria-pressed={on} onClick={() => setF({ ...f, weekdays: on ? f.weekdays.filter((x: number) => x !== i) : [...(f.weekdays ?? []), i] })} className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${on ? "bg-[#F28C28] border-[#F28C28] text-white" : "border-gray-200 dark:border-slate-700"}`}>{d}</button>;
              })}
            </div>
          </div>
          <Field label="From"><input type="time" className={inputClass} value={f.startTime ?? ""} onChange={set("startTime")} /></Field>
          <Field label="Until"><input type="time" className={inputClass} value={f.endTime ?? ""} onChange={set("endTime")} /></Field>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(f.accepting)} onChange={(e) => setF({ ...f, accepting: e.target.checked })} /> Taking new requests</label>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><EnterpriseButton type="submit" disabled={busy === "profile"}>Save profile</EnterpriseButton></div>
        </form>
      </Panel>
      <Panel title={<span className="flex items-center gap-2"><Wallet size={15} className="text-[#F28C28]" /> Payout account</span>}>
        <p className="text-[11px] text-gray-500 mb-3">Pilgrims pay Tirvona. Tirvona Finance pays you manually. The account number is stored encrypted{p.payout.accountNumberLast4 ? ` (saved: ••••${p.payout.accountNumberLast4})` : ""}.</p>
        <form onSubmit={(e) => { e.preventDefault(); run("payout", () => yatraRidePartner.setPayout(Object.fromEntries(Object.entries(payout).filter(([, v]) => v))), () => { setPayout({ ...payout, accountNumber: "" }); return reload(); }, "Payout details saved."); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Account holder" required><input className={inputClass} value={payout.accountHolderName} onChange={(e) => setPayout({ ...payout, accountHolderName: e.target.value })} required minLength={2} /></Field>
          <Field label="Account number"><input className={inputClass} inputMode="numeric" value={payout.accountNumber} onChange={(e) => setPayout({ ...payout, accountNumber: e.target.value })} autoComplete="off" /></Field>
          <Field label="IFSC"><input className={inputClass} value={payout.ifsc} onChange={(e) => setPayout({ ...payout, ifsc: e.target.value.toUpperCase() })} /></Field>
          <Field label="Bank"><input className={inputClass} value={payout.bankName} onChange={(e) => setPayout({ ...payout, bankName: e.target.value })} /></Field>
          <Field label="UPI id"><input className={inputClass} value={payout.upiId} onChange={(e) => setPayout({ ...payout, upiId: e.target.value })} /></Field>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><EnterpriseButton type="submit" disabled={busy === "payout"}>Save payout account</EnterpriseButton></div>
        </form>
      </Panel>
      {["draft", "rejected"].includes(p.status) && (
        <Panel title="Submit for approval">
          <label className="flex items-start gap-2 text-xs mb-3"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" /><span>My vehicles have valid registration, permit and insurance; my drivers hold valid licences; pilgrims pay Tirvona and I never collect cash from them.</span></label>
          <EnterpriseButton icon={<Send size={13} />} disabled={!terms || busy === "submit"} onClick={() => run("submit", () => yatraRidePartner.submit(), reload, "Submitted for approval.")}>Submit to Tirvona</EnterpriseButton>
        </Panel>
      )}
    </div>
  );
};

// =================================================================== vehicles
export const RidePartnerVehiclesPage: React.FC = () => <RidePartnerShell>{(me, reload) => <Vehicles me={me} reload={reload} />}</RidePartnerShell>;

const Vehicles: React.FC<{ me: any; reload: () => unknown }> = ({ me, reload }) => {
  const [list, setList] = useState<any[]>(me.partner.vehicles);
  const { busy, run } = useAction();
  const update = (i: number, patch: Record<string, unknown>) => setList(list.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Vehicles" subtitle="Every vehicle you may send. Upload each one's RC and insurance under Documents." icon={<Car size={20} />} />
      <Panel actions={<EnterpriseButton size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setList([...list, { registrationNumber: "", vehicleType: "sedan", seats: 4, isAc: true }])}>Add vehicle</EnterpriseButton>}>
        {!list.length ? <Empty icon={<Car size={26} className="text-gray-300" />} title="No vehicles yet" /> : (
          <div className="space-y-2">
            {list.map((v, i) => (
              <div key={v.id ?? i} className="grid grid-cols-2 sm:grid-cols-[1fr_160px_90px_80px_auto] gap-2 items-center">
                <input aria-label="Registration number" placeholder="Registration number" className={`${inputClass} col-span-2 sm:col-span-1`} value={v.registrationNumber} onChange={(e) => update(i, { registrationNumber: e.target.value })} />
                <select aria-label="Type" className={inputClass} value={v.vehicleType} onChange={(e) => update(i, { vehicleType: e.target.value })}>{VEHICLE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input aria-label="Seats" type="number" min={1} max={60} className={inputClass} value={v.seats} onChange={(e) => update(i, { seats: Number(e.target.value) })} />
                <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={Boolean(v.isAc)} onChange={(e) => update(i, { isAc: e.target.checked })} /> AC</label>
                <button type="button" aria-label="Remove vehicle" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-3"><EnterpriseButton disabled={busy === "save"} onClick={() => run("save", () => yatraRidePartner.setVehicles(list.map((v) => ({ ...v, seats: Number(v.seats) }))), reload, "Vehicles saved.")}>Save vehicles</EnterpriseButton></div>
      </Panel>
    </div>
  );
};

// ================================================================== documents
const DOC_TYPES = ["pan_card", "driving_licence", "registration_certificate", "insurance", "tourist_permit", "contract_carriage_permit", "address_proof", "cancelled_cheque", "other"];

export const RidePartnerDocumentsPage: React.FC = () => <RidePartnerShell>{() => <Documents />}</RidePartnerShell>;

const Documents: React.FC = () => {
  const docs = useRemote<any[]>(() => yatraRidePartner.documents(), []);
  const [form, setForm] = useState({ documentType: "", documentNumber: "", expiresAt: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { busy, run } = useAction();
  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !form.documentType) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", form.documentType);
      if (form.documentNumber) body.append("documentNumber", form.documentNumber);
      if (form.expiresAt) body.append("expiresAt", new Date(`${form.expiresAt}T00:00:00+05:30`).toISOString());
      await yatraRidePartner.uploadDocument(body);
      toast.success("Uploaded privately for verification.");
      setFile(null);
      setForm({ documentType: "", documentNumber: "", expiresAt: "" });
      docs.reload();
    } catch {
      // shown by the API client
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="KYC and vehicle documents" subtitle="Stored privately; only you and Tirvona's verification team can open them." icon={<FileText size={20} />} />
      <Panel title="Upload">
        <form onSubmit={upload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <Field label="Document" required><select className={inputClass} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} required><option value="">Choose…</option>{DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          <Field label="Number"><input className={inputClass} value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} /></Field>
          <Field label="Valid until"><input type="date" className={inputClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
          <Field label="File (JPG, PNG, WEBP, PDF)" required><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></Field>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><EnterpriseButton type="submit" icon={<Upload size={13} />} disabled={uploading || !file}>{uploading ? "Uploading…" : "Upload"}</EnterpriseButton></div>
        </form>
      </Panel>
      <Panel title="Uploaded">
        {docs.state !== "ready" ? <PanelState state={docs.state} error={docs.error} onRetry={docs.reload} /> : !docs.data?.length ? <Empty title="No documents yet" /> : (
          <ResponsiveTable
            rows={docs.data}
            rowKey={(d) => d.id}
            columns={[
              { header: "Document", cell: (d) => <span className="font-bold">{d.documentType.replace(/_/g, " ")}</span> },
              { header: "Number", cell: (d) => d.documentNumber || "—" },
              { header: "Valid until", cell: (d) => (d.expiresAt ? dateLong(d.expiresAt) : "—") },
              { header: "Status", cell: (d) => <div><StatusPill status={d.status} />{d.reviewNote && <p className="text-[10px] text-gray-500">{d.reviewNote}</p>}</div> },
              { header: "Actions", cell: (d) => (
                <div className="flex gap-1.5 justify-end">
                  <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={async () => window.open((await yatraRidePartner.documentLink(d.id)).data.data.url, "_blank", "noopener,noreferrer")}>View</EnterpriseButton>
                  {d.status !== "approved" && <EnterpriseButton size="sm" variant="ghost" icon={<Trash2 size={12} />} disabled={busy === d.id} onClick={() => window.confirm("Delete this document?") && run(d.id, () => yatraRidePartner.deleteDocument(d.id), docs.reload)}>Delete</EnterpriseButton>}
                </div>
              ) },
            ]}
          />
        )}
      </Panel>
    </div>
  );
};

// =================================================================== requests
export const RidePartnerRequestsPage: React.FC = () => <RidePartnerShell>{(me) => <Requests me={me} />}</RidePartnerShell>;

const Requests: React.FC<{ me: any }> = ({ me }) => {
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") ?? "new");
  const list = useRemote<any[]>(() => yatraRidePartner.requests(tab), [tab]);
  const [accepting, setAccepting] = useState<any | null>(null);
  const { busy, run } = useAction();
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Ride requests" subtitle="Accept with your fare and vehicle. The ride is confirmed only after the pilgrim pays Tirvona; then you see their name and phone." icon={<ClipboardList size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={tab} onChange={setTab} options={[{ value: "new", label: "New" }, { value: "accepted", label: "Awaiting payment" }, { value: "active", label: "Confirmed & active" }, { value: "completed", label: "Completed" }, { value: "rejected", label: "Declined" }, { value: "cancelled", label: "Cancelled" }]} />
          {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty icon={<Car size={26} className="text-gray-300" />} title="Nothing here" /> : (
            <ul className="divide-y divide-gray-50 dark:divide-slate-800">
              {list.data.map((r) => (
                <li key={r.id} className="py-3 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2 items-center"><span className="text-xs font-black">{r.requestNumber} · {dateTimeIst(r.pickupAt)}</span><StatusPill status={r.status} /></div>
                  <p className="text-xs"><MapPin size={11} className="inline" /> {r.pickup.address}{r.pickup.landmark ? ` (${r.pickup.landmark})` : ""} → {r.drop.address}</p>
                  <p className="text-[11px] text-gray-500">{r.passengers} passenger{r.passengers === 1 ? "" : "s"} · {r.rideType.replace(/_/g, " ")} · {r.city}{r.quotedAmount ? ` · ${rupees(r.quotedAmount)}` : ""}</p>
                  {r.notes && <p className="text-[11px] text-gray-500">“{r.notes}”</p>}
                  {r.customer && <p className="text-[11px] font-bold">{r.customer.name} · {r.customer.phone}</p>}
                  {r.assignment?.vehicleRegistration && <p className="text-[11px] text-gray-500">{r.assignment.vehicleRegistration}{r.assignment.driverName ? ` · ${r.assignment.driverName}` : ""}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status === "partner_pending" && <><EnterpriseButton size="sm" icon={<CheckCircle2 size={12} />} onClick={() => setAccepting(r)}>Accept with fare</EnterpriseButton><EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => { const reason = askReason("Why can you not take this ride?"); if (reason) run(r.id, () => yatraRidePartner.reject(r.id, reason), list.reload, "Declined."); }}>Decline</EnterpriseButton></>}
                    {r.status === "confirmed" && <EnterpriseButton size="sm" disabled={busy === r.id} onClick={() => run(r.id, () => yatraRidePartner.start(r.id), list.reload, "Ride started.")}>Start ride</EnterpriseButton>}
                    {r.status === "in_progress" && <EnterpriseButton size="sm" variant="success" disabled={busy === r.id} onClick={() => run(r.id, () => yatraRidePartner.complete(r.id), list.reload, "Ride completed.")}>Complete ride</EnterpriseButton>}
                    {["accepted", "confirmed"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => { const reason = askReason("Why are you cancelling? The pilgrim will be refunded in full."); if (reason) run(r.id, () => yatraRidePartner.cancel(r.id, reason), list.reload, "Cancelled."); }}>Cancel</EnterpriseButton>}
                    {["confirmed", "in_progress", "completed"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" onClick={() => { const description = askReason("Describe the problem for Tirvona:", 5); if (description) run(`i${r.id}`, () => yatraRidePartner.reportIssue(r.id, { description }), undefined, "Reported to Tirvona."); }}>Report issue</EnterpriseButton>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
      {accepting && <AcceptModal ride={accepting} vehicles={me.partner.vehicles} onClose={() => setAccepting(null)} onDone={() => { setAccepting(null); list.reload(); }} />}
    </div>
  );
};

const AcceptModal: React.FC<{ ride: any; vehicles: any[]; onClose: () => void; onDone: () => void }> = ({ ride, vehicles, onClose, onDone }) => {
  const fit = vehicles.filter((v) => Number(v.seats) >= Number(ride.passengers));
  const [f, setF] = useState({ fare: "", vehicleId: fit[0]?.id ?? "", driverName: "", driverPhone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await yatraRidePartner.accept(ride.id, { fare: Number(f.fare), vehicleId: f.vehicleId, driverName: f.driverName || undefined, driverPhone: f.driverPhone || undefined, note: f.note || undefined });
      toast.success("Accepted. The pilgrim will be asked to pay.");
      onDone();
    } catch {
      // shown by the API client
    } finally {
      setBusy(false);
    }
  };
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Accept ${ride.requestNumber}`}>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Your fare (₹)" required><input type="number" min={1} step="1" className={inputClass} value={f.fare} onChange={(e) => setF({ ...f, fare: e.target.value })} required /></Field>
        <Field label="Vehicle" required hint={fit.length ? undefined : "None of your vehicles seats this many people."}><select className={inputClass} value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })} required>{fit.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.seats} seats</option>)}</select></Field>
        <Field label="Driver name"><input className={inputClass} value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} /></Field>
        <Field label="Driver phone"><input type="tel" className={inputClass} value={f.driverPhone} onChange={(e) => setF({ ...f, driverPhone: e.target.value })} /></Field>
        <Field label="Note for the pilgrim" className="sm:col-span-2"><input className={inputClass} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Cancel</EnterpriseButton><EnterpriseButton type="submit" disabled={busy || !fit.length}>{busy ? "Saving…" : "Accept"}</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

// ============================================================ earnings/payouts
export const RidePartnerEarningsPage: React.FC = () => <RidePartnerShell>{() => <PayeeMoney kind="partner" />}</RidePartnerShell>;

/** Payable balance, statement and payout requests — shared by ride partners and partners. */
export const PayeeMoney: React.FC<{ kind: "partner" | "operator"; fetchEarnings?: (p: Record<string, unknown>) => Promise<any>; fetchPayouts?: () => Promise<any>; requestPayout?: (amount: number, note?: string) => Promise<any>; cancelPayout?: (id: string) => Promise<any>; proof?: (id: string) => Promise<any>; canRequest?: boolean }> = (props) => {
  const isPartner = props.kind === "partner";
  const fetchEarnings = props.fetchEarnings ?? ((p) => yatraRidePartner.earnings(p));
  const fetchPayouts = props.fetchPayouts ?? (() => yatraRidePartner.payouts());
  const requestPayout = props.requestPayout ?? ((a, n) => yatraRidePartner.requestPayout(a, n));
  const cancelPayout = props.cancelPayout ?? ((id) => yatraRidePartner.cancelPayout(id));
  const proof = props.proof ?? ((id) => yatraRidePartner.payoutProof(id));
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<any>(null);
  const statement = useRemote<any[]>(async () => {
    const res = await fetchEarnings({ page, limit: 25 });
    setSummary(res.data.summary);
    return res;
  }, [page]);
  const payouts = useRemote<any>(() => fetchPayouts(), []);
  const { busy, run } = useAction();
  const payoutRows: any[] = Array.isArray(payouts.data) ? payouts.data : payouts.data?.items ?? [];
  const ask = () => {
    const raw = window.prompt(`Amount to request (up to ${rupees(summary?.requestable ?? 0)}):`, String(summary?.requestable ?? ""));
    if (!raw) return;
    run("request", () => requestPayout(Number(raw)), () => { statement.reload(); return payouts.reload(); }, "Payout requested.");
  };
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Earnings and payouts" subtitle={isPartner ? "Fares from completed rides, after Tirvona's commission and taxes." : "Booking earnings after Tirvona's commission, taxes and refunds."} icon={<IndianRupee size={20} />} actions={props.canRequest !== false && <EnterpriseButton icon={<Send size={13} />} disabled={!summary?.requestable || busy === "request"} onClick={ask}>Request payout</EnterpriseButton>} />
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Payable now" value={rupees(summary.available)} tone="ok" hint={summary.inOpenPayouts ? `${rupees(summary.inOpenPayouts)} in an open request` : "Delivered and unpaid"} />
            <Stat label="Not yet payable" value={rupees(summary.pending)} hint={isPartner ? "Rides not completed" : "Journeys not finished"} />
            <Stat label="Paid to you" value={rupees(summary.transfers)} />
            <Stat label="Gross earned" value={rupees(summary.grossEarnings + (summary.referralEarnings ?? 0))} />
          </div>
          <Panel title="How your payable is worked out">
            <InfoRow label="Gross earnings">{rupees(summary.grossEarnings)}</InfoRow>
            {summary.referralEarnings > 0 && <InfoRow label="Referral earnings">{rupees(summary.referralEarnings)}</InfoRow>}
            <InfoRow label="Tirvona commission">−{rupees(summary.commission)}</InfoRow>
            <InfoRow label="GST on commission">−{rupees(summary.taxOnCommission)}</InfoRow>
            <InfoRow label="TDS withheld">−{rupees(summary.tds)}</InfoRow>
            {summary.refundDeductions > 0 && <InfoRow label="Refunded to customers">−{rupees(summary.refundDeductions)}</InfoRow>}
            {summary.adjustments !== 0 && <InfoRow label="Adjustments">{rupees(summary.adjustments)}</InfoRow>}
            <InfoRow label="Transfers received">−{rupees(summary.transfers)}</InfoRow>
            <InfoRow label="Balance (payable + not yet payable)">{rupees(summary.available + summary.pending)}</InfoRow>
          </Panel>
        </>
      )}
      <Panel title="Payout history">
        {payouts.state !== "ready" ? <PanelState state={payouts.state} /> : !payoutRows.length ? <p className="text-xs text-gray-500">No payouts yet. Tirvona pays by bank transfer or UPI and records the reference here.</p> : (
          <ResponsiveTable
            rows={payoutRows}
            rowKey={(p) => p.id}
            columns={[
              { header: "Payout", cell: (p) => <div><p className="font-black">{p.payoutNumber}</p><p className="text-[10px] text-gray-500">{dateLong(p.createdAt)}</p></div> },
              { header: "Amount", cell: (p) => rupees(p.amount) },
              { header: "Transfer", cell: (p) => (p.transfer ? `${p.transfer.method.toUpperCase()} ${p.transfer.reference} · ${dateLong(p.transfer.transferDate)}` : "—") },
              { header: "Status", cell: (p) => <div><StatusPill status={p.status} />{p.rejectionReason && <p className="text-[10px] text-gray-500">{p.rejectionReason}</p>}</div> },
              { header: "Actions", cell: (p) => (
                <div className="flex gap-1.5 justify-end">
                  {p.transfer?.hasProof && <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={async () => window.open((await proof(p.id)).data.data.url, "_blank", "noopener,noreferrer")}>Proof</EnterpriseButton>}
                  {["pending", "under_review"].includes(p.status) && props.canRequest !== false && <EnterpriseButton size="sm" variant="ghost" disabled={busy === p.id} onClick={() => run(p.id, () => cancelPayout(p.id), () => { statement.reload(); return payouts.reload(); }, "Cancelled.")}>Cancel</EnterpriseButton>}
                </div>
              ) },
            ]}
          />
        )}
      </Panel>
      <Panel title="Statement">
        {statement.state !== "ready" ? <PanelState state={statement.state} error={statement.error} onRetry={statement.reload} /> : !statement.data?.length ? <Empty title="Nothing yet" /> : (
          <>
            <ResponsiveTable
              rows={statement.data}
              rowKey={(e) => e.id}
              columns={[
                { header: "Date", cell: (e) => dateTimeIst(e.createdAt) },
                { header: "Item", cell: (e) => <span>{e.description || e.entryType.replace(/_/g, " ")}</span> },
                { header: "Reference", cell: (e) => e.reference || "—", hideOnMobile: true },
                { header: "Amount", cell: (e) => <span className={`font-black tabular-nums ${e.direction === "debit" ? "text-rose-600" : "text-emerald-600"}`}>{e.direction === "debit" ? "−" : "+"}{rupees(e.amount)}</span> },
              ]}
            />
            <Pager page={page} limit={25} total={statement.meta.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
};

// ============================================================== notifications
export const RidePartnerNotificationsPage: React.FC = () => <RidePartnerShell>{() => <Notifications />}</RidePartnerShell>;

const Notifications: React.FC = () => {
  const inbox = useRemote<any[]>(() => api.get("/notifications", { params: { page: 1, limit: 50 } }), []);
  const rows = (inbox.data ?? []).filter((n: any) => String(n.kind ?? "").startsWith("yatra"));
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Notifications" subtitle="New requests, payments and payouts." icon={<Bell size={20} />} />
      <Panel>
        {inbox.state !== "ready" ? <PanelState state={inbox.state} error={inbox.error} onRetry={inbox.reload} /> : !rows.length ? <Empty title="No notifications" /> : (
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {rows.map((n: any) => (
              <li key={n._id ?? n.id} className="py-3"><p className="text-xs font-black">{n.title}</p><p className="text-xs text-gray-500">{n.body}</p><div className="flex gap-3 text-[10px] text-gray-400 mt-0.5"><span>{dateTimeIst(n.createdAt)}</span>{n.deepLink && <Link to={n.deepLink} className="text-[#F28C28] font-bold">Open</Link>}</div></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};
