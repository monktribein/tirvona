import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bus,
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Plus,
  Route,
  Send,
  Ticket,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseModal } from "../../../admin/shared/components/EnterpriseModal";
import { Empty, Field, inputClass, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../marketplace/ui";
import { yatraOperator } from "../services/yatra.service";
import { can, OperatorShell } from "./operatorShell";
import { dateLong, SeatMap, StatusPill } from "../yatraUi";

const STATUS_NOTE: Record<string, string> = {
  draft: "Complete your profile, upload your PAN card and submit your organisation for verification.",
  submitted: "Submitted. Tirvona's verification team will review your organisation.",
  under_review: "Tirvona is reviewing your organisation.",
  approved: "Verified by Tirvona. Submit tours for review and open departures.",
  rejected: "Tirvona could not approve your organisation. Fix the issue below and submit again.",
  suspended: "Your organisation is suspended. Contact Tirvona support.",
};

// ================================================================= dashboard
export const OperatorDashboardPage: React.FC = () => (
  <OperatorShell>
    {(me) => {
      const op = me.operator;
      const c = me.checklist;
      return (
        <div className="space-y-5">
          <EnterprisePageHeader title={op.displayName} subtitle={`Yatra organiser · your role: ${me.member.role}`} icon={<LayoutDashboard size={20} />} actions={<StatusPill status={op.status} />} />
          <div className={`rounded-2xl border p-4 text-xs font-semibold ${op.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"}`}>
            {STATUS_NOTE[op.status]}
            {op.reviewNote && <span className="block mt-1">Note from Tirvona: {op.reviewNote}</span>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Verified vehicles" value={c.approvedVehicles} icon={<Bus size={16} />} to="/operator/vehicles" />
            <Stat label="Published tours" value={c.publishedTours} icon={<Route size={16} />} to="/operator/tours" />
            <Stat label="Upcoming departures" value={c.upcomingDepartures} icon={<CalendarDays size={16} />} to="/operator/departures" />
            <Stat label="Documents in review" value={c.documentsPending} icon={<FileText size={16} />} to="/operator/documents" tone={c.documentsPending ? "warn" : undefined} />
          </div>
          {["draft", "rejected"].includes(op.status) && (
            <Panel title="Before you submit">
              <ul className="space-y-1.5 text-xs">
                {[
                  [c.profileComplete, "Contact phone, city and PAN number in your profile", "/operator/profile"],
                  [c.panUploaded, "PAN card uploaded", "/operator/documents"],
                  [c.payoutDetails, "Bank or UPI details for payouts (recommended)", "/operator/profile"],
                ].map(([done, label, to]) => (
                  <li key={String(label)} className="flex items-center gap-2">
                    <BadgeCheck size={14} className={done ? "text-emerald-500" : "text-gray-300"} />
                    <Link to={String(to)} className="hover:underline">{String(label)}</Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Quick actions">
            <div className="flex flex-wrap gap-2">
              {can(me, "createBookings") && <Link to="/operator/bookings/new" className="text-xs font-extrabold px-3 py-2 rounded-full bg-[#F28C28] text-white inline-flex items-center gap-1.5"><Ticket size={13} /> Book for a customer</Link>}
              {can(me, "manageTours") && <Link to="/operator/tours/new" className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><Plus size={13} /> New tour</Link>}
              {can(me, "manageDepartures") && <Link to="/operator/departures" className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><CalendarDays size={13} /> Departures</Link>}
              <Link to="/operator/bookings" className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><ClipboardList size={13} /> Bookings</Link>
            </div>
          </Panel>
        </div>
      );
    }}
  </OperatorShell>
);

// =================================================================== profile
export const OperatorProfilePage: React.FC = () => <OperatorShell>{(me, reload) => <ProfileEditor me={me} reload={reload} />}</OperatorShell>;

const ProfileEditor: React.FC<{ me: any; reload: () => unknown }> = ({ me, reload }) => {
  const op = me.operator;
  const owner = can(me, "manageOrganisation");
  const locked = ["submitted", "under_review", "approved"].includes(op.status);
  const [f, setF] = useState<Record<string, any>>({});
  const [payout, setPayout] = useState({ accountHolderName: op.payout.accountHolderName, accountNumber: "", ifsc: op.payout.ifsc, bankName: op.payout.bankName, upiId: op.payout.upiId });
  const [terms, setTerms] = useState(false);
  const { busy, run } = useAction();
  useEffect(() => {
    setF({
      organisationName: op.organisationName, displayName: op.displayName, organisationType: op.organisationType, description: op.description,
      contactName: op.contactName, contactPhone: op.contactPhone, contactEmail: op.contactEmail, address: op.address, city: op.city, state: op.state, pincode: op.pincode,
      yearsInBusiness: op.yearsInBusiness, panNumber: op.kyc.panNumber, gstin: op.kyc.gstin, registrationNumber: op.kyc.registrationNumber,
    });
  }, [op]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
      if (locked && ["organisationName", "organisationType", "panNumber", "gstin", "registrationNumber"].includes(k)) continue;
      if (v === "" && ["contactEmail", "pincode", "panNumber", "gstin"].includes(k)) continue;
      body[k] = k === "yearsInBusiness" ? Number(v) || 0 : v;
    }
    return run("profile", () => yatraOperator.updateProfile(body), reload, "Profile saved.");
  };
  const savePayout = (e: React.FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(payout).filter(([, v]) => v));
    return run("payout", () => yatraOperator.setPayout(body), () => { setPayout({ ...payout, accountNumber: "" }); return reload(); }, "Payout details saved.");
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Organisation profile" subtitle="Your public name, contact details, KYC numbers and payout account." icon={<Users size={20} />} actions={<StatusPill status={op.status} />} />
      <Panel title="Profile and KYC">
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Legal organisation name" required hint={locked ? "Locked after submission" : undefined}><input className={inputClass} value={f.organisationName ?? ""} onChange={set("organisationName")} disabled={locked || !owner} required /></Field>
          <Field label="Name shown to pilgrims"><input className={inputClass} value={f.displayName ?? ""} onChange={set("displayName")} disabled={!owner} /></Field>
          <Field label="Organisation type">
            <select className={inputClass} value={f.organisationType ?? ""} onChange={set("organisationType")} disabled={locked || !owner}>
              {["proprietorship", "partnership", "private_limited", "llp", "trust", "society", "other"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Contact person"><input className={inputClass} value={f.contactName ?? ""} onChange={set("contactName")} disabled={!owner} /></Field>
          <Field label="Contact phone" required><input type="tel" className={inputClass} value={f.contactPhone ?? ""} onChange={set("contactPhone")} disabled={!owner} /></Field>
          <Field label="Contact email"><input type="email" className={inputClass} value={f.contactEmail ?? ""} onChange={set("contactEmail")} disabled={!owner} /></Field>
          <Field label="Address" className="sm:col-span-2"><input className={inputClass} value={f.address ?? ""} onChange={set("address")} disabled={!owner} /></Field>
          <Field label="City" required><input className={inputClass} value={f.city ?? ""} onChange={set("city")} disabled={!owner} /></Field>
          <Field label="State"><input className={inputClass} value={f.state ?? ""} onChange={set("state")} disabled={!owner} /></Field>
          <Field label="PIN code"><input className={inputClass} value={f.pincode ?? ""} onChange={set("pincode")} disabled={!owner} inputMode="numeric" /></Field>
          <Field label="Years in business"><input type="number" min={0} max={200} className={inputClass} value={f.yearsInBusiness ?? 0} onChange={set("yearsInBusiness")} disabled={!owner} /></Field>
          <Field label="PAN number" required><input className={inputClass} value={f.panNumber ?? ""} onChange={set("panNumber")} disabled={locked || !owner} placeholder="ABCDE1234F" /></Field>
          <Field label="GSTIN (if registered)"><input className={inputClass} value={f.gstin ?? ""} onChange={set("gstin")} disabled={locked || !owner} /></Field>
          <Field label="Registration / licence number"><input className={inputClass} value={f.registrationNumber ?? ""} onChange={set("registrationNumber")} disabled={locked || !owner} /></Field>
          <Field label="About your organisation" className="sm:col-span-2 lg:col-span-3"><textarea rows={3} className={inputClass} value={f.description ?? ""} onChange={set("description")} disabled={!owner} maxLength={2000} /></Field>
          {owner && <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><EnterpriseButton type="submit" disabled={busy === "profile"}>Save profile</EnterpriseButton></div>}
        </form>
      </Panel>

      {can(me, "managePayoutDetails") && (
        <Panel title={<span className="flex items-center gap-2"><Wallet size={15} className="text-[#F28C28]" /> Payout account</span>}>
          <p className="text-[11px] text-gray-500 mb-3">Customers pay Tirvona. Tirvona Finance pays you manually to this account. The account number is stored encrypted{op.payout.accountNumberLast4 ? ` (saved: ••••${op.payout.accountNumberLast4})` : ""}.</p>
          <form onSubmit={savePayout} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Account holder name" required><input className={inputClass} value={payout.accountHolderName} onChange={(e) => setPayout({ ...payout, accountHolderName: e.target.value })} required minLength={2} /></Field>
            <Field label={op.payout.accountNumberLast4 ? "New account number (leave empty to keep)" : "Account number"}><input className={inputClass} inputMode="numeric" value={payout.accountNumber} onChange={(e) => setPayout({ ...payout, accountNumber: e.target.value })} autoComplete="off" /></Field>
            <Field label="IFSC"><input className={inputClass} value={payout.ifsc} onChange={(e) => setPayout({ ...payout, ifsc: e.target.value.toUpperCase() })} /></Field>
            <Field label="Bank name"><input className={inputClass} value={payout.bankName} onChange={(e) => setPayout({ ...payout, bankName: e.target.value })} /></Field>
            <Field label="UPI id"><input className={inputClass} value={payout.upiId} onChange={(e) => setPayout({ ...payout, upiId: e.target.value })} /></Field>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><EnterpriseButton type="submit" disabled={busy === "payout"}>Save payout account</EnterpriseButton></div>
          </form>
        </Panel>
      )}

      {owner && ["draft", "rejected"].includes(op.status) && (
        <Panel title="Submit for verification">
          <label className="flex items-start gap-2 text-xs mb-3">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
            <span>I confirm the details are correct, that my vehicles hold valid permits and insurance, and I accept that all customer payments are collected by Tirvona and refunds follow the published policy.</span>
          </label>
          <EnterpriseButton icon={<Send size={13} />} disabled={!terms || busy === "submit"} onClick={() => run("submit", () => yatraOperator.submit(), reload, "Submitted for verification.")}>Submit to Tirvona</EnterpriseButton>
        </Panel>
      )}
    </div>
  );
};

// ================================================================= documents
const ORG_DOCS = ["pan_card", "gst_certificate", "business_registration", "tourism_licence", "address_proof", "cancelled_cheque", "other"];
const VEHICLE_DOCS = ["registration_certificate", "tourist_permit", "contract_carriage_permit", "stage_carriage_permit", "all_india_tourist_permit", "insurance", "fitness_certificate", "pollution_certificate", "other"];

export const OperatorDocumentsPage: React.FC = () => <OperatorShell>{(me) => <Documents me={me} />}</OperatorShell>;

const Documents: React.FC<{ me: any }> = ({ me }) => {
  const docs = useRemote<any[]>(() => yatraOperator.documents(), []);
  const vehicles = useRemote<any[]>(() => yatraOperator.vehicles(), []);
  const [form, setForm] = useState({ vehicleId: new URLSearchParams(window.location.search).get("vehicle") ?? "", documentType: "", documentNumber: "", expiresAt: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { busy, run } = useAction();
  const types = form.vehicleId ? VEHICLE_DOCS : ORG_DOCS;
  const vehicleName = (id: string | null) => vehicles.data?.find((v) => v.id === id)?.registrationNumber ?? "";

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !form.documentType) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", form.documentType);
      if (form.vehicleId) body.append("vehicleId", form.vehicleId);
      if (form.documentNumber) body.append("documentNumber", form.documentNumber);
      if (form.expiresAt) body.append("expiresAt", new Date(`${form.expiresAt}T00:00:00+05:30`).toISOString());
      await yatraOperator.uploadDocument(body);
      toast.success("Uploaded privately for verification.");
      setFile(null);
      setForm({ ...form, documentType: "", documentNumber: "", expiresAt: "" });
      docs.reload();
    } catch {
      // The API client shows the reason.
    } finally {
      setUploading(false);
    }
  };
  const view = async (id: string) => {
    const res = await yatraOperator.documentLink(id);
    window.open(res.data.data.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="KYC and vehicle documents" subtitle="Stored privately. Only you and Tirvona's verification team can open them, through links that expire in 5 minutes." icon={<FileText size={20} />} />
      {can(me, "manageDocuments") && (
        <Panel title="Upload a document">
          <form onSubmit={upload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="For">
              <select className={inputClass} value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value, documentType: "" })}>
                <option value="">My organisation</option>
                {(vehicles.data ?? []).map((v) => <option key={v.id} value={v.id}>Vehicle {v.registrationNumber}</option>)}
              </select>
            </Field>
            <Field label="Document" required>
              <select className={inputClass} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} required>
                <option value="">Choose…</option>
                {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <Field label="Number"><input className={inputClass} value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} /></Field>
            <Field label="Valid until"><input type="date" className={inputClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
            <Field label="File (JPG, PNG, WEBP or PDF, 10 MB)" required>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </Field>
            <div className="sm:col-span-2 lg:col-span-5 flex justify-end"><EnterpriseButton type="submit" icon={<Upload size={13} />} disabled={uploading || !file}>{uploading ? "Uploading…" : "Upload"}</EnterpriseButton></div>
          </form>
        </Panel>
      )}
      <Panel title="Uploaded documents">
        {docs.state !== "ready" ? <PanelState state={docs.state} error={docs.error} onRetry={docs.reload} /> : !docs.data?.length ? <Empty title="No documents yet" /> : (
          <ResponsiveTable
            rows={docs.data}
            rowKey={(d) => d.id}
            columns={[
              { header: "Document", cell: (d) => <span className="font-bold">{d.documentType.replace(/_/g, " ")}</span> },
              { header: "For", cell: (d) => (d.vehicleId ? `Vehicle ${vehicleName(d.vehicleId)}` : "Organisation") },
              { header: "Number", cell: (d) => d.documentNumber || "—" },
              { header: "Valid until", cell: (d) => (d.expiresAt ? dateLong(d.expiresAt) : "—") },
              { header: "Status", cell: (d) => <div><StatusPill status={d.status} />{d.reviewNote && <p className="text-[10px] text-gray-500 mt-0.5">{d.reviewNote}</p>}</div> },
              {
                header: "Actions",
                cell: (d) => (
                  <div className="flex gap-1.5 justify-end">
                    <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => view(d.id)}>View</EnterpriseButton>
                    {d.status !== "approved" && can(me, "manageDocuments") && (
                      <EnterpriseButton size="sm" variant="ghost" icon={<Trash2 size={12} />} disabled={busy === d.id} onClick={() => window.confirm("Delete this document?") && run(d.id, () => yatraOperator.deleteDocument(d.id), docs.reload)}>Delete</EnterpriseButton>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
};

// ===================================================================== staff
export const OperatorStaffPage: React.FC = () => <OperatorShell>{(me) => <Staff me={me} />}</OperatorShell>;

const Staff: React.FC<{ me: any }> = ({ me }) => {
  const staff = useRemote<any[]>(() => yatraOperator.staff(), []);
  const [f, setF] = useState({ emailOrPhone: "", role: "staff" });
  const { busy, run } = useAction();
  const owner = can(me, "manageStaff");
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Team" subtitle="Managers handle tours, departures and vehicles. Staff make bookings for customers, see manifests and check travellers in." icon={<Users size={20} />} />
      {owner && (
        <Panel title="Add a team member">
          <form onSubmit={(e) => { e.preventDefault(); run("add", () => yatraOperator.addStaff(f), () => { setF({ emailOrPhone: "", role: "staff" }); return staff.reload(); }, "Team member added."); }} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
            <Field label="Their Tirvona account email or phone" hint="They must already have a Tirvona account."><input className={inputClass} value={f.emailOrPhone} onChange={(e) => setF({ ...f, emailOrPhone: e.target.value })} required minLength={5} /></Field>
            <Field label="Role"><select className={inputClass} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="staff">Staff</option><option value="manager">Manager</option></select></Field>
            <EnterpriseButton type="submit" icon={<UserPlus size={13} />} disabled={busy === "add"}>Add</EnterpriseButton>
          </form>
        </Panel>
      )}
      <Panel title="Members">
        {staff.state !== "ready" ? <PanelState state={staff.state} error={staff.error} onRetry={staff.reload} /> : (
          <ResponsiveTable
            rows={staff.data ?? []}
            rowKey={(m) => m.id}
            columns={[
              { header: "Name", cell: (m) => <span className="font-bold">{m.name || "—"}</span> },
              { header: "Contact", cell: (m) => <span className="text-gray-500">{[m.email, m.phone].filter(Boolean).join(" · ")}</span> },
              {
                header: "Role",
                cell: (m) =>
                  owner && m.role !== "owner" && m.status === "active" ? (
                    <select aria-label={`Role for ${m.name}`} className={`${inputClass} !w-28 !py-1.5`} value={m.role} onChange={(e) => run(m.id, () => yatraOperator.updateStaff(m.id, e.target.value), staff.reload, "Role updated.")}>
                      <option value="staff">Staff</option><option value="manager">Manager</option>
                    </select>
                  ) : <span className="capitalize">{m.role}</span>,
              },
              { header: "Status", cell: (m) => <StatusPill status={m.status} /> },
              {
                header: "Actions",
                cell: (m) => owner && m.role !== "owner" && m.status === "active" ? (
                  <EnterpriseButton size="sm" variant="ghost" disabled={busy === m.id} onClick={() => window.confirm(`Remove ${m.name}?`) && run(m.id, () => yatraOperator.removeStaff(m.id), staff.reload, "Removed.")}>Remove</EnterpriseButton>
                ) : null,
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
};

// ================================================================== vehicles
const LAYOUTS: Record<string, { columns: number; used: number[] }> = { "2x2": { columns: 5, used: [0, 1, 3, 4] }, "2x1": { columns: 4, used: [0, 1, 3] }, "1x1": { columns: 3, used: [0, 2] }, sleeper_2x1: { columns: 4, used: [0, 1, 3] } };
/** Same numbering as the server, for a live preview while the form is filled in. */
const previewLayout = (template: string, capacity: number) => {
  const spec = LAYOUTS[template] ?? LAYOUTS["2x2"];
  const n = Math.max(1, Math.min(120, capacity || 1));
  return {
    columns: spec.columns,
    seats: Array.from({ length: n }, (_, i) => ({ seatNo: String(i + 1), row: Math.floor(i / spec.used.length), col: spec.used[i % spec.used.length], kind: template === "sleeper_2x1" ? "sleeper" : "seater", status: "available" })),
  };
};

export const OperatorVehiclesPage: React.FC = () => <OperatorShell>{(me) => <Vehicles me={me} />}</OperatorShell>;

const Vehicles: React.FC<{ me: any }> = ({ me }) => {
  const navigate = useNavigate();
  const vehicles = useRemote<any[]>(() => yatraOperator.vehicles(), []);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const { busy, run } = useAction();
  const manage = can(me, "manageVehicles");
  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Vehicles"
        subtitle="Add each bus with its seat layout, upload its RC, permit and insurance, then send it to Tirvona for verification."
        icon={<Bus size={20} />}
        actions={manage && <EnterpriseButton icon={<Plus size={13} />} onClick={() => setEditing({})}>Add vehicle</EnterpriseButton>}
      />
      <Panel>
        {vehicles.state !== "ready" ? <PanelState state={vehicles.state} error={vehicles.error} onRetry={vehicles.reload} /> : !vehicles.data?.length ? <Empty icon={<Bus size={28} className="text-gray-300" />} title="No vehicles yet" /> : (
          <ResponsiveTable
            rows={vehicles.data}
            rowKey={(v) => v.id}
            columns={[
              { header: "Vehicle", cell: (v) => <div><p className="font-black">{v.registrationNumber}</p><p className="text-[10px] text-gray-500">{[v.make, v.model].filter(Boolean).join(" ") || v.vehicleType.replace(/_/g, " ")}{v.isAc ? " · AC" : ""}</p></div> },
              { header: "Seats", cell: (v) => `${v.seatCapacity} · ${v.seatLayout?.template ?? "2x2"}` },
              { header: "Permit", cell: (v) => v.permitType.replace(/_/g, " ") },
              { header: "Status", cell: (v) => <div><StatusPill status={v.status} />{v.reviewNote && <p className="text-[10px] text-gray-500 mt-0.5">{v.reviewNote}</p>}</div> },
              {
                header: "Actions",
                cell: (v) => (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <EnterpriseButton size="sm" variant="ghost" onClick={() => setViewing(v)}>Seats</EnterpriseButton>
                    {manage && <EnterpriseButton size="sm" variant="ghost" onClick={() => navigate(`/operator/documents?vehicle=${v.id}`)}>Documents</EnterpriseButton>}
                    {manage && v.status !== "suspended" && <EnterpriseButton size="sm" variant="ghost" onClick={() => setEditing(v)}>Edit</EnterpriseButton>}
                    {manage && ["draft", "rejected"].includes(v.status) && <EnterpriseButton size="sm" disabled={busy === v.id} onClick={() => run(v.id, () => yatraOperator.submitVehicle(v.id), vehicles.reload, "Sent for verification.")}>Submit</EnterpriseButton>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {editing && <VehicleForm vehicle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); vehicles.reload(); }} />}
      {viewing && (
        <EnterpriseModal isOpen onClose={() => setViewing(null)} title={`Seats · ${viewing.registrationNumber}`}>
          <SeatMap mode="view" columns={viewing.seatLayout?.columns ?? 5} seats={(viewing.seatLayout?.seats ?? []).map((s: any) => ({ ...s, status: "available" }))} />
        </EnterpriseModal>
      )}
    </div>
  );
};

const VehicleForm: React.FC<{ vehicle: any; onClose: () => void; onSaved: () => void }> = ({ vehicle, onClose, onSaved }) => {
  const isNew = !vehicle.id;
  const [f, setF] = useState({
    registrationNumber: vehicle.registrationNumber ?? "",
    vehicleType: vehicle.vehicleType ?? "bus",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    seatCapacity: String(vehicle.seatCapacity ?? 40),
    layoutTemplate: vehicle.seatLayout?.template && vehicle.seatLayout.template !== "custom" ? vehicle.seatLayout.template : "2x2",
    permitType: vehicle.permitType ?? "tourist_permit",
    isAc: Boolean(vehicle.isAc),
    amenities: (vehicle.amenities ?? []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const preview = previewLayout(f.layoutTemplate, Number(f.seatCapacity));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, seatCapacity: Number(f.seatCapacity), amenities: f.amenities.split(",").map((s: string) => s.trim()).filter(Boolean) };
    try {
      if (isNew) await yatraOperator.createVehicle(body);
      else await yatraOperator.updateVehicle(vehicle.id, body);
      toast.success(isNew ? "Vehicle added." : "Vehicle saved.");
      onSaved();
    } catch {
      // The API client shows the reason.
    } finally {
      setBusy(false);
    }
  };
  return (
    <EnterpriseModal isOpen onClose={onClose} title={isNew ? "Add vehicle" : `Edit ${vehicle.registrationNumber}`}>
      <form onSubmit={submit} className="space-y-3">
        {vehicle.status === "approved" && <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-2">Changing the registration, seats or permit sends this vehicle back for verification.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Registration number" required><input className={inputClass} value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} required minLength={6} /></Field>
          <Field label="Type"><select className={inputClass} value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}>{["bus", "mini_bus", "tempo_traveller", "car", "other"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          <Field label="Make"><input className={inputClass} value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} /></Field>
          <Field label="Model"><input className={inputClass} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          <Field label="Seats" required><input type="number" min={1} max={120} className={inputClass} value={f.seatCapacity} onChange={(e) => setF({ ...f, seatCapacity: e.target.value })} required /></Field>
          <Field label="Seat layout"><select className={inputClass} value={f.layoutTemplate} onChange={(e) => setF({ ...f, layoutTemplate: e.target.value })}><option value="2x2">2 + 2 seater</option><option value="2x1">2 + 1 seater</option><option value="1x1">1 + 1 seater</option><option value="sleeper_2x1">2 + 1 sleeper</option></select></Field>
          <Field label="Permit"><select className={inputClass} value={f.permitType} onChange={(e) => setF({ ...f, permitType: e.target.value })}>{["tourist_permit", "contract_carriage", "stage_carriage", "all_india_tourist", "other"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          <Field label="Amenities" hint="Comma separated, e.g. Charging point, Water"><input className={inputClass} value={f.amenities} onChange={(e) => setF({ ...f, amenities: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={f.isAc} onChange={(e) => setF({ ...f, isAc: e.target.checked })} /> Air conditioned</label>
        </div>
        <div>
          <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 mb-2">Seat preview</p>
          <SeatMap mode="view" columns={preview.columns} seats={preview.seats} />
        </div>
        <div className="flex justify-end gap-2">
          <EnterpriseButton type="button" variant="ghost" onClick={onClose}>Cancel</EnterpriseButton>
          <EnterpriseButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save vehicle"}</EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  );
};

