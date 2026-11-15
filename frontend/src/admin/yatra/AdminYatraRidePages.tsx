import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Car, Eye, Route } from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { askReason, Chips, Empty, Field, inputClass, Pager, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../modules/marketplace/ui";
import { yatraRideAdmin, yatraRides } from "../../modules/yatra/services/yatra.service";
import { dateLong, dateTimeIst, InfoRow, rupees, StatusPill, YatraGate } from "../../modules/yatra/yatraUi";

const Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <YatraGate>
    <div className="space-y-5">{children}</div>
  </YatraGate>
);

const rideType = (t: string) => (t === "any" ? "Any vehicle" : t.replace(/_/g, " "));

// ============================================================ ride partners
export const AdminYatraRidePartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("submitted");
  const [page, setPage] = useState(1);
  const list = useRemote<any[]>(() => yatraRideAdmin.partners({ status: status || undefined, page, limit: 20 }), [status, page]);
  return (
    <Gate>
      <EnterprisePageHeader title="Ride partners" subtitle="Local cab and auto partners for Yatra pilgrims. Only approved partners can receive ride requests." icon={<Car size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: "submitted", label: "To review" }, { value: "approved", label: "Approved" }, { value: "suspended", label: "Suspended" }, { value: "rejected", label: "Rejected" }, { value: "draft", label: "Drafts" }, { value: "", label: "All" }]}
          />
          {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty title="No ride partners here" /> : (
            <>
              <ResponsiveTable
                rows={list.data}
                rowKey={(p) => p.id}
                onRowClick={(p) => navigate(`/admin/yatra/ride-partners/${p.id}`)}
                columns={[
                  { header: "Partner", cell: (p) => <div><p className="font-black">{p.businessName}</p><p className="text-[10px] text-gray-500">{p.city || "—"}</p></div> },
                  { header: "Contact", cell: (p) => <span className="text-gray-500">{[p.contactName, p.contactPhone].filter(Boolean).join(" · ") || "—"}</span> },
                  { header: "Areas", cell: (p) => <span className="text-[11px]">{p.serviceAreas.join(", ") || "—"}</span>, hideOnMobile: true },
                  { header: "Vehicles", cell: (p) => p.vehicles.length },
                  { header: "Submitted", cell: (p) => (p.submittedAt ? dateLong(p.submittedAt) : "—"), hideOnMobile: true },
                  { header: "Status", cell: (p) => <StatusPill status={p.status} /> },
                ]}
              />
              <Pager page={page} limit={20} total={list.meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

export const AdminYatraRidePartnerDetailPage: React.FC = () => {
  const { partnerId = "" } = useParams();
  const d = useRemote<any>(() => yatraRideAdmin.partner(partnerId), [partnerId]);
  const { busy, run } = useAction();
  const review = (action: "approve" | "reject" | "suspend" | "reinstate") => {
    const note = action === "approve" || action === "reinstate" ? "" : askReason("Reason (the partner will see it):");
    if (note === null) return;
    run(action, () => yatraRideAdmin.reviewPartner(partnerId, action, note || undefined), d.reload, "Saved.");
  };
  const view = async (id: string) => {
    const res = await yatraRideAdmin.documentLink(id);
    window.open(res.data.data.url, "_blank", "noopener,noreferrer");
  };
  if (d.state !== "ready" || !d.data) return <Gate><PanelState state={d.state} error={d.error} onRetry={d.reload} /></Gate>;
  const { partner: p, documents, rides, balance } = d.data;
  return (
    <Gate>
      <EnterprisePageHeader
        title={p.businessName}
        subtitle={`${p.city || "No city"} · ride partner`}
        icon={<Car size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {p.status === "submitted" && <EnterpriseButton variant="success" disabled={!!busy} onClick={() => review("approve")}>Approve</EnterpriseButton>}
            {p.status === "submitted" && <EnterpriseButton variant="ghost" disabled={!!busy} onClick={() => review("reject")}>Reject</EnterpriseButton>}
            {p.status === "approved" && <EnterpriseButton variant="ghost" disabled={!!busy} onClick={() => review("suspend")}>Suspend</EnterpriseButton>}
            {p.status === "suspended" && <EnterpriseButton disabled={!!busy} onClick={() => review("reinstate")}>Reinstate</EnterpriseButton>}
          </div>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Status" value={<StatusPill status={p.status} />} />
        <Stat label="Can be paid now" value={rupees(balance.available)} />
        <Stat label="After ride completion" value={rupees(balance.pending)} />
        <Stat label="Paid out" value={rupees(balance.transfers)} />
      </div>
      {p.reviewNote && <p className="text-xs text-gray-500">Last review note: {p.reviewNote}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Profile">
          <div className="space-y-1.5">
            <InfoRow label="Contact">{[p.contactName, p.contactPhone, p.contactEmail].filter(Boolean).join(" · ") || "—"}</InfoRow>
            <InfoRow label="Serves">{p.serviceAreas.join(", ") || "—"}</InfoRow>
            <InfoRow label="PAN">{p.kyc.panNumber || "—"}</InfoRow>
            <InfoRow label="Driving licence">{p.kyc.drivingLicenceNumber || "—"}</InfoRow>
            <InfoRow label="Hours">{`${p.availability.startTime}–${p.availability.endTime}${p.availability.accepting ? "" : " · paused"}`}</InfoRow>
            <InfoRow label="Payout to">{p.payout.upiId || (p.payout.accountNumberLast4 ? `${p.payout.bankName || "Bank"} ••${p.payout.accountNumberLast4} (${p.payout.ifsc})` : "Not added")}</InfoRow>
          </div>
        </Panel>
        <Panel title={`Vehicles (${p.vehicles.length})`}>
          {!p.vehicles.length ? <p className="text-xs text-gray-500">No vehicles added.</p> : (
            <ul className="divide-y divide-gray-50 dark:divide-slate-800">
              {p.vehicles.map((v: any) => (
                <li key={v.id} className="py-2 text-xs flex flex-wrap justify-between gap-2"><span className="font-black">{v.registrationNumber}</span><span className="text-gray-500">{rideType(v.vehicleType)} · {v.seats} seats{v.isAc ? " · AC" : ""}</span></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Documents">
        {!documents.length ? <p className="text-xs text-gray-500">No documents uploaded.</p> : (
          <ResponsiveTable
            rows={documents}
            rowKey={(x: any) => x.id}
            columns={[
              { header: "Document", cell: (x: any) => x.documentType.replace(/_/g, " ") },
              { header: "Number", cell: (x: any) => x.documentNumber || "—" },
              { header: "Valid until", cell: (x: any) => (x.expiresAt ? dateLong(x.expiresAt) : "—") },
              { header: "Uploaded", cell: (x: any) => dateLong(x.createdAt), hideOnMobile: true },
              { header: "", cell: (x: any) => <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => view(x.id)}>View</EnterpriseButton> },
            ]}
          />
        )}
        <p className="mt-2 text-[11px] text-gray-500">Files are private; each view opens a signed link that expires in 5 minutes and is written to the audit log.</p>
      </Panel>
      <Panel title="Recent rides">
        {!rides.length ? <p className="text-xs text-gray-500">No rides yet.</p> : (
          <ResponsiveTable
            rows={rides}
            rowKey={(r: any) => r.id}
            columns={[
              { header: "Pickup", cell: (r: any) => dateTimeIst(r.pickupAt) },
              { header: "Route", cell: (r: any) => <span className="text-[11px]">{r.pickup.address} → {r.drop.address}</span> },
              { header: "Fare", cell: (r: any) => (r.quotedAmount ? rupees(r.quotedAmount) : "—") },
              { header: "Status", cell: (r: any) => <StatusPill status={r.status} /> },
            ]}
          />
        )}
      </Panel>
    </Gate>
  );
};

// ==================================================================== rides
export const AdminYatraRidesPage: React.FC = () => {
  const [status, setStatus] = useState("requested");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const list = useRemote<any[]>(() => yatraRideAdmin.rides({ status: status || undefined, city: city.trim() || undefined, page, limit: 20 }), [status, city, page]);
  const [assigning, setAssigning] = useState<any>(null);
  const { busy, run } = useAction();
  const cancel = (r: any) => {
    const reason = askReason(`Cancel ${r.requestNumber}? Anything paid is refunded in full to the pilgrim's wallet. Reason:`);
    if (reason) run(r.id, () => yatraRideAdmin.cancel(r.id, reason, 100), list.reload, "Ride cancelled.");
  };
  return (
    <Gate>
      <EnterprisePageHeader title="Local rides" subtitle="Pilgrim ride requests in every destination. Assign an approved partner when no one has taken a request." icon={<Route size={20} />} />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <Chips
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[{ value: "requested", label: "Needs a partner" }, { value: "partner_pending", label: "With partner" }, { value: "accepted", label: "Awaiting payment" }, { value: "confirmed", label: "Confirmed" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }, { value: "", label: "All" }]}
            />
            <input aria-label="Filter by city" className={`${inputClass} sm:!w-56`} placeholder="City" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} />
          </div>
          {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty title="No rides here" /> : (
            <>
              <ResponsiveTable
                rows={list.data}
                rowKey={(r) => r.id}
                columns={[
                  { header: "Ride", cell: (r) => <div><p className="font-black">{r.requestNumber}</p><p className="text-[10px] text-gray-500">{r.city} · {rideType(r.rideType)}</p></div> },
                  { header: "Pickup", cell: (r) => dateTimeIst(r.pickupAt) },
                  { header: "Route", cell: (r) => <span className="text-[11px]">{r.pickup.address} → {r.drop.address}</span>, hideOnMobile: true },
                  { header: "Pax", cell: (r) => r.passengers },
                  { header: "Partner", cell: (r) => (r.partnerId ? <Link className="hover:underline" to={`/admin/yatra/ride-partners/${r.partnerId}`}>{r.partnerName}</Link> : "—") },
                  { header: "Fare", cell: (r) => (r.quotedAmount ? rupees(r.quotedAmount) : "—") },
                  { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
                  {
                    header: "Actions",
                    cell: (r) => (
                      <div className="flex gap-1.5 justify-end">
                        {["requested", "partner_pending", "rejected"].includes(r.status) && <EnterpriseButton size="sm" disabled={busy === r.id} onClick={() => setAssigning(r)}>Assign</EnterpriseButton>}
                        {["requested", "partner_pending", "accepted", "confirmed"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => cancel(r)}>Cancel</EnterpriseButton>}
                      </div>
                    ),
                  },
                ]}
              />
              <Pager page={page} limit={20} total={list.meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
      {assigning && <AssignRideModal ride={assigning} fetchPartners={(c) => yatraRides.partners(c)} assign={(id, pid) => yatraRideAdmin.assign(id, pid)} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); list.reload(); }} />}
    </Gate>
  );
};

/** Pick an approved partner serving the ride's city (used by Super Admin and Destination Ops). */
export const AssignRideModal: React.FC<{
  ride: any;
  fetchPartners: (city: string) => Promise<any>;
  assign: (rideId: string, partnerId: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}> = ({ ride, fetchPartners, assign, onClose, onDone }) => {
  const partners = useRemote<any[]>(() => fetchPartners(ride.city), [ride.city]);
  const fit = (partners.data ?? []).filter((p) => p.maxSeats >= Number(ride.passengers));
  const [partnerId, setPartnerId] = useState("");
  const { busy, run } = useAction();
  return (
    <EnterpriseModal isOpen onClose={onClose} title={`Assign ${ride.requestNumber}`} subtitle={`${ride.city} · ${ride.passengers} passenger${ride.passengers === 1 ? "" : "s"}`}>
      {partners.state !== "ready" ? <PanelState state={partners.state} error={partners.error} onRetry={partners.reload} /> : !fit.length ? (
        <p className="text-xs text-gray-500">No approved partner in {ride.city} is taking requests with a vehicle big enough.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run("assign", () => assign(ride.id, partnerId), onDone, "Sent to the partner."); }} className="space-y-3">
          <Field label="Ride partner" required>
            <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
              <option value="">Choose a partner</option>
              {fit.map((p) => <option key={p.id} value={p.id}>{p.name} · up to {p.maxSeats} seats</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "assign" || !partnerId}>Send request</EnterpriseButton></div>
        </form>
      )}
    </EnterpriseModal>
  );
};
