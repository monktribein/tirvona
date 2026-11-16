import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BedDouble,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  IndianRupee,
  Link2,
  MapPin,
  ParkingCircle,
  Phone,
  Plus,
  Printer,
  Route,
  ShoppingBag,
  Ticket,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { askReason, Chips, Empty, Field, inputClass, Panel, PanelState, useAction, useRemote } from "../../marketplace/ui";
import { yatraCustomer, yatraRides, yatraSupplier } from "../services/yatra.service";
import { ItineraryList, dateLong, dateTimeIst, InfoRow, paymentError, rupees, runPayment, StatusPill, timeOnly, YatraGate } from "../yatraUi";

// ================================================================ my journeys
export const MyJourneysPage: React.FC = () => (
  <YatraGate>
    <JourneyList />
  </YatraGate>
);

const JourneyList: React.FC = () => {
  const remote = useRemote<any[]>(() => yatraCustomer.journeys(), []);
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <EnterprisePageHeader title="My Journeys" subtitle="Your Tirvona Yatra trips: tickets, boarding, itinerary and add-ons." icon={<Route size={20} />} />
      {remote.state !== "ready" ? (
        <PanelState state={remote.state} error={remote.error} onRetry={remote.reload} />
      ) : !remote.data?.length ? (
        <Empty icon={<Bus size={28} className="text-[#F28C28]" />} title="No journeys yet" text="When you book a Yatra, it appears here with your ticket and itinerary." action={<Link to="/yatra" className="text-xs font-extrabold text-[#F28C28]">Find a Yatra</Link>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {remote.data.map((j) => (
            <Link key={j.id} to={`/profile/journeys/${j.id}`} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 sm:p-5 shadow-sm hover:border-[#F28C28]/50 space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-sm text-[#0B192C] dark:text-white">{j.title}</p>
                <StatusPill status={j.status} />
              </div>
              <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><MapPin size={12} /> {j.originCity} → {j.destinationCity}</p>
              <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><CalendarDays size={12} /> {dateLong(j.startDate)}</p>
              <p className="text-[11px] text-gray-400">{j.journeyNumber} · {j.bookingReference} · {j.travellers} traveller{j.travellers === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================== journey hub
export const JourneyDetailPage: React.FC = () => (
  <YatraGate>
    <JourneyHub />
  </YatraGate>
);

const JourneyHub: React.FC = () => {
  const { journeyId = "" } = useParams();
  const remote = useRemote<any>(() => yatraCustomer.journey(journeyId), [journeyId]);
  const [ticket, setTicket] = useState<any>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const { busy, run } = useAction();
  const data = remote.data;

  if (remote.state !== "ready" || !data)
    return <div className="max-w-5xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} onRetry={remote.reload} missingText="This journey was not found." /></div>;

  const { journey, booking, departure, tour, operator } = data;
  const canCancel = booking.status === "confirmed" && new Date(booking.departAt).getTime() > Date.now();

  const openTicket = async () => {
    setShowTicket(true);
    if (!ticket) {
      try {
        setTicket((await yatraCustomer.ticket(booking.id)).data.data);
      } catch {
        setShowTicket(false);
      }
    }
  };
  const startCancel = async () => setPreview((await yatraCustomer.refundPreview(booking.id)).data.data);
  const confirmCancel = async () => {
    const reason = askReason("Why do you want to cancel? (at least 3 characters)");
    if (!reason) return;
    await run("cancel", () => yatraCustomer.requestCancellation(booking.id, reason), () => {
      setPreview(null);
      return remote.reload();
    }, "Your cancellation request was sent to Tirvona.");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <EnterprisePageHeader
        title={journey.title}
        subtitle={`${journey.journeyNumber} · ${journey.originCity} → ${journey.destinationCity} · ${dateLong(journey.startDate)}`}
        icon={<Route size={20} />}
      />
      <div className="flex flex-wrap gap-2 items-center">
        <StatusPill status={journey.status} />
        <StatusPill status={booking.status} />
        <button type="button" className="text-xs font-bold text-gray-500 hover:underline ml-auto" onClick={async () => { const description = askReason("Tell Tirvona what went wrong (at least 5 characters):", 5); if (!description) return; await yatraRides.reportJourneyIssue(journey.id, { description }); toast.success("Reported. Tirvona support will contact you."); }}>Report a problem</button>
        <Link to="/profile/journeys" className="text-xs font-bold text-[#F28C28] hover:underline">All journeys</Link>
      </div>

      {departure?.status === "cancelled" && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300">
          This departure was cancelled by Tirvona{departure.cancellationReason ? `: ${departure.cancellationReason}` : ""}. Paid amounts were refunded to your Tirvona wallet.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Panel
            title={<span className="flex items-center gap-2"><Ticket size={15} className="text-[#F28C28]" /> Bus ticket</span>}
            actions={["confirmed", "cancellation_requested", "completed"].includes(booking.status) && (
              <EnterpriseButton size="sm" variant="outline" onClick={openTicket}>Show ticket QR</EnterpriseButton>
            )}
          >
            <InfoRow label="Booking reference">{booking.bookingReference}</InfoRow>
            {booking.ticketCode && <InfoRow label="Ticket code">{booking.ticketCode}</InfoRow>}
            <InfoRow label="Departure">{dateTimeIst(departure?.departAt)}</InfoRow>
            <InfoRow label="Return">{dateTimeIst(departure?.returnAt)}</InfoRow>
            <InfoRow label="Seats">{booking.seats.join(", ")}</InfoRow>
            <InfoRow label="Amount paid">{rupees(booking.pricing.amountPaid)}{booking.pricing.protectionFee > 0 ? ` (includes ${rupees(booking.pricing.protectionFee)} cancellation protection)` : ""}</InfoRow>
            {booking.pricing.refundAmount > 0 && <InfoRow label="Refunded to wallet">{rupees(booking.pricing.refundAmount)}</InfoRow>}
          </Panel>

          <Panel title="Travellers">
            <ul className="divide-y divide-gray-50 dark:divide-slate-800">
              {booking.passengers.map((p: any) => (
                <li key={p.seatNo} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-bold">{p.name}{p.age ? `, ${p.age}` : ""}</span>
                  <span className="text-gray-500">Seat {p.seatNo}{p.checkedInAt ? " · boarded" : ""}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {tour && (
            <Panel title="Itinerary">
              <ItineraryList days={tour.itinerary} />
            </Panel>
          )}

          <AddOns journey={journey} booking={booking} requests={data.serviceRequests} reload={remote.reload} />
          <RidesPanel journey={journey} booking={booking} />
          <RateTripPanel booking={booking} />
          <LinkedBookings journeyId={journey.id} links={data.links} destination={journey.destinationCity} startDate={journey.startDate} reload={remote.reload} />

          <Panel title="Journey history">
            <ol className="space-y-2">
              {booking.history.slice().reverse().map((h: any, i: number) => (
                <li key={i} className="text-xs flex gap-2"><span className="text-gray-400 shrink-0 w-36">{dateTimeIst(h.at)}</span><span>{h.note || h.status}</span></li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <Panel title={<span className="flex items-center gap-2"><MapPin size={15} className="text-[#F28C28]" /> Boarding</span>}>
            {departure?.boardingPoint ? (
              <>
                <InfoRow label="Point">{departure.boardingPoint.name}</InfoRow>
                {departure.boardingPoint.time && <InfoRow label="Time">{timeOnly(departure.boardingPoint.time)}</InfoRow>}
                {(departure.boardingPoint.address || departure.boardingPoint.landmark) && <InfoRow label="Address">{[departure.boardingPoint.landmark, departure.boardingPoint.address].filter(Boolean).join(", ")}</InfoRow>}
                {departure.boardingPoint.mapUrl && <a href={departure.boardingPoint.mapUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#F28C28] hover:underline">Open in maps</a>}
              </>
            ) : <p className="text-xs text-gray-500">{booking.boardingPointName}</p>}
          </Panel>
          {operator && (
            <Panel title="Partner">
              <p className="text-xs font-black">{operator.name}</p>
              {operator.contactPhone && <a href={`tel:${operator.contactPhone}`} className="text-xs font-bold text-[#F28C28] inline-flex items-center gap-1 mt-1"><Phone size={12} /> {operator.contactPhone}</a>}
            </Panel>
          )}
          <Panel title="Cancellation">
            {booking.cancellation ? (
              <div className="space-y-1">
                <StatusPill status={booking.cancellation.status === "requested" ? "cancellation_requested" : booking.cancellation.status} />
                <p className="text-xs text-gray-500">
                  {booking.cancellation.status === "requested"
                    ? `Waiting for Tirvona. Policy refund: ${rupees(booking.cancellation.quotedAmount)} (${booking.cancellation.quotedPercent}%).`
                    : booking.cancellation.status === "approved"
                      ? `Cancelled. ${rupees(booking.cancellation.refundAmount)} was added to your Tirvona wallet.`
                      : `Not approved: ${booking.cancellation.decisionNote}`}
                </p>
              </div>
            ) : canCancel ? (
              preview ? (
                <div className="space-y-2">
                  <p className="text-xs">Under the policy you would get <b>{rupees(preview.refundAmount)}</b> ({preview.refundPercent}%) back in your Tirvona wallet once Tirvona approves.</p>
                  <div className="flex gap-2">
                    <EnterpriseButton size="sm" variant="danger" disabled={busy === "cancel"} onClick={confirmCancel}>Request cancellation</EnterpriseButton>
                    <EnterpriseButton size="sm" variant="ghost" onClick={() => setPreview(null)}>Keep booking</EnterpriseButton>
                  </div>
                </div>
              ) : (
                <EnterpriseButton size="sm" variant="outline" onClick={startCancel}>Cancel this booking</EnterpriseButton>
              )
            ) : (
              <p className="text-xs text-gray-500">Cancellation is not available for this booking.</p>
            )}
          </Panel>
        </div>
      </div>

      {showTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Ticket">
          <div className="bg-white dark:bg-[#0B192C] rounded-[24px] p-5 w-full max-w-sm space-y-3 text-center print:shadow-none">
            <div className="flex justify-between items-center">
              <p className="text-sm font-black">Tirvona Yatra ticket</p>
              <button type="button" aria-label="Close" onClick={() => setShowTicket(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><X size={16} /></button>
            </div>
            {ticket ? (
              <>
                <img src={ticket.qr} alt={`QR code for booking ${booking.bookingReference}`} className="w-56 h-56 mx-auto" />
                <p className="text-lg font-black tracking-widest">{ticket.booking.ticketCode}</p>
                <p className="text-xs text-gray-500">{booking.bookingReference} · Seats {booking.seats.join(", ")}</p>
                <p className="text-xs text-gray-500">{dateTimeIst(departure?.departAt)} · {booking.boardingPointName}</p>
                <EnterpriseButton size="sm" variant="outline" icon={<Printer size={13} />} onClick={() => window.print()}>Print</EnterpriseButton>
              </>
            ) : <PanelState state="loading" />}
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------- add-ons
const AddOns: React.FC<{ journey: any; booking: any; requests: any[]; reload: () => unknown }> = ({ journey, booking, requests, reload }) => {
  const { user } = useAuth();
  const [form, setForm] = useState<"" | "food" | "puja">("");
  const { busy, run } = useAction();
  const open = ["confirmed", "cancellation_requested"].includes(booking.status) && journey.status !== "completed";

  const pay = async (request: any) => {
    try {
      const order = await yatraCustomer.requestOrder(request.id);
      await runPayment(order.data.data, { name: user?.name, email: user?.email, contact: user?.phone }, (proof) => yatraCustomer.requestConfirm(request.id, proof));
      toast.success("Add-on confirmed.");
      reload();
    } catch (err) {
      toast.error(paymentError(err));
      reload();
    }
  };
  const cancel = async (request: any) => {
    const reason = askReason("Why cancel this request?");
    if (!reason) return;
    await run(request.id, () => yatraCustomer.cancelRequest(request.id, reason), reload, "Request cancelled.");
  };

  return (
    <Panel
      title={<span className="flex items-center gap-2"><Plus size={15} className="text-[#F28C28]" /> Meals and puja</span>}
      actions={open && (
        <div className="flex gap-2">
          <EnterpriseButton size="sm" variant="outline" icon={<UtensilsCrossed size={13} />} onClick={() => setForm(form === "food" ? "" : "food")}>Request meals</EnterpriseButton>
          <EnterpriseButton size="sm" variant="outline" icon={<Flame size={13} />} onClick={() => setForm(form === "puja" ? "" : "puja")}>Request a puja</EnterpriseButton>
        </div>
      )}
    >
      {form && <RequestForm type={form} journey={journey} booking={booking} onDone={() => { setForm(""); reload(); }} />}
      {!requests.length ? (
        !form && <p className="text-xs text-gray-500">No add-ons yet. Request group meals or a puja; it is confirmed once the supplier accepts and you pay.</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-slate-800">
          {requests.map((r) => (
            <li key={r.id} className="py-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs font-black">
                  {r.serviceType === "food" ? `${r.details.quantity} × ${String(r.details.mealType).replace("_", " ")}` : r.details.ritualName} · {dateLong(r.serviceDate)}
                </span>
                <StatusPill status={r.status} />
              </div>
              <p className="text-[11px] text-gray-500">{r.requestNumber}{r.supplierName ? ` · ${r.supplierName}` : " · Tirvona will find a supplier"}{r.quotedAmount ? ` · ${rupees(r.quotedAmount)}` : ""}</p>
              {r.supplierNote && <p className="text-[11px] text-gray-500">“{r.supplierNote}”</p>}
              <div className="flex gap-2">
                {r.status === "accepted" && <EnterpriseButton size="sm" icon={<IndianRupee size={12} />} onClick={() => pay(r)}>Pay {rupees(r.quotedAmount)} to confirm</EnterpriseButton>}
                {["requested", "supplier_pending", "accepted"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => cancel(r)}>Cancel request</EnterpriseButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const RequestForm: React.FC<{ type: "food" | "puja"; journey: any; booking: any; onDone: () => void }> = ({ type, journey, booking, onDone }) => {
  const suppliers = useRemote<any[]>(() => (type === "food" ? yatraCustomer.foodSuppliers() : yatraCustomer.pujaProviders(journey.destinationCity)), [type]);
  const min = new Date(new Date(journey.startDate).getTime() - 86_400_000 + 330 * 60_000).toISOString().slice(0, 10);
  const max = new Date(new Date(journey.endDate).getTime() + 86_400_000 + 330 * 60_000).toISOString().slice(0, 10);
  const [f, setF] = useState<Record<string, string>>({ serviceDate: min > new Date().toISOString().slice(0, 10) ? min : new Date().toISOString().slice(0, 10), location: journey.destinationCity, mealType: "lunch", quantity: String(booking.seatCount), dietaryPreference: "satvik", attendees: String(booking.seatCount) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = { serviceType: type, serviceDate: new Date(`${f.serviceDate}T12:00:00+05:30`).toISOString(), location: f.location, notes: f.notes || undefined };
      if (type === "food") Object.assign(body, { mealType: f.mealType, quantity: Number(f.quantity), dietaryPreference: f.dietaryPreference, foodVendorId: f.supplier || undefined });
      else Object.assign(body, { ritualName: f.ritualName, preferredTime: f.preferredTime || undefined, attendees: Number(f.attendees) || undefined, providerId: f.supplier || undefined });
      await yatraCustomer.createRequest(journey.id, body);
      toast.success("Request sent.");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "The request could not be sent."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label={type === "food" ? "Request meals" : "Request a puja"}>
      <Field label="Date" required><input type="date" min={min} max={max} className={inputClass} value={f.serviceDate} onChange={set("serviceDate")} required /></Field>
      <Field label="Where" required><input className={inputClass} value={f.location} onChange={set("location")} required minLength={2} /></Field>
      {type === "food" ? (
        <>
          <Field label="Meal" required>
            <select className={inputClass} value={f.mealType} onChange={set("mealType")}>
              <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="packed_meal">Packed meal</option>
            </select>
          </Field>
          <Field label="How many people" required><input type="number" min={1} max={500} className={inputClass} value={f.quantity} onChange={set("quantity")} required /></Field>
          <Field label="Food preference">
            <select className={inputClass} value={f.dietaryPreference} onChange={set("dietaryPreference")}>
              <option value="satvik">Satvik</option><option value="jain">Jain</option><option value="no_onion_garlic">No onion / garlic</option><option value="regular">Regular vegetarian</option>
            </select>
          </Field>
        </>
      ) : (
        <>
          <Field label="Which puja" required><input className={inputClass} value={f.ritualName ?? ""} onChange={set("ritualName")} required minLength={2} placeholder="e.g. Yamuna aarti sankalp" /></Field>
          <Field label="Preferred time"><input className={inputClass} value={f.preferredTime ?? ""} onChange={set("preferredTime")} placeholder="e.g. Morning" /></Field>
          <Field label="People attending"><input type="number" min={1} max={200} className={inputClass} value={f.attendees} onChange={set("attendees")} /></Field>
        </>
      )}
      <Field label={type === "food" ? "Restaurant (optional)" : "Pandit (optional)"} hint="Leave empty and Tirvona will find one.">
        <select className={inputClass} value={f.supplier ?? ""} onChange={set("supplier")}>
          <option value="">Let Tirvona choose</option>
          {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inputClass} value={f.notes ?? ""} onChange={set("notes")} maxLength={1000} /></Field>
      {error && <p role="alert" className="sm:col-span-2 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <EnterpriseButton type="button" variant="ghost" onClick={onDone}>Close</EnterpriseButton>
        <EnterpriseButton type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</EnterpriseButton>
      </div>
    </form>
  );
};

// ----------------------------------------------------------- linked bookings
const MODULE_ICON: Record<string, React.ReactNode> = { stay: <BedDouble size={14} />, parking: <ParkingCircle size={14} />, aarti: <Flame size={14} /> };

const LinkedBookings: React.FC<{ journeyId: string; links: any[]; destination: string; startDate: string; reload: () => unknown }> = ({ journeyId, links, destination, startDate, reload }) => {
  const [picking, setPicking] = useState(false);
  const linkable = useRemote<any[]>(() => (picking ? yatraCustomer.linkable(journeyId) : Promise.resolve({ data: { data: [] } })), [picking, journeyId]);
  const { busy, run } = useAction();
  const date = new Date(startDate).toISOString().slice(0, 10);
  return (
    <Panel
      title={<span className="flex items-center gap-2"><Link2 size={15} className="text-[#F28C28]" /> Stay, parking and aarti</span>}
      actions={<EnterpriseButton size="sm" variant="outline" onClick={() => setPicking(!picking)}>{picking ? "Done" : "Add an existing booking"}</EnterpriseButton>}
    >
      {links.length > 0 && (
        <ul className="divide-y divide-gray-50 dark:divide-slate-800 mb-3">
          {links.map((l) => (
            <li key={l.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-bold">{MODULE_ICON[l.module]} {l.title} · {l.reference}</span>
              <span className="flex items-center gap-2">
                <StatusPill status={l.status} />
                <button type="button" aria-label={`Remove ${l.reference}`} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800" disabled={busy === l.id} onClick={() => run(l.id, () => yatraCustomer.removeLink(journeyId, l.id), reload)}><X size={12} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {picking && (
        <div className="mb-3">
          {linkable.state !== "ready" ? <PanelState state={linkable.state} error={linkable.error} /> : !linkable.data?.length ? (
            <p className="text-xs text-gray-500">No stay, parking or aarti bookings around these dates in your account.</p>
          ) : (
            <ul className="space-y-1.5">
              {linkable.data.map((r) => (
                <li key={`${r.module}:${r.refId}`} className="flex items-center justify-between gap-2 text-xs rounded-xl border border-gray-100 dark:border-slate-800 p-2">
                  <span className="flex items-center gap-2">{MODULE_ICON[r.module]} {r.title} · {r.reference} · {dateLong(r.date)}</span>
                  <EnterpriseButton size="sm" disabled={busy === r.refId} onClick={() => run(r.refId, () => yatraCustomer.addLink(journeyId, r.module, r.refId), () => { linkable.reload(); return reload(); }, "Added to your journey.")}>Add</EnterpriseButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Link to={`/stays?city=${encodeURIComponent(destination)}&checkIn=${date}`} className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] inline-flex items-center gap-1"><BedDouble size={12} /> Find a stay in {destination}</Link>
        <Link to="/parking" className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] inline-flex items-center gap-1"><ParkingCircle size={12} /> Parking</Link>
        <Link to="/aarti" className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] inline-flex items-center gap-1"><Flame size={12} /> Aarti passes</Link>
        <Link to="/marketplace" className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:border-[#F28C28] inline-flex items-center gap-1"><ShoppingBag size={12} /> Prasad and puja items</Link>
      </div>
    </Panel>
  );
};

// ============================================================ supplier inbox
/** Restaurants and pandits: Yatra meal and puja requests assigned to them. */
export const SupplierYatraRequestsPage: React.FC = () => (
  <YatraGate>
    <SupplierInbox />
  </YatraGate>
);

const SupplierInbox: React.FC = () => {
  const [status, setStatus] = useState("supplier_pending");
  const remote = useRemote<any[]>(() => yatraSupplier.requests(status || undefined), [status]);
  const { busy, run } = useAction();

  const accept = async (r: any) => {
    const raw = window.prompt(`Your price for ${r.requestNumber} in rupees (the customer pays Tirvona):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!(amount >= 1)) return toast.error("Enter a valid amount.");
    await run(r.id, () => yatraSupplier.respond(r.id, { decision: "accept", quotedAmount: amount }), remote.reload, "Accepted. The customer will be asked to pay.");
  };
  const reject = async (r: any) => {
    const note = askReason("Why can you not take this request?");
    if (!note) return;
    await run(r.id, () => yatraSupplier.respond(r.id, { decision: "reject", note }), remote.reload, "Declined.");
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Yatra requests" subtitle="Meal and puja requests from Tirvona Yatra pilgrims. Accept with your price; it is confirmed once the pilgrim pays Tirvona." icon={<Clock size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={status} onChange={setStatus} options={[{ value: "supplier_pending", label: "Waiting for you" }, { value: "accepted", label: "Awaiting payment" }, { value: "confirmed", label: "Confirmed" }, { value: "", label: "All" }]} />
          {remote.state !== "ready" ? (
            <PanelState state={remote.state} error={remote.error} onRetry={remote.reload} missingText="You are not registered as a restaurant or pandit on Tirvona." />
          ) : !remote.data?.length ? (
            <Empty title="Nothing here" text="New Yatra requests will appear here." />
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-slate-800">
              {remote.data.map((r) => (
                <li key={r.id} className="py-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black">{r.serviceType === "food" ? `${r.details.quantity} × ${String(r.details.mealType).replace("_", " ")} (${r.details.dietaryPreference})` : r.details.ritualName}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-[11px] text-gray-500">{r.requestNumber} · {dateLong(r.serviceDate)}{r.details.preferredTime ? ` · ${r.details.preferredTime}` : ""} · {r.details.location}</p>
                  {r.details.notes && <p className="text-[11px] text-gray-500">“{r.details.notes}”</p>}
                  {r.customer && <p className="text-[11px] font-bold">{r.customer.name} · {r.customer.phone}</p>}
                  {r.quotedAmount > 0 && <p className="text-[11px] text-gray-500">Your price: {rupees(r.quotedAmount)}</p>}
                  <div className="flex gap-2 pt-1">
                    {r.status === "supplier_pending" && (
                      <>
                        <EnterpriseButton size="sm" disabled={busy === r.id} icon={<CheckCircle2 size={12} />} onClick={() => accept(r)}>Accept with price</EnterpriseButton>
                        <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => reject(r)}>Decline</EnterpriseButton>
                      </>
                    )}
                    {r.status === "confirmed" && <EnterpriseButton size="sm" variant="outline" disabled={busy === r.id} onClick={() => run(r.id, () => yatraSupplier.fulfil(r.id), remote.reload, "Marked as delivered.")}>Mark delivered</EnterpriseButton>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
};

// --------------------------------------------------------------- rate this trip
/** After the trip has finished, the pilgrim rates it once (1–5 stars and an optional comment). */
const RateTripPanel: React.FC<{ booking: any }> = ({ booking }) => {
  const state = useRemote<any>(() => yatraCustomer.rating(booking.id), [booking.id]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState(0);
  const { busy, run } = useAction();
  if (state.state !== "ready" || !state.data) return null;
  const { rating, canRate, reason } = state.data;
  if (!rating && !canRate) return null; // not finished yet (or not a paid booking): nothing to show
  return (
    <Panel title="Rate your trip">
      {rating ? (
        <div className="space-y-1">
          <p className="text-sm font-black text-amber-600" aria-label={`You rated ${rating.stars} out of 5`}>{"★".repeat(rating.stars)}<span className="text-gray-300">{"★".repeat(5 - rating.stars)}</span></p>
          {rating.comment && <p className="text-xs text-gray-600 dark:text-gray-300">{rating.comment}</p>}
          <p className="text-[11px] text-gray-400">Thank you. Your first name and rating are shown on the partner's page.</p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!stars) return;
            run("rate", () => yatraCustomer.rate(booking.id, { stars, comment: comment.trim() || undefined }), state.reload, "Thank you for rating your trip.");
          }}
        >
          <p className="text-[11px] text-gray-500">{reason || "How was your trip with this partner?"}</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setStars(n)} className={`text-3xl leading-none px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/60 rounded ${n <= (hover || stars) ? "text-amber-500" : "text-gray-300"}`}>★</button>
            ))}
          </div>
          <Field label="Comment (optional)"><textarea rows={3} maxLength={500} className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Bus, driver, timing, organiser" /></Field>
          <div className="flex justify-end"><EnterpriseButton type="submit" disabled={busy === "rate" || !stars}>Submit rating</EnterpriseButton></div>
        </form>
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------------- rides
const RIDE_TYPES = [["any", "Any vehicle"], ["auto", "Auto"], ["e_rickshaw", "E-rickshaw"], ["sedan", "Sedan"], ["suv", "SUV"], ["tempo_traveller", "Tempo traveller"], ["mini_bus", "Mini bus"]];

const RidesPanel: React.FC<{ journey: any; booking: any }> = ({ journey, booking }) => {
  const { user } = useAuth();
  const rides = useRemote<any[]>(() => yatraRides.list(journey.id), [journey.id]);
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  const canRequest = ["confirmed", "cancellation_requested"].includes(booking.status) && journey.status !== "completed";
  const pay = async (ride: any) => {
    try {
      const order = await yatraRides.order(ride.id);
      await runPayment(order.data.data, { name: user?.name, email: user?.email, contact: user?.phone }, (proof) => yatraRides.confirm(ride.id, proof));
      toast.success("Ride confirmed.");
    } catch (err) {
      toast.error(paymentError(err));
    } finally {
      rides.reload();
    }
  };
  return (
    <Panel
      title={<span className="flex items-center gap-2"><Route size={15} className="text-[#F28C28]" /> Local rides in {journey.destinationCity}</span>}
      actions={canRequest && <EnterpriseButton size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setOpen(!open)}>Request a ride</EnterpriseButton>}
    >
      {open && <RideForm journey={journey} booking={booking} onDone={() => { setOpen(false); rides.reload(); }} />}
      {rides.state !== "ready" ? <PanelState state={rides.state} error={rides.error} onRetry={rides.reload} /> : !rides.data?.length ? (
        !open && <p className="text-xs text-gray-500">Need a cab from the station or to a temple? Request it here; it is confirmed once a verified partner accepts and you pay.</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-slate-800">
          {rides.data.map((r) => (
            <li key={r.id} className="py-3 space-y-1">
              <div className="flex flex-wrap justify-between gap-2 items-center"><span className="text-xs font-black">{dateTimeIst(r.pickupAt)}</span><StatusPill status={r.status} /></div>
              <p className="text-xs">{r.pickup.address} → {r.drop.address}</p>
              <p className="text-[11px] text-gray-500">{r.requestNumber} · {r.passengers} passenger{r.passengers === 1 ? "" : "s"}{r.partnerName ? ` · ${r.partnerName}` : " · Tirvona is finding a partner"}{r.quotedAmount ? ` · ${rupees(r.quotedAmount)}` : ""}</p>
              {r.assignment && <p className="text-[11px] font-bold">{r.assignment.vehicleRegistration}{r.assignment.driverName ? ` · ${r.assignment.driverName}` : ""}{r.assignment.driverPhone ? ` · ${r.assignment.driverPhone}` : ""}</p>}
              {r.refundAmount > 0 && <p className="text-[11px] text-emerald-600">{rupees(r.refundAmount)} refunded to your wallet</p>}
              <div className="flex flex-wrap gap-2">
                {r.status === "accepted" && <EnterpriseButton size="sm" icon={<IndianRupee size={12} />} onClick={() => pay(r)}>Pay {rupees(r.quotedAmount)} to confirm</EnterpriseButton>}
                {["requested", "partner_pending", "accepted", "confirmed"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" disabled={busy === r.id} onClick={() => { const reason = askReason(r.status === "confirmed" ? "Cancel this paid ride? A full refund applies if pickup is far enough away. Reason:" : "Why cancel this ride?"); if (reason) run(r.id, () => yatraRides.cancel(r.id, reason), rides.reload, "Ride cancelled."); }}>Cancel</EnterpriseButton>}
                {["confirmed", "in_progress", "completed"].includes(r.status) && <EnterpriseButton size="sm" variant="ghost" onClick={() => { const description = askReason("What went wrong with this ride?", 5); if (description) run(`i${r.id}`, () => yatraRides.reportRideIssue(r.id, { description }), undefined, "Reported to Tirvona."); }}>Report issue</EnterpriseButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const RideForm: React.FC<{ journey: any; booking: any; onDone: () => void }> = ({ journey, booking, onDone }) => {
  const partners = useRemote<any[]>(() => yatraRides.partners(journey.destinationCity), [journey.destinationCity]);
  const defaultTime = new Date(Math.max(Date.now() + 2 * 3_600_000, new Date(journey.startDate).getTime()) + 330 * 60_000).toISOString().slice(0, 16);
  const [f, setF] = useState({ pickupAddress: "", pickupLandmark: "", dropAddress: "", pickupAt: defaultTime, passengers: String(booking.seatCount), rideType: "any", partnerId: "", notes: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await yatraRides.request(journey.id, { pickupAddress: f.pickupAddress, pickupLandmark: f.pickupLandmark || undefined, dropAddress: f.dropAddress, pickupAt: new Date(`${f.pickupAt}:00+05:30`).toISOString(), passengers: Number(f.passengers), rideType: f.rideType, partnerId: f.partnerId || undefined, notes: f.notes || undefined });
      toast.success("Ride requested.");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "The ride could not be requested."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Request a ride">
      <Field label="Pickup" required><input className={inputClass} value={f.pickupAddress} onChange={set("pickupAddress")} required minLength={3} placeholder="e.g. Vrindavan bus stand" /></Field>
      <Field label="Landmark"><input className={inputClass} value={f.pickupLandmark} onChange={set("pickupLandmark")} /></Field>
      <Field label="Drop" required><input className={inputClass} value={f.dropAddress} onChange={set("dropAddress")} required minLength={3} placeholder="e.g. Prem Mandir" /></Field>
      <Field label="Pickup time (India)" required><input type="datetime-local" className={inputClass} value={f.pickupAt} onChange={set("pickupAt")} required /></Field>
      <Field label="Passengers" required><input type="number" min={1} max={60} className={inputClass} value={f.passengers} onChange={set("passengers")} required /></Field>
      <Field label="Vehicle"><select className={inputClass} value={f.rideType} onChange={set("rideType")}>{RIDE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Ride partner (optional)" hint="Leave empty and Tirvona will assign a verified partner." className="sm:col-span-2">
        <select className={inputClass} value={f.partnerId} onChange={set("partnerId")}><option value="">Let Tirvona choose</option>{(partners.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · up to {p.maxSeats} seats</option>)}</select>
      </Field>
      {error && <p role="alert" className="sm:col-span-2 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2"><EnterpriseButton type="button" variant="ghost" onClick={onDone}>Close</EnterpriseButton><EnterpriseButton type="submit" disabled={busy}>{busy ? "Sending…" : "Request ride"}</EnterpriseButton></div>
    </form>
  );
};
