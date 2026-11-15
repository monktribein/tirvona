import React, { useState } from "react";
import { AlertTriangle, Bus, CalendarDays, Car, MapPin, Plus, Search, Users, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../../admin/shared/components/EnterpriseModal";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { AssignRideModal } from "../../../admin/yatra/AdminYatraRidePages";
import { askReason, Chips, Empty, Field, inputClass, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../marketplace/ui";
import { yatraOps } from "../services/yatra.service";
import { dateLong, dateTimeIst, InfoRow, rupees, StatusPill, timeOnly, YatraGate } from "../yatraUi";

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 330 * 60_000 - n * 86_400_000).toISOString().slice(0, 10);
const SEVERITY_TONE: Record<string, string> = { low: "text-gray-500", medium: "text-amber-600", high: "text-rose-600", critical: "text-rose-700 font-black" };

/**
 * Destination Operations for Tirvona Yatra. Super Admin sees every city (or
 * picks one); HR and Executive logins see only their office area, enforced on
 * the server with the same office scope as the Leads, Food and Temple consoles.
 */
export const YatraOpsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin";
  const [date, setDate] = useState(istToday());
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const d = useRemote<any>(() => yatraOps.dashboard({ date, city: city || undefined }), [date, city]);
  const [passengersOf, setPassengersOf] = useState<any>(null);
  const [assigning, setAssigning] = useState<any>(null);
  const [reporting, setReporting] = useState(false);
  return (
    <YatraGate>
      <div className="space-y-5">
        <EnterprisePageHeader
          title="Yatra Destination Ops"
          subtitle={d.data ? `Area: ${d.data.scope}. Arrivals, departures, supplier confirmations, local rides and incidents.` : "Arrivals, departures, supplier confirmations, local rides and incidents."}
          icon={<MapPin size={20} />}
          actions={<EnterpriseButton icon={<Plus size={14} />} onClick={() => setReporting(true)}>Report incident</EnterpriseButton>}
        />
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Day"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value || istToday())} /></Field>
          {isAdmin && (
            <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); setCity(cityInput.trim()); }}>
              <Field label="City (blank = all)"><input className={inputClass} value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="e.g. Vrindavan" /></Field>
              <EnterpriseButton type="submit" variant="outline">Show</EnterpriseButton>
            </form>
          )}
        </div>
        {d.state !== "ready" || !d.data ? <PanelState state={d.state} error={d.error} onRetry={d.reload} /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Groups arriving / on ground" value={d.data.kpis.arrivingGroups} hint={`${d.data.kpis.arrivingPassengers} pilgrims`} icon={<Bus size={16} />} />
              <Stat label="Groups leaving today" value={d.data.kpis.leavingGroups} hint={`${d.data.kpis.leavingPassengers} pilgrims`} icon={<CalendarDays size={16} />} />
              <Stat label="Meal & puja to confirm" value={d.data.kpis.supplierPending} tone={d.data.kpis.supplierPending ? "warn" : undefined} icon={<UtensilsCrossed size={16} />} />
              <Stat label="Rides needing a partner" value={d.data.kpis.ridesNeedingPartner} tone={d.data.kpis.ridesNeedingPartner ? "warn" : undefined} icon={<Car size={16} />} />
              <Stat label="Open incidents" value={d.data.kpis.openIssues} tone={d.data.kpis.openIssues ? "warn" : undefined} icon={<AlertTriangle size={16} />} />
            </div>

            <Panel title="Arrivals and groups on the ground">
              {!d.data.arrivals.length ? <p className="text-xs text-gray-500">No groups in this area on {dateLong(date)}.</p> : <DepartureTable rows={d.data.arrivals} onPassengers={setPassengersOf} />}
            </Panel>
            <Panel title="Leaving from this area">
              {!d.data.departures.length ? <p className="text-xs text-gray-500">No departures from this area on {dateLong(date)}.</p> : <DepartureTable rows={d.data.departures} onPassengers={setPassengersOf} />}
            </Panel>

            <Panel title="Meal and puja confirmations">
              {!d.data.supplierConfirmations.length ? <p className="text-xs text-gray-500">No meal or puja requests around this day.</p> : (
                <ResponsiveTable
                  rows={d.data.supplierConfirmations}
                  rowKey={(r: any) => r.id}
                  columns={[
                    { header: "Request", cell: (r: any) => <span className="font-black">{r.requestNumber}</span> },
                    { header: "Service", cell: (r: any) => (r.serviceType === "food" ? "Meal" : r.serviceType === "puja" ? "Puja" : r.serviceType) },
                    { header: "When", cell: (r: any) => dateLong(r.serviceDate) },
                    { header: "Supplier", cell: (r: any) => r.supplierName || "Not assigned" },
                    { header: "Status", cell: (r: any) => <StatusPill status={r.status} /> },
                  ]}
                />
              )}
            </Panel>

            <Panel title="Local rides">
              {!d.data.rides.length ? <p className="text-xs text-gray-500">No rides on this day.</p> : (
                <ResponsiveTable
                  rows={d.data.rides}
                  rowKey={(r: any) => r.id}
                  columns={[
                    { header: "Pickup", cell: (r: any) => <div><p className="font-black">{timeOnly(r.pickupAt)}</p><p className="text-[10px] text-gray-500">{r.requestNumber}</p></div> },
                    { header: "Route", cell: (r: any) => <span className="text-[11px]">{r.pickup} → {r.drop}</span> },
                    { header: "Pax", cell: (r: any) => r.passengers },
                    { header: "Partner", cell: (r: any) => r.partnerName || "—" },
                    { header: "Status", cell: (r: any) => <StatusPill status={r.status} /> },
                    { header: "", cell: (r: any) => (["requested", "rejected", "partner_pending"].includes(r.status) ? <EnterpriseButton size="sm" onClick={() => setAssigning(r)}>Assign</EnterpriseButton> : null) },
                  ]}
                />
              )}
            </Panel>
          </>
        )}

        <Issues city={city} reloadKey={d.data} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BookingLookup city={city} />
          <CityReport city={city} />
        </div>
      </div>
      {passengersOf && <PassengersModal departure={passengersOf} onClose={() => setPassengersOf(null)} />}
      {assigning && <AssignRideModal ride={assigning} fetchPartners={(c) => yatraOps.partners(c)} assign={(id, pid) => yatraOps.assignRide(id, pid)} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); d.reload(); }} />}
      {reporting && <IncidentModal defaultCity={city} onClose={() => setReporting(false)} onDone={() => { setReporting(false); d.reload(); }} />}
    </YatraGate>
  );
};

const DepartureTable: React.FC<{ rows: any[]; onPassengers: (row: any) => void }> = ({ rows, onPassengers }) => (
  <ResponsiveTable
    rows={rows}
    rowKey={(r: any) => r.departureId}
    columns={[
      { header: "Departure", cell: (r: any) => <div><p className="font-black">{r.tourTitle}</p><p className="text-[10px] text-gray-500">{r.departureCode} · {r.originCity} → {r.destinationCity}</p></div> },
      { header: "Leaves / returns", cell: (r: any) => <span className="text-[11px]">{dateTimeIst(r.departAt)}<br />{dateTimeIst(r.returnAt)}</span> },
      { header: "Pilgrims", cell: (r: any) => `${r.passengers} / ${r.capacity}` },
      { header: "Organiser", cell: (r: any) => <span className="text-[11px]">{r.organiser}{r.organiserPhone ? ` · ${r.organiserPhone}` : ""}</span>, hideOnMobile: true },
      { header: "Status", cell: (r: any) => <StatusPill status={r.status} /> },
      { header: "", cell: (r: any) => <EnterpriseButton size="sm" variant="ghost" icon={<Users size={12} />} onClick={() => onPassengers(r)}>Passengers</EnterpriseButton> },
    ]}
  />
);

const PassengersModal: React.FC<{ departure: any; onClose: () => void }> = ({ departure, onClose }) => {
  const p = useRemote<any>(() => yatraOps.passengers(departure.departureId), [departure.departureId]);
  return (
    <EnterpriseModal isOpen onClose={onClose} title={departure.tourTitle} subtitle={`${departure.departureCode} · confirmed travellers`}>
      {p.state !== "ready" || !p.data ? <PanelState state={p.state} error={p.error} onRetry={p.reload} /> : !p.data.passengers.length ? <p className="text-xs text-gray-500">No confirmed travellers.</p> : (
        <ul className="divide-y divide-gray-50 dark:divide-slate-800">
          {p.data.passengers.map((x: any) => (
            <li key={`${x.bookingReference}-${x.seatNo}`} className="py-2 flex justify-between gap-3 text-xs">
              <div className="min-w-0"><p className="font-bold">{x.name}</p><p className="text-[10px] text-gray-500">{x.bookingReference} · {x.boardingPointName}{x.contactPhone ? ` · ${x.contactPhone}` : ""}</p></div>
              <span className="shrink-0 text-right"><b>Seat {x.seatNo}</b>{x.checkedInAt && <span className="block text-[10px] text-emerald-600">Boarded</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </EnterpriseModal>
  );
};

// ================================================================== issues
const Issues: React.FC<{ city: string; reloadKey: unknown }> = ({ city, reloadKey }) => {
  const [status, setStatus] = useState("open");
  const list = useRemote<any[]>(() => yatraOps.issues({ status: status || undefined, city: city || undefined, page: 1, limit: 50 }), [status, city, reloadKey]);
  const { busy, run } = useAction();
  const move = (i: any, next: string) => {
    const resolution = ["resolved", "closed"].includes(next) ? askReason("How was it resolved? (saved on the incident; tell the reporter yourself)") : "";
    if (resolution === null) return;
    run(i.id, () => yatraOps.updateIssue(i.id, { status: next, resolution: resolution || undefined }), list.reload, "Incident updated.");
  };
  return (
    <Panel title="Incidents and pilgrim issues">
      <div className="space-y-3">
        <Chips value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }, { value: "", label: "All" }]} />
        {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty title="Nothing here" /> : (
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {list.data.map((i) => (
              <li key={i.id} className="py-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <span className="text-xs font-black">{i.title}</span>
                  <StatusPill status={i.status} />
                </div>
                <p className="text-[11px] text-gray-500">{i.issueNumber} · {i.city} · {i.category} · <span className={SEVERITY_TONE[i.severity] ?? ""}>{i.severity}</span> · {dateTimeIst(i.createdAt)} · reported by {i.reportedByRole || "—"}</p>
                {i.description && <p className="text-xs">{i.description}</p>}
                {i.resolution && <p className="text-xs text-emerald-700 dark:text-emerald-400">Resolution: {i.resolution}</p>}
                <div className="flex flex-wrap gap-2">
                  {i.status === "open" && <EnterpriseButton size="sm" variant="outline" disabled={busy === i.id} onClick={() => move(i, "in_progress")}>Start handling</EnterpriseButton>}
                  {["open", "in_progress"].includes(i.status) && <EnterpriseButton size="sm" variant="success" disabled={busy === i.id} onClick={() => move(i, "resolved")}>Mark resolved</EnterpriseButton>}
                  {i.status === "resolved" && <EnterpriseButton size="sm" variant="ghost" disabled={busy === i.id} onClick={() => move(i, "closed")}>Close</EnterpriseButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
};

const IncidentModal: React.FC<{ defaultCity: string; onClose: () => void; onDone: () => void }> = ({ defaultCity, onClose, onDone }) => {
  const [f, setF] = useState({ city: defaultCity, title: "", description: "", category: "incident", severity: "medium", bookingReference: "" });
  const { busy, run } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <EnterpriseModal isOpen onClose={onClose} title="Report an incident" subtitle="Super Admin and the area team see it at once.">
      <form onSubmit={(e) => { e.preventDefault(); run("issue", () => yatraOps.createIssue({ ...f, description: f.description || undefined, bookingReference: f.bookingReference || undefined }), onDone, "Incident reported."); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="City" required><input className={inputClass} value={f.city} onChange={set("city")} required minLength={2} /></Field>
        <Field label="Booking reference"><input className={inputClass} value={f.bookingReference} onChange={set("bookingReference")} placeholder="Optional" /></Field>
        <Field label="What happened" required className="sm:col-span-2"><input className={inputClass} value={f.title} onChange={set("title")} required minLength={3} maxLength={140} /></Field>
        <Field label="Details" className="sm:col-span-2"><textarea rows={3} className={inputClass} value={f.description} onChange={set("description")} maxLength={2000} /></Field>
        <Field label="Category"><select className={inputClass} value={f.category} onChange={set("category")}>{["incident", "service", "ride", "booking", "payment", "safety", "other"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></Field>
        <Field label="Severity"><select className={inputClass} value={f.severity} onChange={set("severity")}>{["low", "medium", "high", "critical"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></Field>
        <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onClose}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy === "issue"}>Report</EnterpriseButton></div>
      </form>
    </EnterpriseModal>
  );
};

// ========================================================= booking lookup
const BookingLookup: React.FC<{ city: string }> = ({ city }) => {
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await yatraOps.lookup(reference, city || undefined);
      setResult(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "No booking with that reference in your area."));
    } finally {
      setBusy(false);
    }
  };
  const b = result?.booking;
  return (
    <Panel title="Booking assistance">
      <form onSubmit={search} className="flex gap-2 items-end">
        <Field label="Booking reference" className="flex-1"><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} required minLength={4} placeholder="e.g. TVN-YTR-AB12CD34" /></Field>
        <EnterpriseButton type="submit" icon={<Search size={14} />} disabled={busy}>Find</EnterpriseButton>
      </form>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      {b && (
        <div className="mt-3 space-y-1.5">
          <InfoRow label="Booking">{<span className="flex items-center gap-2">{b.bookingReference} <StatusPill status={b.status} /></span>}</InfoRow>
          <InfoRow label="Tour">{`${result.tour.title} · ${result.tour.originCity} → ${result.tour.destinationCity}`}</InfoRow>
          <InfoRow label="Departs">{result.departure ? `${dateTimeIst(result.departure.departAt)} (${result.departure.departureCode})` : "—"}</InfoRow>
          <InfoRow label="Boarding">{b.boardingPointName || "—"}</InfoRow>
          <InfoRow label="Contact">{[b.contact?.name, b.contact?.phone].filter(Boolean).join(" · ") || "—"}</InfoRow>
          <InfoRow label="Travellers">{(b.passengers ?? []).map((p: any) => `${p.name} (${p.seatNo})`).join(", ")}</InfoRow>
          <InfoRow label="Paid">{rupees(b.pricing?.amountPaid ?? 0)}</InfoRow>
        </div>
      )}
    </Panel>
  );
};

// ============================================================ city report
const CityReport: React.FC<{ city: string }> = ({ city }) => {
  const [range, setRange] = useState({ from: daysAgo(7), to: istToday() });
  const r = useRemote<any>(() => yatraOps.report({ ...range, city: city || undefined }), [range.from, range.to, city]);
  return (
    <Panel title="Area report">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="From"><input type="date" className={inputClass} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className={inputClass} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        </div>
        {r.state !== "ready" || !r.data ? <PanelState state={r.state} error={r.error} onRetry={r.reload} /> : !r.data.rows.length ? <p className="text-xs text-gray-500">Nothing in {r.data.scope} for these days.</p> : (
          <ResponsiveTable
            rows={r.data.rows}
            rowKey={(x: any) => x.date}
            columns={[
              { header: "Date", cell: (x: any) => <span className="font-black">{x.date}</span> },
              { header: "Groups", cell: (x: any) => x.arrivingGroups },
              { header: "Pilgrims", cell: (x: any) => x.arrivingPassengers },
              { header: "Rides", cell: (x: any) => `${x.completedRides}/${x.rides}` },
              { header: "Incidents", cell: (x: any) => x.issues },
            ]}
          />
        )}
      </div>
    </Panel>
  );
};
