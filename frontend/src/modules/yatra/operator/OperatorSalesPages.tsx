import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  Link2,
  Plus,
  QrCode,
  ScanLine,
  Send,
  Share2,
  Ticket,
  Trash2,
} from "lucide-react";
import api, { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseModal } from "../../../admin/shared/components/EnterpriseModal";
import { askReason, Chips, Empty, Field, inputClass, Pager, Panel, PanelState, ResponsiveTable, Stat, useAction, useRemote } from "../../marketplace/ui";
import { yatraOperator, yatraOperatorPayouts } from "../services/yatra.service";
import { PayeeMoney } from "../ridePartner/RidePartnerPages";
import { dateLong, dateTimeIst, fromLocalInput, InfoRow, rupees, SeatMap, StatusPill, statusLabel, timeOnly, toLocalInput } from "../yatraUi";
import { can, OperatorShell } from "./operatorShell";

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  } catch {
    window.prompt("Copy this:", text);
  }
};
const whatsapp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ================================================================ departures
export const OperatorDeparturesPage: React.FC = () => <OperatorShell>{(me) => <Departures me={me} />}</OperatorShell>;

const Departures: React.FC<{ me: any }> = ({ me }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scope, setScope] = useState("upcoming");
  const tourId = params.get("tour") ?? undefined;
  const list = useRemote<any[]>(() => yatraOperator.departures({ upcoming: scope === "upcoming" ? "true" : undefined, tourId }), [scope, tourId]);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Departures"
        subtitle="Each departure is one trip of a tour on one vehicle. Its seats live in Tirvona's central inventory."
        icon={<CalendarDays size={20} />}
        actions={can(me, "manageDepartures") && <EnterpriseButton icon={<Plus size={13} />} onClick={() => setCreating(true)}>New departure</EnterpriseButton>}
      />
      <Panel>
        <div className="space-y-3">
          <Chips value={scope} onChange={setScope} options={[{ value: "upcoming", label: "Upcoming" }, { value: "all", label: "All" }]} />
          {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty icon={<CalendarDays size={28} className="text-gray-300" />} title="No departures" /> : (
            <ResponsiveTable
              rows={list.data}
              rowKey={(d) => d.id}
              onRowClick={(d) => navigate(`/operator/departures/${d.id}`)}
              columns={[
                { header: "Departure", cell: (d) => <div><p className="font-black">{dateTimeIst(d.departAt)}</p><p className="text-[10px] text-gray-500">{d.departureCode}</p></div> },
                { header: "Tour", cell: (d) => <div><p className="font-bold">{d.tourTitle}</p>{d.tourStatus !== "published" && <p className="text-[10px] text-amber-600">Tour {statusLabel(d.tourStatus).toLowerCase()}</p>}</div> },
                { header: "Seats sold", cell: (d) => <span className="tabular-nums">{d.bookedSeats} / {d.capacity}</span> },
                { header: "Fare", cell: (d) => rupees(d.fare) },
                { header: "Status", cell: (d) => <StatusPill status={d.status} /> },
              ]}
            />
          )}
        </div>
      </Panel>
      {creating && <DepartureForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/operator/departures/${id}`)} defaultTour={tourId} />}
    </div>
  );
};

type Point = { id?: string; name: string; address: string; landmark: string; time: string };

const DepartureForm: React.FC<{ onClose: () => void; onSaved: (id: string) => void; defaultTour?: string; departure?: any }> = ({ onClose, onSaved, defaultTour, departure }) => {
  const tours = useRemote<any[]>(() => yatraOperator.tours(), []);
  const vehicles = useRemote<any[]>(() => yatraOperator.vehicles(), []);
  const isDraft = !departure || departure.status === "draft";
  const [f, setF] = useState({
    tourId: departure?.tourId ?? defaultTour ?? "",
    vehicleId: departure?.vehicleId ?? "",
    departAt: toLocalInput(departure?.departAt),
    returnAt: toLocalInput(departure?.returnAt),
    fare: departure?.fare ? String(departure.fare) : "",
    seatMode: departure?.seatMode ?? "choose",
    blockedSeats: (departure?.blockedSeats ?? []).join(", "),
    notes: departure?.notes ?? "",
  });
  const [points, setPoints] = useState<Point[]>(
    departure?.boardingPoints?.length
      ? departure.boardingPoints.map((p: any) => ({ id: p.id, name: p.name, address: p.address ?? "", landmark: p.landmark ?? "", time: toLocalInput(p.time) }))
      : [{ name: "", address: "", landmark: "", time: "" }],
  );
  const [drops, setDrops] = useState<Point[]>(
    (departure?.droppingPoints ?? []).map((p: any) => ({ id: p.id, name: p.name, address: p.address ?? "", landmark: p.landmark ?? "", time: toLocalInput(p.time) })),
  );
  const [rests, setRests] = useState<Array<{ id?: string; name: string; time: string; durationMinutes: string }>>(
    (departure?.restStops ?? []).map((p: any) => ({ id: p.id, name: p.name, time: toLocalInput(p.time), durationMinutes: p.durationMinutes ? String(p.durationMinutes) : "" })),
  );
  const [charter, setCharter] = useState(Boolean(departure?.charterEnabled));
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(Object.entries(departure?.seatFares ?? {}).map(([k, v]) => [k, String(v)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tour = tours.data?.find((t) => t.id === f.tourId);
  const layout = departure?.seatLayout ?? vehicles.data?.find((v) => v.id === f.vehicleId)?.seatLayout ?? null;
  const defaultFare = Number(f.fare || tour?.baseFare || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const clean = (list: Point[]) => list.filter((p) => p.name.trim()).map((p) => ({ id: p.id, name: p.name.trim(), address: p.address || undefined, landmark: p.landmark || undefined, time: fromLocalInput(p.time) }));
    const boardingPoints = clean(points);
    const body: Record<string, unknown> = {
      boardingPoints,
      droppingPoints: clean(drops),
      restStops: rests.filter((r) => r.name.trim()).map((r) => ({ id: r.id, name: r.name.trim(), time: fromLocalInput(r.time), durationMinutes: r.durationMinutes ? Number(r.durationMinutes) : undefined })),
      charterEnabled: charter,
      seatFares: f.seatMode === "choose" ? Object.fromEntries(Object.entries(rates).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) : {},
      notes: f.notes,
    };
    if (isDraft) {
      Object.assign(body, {
        departAt: fromLocalInput(f.departAt),
        returnAt: fromLocalInput(f.returnAt),
        fare: f.fare ? Number(f.fare) : undefined,
        seatMode: f.seatMode,
        blockedSeats: f.blockedSeats.split(",").map((s: string) => s.trim()).filter(Boolean),
      });
    }
    try {
      if (departure) {
        await yatraOperator.updateDeparture(departure.id, body);
        toast.success("Departure saved.");
        onSaved(departure.id);
      } else {
        const res = await yatraOperator.createDeparture({ ...body, tourId: f.tourId, vehicleId: f.vehicleId });
        toast.success("Departure saved as a draft.");
        onSaved(res.data.data.id);
      }
    } catch (err) {
      setError(getErrorMessage(err, "The departure could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EnterpriseModal isOpen onClose={onClose} title={departure ? "Edit departure" : "New departure"}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!departure && (
            <>
              <Field label="Tour" required>
                <select className={inputClass} value={f.tourId} onChange={(e) => setF({ ...f, tourId: e.target.value })} required>
                  <option value="">Choose a tour</option>
                  {(tours.data ?? []).filter((t) => t.status !== "rejected").map((t) => <option key={t.id} value={t.id}>{t.title} ({statusLabel(t.status)})</option>)}
                </select>
              </Field>
              <Field label="Vehicle" required>
                <select className={inputClass} value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })} required>
                  <option value="">Choose a vehicle</option>
                  {(vehicles.data ?? []).filter((v) => !["suspended", "rejected"].includes(v.status)).map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.seatCapacity} seats ({statusLabel(v.status)})</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Departs (India time)" required><input type="datetime-local" className={inputClass} value={f.departAt} onChange={(e) => setF({ ...f, departAt: e.target.value })} required disabled={!isDraft} /></Field>
          <Field label="Returns (India time)"><input type="datetime-local" className={inputClass} value={f.returnAt} onChange={(e) => setF({ ...f, returnAt: e.target.value })} disabled={!isDraft} /></Field>
          <Field label="Fare per seat (₹)" hint={tour ? `Tour fare: ${rupees(tour.baseFare)}` : undefined}><input type="number" min={1} step="0.01" className={inputClass} value={f.fare} onChange={(e) => setF({ ...f, fare: e.target.value })} disabled={!isDraft} /></Field>
          <Field label="Seat selection"><select className={inputClass} value={f.seatMode} onChange={(e) => setF({ ...f, seatMode: e.target.value })} disabled={!isDraft}><option value="choose">Travellers choose seats</option><option value="auto">Assign seats automatically</option></select></Field>
          <Field label="Seats not for sale" hint="Comma separated, e.g. 1, 2 for guide seats" className="sm:col-span-2"><input className={inputClass} value={f.blockedSeats} onChange={(e) => setF({ ...f, blockedSeats: e.target.value })} disabled={!isDraft} /></Field>
        </div>
        {!isDraft && <p className="text-[11px] text-gray-500">Time, default fare and seats are locked while the departure is open. You can still change the rate of a seat nobody has held or bought. Ask Tirvona for other changes.</p>}
        <SeatRates layout={layout} blocked={f.blockedSeats.split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean)} defaultFare={defaultFare} rates={rates} setRates={setRates} seatMode={f.seatMode} />
        <PointEditor title="Boarding points" noun="boarding point" example="Kashmere Gate ISBT" points={points} setPoints={setPoints} />
        <PointEditor title="Dropping points" noun="dropping point" example="Vrindavan Bus Stand" points={drops} setPoints={setDrops} optional />
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Rest stops <span className="font-medium text-gray-400">(optional)</span></p><EnterpriseButton type="button" size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setRests([...rests, { name: "", time: "", durationMinutes: "" }])}>Add</EnterpriseButton></div>
          {rests.length === 0 && <p className="text-[11px] text-gray-400">No rest stop. Travellers will see "This bus has no rest stop".</p>}
          {rests.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_170px_110px_auto] gap-2">
              <input aria-label="Rest stop name" placeholder="Name, e.g. Haveli Dhaba, NH-19" className={inputClass} value={r.name} onChange={(e) => setRests(rests.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Rest stop time" type="datetime-local" className={inputClass} value={r.time} onChange={(e) => setRests(rests.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <input aria-label="Stop length in minutes" type="number" min={0} max={240} placeholder="Minutes" className={inputClass} value={r.durationMinutes} onChange={(e) => setRests(rests.map((x, j) => (j === i ? { ...x, durationMinutes: e.target.value } : x)))} />
              <button type="button" aria-label="Remove rest stop" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setRests(rests.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs font-bold"><input type="checkbox" className="mt-0.5" checked={charter} onChange={(e) => setCharter(e.target.checked)} /> <span>Accept requests to book the whole bus<span className="block font-medium text-gray-500">Pilgrims can ask for every seat. You accept or decline; the seats are held for them to pay Tirvona.</span></span></label>
        <Field label="Notes for your team"><textarea rows={2} className={inputClass} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></Field>
        {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <EnterpriseButton type="button" variant="ghost" onClick={onClose}>Cancel</EnterpriseButton>
          <EnterpriseButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  );
};

/** A list of named places with times: boarding points, or dropping points. */
const PointEditor: React.FC<{ title: string; noun: string; example: string; points: Point[]; setPoints: (p: Point[]) => void; optional?: boolean }> = ({ title, noun, example, points, setPoints, optional }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">{title}{optional && <span className="font-medium text-gray-400"> (optional)</span>}</p>
      <EnterpriseButton type="button" size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setPoints([...points, { name: "", address: "", landmark: "", time: "" }])}>Add</EnterpriseButton>
    </div>
    {points.map((p, i) => (
      <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_170px_auto] gap-2">
        <input aria-label={`${noun} name`} placeholder={`Name, e.g. ${example}`} className={inputClass} value={p.name} onChange={(e) => setPoints(points.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
        <input aria-label="Address or landmark" placeholder="Address or landmark" className={inputClass} value={p.address} onChange={(e) => setPoints(points.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
        <input aria-label={`${noun} time`} type="datetime-local" className={inputClass} value={p.time} onChange={(e) => setPoints(points.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
        <button type="button" aria-label={`Remove ${noun}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setPoints(points.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
      </div>
    ))}
  </div>
);

/**
 * The rate of every seat. One default fare covers all seats; click seats to give them a different rate
 * (window seats, upper deck, front row...). Seats without their own rate cost the default fare.
 */
const SeatRates: React.FC<{ layout: any; blocked: string[]; defaultFare: number; rates: Record<string, string>; setRates: (r: Record<string, string>) => void; seatMode: string }> = ({ layout, blocked, defaultFare, rates, setRates, seatMode }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [value, setValue] = useState("");
  if (seatMode !== "choose") return <p className="text-[11px] text-gray-500">Every seat costs the default fare. Different seat rates apply only when travellers choose their own seats.</p>;
  if (!layout?.seats?.length) return <p className="text-[11px] text-gray-500">Choose a vehicle to set the rate of individual seats.</p>;
  const seats: any[] = layout.seats;
  const decks = (["lower", "upper"] as const).map((id) => ({ id, seats: seats.filter((s) => (s.deck === "upper" ? "upper" : "lower") === id) })).filter((d) => d.seats.length);
  const rateOf = (seatNo: string) => (Number(rates[seatNo]) > 0 ? Number(rates[seatNo]) : defaultFare);
  const custom = Object.entries(rates).filter(([seat, v]) => Number(v) > 0 && Number(v) !== defaultFare && seats.some((s) => String(s.seatNo).toUpperCase() === seat));
  const toggle = (seatNo: string) => setPicked((p) => (p.includes(seatNo) ? p.filter((x) => x !== seatNo) : [...p, seatNo]));
  const apply = () => {
    const n = Number(value);
    if (!(n >= 1)) return;
    const next = { ...rates };
    for (const seat of picked) next[seat] = String(n);
    setRates(next);
    setPicked([]);
    setValue("");
  };
  const reset = (list: string[]) => {
    const next = { ...rates };
    for (const seat of list) delete next[seat];
    setRates(next);
    setPicked([]);
  };
  const edit = (seat: string) => {
    setPicked([seat]);
    setValue(String(rateOf(seat)));
  };
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-800 p-3 space-y-3">
      <div>
        <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">Seat rates</p>
        <p className="text-[11px] text-gray-500">Every seat costs the default fare ({rupees(defaultFare)}). Tap one or more seats to give them a different rate.</p>
      </div>
      <div className={`grid gap-3 ${decks.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {decks.map((deck) => (
          <div key={deck.id} className="rounded-xl bg-gray-50/70 dark:bg-slate-900/40 p-2.5 min-w-0">
            {decks.length > 1 && <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">{deck.id === "upper" ? "Upper deck" : "Lower deck"}</p>}
            <div className="grid gap-1.5 mx-auto" style={{ gridTemplateColumns: `repeat(${Math.max(1, layout.columns ?? 5)}, minmax(0, 2.9rem))`, justifyContent: "center" }}>
              {deck.seats.map((seat) => {
                const no = String(seat.seatNo).toUpperCase();
                const off = blocked.includes(no);
                const own = Number(rates[no]) > 0 && Number(rates[no]) !== defaultFare;
                const on = picked.includes(no);
                return (
                  <button key={no} type="button" disabled={off} aria-pressed={on} aria-label={`Seat ${no}, rate ${rupees(rateOf(no))}${own ? " (custom)" : ""}`} onClick={() => toggle(no)} style={{ gridRow: seat.row + 1, gridColumn: seat.col + 1 }} className={`flex flex-col items-center justify-center rounded-lg border text-[10px] font-black ${seat.kind === "sleeper" ? "h-14" : "h-11"} disabled:opacity-40 disabled:cursor-not-allowed ${on ? "bg-[#F28C28] border-[#F28C28] text-white" : own ? "bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"}`}>
                    {no}
                    <span className="text-[8px] font-bold leading-none mt-0.5 opacity-80">{off ? "off" : rupees(rateOf(no))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-orange-50/70 dark:bg-slate-900 p-3">
          <p className="text-[11px] font-bold w-full">{picked.length === 1 ? `Seat ${picked[0]}` : `${picked.length} seats: ${picked.join(", ")}`}</p>
          <label className="text-[11px] font-bold text-gray-600">New rate (₹)<input type="number" min={1} step="0.01" className={`${inputClass} w-32 mt-1`} value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <EnterpriseButton type="button" size="sm" onClick={apply} disabled={!(Number(value) >= 1)}>Set rate</EnterpriseButton>
          <EnterpriseButton type="button" size="sm" variant="ghost" onClick={() => reset(picked)}>Back to default</EnterpriseButton>
          <EnterpriseButton type="button" size="sm" variant="ghost" onClick={() => setPicked([])}>Clear selection</EnterpriseButton>
        </div>
      )}
      {custom.length > 0 && (
        <div>
          <p className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 mb-1">Seats with their own rate ({custom.length})</p>
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {custom.map(([seat, v]) => (
              <li key={seat} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="font-black w-12">Seat {seat}</span>
                <span className="tabular-nums">{rupees(Number(v))}</span>
                <span className="ml-auto flex gap-1">
                  <EnterpriseButton type="button" size="sm" variant="ghost" onClick={() => edit(seat)}>Edit rate</EnterpriseButton>
                  <EnterpriseButton type="button" size="sm" variant="ghost" onClick={() => reset([seat])}>Reset</EnterpriseButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const OperatorDepartureDetailPage: React.FC = () => <OperatorShell>{(me) => <DepartureDetail me={me} />}</OperatorShell>;

const DepartureDetail: React.FC<{ me: any }> = ({ me }) => {
  const { departureId = "" } = useParams();
  const [tab, setTab] = useState("seats");
  const detail = useRemote<any>(() => yatraOperator.departure(departureId), [departureId]);
  const seats = useRemote<any>(() => yatraOperator.seats(departureId), [departureId]);
  const manifest = useRemote<any>(() => yatraOperator.manifest(departureId), [departureId]);
  const [editing, setEditing] = useState(false);
  const { busy, run } = useAction();

  if (detail.state !== "ready" || !detail.data) return <PanelState state={detail.state} error={detail.error} onRetry={detail.reload} />;
  const { departure: d, tour, vehicle, sellable, unsellableReason } = detail.data;
  const manage = can(me, "manageDepartures");
  const refresh = () => {
    detail.reload();
    seats.reload();
    manifest.reload();
  };
  const download = async () => {
    const res = await yatraOperator.manifestCsv(d.id);
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${d.departureCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title={`${tour?.title ?? "Departure"} · ${dateLong(d.departAt)}`}
        subtitle={`${d.departureCode} · departs ${timeOnly(d.departAt)} · ${vehicle?.registrationNumber ?? ""}`}
        icon={<CalendarDays size={20} />}
        actions={<StatusPill status={d.status} />}
      />
      {!sellable && d.status !== "cancelled" && <p className="text-xs rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">{d.status === "draft" ? "Draft — not visible to pilgrims yet. " : ""}{unsellableReason}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Seats sold" value={`${d.bookedSeats} / ${d.capacity}`} />
        <Stat label="Fare" value={rupees(d.fare)} />
        <Stat label="Travellers checked in" value={manifest.data ? `${manifest.data.checkedIn} / ${manifest.data.passengers.length}` : "—"} />
        <Stat label="Seat mode" value={d.seatMode === "choose" ? "Chosen" : "Automatic"} />
      </div>
      {manage && (
        <div className="flex flex-wrap gap-2">
          {d.status === "draft" && <EnterpriseButton disabled={busy === "open"} icon={<Send size={13} />} onClick={() => run("open", () => yatraOperator.openDeparture(d.id), refresh, "Open for booking.")}>Open for booking</EnterpriseButton>}
          {d.status === "scheduled" && <EnterpriseButton variant="outline" disabled={busy === "close"} onClick={() => run("close", () => yatraOperator.closeSales(d.id), refresh, "Sales stopped.")}>Stop sales</EnterpriseButton>}
          {d.status === "sales_closed" && <EnterpriseButton variant="outline" disabled={busy === "reopen"} onClick={() => run("reopen", () => yatraOperator.reopenSales(d.id), refresh, "Sales reopened.")}>Reopen sales</EnterpriseButton>}
          {!["cancelled", "completed"].includes(d.status) && <EnterpriseButton variant="ghost" onClick={() => setEditing(true)}>Edit</EnterpriseButton>}
          {can(me, "createBookings") && d.status === "scheduled" && <Link to={`/operator/bookings/new?departure=${d.id}`} className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><Ticket size={13} /> Book for a customer</Link>}
        </div>
      )}
      <Chips value={tab} onChange={setTab} options={[{ value: "seats", label: "Seat inventory" }, { value: "manifest", label: "Manifest" }, { value: "boarding", label: "Boarding check-in" }, { value: "details", label: "Details" }]} />
      {tab === "seats" && (
        <Panel title="Seat inventory" actions={<EnterpriseButton size="sm" variant="ghost" onClick={seats.reload}>Refresh</EnterpriseButton>}>
          {seats.state !== "ready" ? <PanelState state={seats.state} error={seats.error} onRetry={seats.reload} /> : <SeatMap mode="view" columns={seats.data.columns} seats={seats.data.seats} />}
          <p className="text-[10px] text-gray-400 mt-2">Seats are sold only through Tirvona. Held seats free up by themselves if their payment does not arrive.</p>
        </Panel>
      )}
      {tab === "manifest" && (
        <Panel title={`Manifest · ${manifest.data?.passengers.length ?? 0} travellers`} actions={<EnterpriseButton size="sm" variant="outline" icon={<Download size={12} />} onClick={download}>Download CSV</EnterpriseButton>}>
          {manifest.state !== "ready" ? <PanelState state={manifest.state} error={manifest.error} onRetry={manifest.reload} /> : !manifest.data.passengers.length ? <Empty title="No confirmed travellers yet" /> : (
            <ResponsiveTable
              rows={manifest.data.passengers}
              rowKey={(p: any) => `${p.bookingId}-${p.seatNo}`}
              columns={[
                { header: "Seat", cell: (p: any) => <span className="font-black">{p.seatNo}</span> },
                { header: "Traveller", cell: (p: any) => <span>{p.name}{p.age ? `, ${p.age}` : ""}</span> },
                { header: "Booking", cell: (p: any) => <span className="text-gray-500">{p.bookingReference}</span> },
                { header: "Boarding", cell: (p: any) => p.boardingPointName },
                { header: "Phone", cell: (p: any) => p.contactPhone || "—", hideOnMobile: true },
                { header: "Boarded", cell: (p: any) => (p.checkedInAt ? <StatusPill status="completed" /> : <span className="text-gray-400">—</span>) },
              ]}
            />
          )}
        </Panel>
      )}
      {tab === "boarding" && <CheckIn departureId={d.id} onDone={manifest.reload} />}
      {tab === "details" && (
        <Panel title="Details">
          <InfoRow label="Departs">{dateTimeIst(d.departAt)}</InfoRow>
          <InfoRow label="Returns">{dateTimeIst(d.returnAt)}</InfoRow>
          <InfoRow label="Seats not for sale">{d.blockedSeats.join(", ") || "None"}</InfoRow>
          {d.boardingPoints.map((p: any) => <InfoRow key={p.id} label={p.name}>{[p.address, p.time ? timeOnly(p.time) : ""].filter(Boolean).join(" · ") || "—"}</InfoRow>)}
          {d.notes && <InfoRow label="Notes">{d.notes}</InfoRow>}
        </Panel>
      )}
      {editing && <DepartureForm departure={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
    </div>
  );
};

const CheckIn: React.FC<{ departureId: string; onDone: () => unknown }> = ({ departureId, onDone }) => {
  const [f, setF] = useState({ qr: "", bookingReference: "", ticketCode: "", seatNos: "" });
  const [last, setLast] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = f.qr.trim()
        ? { qr: f.qr.trim() }
        : { bookingReference: f.bookingReference.trim(), ticketCode: f.ticketCode.trim(), seatNos: f.seatNos.split(",").map((s) => s.trim()).filter(Boolean) };
      const res = await yatraOperator.checkIn(departureId, body);
      setLast(res.data.data);
      setF({ qr: "", bookingReference: "", ticketCode: "", seatNos: "" });
      toast.success("Checked in.");
      onDone();
    } catch {
      setLast(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={<span className="flex items-center gap-2"><ScanLine size={15} className="text-[#F28C28]" /> Boarding check-in</span>}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Scan the ticket QR" hint="A QR scanner types the code here; press Enter.">
          <input className={inputClass} value={f.qr} onChange={(e) => setF({ ...f, qr: e.target.value })} placeholder='{"t":"yatra",...}' autoFocus />
        </Field>
        <p className="text-[11px] text-gray-400 text-center">or enter it by hand</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Booking reference"><input className={inputClass} value={f.bookingReference} onChange={(e) => setF({ ...f, bookingReference: e.target.value.toUpperCase() })} placeholder="TVN-YTR-…" /></Field>
          <Field label="Ticket code"><input className={inputClass} value={f.ticketCode} onChange={(e) => setF({ ...f, ticketCode: e.target.value.toUpperCase() })} placeholder="ABC-123" /></Field>
          <Field label="Only these seats" hint="Empty = everyone on the ticket"><input className={inputClass} value={f.seatNos} onChange={(e) => setF({ ...f, seatNos: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end"><EnterpriseButton type="submit" disabled={busy || (!f.qr && !(f.bookingReference && f.ticketCode))}>{busy ? "Checking…" : "Check in"}</EnterpriseButton></div>
      </form>
      {last && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 p-3 text-xs">
          <p className="font-black text-emerald-800 dark:text-emerald-300">{last.bookingReference} boarded</p>
          <p className="text-emerald-700 dark:text-emerald-400">{last.passengers.filter((p: any) => p.checkedInAt).map((p: any) => `${p.name} (${p.seatNo})`).join(", ")}</p>
        </div>
      )}
    </Panel>
  );
};

// ================================================================== bookings
export const OperatorBookingsPage: React.FC = () => <OperatorShell>{(me) => <Bookings me={me} />}</OperatorShell>;

const Bookings: React.FC<{ me: any }> = ({ me }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useRemote<any[]>(() => yatraOperator.bookings({ status: status || undefined, source: source || undefined, q: q || undefined, page, limit: 20 }), [status, source, q, page]);
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Bookings" subtitle="Every booking on your departures: from Tirvona's website, from your links, and the ones your team made for customers." icon={<ClipboardList size={20} />} actions={can(me, "createBookings") && <EnterpriseButton icon={<Ticket size={13} />} onClick={() => navigate("/operator/bookings/new")}>Book for a customer</EnterpriseButton>} />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <Chips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All" }, { value: "confirmed", label: "Confirmed" }, { value: "held", label: "Seats held" }, { value: "payment_pending", label: "Awaiting payment" }, { value: "cancellation_requested", label: "Cancellation requested" }, { value: "cancelled", label: "Cancelled" }]} />
            <div className="flex gap-2">
              <select aria-label="Source" className={`${inputClass} md:!w-44`} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
                <option value="">All sources</option><option value="MARKETPLACE">Tirvona website</option><option value="OPERATOR_LINK">Your links</option><option value="ORGANIZER">Your team</option>
              </select>
              <input aria-label="Search booking reference" placeholder="Booking reference" className={`${inputClass} md:!w-48`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          {list.state !== "ready" ? <PanelState state={list.state} error={list.error} onRetry={list.reload} /> : !list.data?.length ? <Empty icon={<Ticket size={28} className="text-gray-300" />} title="No bookings" /> : (
            <>
              <ResponsiveTable
                rows={list.data}
                rowKey={(b) => b.id}
                onRowClick={(b) => navigate(`/operator/bookings/${b.id}`)}
                columns={[
                  { header: "Booking", cell: (b) => <div><p className="font-black">{b.bookingReference}</p><p className="text-[10px] text-gray-500">{b.contact.name}</p></div> },
                  { header: "Trip", cell: (b) => <div><p className="font-bold">{b.tourTitle}</p><p className="text-[10px] text-gray-500">{dateTimeIst(b.departAt)}</p></div> },
                  { header: "Seats", cell: (b) => b.seats.join(", ") },
                  { header: "Amount", cell: (b) => rupees(b.pricing.totalAmount) },
                  { header: "Source", cell: (b) => <span className="text-[11px]">{statusLabel(b.source)}</span>, hideOnMobile: true },
                  { header: "Status", cell: (b) => <StatusPill status={b.status} /> },
                ]}
              />
              <Pager page={page} limit={20} total={list.meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

export const OperatorNewBookingPage: React.FC = () => <OperatorShell>{(me) => <NewBooking me={me} />}</OperatorShell>;

const NewBooking: React.FC<{ me: any }> = ({ me }) => {
  const [params] = useSearchParams();
  const departures = useRemote<any[]>(() => yatraOperator.departures({ upcoming: "true", status: "scheduled" }), []);
  const [departureId, setDepartureId] = useState(params.get("departure") ?? "");
  const seatMap = useRemote<any>(() => (departureId ? yatraOperator.seats(departureId) : Promise.resolve({ data: { data: null } })), [departureId]);
  const departure = useMemo(() => departures.data?.find((d) => d.id === departureId), [departures.data, departureId]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [travellers, setTravellers] = useState([{ name: "", age: "", gender: "", phone: "" }]);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [boarding, setBoarding] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = departure?.seatMode === "choose";
  const n = choose ? selected.length : count;

  useEffect(() => {
    setSelected([]);
    setBoarding(departure?.boardingPoints?.[0]?.id ?? "");
  }, [departureId, departure]);
  useEffect(() => {
    setTravellers((list) => Array.from({ length: Math.max(1, n) }, (_, i) => list[i] ?? { name: "", age: "", gender: "", phone: "" }));
  }, [n]);

  if (!can(me, "createBookings")) return <Empty title="Your role cannot make bookings" />;
  if (me.operator.status !== "approved") return <Empty title="Bookings open after Tirvona approves your organisation" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await yatraOperator.createBooking({
        departureId,
        seats: choose ? selected : undefined,
        passengers: travellers.map((t) => ({ name: t.name.trim(), age: t.age ? Number(t.age) : undefined, gender: t.gender || undefined, phone: t.phone || undefined })),
        contact: { name: contact.name.trim() || travellers[0].name.trim(), phone: contact.phone.trim(), email: contact.email.trim() || undefined },
        boardingPointId: boarding,
      });
      setResult(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Those seats could not be held."));
      seatMap.reload();
      setSelected([]);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const b = result.booking;
    const message = `Namaste ${b.contact.name}, your ${b.tourTitle} seats (${b.seats.join(", ")}) are held. Pay ${rupees(b.pricing.totalAmount)} securely to Tirvona here: ${result.paymentLink}`;
    return (
      <div className="max-w-2xl space-y-5">
        <EnterprisePageHeader title="Seats held for your customer" subtitle="Send this payment link. The booking is confirmed only when the customer pays Tirvona." icon={<Ticket size={20} />} />
        <Panel>
          <InfoRow label="Booking">{b.bookingReference}</InfoRow>
          <InfoRow label="Seats">{b.seats.join(", ")}</InfoRow>
          <InfoRow label="Amount">{rupees(b.pricing.totalAmount)}</InfoRow>
          <InfoRow label="Link valid until">{dateTimeIst(result.paymentLinkExpiresAt)}</InfoRow>
          <div className="mt-3 rounded-xl bg-gray-50 dark:bg-slate-900 p-3 text-[11px] break-all">{result.paymentLink}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <EnterpriseButton size="sm" icon={<Copy size={12} />} onClick={() => copy(result.paymentLink)}>Copy link</EnterpriseButton>
            <a href={whatsapp(message)} target="_blank" rel="noreferrer" className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><Share2 size={12} /> Send on WhatsApp</a>
            <Link to={`/operator/bookings/${b.id}`} className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700">Open booking</Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <EnterprisePageHeader title="Book for a customer" subtitle="Seats come from the same central inventory as the website. Your customer pays Tirvona through a link; you never collect money." icon={<Ticket size={20} />} />
      <Panel title="1. Departure">
        {departures.state !== "ready" ? <PanelState state={departures.state} /> : (
          <select className={inputClass} value={departureId} onChange={(e) => setDepartureId(e.target.value)} required aria-label="Departure">
            <option value="">Choose an open departure</option>
            {(departures.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.tourTitle} · {dateTimeIst(d.departAt)} · {d.capacity - d.bookedSeats} left</option>)}
          </select>
        )}
      </Panel>
      {departure && (
        <>
          <Panel title="2. Seats">
            {choose ? (
              seatMap.state === "ready" && seatMap.data ? (
                <SeatMap
                  columns={seatMap.data.columns}
                  seats={seatMap.data.seats.map((s: any) => ({ ...s, status: s.status === "available" ? "available" : s.status === "blocked" ? "blocked" : "unavailable" }))}
                  selected={selected}
                  onToggle={(s) => setSelected((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}
                />
              ) : <PanelState state={seatMap.state} />
            ) : (
              <Field label="Number of seats"><input type="number" min={1} max={40} className={inputClass} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} /></Field>
            )}
          </Panel>
          <Panel title="3. Travellers and contact">
            <div className="space-y-3">
              {travellers.map((t, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_110px_150px] gap-2">
                  <input aria-label={`Traveller ${i + 1} name`} placeholder={`Traveller ${i + 1}${choose && selected[i] ? ` · seat ${selected[i]}` : ""}`} className={`${inputClass} col-span-2 sm:col-span-1`} value={t.name} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} required minLength={2} />
                  <input aria-label="Age" placeholder="Age" type="number" min={0} max={120} className={inputClass} value={t.age} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))} />
                  <select aria-label="Gender" className={inputClass} value={t.gender} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}><option value="">Gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select>
                  <input aria-label="Mobile" placeholder="Mobile (optional)" type="tel" className={`${inputClass} col-span-2 sm:col-span-1`} value={t.phone} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Customer name"><input className={inputClass} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></Field>
                <Field label="Customer mobile" required><input type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required /></Field>
                <Field label="Boarding point" required>
                  <select className={inputClass} value={boarding} onChange={(e) => setBoarding(e.target.value)} required>
                    {(departure.boardingPoints ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </Panel>
          {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm font-black">{rupees(departure.fare * Math.max(0, n))}</span>
            <EnterpriseButton type="submit" disabled={busy || n < 1} icon={<Link2 size={13} />}>{busy ? "Holding seats…" : "Hold seats and create payment link"}</EnterpriseButton>
          </div>
        </>
      )}
    </form>
  );
};

export const OperatorBookingDetailPage: React.FC = () => <OperatorShell>{(me) => <BookingDetail me={me} />}</OperatorShell>;

const BookingDetail: React.FC<{ me: any }> = ({ me }) => {
  const { bookingId = "" } = useParams();
  const remote = useRemote<any>(() => yatraOperator.booking(bookingId), [bookingId]);
  const [link, setLink] = useState<any>(null);
  const { busy, run } = useAction();
  if (remote.state !== "ready" || !remote.data) return <PanelState state={remote.state} error={remote.error} onRetry={remote.reload} />;
  const b = remote.data;
  const open = ["held", "payment_pending", "expired"].includes(b.status);
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title={b.bookingReference} subtitle={`${b.tourTitle} · ${dateTimeIst(b.departAt)}`} icon={<Ticket size={20} />} actions={<StatusPill status={b.status} />} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Booking">
          <InfoRow label="Source">{statusLabel(b.source)}{b.attribution?.campaign ? ` · ${b.attribution.campaign}` : ""}</InfoRow>
          <InfoRow label="Seats">{b.seats.join(", ")}</InfoRow>
          <InfoRow label="Boarding point">{b.boardingPointName}</InfoRow>
          <InfoRow label="Amount">{rupees(b.pricing.totalAmount)}</InfoRow>
          <InfoRow label="Payment">{statusLabel(b.paymentStatus)}</InfoRow>
          <InfoRow label="Customer">{b.contact.name} · {b.contact.phone}</InfoRow>
          {b.organizerMemberRole && <InfoRow label="Booked by your team">{b.organizerMemberRole}</InfoRow>}
          {b.cancellation && <InfoRow label="Cancellation">{statusLabel(b.cancellation.status)}{b.cancellation.refundAmount ? ` · ${rupees(b.cancellation.refundAmount)} refunded` : ""}</InfoRow>}
        </Panel>
        <Panel title="Travellers">
          {b.passengers.map((p: any) => <InfoRow key={p.seatNo} label={`Seat ${p.seatNo}`}>{p.name}{p.age ? `, ${p.age}` : ""}{p.checkedInAt ? " · boarded" : ""}</InfoRow>)}
        </Panel>
      </div>
      <div className="flex flex-wrap gap-2">
        {open && b.source === "ORGANIZER" && can(me, "createBookings") && (
          <EnterpriseButton icon={<Link2 size={13} />} disabled={busy === "link"} onClick={() => run("link", async () => setLink((await yatraOperator.reissueLink(b.id)).data.data), remote.reload, "New payment link ready.")}>New payment link</EnterpriseButton>
        )}
        {["held", "payment_pending"].includes(b.status) && can(me, "createBookings") && (
          <EnterpriseButton variant="ghost" disabled={busy === "release"} onClick={() => window.confirm("Release these seats?") && run("release", () => yatraOperator.releaseBooking(b.id), remote.reload, "Seats released.")}>Release seats</EnterpriseButton>
        )}
        {b.status === "confirmed" && can(me, "createBookings") && (
          <EnterpriseButton variant="outline" onClick={() => { const reason = askReason("Reason for the customer's cancellation?"); if (reason) run("cancel", () => yatraOperator.requestCancellation(b.id, reason), remote.reload, "Sent to Tirvona for approval."); }}>Request cancellation</EnterpriseButton>
        )}
      </div>
      {link && (
        <Panel title="Payment link">
          <div className="rounded-xl bg-gray-50 dark:bg-slate-900 p-3 text-[11px] break-all">{link.paymentLink}</div>
          <div className="flex gap-2 mt-2">
            <EnterpriseButton size="sm" icon={<Copy size={12} />} onClick={() => copy(link.paymentLink)}>Copy</EnterpriseButton>
            <a href={whatsapp(`Pay for your Tirvona Yatra booking ${b.bookingReference}: ${link.paymentLink}`)} target="_blank" rel="noreferrer" className="text-xs font-extrabold px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 inline-flex items-center gap-1.5"><Share2 size={12} /> WhatsApp</a>
          </div>
        </Panel>
      )}
      <Panel title="History">
        {b.history.slice().reverse().map((h: any, i: number) => <InfoRow key={i} label={dateTimeIst(h.at)}>{h.note || statusLabel(h.status)}</InfoRow>)}
      </Panel>
    </div>
  );
};

// ===================================================================== links
export const OperatorLinksPage: React.FC = () => <OperatorShell>{(me) => <Links me={me} />}</OperatorShell>;

const Links: React.FC<{ me: any }> = ({ me }) => {
  const links = useRemote<any[]>(() => yatraOperator.links(), []);
  const tours = useRemote<any[]>(() => yatraOperator.tours("published"), []);
  const departures = useRemote<any[]>(() => yatraOperator.departures({ upcoming: "true" }), []);
  const [f, setF] = useState({ tourId: "", departureId: "", campaign: "" });
  const [qr, setQr] = useState<any>(null);
  const { busy, run } = useAction();
  const manage = can(me, "manageLinks") && me.operator.status === "approved";
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Booking links and QR" subtitle="Share these with your customers. Bookings made through them are recorded as your direct bookings." icon={<QrCode size={20} />} />
      {manage && (
        <Panel title="Create a link">
          <form onSubmit={(e) => { e.preventDefault(); run("create", async () => setQr((await yatraOperator.createLink({ tourId: f.tourId, departureId: f.departureId || undefined, campaign: f.campaign || undefined })).data.data), links.reload, "Link created."); }} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Field label="Tour" required><select className={inputClass} value={f.tourId} onChange={(e) => setF({ ...f, tourId: e.target.value, departureId: "" })} required><option value="">Choose</option>{(tours.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
            <Field label="Departure (optional)"><select className={inputClass} value={f.departureId} onChange={(e) => setF({ ...f, departureId: e.target.value })}><option value="">Any upcoming</option>{(departures.data ?? []).filter((d) => d.tourId === f.tourId).map((d) => <option key={d.id} value={d.id}>{dateTimeIst(d.departAt)}</option>)}</select></Field>
            <Field label="Label (optional)"><input className={inputClass} value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} placeholder="e.g. Temple poster" /></Field>
            <EnterpriseButton type="submit" icon={<Plus size={13} />} disabled={busy === "create"}>Create</EnterpriseButton>
          </form>
        </Panel>
      )}
      <Panel title="Your links">
        {links.state !== "ready" ? <PanelState state={links.state} error={links.error} onRetry={links.reload} /> : !links.data?.length ? <Empty title="No links yet" /> : (
          <ResponsiveTable
            rows={links.data}
            rowKey={(l) => l.id}
            columns={[
              { header: "Link", cell: (l) => <div><p className="font-bold break-all">{l.url}</p><p className="text-[10px] text-gray-500">{l.campaign || "No label"}</p></div> },
              { header: "Bookings", cell: (l) => <span className="tabular-nums">{l.bookingsCount}</span> },
              { header: "Status", cell: (l) => <StatusPill status={l.active ? "active" : "draft"} /> },
              {
                header: "Actions",
                cell: (l) => (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <EnterpriseButton size="sm" variant="ghost" icon={<Copy size={12} />} onClick={() => copy(l.url)}>Copy</EnterpriseButton>
                    <EnterpriseButton size="sm" variant="ghost" icon={<QrCode size={12} />} onClick={async () => setQr((await yatraOperator.linkQr(l.id)).data.data)}>QR</EnterpriseButton>
                    {can(me, "manageLinks") && <EnterpriseButton size="sm" variant="ghost" disabled={busy === l.id} onClick={() => run(l.id, () => yatraOperator.setLinkActive(l.id, !l.active), links.reload)}>{l.active ? "Turn off" : "Turn on"}</EnterpriseButton>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {qr && (
        <EnterpriseModal isOpen onClose={() => setQr(null)} title="Booking QR">
          <div className="text-center space-y-2">
            <img src={qr.qr} alt={`QR code for ${qr.url}`} className="w-56 h-56 mx-auto" />
            <p className="text-[11px] break-all text-gray-500">{qr.url}</p>
            <a href={qr.qr} download={`tirvona-yatra-${qr.code}.png`} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#F28C28]"><Download size={12} /> Download QR</a>
          </div>
        </EnterpriseModal>
      )}
    </div>
  );
};

// ===================================================== earnings and reports
export const OperatorEarningsPage: React.FC = () => (
  <OperatorShell>
    {(me) =>
      can(me, "viewFinance") ? (
        <PayeeMoney
          kind="operator"
          fetchEarnings={(p) => yatraOperator.earnings(p)}
          fetchPayouts={() => yatraOperator.payouts()}
          requestPayout={(amount, note) => yatraOperatorPayouts.request(amount, note)}
          cancelPayout={(id) => yatraOperatorPayouts.cancel(id)}
          proof={(id) => yatraOperatorPayouts.proof(id)}
          canRequest={can(me, "managePayoutDetails")}
        />
      ) : (
        <Empty title="Your role cannot see earnings" />
      )
    }
  </OperatorShell>
);

export const OperatorReportsPage: React.FC = () => <OperatorShell>{(me) => (can(me, "viewFinance") ? <Reports /> : <Empty title="Your role cannot see reports" />)}</OperatorShell>;

const Reports: React.FC = () => {
  const r = useRemote<any>(() => yatraOperator.reports(), []);
  if (r.state !== "ready" || !r.data) return <PanelState state={r.state} error={r.error} onRetry={r.reload} />;
  const counts = (obj: Record<string, number>) => Object.entries(obj ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Reports" subtitle="The last 90 days of bookings and your recent departures." icon={<BarChart3 size={20} />} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Bookings by status">{counts(r.data.bookingsByStatus).map(([k, v]) => <InfoRow key={k} label={statusLabel(k)}>{v}</InfoRow>)}{!counts(r.data.bookingsByStatus).length && <p className="text-xs text-gray-500">No bookings yet.</p>}</Panel>
        <Panel title="Bookings by source">{counts(r.data.bookingsBySource).map(([k, v]) => <InfoRow key={k} label={statusLabel(k)}>{v}</InfoRow>)}{!counts(r.data.bookingsBySource).length && <p className="text-xs text-gray-500">No bookings yet.</p>}</Panel>
      </div>
      <Panel title="Seat fill">
        {!r.data.seatFill.length ? <p className="text-xs text-gray-500">No recent departures.</p> : (
          <ul className="space-y-2">
            {r.data.seatFill.map((d: any) => (
              <li key={d.departureId} className="text-xs">
                <div className="flex justify-between"><span className="font-bold">{dateTimeIst(d.departAt)} · {d.departureCode}</span><span className="tabular-nums">{d.bookedSeats}/{d.capacity} · {d.fillPercent}%</span></div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 mt-1" role="progressbar" aria-valuenow={d.fillPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`Seat fill ${d.departureCode}`}>
                  <div className="h-2 rounded-full bg-[#F28C28]" style={{ width: `${Math.min(100, d.fillPercent)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Sales by month">{r.data.revenueByMonth.length ? r.data.revenueByMonth.map((m: any) => <InfoRow key={m.month} label={m.month}>{rupees(m.amount)}</InfoRow>) : <p className="text-xs text-gray-500">No sales yet.</p>}</Panel>
    </div>
  );
};

// ============================================================= notifications
export const OperatorNotificationsPage: React.FC = () => <OperatorShell>{() => <Notifications />}</OperatorShell>;

const Notifications: React.FC = () => {
  const inbox = useRemote<any[]>(() => api.get("/notifications", { params: { page: 1, limit: 50 } }), []);
  const rows = (inbox.data ?? []).filter((n: any) => String(n.kind ?? "").startsWith("yatra"));
  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Notifications" subtitle="Yatra updates for your organisation: reviews, bookings and cancellations." icon={<Bell size={20} />} />
      <Panel>
        {inbox.state !== "ready" ? <PanelState state={inbox.state} error={inbox.error} onRetry={inbox.reload} /> : !rows.length ? <Empty title="No Yatra notifications" /> : (
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {rows.map((n: any) => (
              <li key={n._id ?? n.id} className="py-3">
                <p className="text-xs font-black">{n.title}</p>
                <p className="text-xs text-gray-500">{n.body}</p>
                <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5"><span>{dateTimeIst(n.createdAt)}</span>{n.deepLink && <Link to={n.deepLink} className="text-[#F28C28] font-bold">Open</Link>}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};
