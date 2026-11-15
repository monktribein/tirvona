import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck,
  Bus,
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  History,
  IndianRupee,
  LayoutDashboard,
  Route,
  Settings,
  Ticket,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { askReason, Chips, Empty, Field, inputClass, Pager, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../modules/marketplace/ui";
import { yatraAdmin } from "../../modules/yatra/services/yatra.service";
import { dateLong, dateTimeIst, InfoRow, rupees, SeatMap, StatusPill, statusLabel, YatraGate } from "../../modules/yatra/yatraUi";

const Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <YatraGate>
    <div className="space-y-5">{children}</div>
  </YatraGate>
);

const openDocument = async (id: string) => {
  const res = await yatraAdmin.documentLink(id);
  window.open(res.data.data.url, "_blank", "noopener,noreferrer");
};

/** Status tabs plus a paged list, the pattern every admin queue below uses. */
function usePagedQueue(fetcher: (p: { status?: string; page: number; limit: number }) => Promise<any>, initial = "") {
  const [status, setStatus] = useState(initial);
  const [page, setPage] = useState(1);
  const remote = useRemote<any[]>(() => fetcher({ status: status || undefined, page, limit: 20 }), [status, page]);
  return { status, setStatus: (s: string) => { setStatus(s); setPage(1); }, page, setPage, remote };
}

// ================================================================= overview
export const AdminYatraOverviewPage: React.FC = () => {
  const o = useRemote<any>(() => yatraAdmin.overview(), []);
  return (
    <Gate>
      <EnterprisePageHeader title="Tirvona Yatra" subtitle="Organisers, tours, departures, bookings and money. Only Super Admin approves and publishes." icon={<Bus size={20} />} />
      {o.state !== "ready" || !o.data ? <PanelState state={o.state} error={o.error} onRetry={o.reload} /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Organisers to review" value={o.data.operatorsAwaitingReview} tone={o.data.operatorsAwaitingReview ? "warn" : undefined} to="/admin/yatra/operators?status=submitted" icon={<Users size={16} />} />
            <Stat label="Documents to verify" value={o.data.documentsPending} tone={o.data.documentsPending ? "warn" : undefined} to="/admin/yatra/documents" icon={<FileText size={16} />} />
            <Stat label="Vehicles to verify" value={o.data.vehiclesPending} tone={o.data.vehiclesPending ? "warn" : undefined} to="/admin/yatra/vehicles" icon={<Bus size={16} />} />
            <Stat label="Tours awaiting action" value={o.data.toursAwaitingAction} tone={o.data.toursAwaitingAction ? "warn" : undefined} to="/admin/yatra/tours" icon={<Route size={16} />} />
            <Stat label="Cancellation requests" value={o.data.cancellationRequests} tone={o.data.cancellationRequests ? "warn" : undefined} to="/admin/yatra/cancellations" icon={<Ticket size={16} />} />
            <Stat label="Open add-on requests" value={o.data.openServiceRequests} to="/admin/yatra/service-requests" icon={<UtensilsCrossed size={16} />} />
            <Stat label="Upcoming departures" value={o.data.upcomingDepartures} to="/admin/yatra/departures" icon={<CalendarDays size={16} />} />
            <Stat label="Unpaid seat holds" value={o.data.unpaidHolds} hint="Free themselves when the hold lapses" />
          </div>
          {o.data.p5Counts && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label="Ride partners to review" value={o.data.p5Counts.partnersToReview} tone={o.data.p5Counts.partnersToReview ? "warn" : undefined} to="/admin/yatra/ride-partners" icon={<Users size={16} />} />
              <Stat label="Rides needing a partner" value={o.data.p5Counts.ridesNeedingPartner} tone={o.data.p5Counts.ridesNeedingPartner ? "warn" : undefined} to="/admin/yatra/rides" icon={<Route size={16} />} />
              <Stat label="Open incidents" value={o.data.p5Counts.openIssues} tone={o.data.p5Counts.openIssues ? "warn" : undefined} to="/ops/yatra" icon={<ClipboardList size={16} />} />
              <Stat label="Payouts to process" value={o.data.p5Counts.payoutsToProcess} tone={o.data.p5Counts.payoutsToProcess ? "warn" : undefined} to="/admin/yatra/finance?tab=payouts" icon={<IndianRupee size={16} />} />
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Collected by Tirvona" value={rupees(o.data.money.collected)} icon={<IndianRupee size={16} />} to="/admin/yatra/finance" />
            <Stat label="Refunded to wallets" value={rupees(o.data.money.refundedToWallet)} />
            <Stat label="Unusable payments returned" value={rupees(o.data.money.unappliedReturned)} />
            <Stat label="Net" value={rupees(o.data.money.net)} tone="ok" />
          </div>
        </>
      )}
    </Gate>
  );
};

// =============================================================== organisers
export const AdminYatraOperatorsPage: React.FC = () => {
  const navigate = useNavigate();
  const initial = new URLSearchParams(window.location.search).get("status") ?? "";
  const q = usePagedQueue((p) => yatraAdmin.operators(p), initial);
  return (
    <Gate>
      <EnterprisePageHeader title="Yatra organisers" subtitle="Verify KYC and approve, reject or suspend organisers." icon={<Users size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "", label: "All" }, { value: "submitted", label: "Submitted" }, { value: "under_review", label: "Under review" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "suspended", label: "Suspended" }, { value: "draft", label: "Drafts" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="No organisers here" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(o) => o.id}
                onRowClick={(o) => navigate(`/admin/yatra/operators/${o.id}`)}
                columns={[
                  { header: "Organiser", cell: (o) => <div><p className="font-black">{o.organisationName}</p><p className="text-[10px] text-gray-500">{o.organisationType.replace(/_/g, " ")} · {o.city || "—"}</p></div> },
                  { header: "Contact", cell: (o) => <span className="text-gray-500">{[o.contactName, o.contactPhone].filter(Boolean).join(" · ")}</span> },
                  { header: "PAN", cell: (o) => o.kyc.panNumber || "—" },
                  { header: "Submitted", cell: (o) => (o.submittedAt ? dateLong(o.submittedAt) : "—") },
                  { header: "Status", cell: (o) => <StatusPill status={o.status} /> },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

export const AdminYatraOperatorDetailPage: React.FC = () => {
  const { operatorId = "" } = useParams();
  const d = useRemote<any>(() => yatraAdmin.operator(operatorId), [operatorId]);
  const { busy, run } = useAction();
  const review = (action: string, needsNote = false) => {
    const note = needsNote ? askReason("Reason (the organiser will see it):") : window.prompt("Optional note for the organiser:") ?? "";
    if (needsNote && !note) return;
    run(action, () => yatraAdmin.reviewOperator(operatorId, action, note || undefined), d.reload, "Saved.");
  };
  const reviewDoc = (id: string, decision: "approve" | "reject") => {
    const note = decision === "reject" ? askReason("Why is this document rejected?") : "";
    if (decision === "reject" && !note) return;
    run(id, () => yatraAdmin.reviewDocument(id, decision, note || undefined), d.reload);
  };
  return (
    <Gate>
      {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (() => {
        const op = d.data.operator;
        return (
          <>
            <EnterprisePageHeader title={op.organisationName} subtitle={`${op.organisationType.replace(/_/g, " ")} · ${op.city || "—"}`} icon={<Users size={20} />} actions={<StatusPill status={op.status} />} />
            <div className="flex flex-wrap gap-2">
              {op.status === "submitted" && <EnterpriseButton variant="outline" disabled={!!busy} onClick={() => review("start_review")}>Start review</EnterpriseButton>}
              {["submitted", "under_review"].includes(op.status) && <EnterpriseButton variant="success" icon={<BadgeCheck size={13} />} disabled={!!busy} onClick={() => review("approve")}>Approve</EnterpriseButton>}
              {["submitted", "under_review"].includes(op.status) && <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => review("reject", true)}>Reject</EnterpriseButton>}
              {op.status === "approved" && <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => review("suspend", true)}>Suspend</EnterpriseButton>}
              {op.status === "suspended" && <EnterpriseButton variant="success" disabled={!!busy} onClick={() => review("reinstate")}>Reinstate</EnterpriseButton>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel title="Profile and KYC">
                <InfoRow label="Shown as">{op.displayName}</InfoRow>
                <InfoRow label="Contact">{[op.contactName, op.contactPhone, op.contactEmail].filter(Boolean).join(" · ") || "—"}</InfoRow>
                <InfoRow label="Address">{[op.address, op.city, op.state, op.pincode].filter(Boolean).join(", ") || "—"}</InfoRow>
                <InfoRow label="PAN">{op.kyc.panNumber || "—"}</InfoRow>
                <InfoRow label="GSTIN">{op.kyc.gstin || "—"}</InfoRow>
                <InfoRow label="Registration">{op.kyc.registrationNumber || "—"}</InfoRow>
                <InfoRow label="Payout">{op.payout.accountNumberLast4 ? `${op.payout.bankName || "Bank"} ••••${op.payout.accountNumberLast4} · ${op.payout.ifsc}` : op.payout.upiId || "Not added"}</InfoRow>
                {op.reviewNote && <InfoRow label="Last review note">{op.reviewNote}</InfoRow>}
              </Panel>
              <Panel title="Team">
                {d.data.members.map((m: any) => <InfoRow key={m.id} label={`${m.name || "—"} (${m.role})`}>{[m.email, m.phone].filter(Boolean).join(" · ")} · {m.status}</InfoRow>)}
              </Panel>
            </div>
            <Panel title="Documents">
              {!d.data.documents.length ? <Empty title="No documents uploaded" /> : (
                <ResponsiveTable
                  rows={d.data.documents}
                  rowKey={(x: any) => x.id}
                  columns={[
                    { header: "Document", cell: (x: any) => <div><p className="font-bold">{x.documentType.replace(/_/g, " ")}</p><p className="text-[10px] text-gray-500">{x.vehicleId ? `Vehicle ${d.data.vehicles.find((v: any) => v.id === x.vehicleId)?.registrationNumber ?? ""}` : "Organisation"}</p></div> },
                    { header: "Number", cell: (x: any) => x.documentNumber || "—" },
                    { header: "Valid until", cell: (x: any) => (x.expiresAt ? dateLong(x.expiresAt) : "—") },
                    { header: "Status", cell: (x: any) => <StatusPill status={x.status} /> },
                    {
                      header: "Actions",
                      cell: (x: any) => (
                        <div className="flex gap-1.5 justify-end">
                          <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => openDocument(x.id)}>View</EnterpriseButton>
                          {x.status !== "approved" && <EnterpriseButton size="sm" variant="success" disabled={busy === x.id} onClick={() => reviewDoc(x.id, "approve")}>Approve</EnterpriseButton>}
                          {x.status !== "rejected" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === x.id} onClick={() => reviewDoc(x.id, "reject")}>Reject</EnterpriseButton>}
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </Panel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel title="Vehicles">{d.data.vehicles.length ? d.data.vehicles.map((v: any) => <InfoRow key={v.id} label={v.registrationNumber}><StatusPill status={v.status} /></InfoRow>) : <p className="text-xs text-gray-500">None</p>}</Panel>
              <Panel title="Tours">{d.data.tours.length ? d.data.tours.map((t: any) => <InfoRow key={t.id} label={t.title}><Link to={`/admin/yatra/tours/${t.id}`}><StatusPill status={t.status} /></Link></InfoRow>) : <p className="text-xs text-gray-500">None</p>}</Panel>
            </div>
          </>
        );
      })()}
    </Gate>
  );
};

// ================================================================ documents
export const AdminYatraDocumentsPage: React.FC = () => {
  const q = usePagedQueue((p) => yatraAdmin.documents(p), "pending");
  const { busy, run } = useAction();
  const decide = (id: string, decision: "approve" | "reject") => {
    const note = decision === "reject" ? askReason("Why is this document rejected?") : "";
    if (decision === "reject" && !note) return;
    run(id, () => yatraAdmin.reviewDocument(id, decision, note || undefined), q.remote.reload);
  };
  return (
    <Gate>
      <EnterprisePageHeader title="KYC and vehicle documents" subtitle="Private files. Each view opens a signed link that expires in 5 minutes and is written to the audit log." icon={<FileText size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "pending", label: "To verify" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "", label: "All" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="Nothing to verify" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(x) => x.id}
                columns={[
                  { header: "Organiser", cell: (x) => <Link className="font-bold hover:underline" to={`/admin/yatra/operators/${x.operatorId}`}>{x.operatorName}</Link> },
                  { header: "Document", cell: (x) => <span>{x.documentType.replace(/_/g, " ")}{x.vehicleId ? " (vehicle)" : ""}</span> },
                  { header: "Number", cell: (x) => x.documentNumber || "—" },
                  { header: "Valid until", cell: (x) => (x.expiresAt ? dateLong(x.expiresAt) : "—") },
                  { header: "Status", cell: (x) => <StatusPill status={x.status} /> },
                  {
                    header: "Actions",
                    cell: (x) => (
                      <div className="flex gap-1.5 justify-end">
                        <EnterpriseButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => openDocument(x.id)}>View</EnterpriseButton>
                        {x.status !== "approved" && <EnterpriseButton size="sm" variant="success" disabled={busy === x.id} onClick={() => decide(x.id, "approve")}>Approve</EnterpriseButton>}
                        {x.status !== "rejected" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === x.id} onClick={() => decide(x.id, "reject")}>Reject</EnterpriseButton>}
                      </div>
                    ),
                  },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

// ================================================================= vehicles
export const AdminYatraVehiclesPage: React.FC = () => {
  const q = usePagedQueue((p) => yatraAdmin.vehicles(p), "pending_verification");
  const { busy, run } = useAction();
  const act = (id: string, action: "approve" | "reject" | "suspend") => {
    const note = action === "approve" ? "" : askReason("Reason (the organiser will see it):");
    if (action !== "approve" && !note) return;
    run(id, () => yatraAdmin.reviewVehicle(id, action, note || undefined), q.remote.reload);
  };
  return (
    <Gate>
      <EnterprisePageHeader title="Vehicle verification" subtitle="Check the RC, permit and insurance on the organiser's page before approving a vehicle." icon={<Bus size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "pending_verification", label: "To verify" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "suspended", label: "Suspended" }, { value: "", label: "All" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="No vehicles here" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(v) => v.id}
                columns={[
                  { header: "Vehicle", cell: (v) => <div><p className="font-black">{v.registrationNumber}</p><p className="text-[10px] text-gray-500">{v.vehicleType.replace(/_/g, " ")} · {v.seatCapacity} seats{v.isAc ? " · AC" : ""}</p></div> },
                  { header: "Organiser", cell: (v) => <Link className="hover:underline" to={`/admin/yatra/operators/${v.operatorId}`}>{v.operatorName}</Link> },
                  { header: "Permit", cell: (v) => v.permitType.replace(/_/g, " ") },
                  { header: "Status", cell: (v) => <StatusPill status={v.status} /> },
                  {
                    header: "Actions",
                    cell: (v) => (
                      <div className="flex gap-1.5 justify-end">
                        {v.status !== "approved" && <EnterpriseButton size="sm" variant="success" disabled={busy === v.id} onClick={() => act(v.id, "approve")}>Approve</EnterpriseButton>}
                        {v.status === "pending_verification" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === v.id} onClick={() => act(v.id, "reject")}>Reject</EnterpriseButton>}
                        {v.status === "approved" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === v.id} onClick={() => act(v.id, "suspend")}>Suspend</EnterpriseButton>}
                      </div>
                    ),
                  },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

// ==================================================================== tours
export const AdminYatraToursPage: React.FC = () => {
  const navigate = useNavigate();
  const q = usePagedQueue((p) => yatraAdmin.tours(p), "pending_review");
  return (
    <Gate>
      <EnterprisePageHeader title="Tour review and publishing" subtitle="Only Super Admin can approve, publish or unpublish a tour." icon={<Route size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "pending_review", label: "To review" }, { value: "approved", label: "Approved, not live" }, { value: "published", label: "Published" }, { value: "unpublished", label: "Unpublished" }, { value: "rejected", label: "Rejected" }, { value: "", label: "All" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="No tours here" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(t) => t.id}
                onRowClick={(t) => navigate(`/admin/yatra/tours/${t.id}`)}
                columns={[
                  { header: "Tour", cell: (t) => <div><p className="font-black">{t.title}</p><p className="text-[10px] text-gray-500">{t.originCity} → {t.destinationCity} · {t.durationDays} days · {t.productType.replace(/_/g, " ")}</p></div> },
                  { header: "Organiser", cell: (t) => <div><p>{t.operatorName}</p><StatusPill status={t.operatorStatus} /></div> },
                  { header: "Fare", cell: (t) => rupees(t.baseFare) },
                  { header: "Status", cell: (t) => <StatusPill status={t.status} /> },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

export const AdminYatraTourDetailPage: React.FC = () => {
  const { tourId = "" } = useParams();
  const d = useRemote<any>(() => yatraAdmin.tour(tourId), [tourId]);
  const { busy, run } = useAction();
  const act = (action: string, needsNote = false) => {
    const note = needsNote ? askReason("Reason (the organiser will see it):") : "";
    if (needsNote && !note) return;
    run(action, () => yatraAdmin.reviewTour(tourId, action, note || undefined), d.reload, "Saved.");
  };
  return (
    <Gate>
      {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (() => {
        const t = d.data.tour;
        return (
          <>
            <EnterprisePageHeader title={t.title} subtitle={`${d.data.operator?.organisationName ?? ""} · ${t.originCity} → ${t.destinationCity}`} icon={<Route size={20} />} actions={<StatusPill status={t.status} />} />
            {d.data.operator?.status !== "approved" && <p className="text-xs rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">The organiser is {statusLabel(d.data.operator?.status).toLowerCase()}. A tour can be published only for an approved organiser.</p>}
            <div className="flex flex-wrap gap-2">
              {t.status === "pending_review" && <EnterpriseButton variant="outline" disabled={!!busy} onClick={() => act("approve")}>Approve (not live yet)</EnterpriseButton>}
              {["pending_review", "approved", "unpublished"].includes(t.status) && <EnterpriseButton variant="success" disabled={!!busy} onClick={() => act("publish")}>Publish</EnterpriseButton>}
              {["pending_review", "approved"].includes(t.status) && <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => act("reject", true)}>Reject</EnterpriseButton>}
              {t.status === "published" && <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => act("unpublish", true)}>Unpublish</EnterpriseButton>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel title="Tour">
                <InfoRow label="Sold as">{t.productType.replace(/_/g, " ")}</InfoRow>
                <InfoRow label="Duration">{t.durationDays} days / {t.durationNights} nights</InfoRow>
                <InfoRow label="Fare">{rupees(t.baseFare)}</InfoRow>
                <InfoRow label="Template">{t.circuitTemplateName || "—"}</InfoRow>
                <InfoRow label="Included">{t.inclusions.join(", ") || "—"}</InfoRow>
                <InfoRow label="Not included">{t.exclusions.join(", ") || "—"}</InfoRow>
                <InfoRow label="Cancellation">{(t.cancellationPolicy?.windows ?? []).map((w: any) => `${w.hoursBefore}h+: ${w.refundPercent}%`).join(" · ")} · later: {t.cancellationPolicy?.defaultRefundPercent ?? 0}%</InfoRow>
                {t.summary && <p className="text-xs text-gray-600 mt-2">{t.summary}</p>}
                {t.description && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">{t.description}</p>}
              </Panel>
              <Panel title="Itinerary">
                {t.itinerary.map((day: any) => <InfoRow key={day.dayNumber} label={`Day ${day.dayNumber}`}>{day.title}{day.description ? ` — ${day.description}` : ""}</InfoRow>)}
                {t.stops.length > 0 && <p className="text-[11px] text-gray-500 mt-2">Stops: {t.stops.map((s: any) => s.name).join(" → ")}</p>}
              </Panel>
            </div>
            {t.images.length > 0 && <Panel title="Photos"><div className="flex flex-wrap gap-2">{t.images.map((u: string) => <img key={u} src={u} alt="" className="h-24 w-36 rounded-xl object-cover" />)}</div></Panel>}
            <Panel title="Departures">
              {!d.data.departures.length ? <p className="text-xs text-gray-500">None yet.</p> : d.data.departures.map((x: any) => (
                <InfoRow key={x.id} label={dateTimeIst(x.departAt)}><Link to={`/admin/yatra/departures/${x.id}`} className="hover:underline">{x.bookedSeats}/{x.capacity} sold · {statusLabel(x.status)}</Link></InfoRow>
              ))}
            </Panel>
          </>
        );
      })()}
    </Gate>
  );
};

// =============================================================== departures
export const AdminYatraDeparturesPage: React.FC = () => {
  const navigate = useNavigate();
  const q = usePagedQueue((p) => yatraAdmin.departures(p), "scheduled");
  return (
    <Gate>
      <EnterprisePageHeader title="Departures and seat inventory" subtitle="Every departure on Tirvona, with its central seat inventory." icon={<CalendarDays size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "scheduled", label: "Open" }, { value: "draft", label: "Draft" }, { value: "sales_closed", label: "Sales closed" }, { value: "cancelled", label: "Cancelled" }, { value: "completed", label: "Completed" }, { value: "", label: "All" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="No departures here" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(d) => d.id}
                onRowClick={(d) => navigate(`/admin/yatra/departures/${d.id}`)}
                columns={[
                  { header: "Departure", cell: (d) => <div><p className="font-black">{dateTimeIst(d.departAt)}</p><p className="text-[10px] text-gray-500">{d.departureCode}</p></div> },
                  { header: "Tour", cell: (d) => <div><p className="font-bold">{d.tourTitle}</p><p className="text-[10px] text-gray-500">{d.operatorName}</p></div> },
                  { header: "Sold", cell: (d) => `${d.bookedSeats} / ${d.capacity}` },
                  { header: "Fare", cell: (d) => rupees(d.fare) },
                  { header: "Status", cell: (d) => <StatusPill status={d.status} /> },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

export const AdminYatraDepartureDetailPage: React.FC = () => {
  const { departureId = "" } = useParams();
  const d = useRemote<any>(() => yatraAdmin.departure(departureId), [departureId]);
  const [picked, setPicked] = useState<string[]>([]);
  const { busy, run } = useAction();
  return (
    <Gate>
      {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (() => {
        const dep = d.data.departure;
        const seats = d.data.seatMap.seats;
        const blockable = picked.filter((s) => seats.find((x: any) => x.seatNo === s)?.status === "available");
        const unblockable = picked.filter((s) => seats.find((x: any) => x.seatNo === s)?.status === "blocked");
        return (
          <>
            <EnterprisePageHeader title={`${d.data.tour?.title ?? ""} · ${dateLong(dep.departAt)}`} subtitle={`${dep.departureCode} · ${d.data.operator?.organisationName ?? ""} · ${d.data.vehicle?.registrationNumber ?? ""}`} icon={<CalendarDays size={20} />} actions={<StatusPill status={dep.status} />} />
            {!d.data.sellable && dep.status !== "cancelled" && <p className="text-xs rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">Not on sale: {d.data.unsellableReason}</p>}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Sold" value={`${dep.bookedSeats} / ${dep.capacity}`} />
              <Stat label="Available now" value={d.data.seatMap.available} />
              <Stat label="Fare" value={rupees(dep.fare)} />
              <Stat label="Departs" value={dateTimeIst(dep.departAt)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {dep.status === "scheduled" && <EnterpriseButton variant="outline" disabled={!!busy} onClick={() => run("close", () => yatraAdmin.closeSales(dep.id), d.reload, "Sales stopped.")}>Stop sales</EnterpriseButton>}
              {dep.status === "sales_closed" && <EnterpriseButton variant="outline" disabled={!!busy} onClick={() => run("reopen", () => yatraAdmin.reopenSales(dep.id), d.reload, "Sales reopened.")}>Reopen sales</EnterpriseButton>}
              {!["cancelled", "completed"].includes(dep.status) && (
                <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => {
                  const reason = askReason("Cancel this departure? Every paid traveller gets a full refund to their Tirvona wallet. Reason:");
                  if (reason && window.confirm("This cannot be undone. Cancel the departure and refund everyone?")) run("cancel", () => yatraAdmin.cancelDeparture(dep.id, reason), d.reload, "Departure cancelled and travellers refunded.");
                }}>Cancel departure and refund</EnterpriseButton>
              )}
              <Link to={`/admin/yatra/bookings?departureId=${dep.id}`} className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700">Bookings</Link>
            </div>
            <Panel title="Global seat inventory" actions={
              <div className="flex gap-2">
                <EnterpriseButton size="sm" variant="outline" disabled={!blockable.length || !!busy} onClick={() => run("block", () => yatraAdmin.blockSeats(dep.id, blockable, true), () => { setPicked([]); return d.reload(); }, "Seats blocked.")}>Block {blockable.length || ""}</EnterpriseButton>
                <EnterpriseButton size="sm" variant="outline" disabled={!unblockable.length || !!busy} onClick={() => run("unblock", () => yatraAdmin.blockSeats(dep.id, unblockable, false), () => { setPicked([]); return d.reload(); }, "Seats released for sale.")}>Unblock {unblockable.length || ""}</EnterpriseButton>
              </div>
            }>
              <p className="text-[11px] text-gray-500 mb-2">Select available seats to block them, or blocked seats to put them back on sale. Held and sold seats cannot be changed here.</p>
              <SeatMap
                columns={d.data.seatMap.columns}
                seats={seats.map((s: any) => ({ ...s, status: ["available", "blocked"].includes(s.status) ? "available" : "unavailable", bookingReference: s.bookingReference || (s.status === "blocked" ? "blocked" : "") }))}
                selected={picked}
                onToggle={(s) => setPicked((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}
              />
              <div className="mt-3"><SeatMap mode="view" columns={d.data.seatMap.columns} seats={seats} /></div>
            </Panel>
          </>
        );
      })()}
    </Gate>
  );
};

// ================================================================= bookings
export const AdminYatraBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const departureId = new URLSearchParams(window.location.search).get("departureId") ?? undefined;
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const remote = useRemote<any[]>(() => yatraAdmin.bookings({ status: status || undefined, source: source || undefined, q: search || undefined, departureId, page, limit: 20 }), [status, source, search, page, departureId]);
  const queue = { status, setStatus: (v: string) => { setStatus(v); setPage(1); }, page, setPage, remote };
  return (
    <Gate>
      <EnterprisePageHeader title="Yatra bookings" subtitle="All bookings across organisers, with source and payment state." icon={<ClipboardList size={20} />} />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <Chips value={queue.status} onChange={queue.setStatus} options={[{ value: "", label: "All" }, { value: "confirmed", label: "Confirmed" }, { value: "payment_pending", label: "Awaiting payment" }, { value: "held", label: "Held" }, { value: "cancellation_requested", label: "Cancellation requested" }, { value: "cancelled", label: "Cancelled" }, { value: "expired", label: "Expired" }]} />
            <div className="flex gap-2">
              <select aria-label="Source" className={`${inputClass} md:!w-44`} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
                <option value="">All sources</option><option value="MARKETPLACE">Website</option><option value="OPERATOR_LINK">Organiser link</option><option value="ORGANIZER">Organiser-assisted</option>
              </select>
              <input aria-label="Booking reference" placeholder="Booking reference" className={`${inputClass} md:!w-48`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setSearch(q.trim()); setPage(1); } }} onBlur={() => setSearch(q.trim())} />
            </div>
          </div>
          {queue.remote.state !== "ready" ? <PanelState state={queue.remote.state} error={queue.remote.error} onRetry={queue.remote.reload} /> : !queue.remote.data?.length ? <Empty title="No bookings" /> : (
            <>
              <ResponsiveTable
                rows={queue.remote.data}
                rowKey={(b) => b.id}
                onRowClick={(b) => navigate(`/admin/yatra/bookings/${b.id}`)}
                columns={[
                  { header: "Booking", cell: (b) => <div><p className="font-black">{b.bookingReference}</p><p className="text-[10px] text-gray-500">{b.contact.name} · {b.contact.phone}</p></div> },
                  { header: "Trip", cell: (b) => <div><p className="font-bold">{b.tourTitle}</p><p className="text-[10px] text-gray-500">{dateTimeIst(b.departAt)}</p></div> },
                  { header: "Seats", cell: (b) => b.seats.join(", ") },
                  { header: "Amount", cell: (b) => rupees(b.pricing.totalAmount) },
                  { header: "Source", cell: (b) => statusLabel(b.source), hideOnMobile: true },
                  { header: "Status", cell: (b) => <StatusPill status={b.status} /> },
                ]}
              />
              <Pager page={queue.page} limit={20} total={queue.remote.meta.total} onPage={queue.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

export const AdminYatraBookingDetailPage: React.FC = () => {
  const { bookingId = "" } = useParams();
  const d = useRemote<any>(() => yatraAdmin.booking(bookingId), [bookingId]);
  const { busy, run } = useAction();
  return (
    <Gate>
      {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (() => {
        const b = d.data.booking;
        return (
          <>
            <EnterprisePageHeader title={b.bookingReference} subtitle={`${b.tourTitle} · ${d.data.operatorName}`} icon={<Ticket size={20} />} actions={<StatusPill status={b.status} />} />
            <CancellationActions booking={b} busy={busy} run={run} reload={d.reload} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel title="Booking">
                <InfoRow label="Departure">{dateTimeIst(b.departAt)}</InfoRow>
                <InfoRow label="Source">{statusLabel(b.source)}{b.attribution.code ? ` · link ${b.attribution.code}` : ""}</InfoRow>
                {b.organizerStaffUserId && <InfoRow label="Organiser staff">{b.organizerStaffUserId} ({b.organizerMemberRole})</InfoRow>}
                <InfoRow label="Customer account">{b.customerId ?? "Not yet claimed"}</InfoRow>
                <InfoRow label="Contact">{b.contact.name} · {b.contact.phone}</InfoRow>
                <InfoRow label="Seats">{b.seats.join(", ")}</InfoRow>
                <InfoRow label="Total">{rupees(b.pricing.totalAmount)}</InfoRow>
                <InfoRow label="Paid">{rupees(b.pricing.amountPaid)}</InfoRow>
                {b.pricing.refundAmount > 0 && <InfoRow label="Refunded to wallet">{rupees(b.pricing.refundAmount)}</InfoRow>}
              </Panel>
              <Panel title="Travellers">{b.passengers.map((p: any) => <InfoRow key={p.seatNo} label={`Seat ${p.seatNo}`}>{p.name}{p.age ? `, ${p.age}` : ""}{p.checkedInAt ? " · boarded" : ""}</InfoRow>)}</Panel>
            </div>
            <Panel title="Payments">
              {!d.data.payments.length ? <p className="text-xs text-gray-500">No payment attempts.</p> : (
                <ResponsiveTable
                  rows={d.data.payments}
                  rowKey={(p: any) => p.id}
                  columns={[
                    { header: "Created", cell: (p: any) => dateTimeIst(p.createdAt) },
                    { header: "Amount", cell: (p: any) => rupees(p.amount) },
                    { header: "Via", cell: (p: any) => `${p.method} · ${p.channel}` },
                    { header: "Razorpay", cell: (p: any) => <span className="text-[10px] break-all">{p.orderId}{p.paymentId ? ` / ${p.paymentId}` : ""}</span>, hideOnMobile: true },
                    { header: "Status", cell: (p: any) => <div><StatusPill status={p.status} />{p.unapplied && <p className="text-[10px] text-rose-600">Returned to wallet</p>}</div> },
                  ]}
                />
              )}
            </Panel>
            <Panel title="Ledger">{d.data.ledger.map((l: any) => <InfoRow key={l.id} label={`${dateTimeIst(l.createdAt)} · ${l.type.replace(/_/g, " ")}`}>{l.direction === "debit" ? "−" : "+"}{rupees(l.amount)}</InfoRow>)}</Panel>
            <Panel title="History">{b.history.slice().reverse().map((h: any, i: number) => <InfoRow key={i} label={dateTimeIst(h.at)}>{h.note || statusLabel(h.status)}</InfoRow>)}</Panel>
          </>
        );
      })()}
    </Gate>
  );
};

const CancellationActions: React.FC<{ booking: any; busy: string; run: ReturnType<typeof useAction>["run"]; reload: () => unknown }> = ({ booking: b, busy, run, reload }) => {
  const [percent, setPercent] = useState<string>(b.cancellation?.quotedPercent !== undefined ? String(b.cancellation.quotedPercent) : "");
  if (b.status === "cancellation_requested")
    return (
      <Panel title="Cancellation request">
        <p className="text-xs mb-2">Reason: {b.cancellation.reason}. Policy refund: <b>{rupees(b.cancellation.quotedAmount)}</b> ({b.cancellation.quotedPercent}%).</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Refund %" hint="Change only with a reason"><input type="number" min={0} max={100} className={`${inputClass} !w-24`} value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
          <EnterpriseButton variant="success" disabled={!!busy} onClick={() => {
            const custom = percent !== "" && Number(percent) !== b.cancellation.quotedPercent;
            const note = custom ? askReason("Why a different refund?") : "";
            if (custom && !note) return;
            run("approve", () => yatraAdmin.decideCancellation(b.id, { decision: "approve", refundPercent: percent === "" ? undefined : Number(percent), note: note || undefined }), reload, "Cancelled; refund sent to the wallet.");
          }}>Approve and refund to wallet</EnterpriseButton>
          <EnterpriseButton variant="danger" disabled={!!busy} onClick={() => { const note = askReason("Why is the cancellation rejected?"); if (note) run("reject", () => yatraAdmin.decideCancellation(b.id, { decision: "reject", note }), reload, "Request rejected."); }}>Reject</EnterpriseButton>
        </div>
      </Panel>
    );
  if (b.status === "confirmed")
    return (
      <div>
        <EnterpriseButton variant="outline" disabled={!!busy} onClick={() => {
          const reason = askReason("Reason for cancelling this booking:");
          if (!reason) return;
          const raw = window.prompt("Refund % to the customer's wallet (0–100):", "100");
          if (raw === null) return;
          run("cancel", () => yatraAdmin.cancelBooking(b.id, { refundPercent: Math.max(0, Math.min(100, Number(raw) || 0)), reason }), reload, "Booking cancelled.");
        }}>Cancel this booking</EnterpriseButton>
      </div>
    );
  return null;
};

export const AdminYatraCancellationsPage: React.FC = () => {
  const navigate = useNavigate();
  const q = useRemote<any[]>(() => yatraAdmin.bookings({ status: "cancellation_requested", limit: 100 }), []);
  return (
    <Gate>
      <EnterprisePageHeader title="Cancellation requests" subtitle="Approve to refund to the customer's Tirvona wallet and release the seats." icon={<Ticket size={20} />} />
      <Panel>
        {q.state !== "ready" ? <PanelState state={q.state} error={q.error} onRetry={q.reload} /> : !q.data?.length ? <Empty title="No open requests" /> : (
          <ResponsiveTable
            rows={q.data}
            rowKey={(b) => b.id}
            onRowClick={(b) => navigate(`/admin/yatra/bookings/${b.id}`)}
            columns={[
              { header: "Booking", cell: (b) => <span className="font-black">{b.bookingReference}</span> },
              { header: "Trip", cell: (b) => <div><p>{b.tourTitle}</p><p className="text-[10px] text-gray-500">{dateTimeIst(b.departAt)}</p></div> },
              { header: "Requested", cell: (b) => dateTimeIst(b.cancellation?.requestedAt) },
              { header: "Policy refund", cell: (b) => `${rupees(b.cancellation?.quotedAmount)} (${b.cancellation?.quotedPercent}%)` },
              { header: "Reason", cell: (b) => <span className="text-gray-500">{b.cancellation?.reason}</span>, hideOnMobile: true },
            ]}
          />
        )}
      </Panel>
    </Gate>
  );
};

// ========================================================= service requests
export const AdminYatraServiceRequestsPage: React.FC = () => {
  const q = usePagedQueue((p) => yatraAdmin.serviceRequests(p), "requested");
  const { busy, run } = useAction();
  const assign = (r: any) => {
    const id = window.prompt(`${r.serviceType === "food" ? "Restaurant (food vendor)" : "Pandit (provider)"} id to assign:`);
    if (!id) return;
    run(r.id, () => yatraAdmin.assignSupplier(r.id, r.serviceType === "food" ? { foodVendorId: id.trim() } : { providerId: id.trim() }), q.remote.reload, "Assigned.");
  };
  const accept = (r: any) => {
    const raw = window.prompt("Price agreed with the supplier, in rupees:");
    if (!raw) return;
    run(r.id, () => yatraAdmin.respondRequest(r.id, { decision: "accept", quotedAmount: Number(raw) }), q.remote.reload, "Accepted on the supplier's behalf.");
  };
  return (
    <Gate>
      <EnterprisePageHeader title="Meal and puja requests" subtitle="Assign a supplier, answer on their behalf, mark delivered, or cancel (paid add-ons are refunded to the wallet)." icon={<UtensilsCrossed size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={q.status} onChange={q.setStatus} options={[{ value: "requested", label: "Need a supplier" }, { value: "supplier_pending", label: "Waiting for supplier" }, { value: "accepted", label: "Awaiting payment" }, { value: "confirmed", label: "Confirmed" }, { value: "", label: "All" }]} />
          {q.remote.state !== "ready" ? <PanelState state={q.remote.state} error={q.remote.error} onRetry={q.remote.reload} /> : !q.remote.data?.length ? <Empty title="Nothing here" /> : (
            <>
              <ResponsiveTable
                rows={q.remote.data}
                rowKey={(r) => r.id}
                columns={[
                  { header: "Request", cell: (r) => <div><p className="font-black">{r.requestNumber}</p><p className="text-[10px] text-gray-500">{r.serviceType === "food" ? `${r.details.quantity} × ${String(r.details.mealType).replace("_", " ")}` : r.details.ritualName}</p></div> },
                  { header: "When / where", cell: (r) => <div><p>{dateLong(r.serviceDate)}</p><p className="text-[10px] text-gray-500">{r.details.location}</p></div> },
                  { header: "Supplier", cell: (r) => r.supplierName || "—" },
                  { header: "Price", cell: (r) => (r.quotedAmount ? rupees(r.quotedAmount) : "—") },
                  { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
                  {
                    header: "Actions",
                    cell: (r) => (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {["requested", "supplier_pending", "rejected"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => assign(r)}>Assign</EnterpriseButton>}
                        {r.status === "supplier_pending" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => accept(r)}>Accept</EnterpriseButton>}
                        {r.status === "confirmed" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => yatraAdmin.fulfilRequest(r.id), q.remote.reload, "Marked delivered.")}>Delivered</EnterpriseButton>}
                        {!["cancelled", "fulfilled", "rejected"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => { const reason = askReason("Reason for cancelling:"); if (reason) run(r.id, () => yatraAdmin.cancelRequest(r.id, reason), q.remote.reload, "Cancelled."); }}>Cancel</EnterpriseButton>}
                      </div>
                    ),
                  },
                ]}
              />
              <Pager page={q.page} limit={20} total={q.remote.meta.total} onPage={q.setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

// ================================================================== finance
export const AdminYatraFinancePage: React.FC = () => {
  const [range, setRange] = useState({ from: "", to: "" });
  const f = useRemote<any>(() => yatraAdmin.finance(range), [range.from, range.to]);
  const [page, setPage] = useState(1);
  const ledger = useRemote<any[]>(() => yatraAdmin.ledger({ page, limit: 25 }), [page]);
  return (
    <Gate>
      <EnterprisePageHeader title="Yatra collections & ledger" subtitle="Every payment Tirvona collected and every wallet refund. Commission, payables and payouts are in the Finance Center." icon={<IndianRupee size={20} />} actions={<Link to="/admin/yatra/finance" className="text-xs font-bold text-[#F28C28] hover:underline">Finance Center →</Link>} />
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" className={inputClass} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className={inputClass} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
      </div>
      {f.state !== "ready" || !f.data ? <PanelState state={f.state} error={f.error} onRetry={f.reload} /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Booking payments" value={rupees(f.data.totals.bookingPayments)} />
            <Stat label="Add-on payments" value={rupees(f.data.totals.addOnPayments)} />
            <Stat label="Refunds to wallets" value={rupees(f.data.totals.refundsToWallet)} />
            <Stat label="Unusable payments returned" value={rupees(f.data.totals.unappliedReturned)} tone={f.data.totals.unappliedReturned ? "warn" : undefined} />
          </div>
          <Panel title="By organiser">
            {!f.data.perOperator.length ? <Empty title="No sales yet" /> : (
              <ResponsiveTable
                rows={f.data.perOperator}
                rowKey={(r: any) => r.operatorId}
                columns={[
                  { header: "Organiser", cell: (r: any) => <Link className="font-bold hover:underline" to={`/admin/yatra/operators/${r.operatorId}`}>{r.operatorName}</Link> },
                  { header: "Gross", cell: (r: any) => rupees(r.grossSales) },
                  { header: "Refunds", cell: (r: any) => rupees(r.refunds) },
                  { header: "Net", cell: (r: any) => <b>{rupees(r.netSales)}</b> },
                  { header: "Direct / website", cell: (r: any) => `${rupees(r.directSales)} / ${rupees(r.marketplaceSales)}`, hideOnMobile: true },
                  { header: "Add-ons", cell: (r: any) => rupees(r.addOnSales), hideOnMobile: true },
                ]}
              />
            )}
          </Panel>
          <Panel title="Payment issues">
            {!f.data.paymentIssues.length ? <p className="text-xs text-gray-500">No unusable or stuck payments.</p> : (
              <ResponsiveTable
                rows={f.data.paymentIssues}
                rowKey={(p: any) => p.id}
                columns={[
                  { header: "Created", cell: (p: any) => dateTimeIst(p.createdAt) },
                  { header: "Amount", cell: (p: any) => rupees(p.amount) },
                  { header: "What", cell: (p: any) => (p.unapplied ? "Paid but unusable — returned to wallet" : "Order created, no payment yet") },
                  { header: "Detail", cell: (p: any) => <span className="text-[10px] break-all">{p.failureReason || p.orderId}</span>, hideOnMobile: true },
                  { header: "Booking", cell: (p: any) => (p.bookingId ? <Link className="hover:underline" to={`/admin/yatra/bookings/${p.bookingId}`}>Open</Link> : "—") },
                ]}
              />
            )}
          </Panel>
        </>
      )}
      <Panel title="Ledger">
        {ledger.state !== "ready" ? <PanelState state={ledger.state} /> : (
          <>
            <ResponsiveTable
              rows={ledger.data ?? []}
              rowKey={(l) => l.id}
              columns={[
                { header: "Date", cell: (l) => dateTimeIst(l.createdAt) },
                { header: "Type", cell: (l) => l.type.replace(/_/g, " ") },
                { header: "Reference", cell: (l) => l.reference || "—" },
                { header: "Amount", cell: (l) => <span className={`font-black tabular-nums ${l.direction === "debit" ? "text-rose-600" : "text-emerald-600"}`}>{l.direction === "debit" ? "−" : "+"}{rupees(l.amount)}</span> },
              ]}
            />
            <Pager page={page} limit={25} total={ledger.meta.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </Gate>
  );
};

// ==================================================================== audit
export const AdminYatraAuditPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const a = useRemote<any[]>(() => yatraAdmin.audit({ page, limit: 30, action: action || undefined }), [page, action]);
  return (
    <Gate>
      <EnterprisePageHeader title="Yatra audit log" subtitle="Who changed what and when, with before and after values." icon={<History size={20} />} />
      <Panel>
        <div className="space-y-3">
          <input aria-label="Filter by action" className={`${inputClass} md:!w-72`} placeholder="Filter by action, e.g. tour.publish" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          {a.state !== "ready" ? <PanelState state={a.state} error={a.error} onRetry={a.reload} /> : !a.data?.length ? <Empty title="No entries" /> : (
            <>
              <ResponsiveTable
                rows={a.data}
                rowKey={(r) => r.id}
                columns={[
                  { header: "When", cell: (r) => dateTimeIst(r.timestamp) },
                  { header: "Action", cell: (r) => <span className="font-bold">{r.action}</span> },
                  { header: "By", cell: (r) => <span className="text-[10px] text-gray-500">{r.userId ?? "system"}</span> },
                  { header: "Change", cell: (r) => <span className="text-[10px] break-all text-gray-500">{r.before ? `${JSON.stringify(r.before)} → ` : ""}{r.after ? JSON.stringify(r.after) : JSON.stringify(r.details).slice(0, 160)}</span> },
                ]}
              />
              <Pager page={page} limit={30} total={a.meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </Gate>
  );
};

// ================================================================= settings
export const AdminYatraSettingsPage: React.FC = () => {
  const s = useRemote<any>(() => yatraAdmin.settings(), []);
  const [f, setF] = useState<Record<string, string> | null>(null);
  const { busy, run } = useAction();
  const values = f ?? (s.data ? Object.fromEntries(Object.entries(s.data).map(([k, v]) => [k, String(v ?? "")])) : null);
  return (
    <Gate>
      <EnterprisePageHeader title="Yatra settings" subtitle="Seat hold times, booking limits, ride rules and reminders." icon={<Settings size={20} />} />
      {s.state !== "ready" || !values ? <PanelState state={s.state} error={s.error} onRetry={s.reload} /> : (
        <Panel>
          <form onSubmit={(e) => { e.preventDefault(); run("save", () => yatraAdmin.saveSettings({ holdMinutes: Number(values.holdMinutes), paymentLinkMinutes: Number(values.paymentLinkMinutes), maxSeatsPerBooking: Number(values.maxSeatsPerBooking), salesCloseMinutes: Number(values.salesCloseMinutes), rideFullRefundHours: Number(values.rideFullRefundHours), ridePartnerResponseHours: Number(values.ridePartnerResponseHours), reminderHours: Number(values.reminderHours), supportPhone: values.supportPhone }), () => { setF(null); return s.reload(); }, "Settings saved."); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            <Field label="Website seat hold (minutes)" hint="5 to 30"><input type="number" min={5} max={30} className={inputClass} value={values.holdMinutes} onChange={(e) => setF({ ...values, holdMinutes: e.target.value })} /></Field>
            <Field label="Organiser payment-link hold (minutes)" hint="10 to 120"><input type="number" min={10} max={120} className={inputClass} value={values.paymentLinkMinutes} onChange={(e) => setF({ ...values, paymentLinkMinutes: e.target.value })} /></Field>
            <Field label="Most seats in one booking" hint="1 to 40"><input type="number" min={1} max={40} className={inputClass} value={values.maxSeatsPerBooking} onChange={(e) => setF({ ...values, maxSeatsPerBooking: e.target.value })} /></Field>
            <Field label="Stop sales before departure (minutes)" hint="0 to 1440"><input type="number" min={0} max={1440} className={inputClass} value={values.salesCloseMinutes} onChange={(e) => setF({ ...values, salesCloseMinutes: e.target.value })} /></Field>
            <Field label="Full ride refund if cancelled (hours before pickup)" hint="0 to 72"><input type="number" min={0} max={72} className={inputClass} value={values.rideFullRefundHours} onChange={(e) => setF({ ...values, rideFullRefundHours: e.target.value })} /></Field>
            <Field label="Ride partner must answer within (hours)" hint="1 to 72; then the request returns to Tirvona"><input type="number" min={1} max={72} className={inputClass} value={values.ridePartnerResponseHours} onChange={(e) => setF({ ...values, ridePartnerResponseHours: e.target.value })} /></Field>
            <Field label="Journey reminder (hours before departure)" hint="1 to 96"><input type="number" min={1} max={96} className={inputClass} value={values.reminderHours} onChange={(e) => setF({ ...values, reminderHours: e.target.value })} /></Field>
            <Field label="Support phone shown to pilgrims"><input className={inputClass} value={values.supportPhone} onChange={(e) => setF({ ...values, supportPhone: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex justify-end"><EnterpriseButton type="submit" disabled={busy === "save"}>Save settings</EnterpriseButton></div>
          </form>
        </Panel>
      )}
      <p className="text-[11px] text-gray-500 flex items-center gap-1.5"><LayoutDashboard size={12} /> Yatra itself is switched on or off on the server with YATRA_ENABLED.</p>
    </Gate>
  );
};
