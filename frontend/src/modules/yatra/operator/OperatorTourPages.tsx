import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Compass, Plus, Route, Save, Send, Trash2, Upload } from "lucide-react";
import { uploadService } from "../../../services";
import { toast } from "../../../lib/toast";
import { getErrorMessage } from "../../../lib/api";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Chips, Empty, Field, inputClass, Panel, PanelState, ResponsiveTable, useAction, useRemote } from "../../marketplace/ui";
import { yatraOperator } from "../services/yatra.service";
import { rupees, StatusPill } from "../yatraUi";
import { can, OperatorShell } from "./operatorShell";

const EDITABLE = ["draft", "rejected", "unpublished"];

export const OperatorToursPage: React.FC = () => <OperatorShell>{(me) => <Tours me={me} />}</OperatorShell>;

const Tours: React.FC<{ me: any }> = ({ me }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const tours = useRemote<any[]>(() => yatraOperator.tours(status || undefined), [status]);
  const { busy, run } = useAction();
  const manage = can(me, "manageTours");
  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Tours"
        subtitle="Draft a tour, submit it, and Tirvona reviews and publishes it. Only published tours can take bookings."
        icon={<Route size={20} />}
        actions={manage && <EnterpriseButton icon={<Plus size={13} />} onClick={() => navigate("/operator/tours/new")}>New tour</EnterpriseButton>}
      />
      <Panel>
        <div className="space-y-3">
          <Chips value={status} onChange={setStatus} options={[{ value: "", label: "All" }, { value: "draft", label: "Drafts" }, { value: "pending_review", label: "In review" }, { value: "published", label: "Published" }, { value: "rejected", label: "Rejected" }]} />
          {tours.state !== "ready" ? <PanelState state={tours.state} error={tours.error} onRetry={tours.reload} /> : !tours.data?.length ? <Empty icon={<Route size={28} className="text-gray-300" />} title="No tours here" /> : (
            <ResponsiveTable
              rows={tours.data}
              rowKey={(t) => t.id}
              onRowClick={(t) => navigate(`/operator/tours/${t.id}`)}
              columns={[
                { header: "Tour", cell: (t) => <div><p className="font-black">{t.title}</p><p className="text-[10px] text-gray-500">{t.originCity} → {t.destinationCity} · {t.durationDays} day{t.durationDays === 1 ? "" : "s"}</p></div> },
                { header: "From", cell: (t) => rupees(t.baseFare) },
                { header: "Status", cell: (t) => <div><StatusPill status={t.status} />{t.reviewNote && <p className="text-[10px] text-gray-500 mt-0.5 max-w-[220px]">{t.reviewNote}</p>}</div> },
                {
                  header: "Actions",
                  cell: (t) => (
                    <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      {manage && EDITABLE.includes(t.status) && <EnterpriseButton size="sm" disabled={busy === t.id} icon={<Send size={12} />} onClick={() => run(t.id, () => yatraOperator.submitTour(t.id), tours.reload, "Sent to Tirvona for review.")}>Submit</EnterpriseButton>}
                      <EnterpriseButton size="sm" variant="ghost" onClick={() => navigate(`/operator/departures?tour=${t.id}`)}>Departures</EnterpriseButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Panel>
    </div>
  );
};

// =================================================================== editor
type Stop = { name: string; dayNumber: number; city: string };
type Day = { dayNumber: number; title: string; description: string };
type Window = { hoursBefore: number; refundPercent: number };

const lines = (value: string) => value.split("\n").map((s) => s.trim()).filter(Boolean);

export const OperatorTourEditorPage: React.FC = () => <OperatorShell>{(me) => <TourEditor me={me} />}</OperatorShell>;

const TourEditor: React.FC<{ me: any }> = ({ me }) => {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const isNew = !tourId;
  const existing = useRemote<any>(() => (tourId ? yatraOperator.tour(tourId) : Promise.resolve({ data: { data: null } })), [tourId]);
  const templates = useRemote<any[]>(() => yatraOperator.circuitTemplates(), []);
  const [f, setF] = useState<Record<string, any>>({ title: "", summary: "", description: "", productType: "group_tour", originCity: "", originState: "", destinationCity: "", destinationState: "", durationDays: 1, durationNights: 0, baseFare: "", coverImage: "", circuitTemplateId: "" });
  const [stops, setStops] = useState<Stop[]>([]);
  const [days, setDays] = useState<Day[]>([{ dayNumber: 1, title: "", description: "" }]);
  const [text, setText] = useState({ highlights: "", inclusions: "", exclusions: "" });
  const [images, setImages] = useState<string[]>([]);
  const [policy, setPolicy] = useState<{ windows: Window[]; defaultRefundPercent: number }>({ windows: [{ hoursBefore: 72, refundPercent: 90 }, { hoursBefore: 24, refundPercent: 50 }], defaultRefundPercent: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { run, busy: acting } = useAction();

  const load = (t: any) => {
    setF({ title: t.title ?? "", summary: t.summary ?? "", description: t.description ?? "", productType: t.productType ?? "group_tour", originCity: t.originCity ?? "", originState: t.originState ?? "", destinationCity: t.destinationCity ?? "", destinationState: t.destinationState ?? "", durationDays: t.durationDays ?? 1, durationNights: t.durationNights ?? 0, baseFare: t.baseFare ?? "", coverImage: t.coverImage ?? "", circuitTemplateId: t.circuitTemplateId ?? "" });
    setStops((t.stops ?? []).map((s: any) => ({ name: s.name, dayNumber: s.dayNumber, city: s.city ?? "" })));
    setDays(t.itinerary?.length ? t.itinerary.map((d: any) => ({ dayNumber: d.dayNumber, title: d.title ?? "", description: d.description ?? "" })) : [{ dayNumber: 1, title: "", description: "" }]);
    setText({ highlights: (t.highlights ?? []).join("\n"), inclusions: (t.inclusions ?? []).join("\n"), exclusions: (t.exclusions ?? []).join("\n") });
    setImages(t.images ?? []);
    if (t.cancellationPolicy?.windows) setPolicy({ windows: t.cancellationPolicy.windows, defaultRefundPercent: t.cancellationPolicy.defaultRefundPercent ?? 0 });
  };
  useEffect(() => {
    if (existing.data) load(existing.data);
  }, [existing.data]);

  if (existing.state !== "ready") return <PanelState state={existing.state} error={existing.error} onRetry={existing.reload} />;
  const tour = existing.data;
  const editable = can(me, "manageTours") && (isNew || EDITABLE.includes(tour?.status));

  const applyTemplate = async (id: string) => {
    if (!id) return;
    try {
      const t = (await yatraOperator.circuitTemplate(id)).data.data;
      load({ ...t, baseFare: f.baseFare, productType: f.productType, cancellationPolicy: policy });
      setF((prev) => ({ ...prev, circuitTemplateId: t.circuitTemplateId }));
      toast.success(`Filled from "${t.circuitTemplateName}". Review and adjust.`);
    } catch {
      // shown by the API client
    }
  };
  const addImage = async (file?: File) => {
    if (!file) return;
    try {
      const url = await uploadService.file(file, "yatra-tours");
      setImages((list) => [...list, url].slice(0, 12));
      if (!f.coverImage) setF((prev) => ({ ...prev, coverImage: url }));
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed."));
    }
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setBusy(true);
    const body: Record<string, unknown> = {
      ...f,
      durationDays: Number(f.durationDays),
      durationNights: Number(f.durationNights) || 0,
      baseFare: Number(f.baseFare),
      circuitTemplateId: f.circuitTemplateId || undefined,
      coverImage: f.coverImage || undefined,
      stops: stops.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), dayNumber: Number(s.dayNumber) || 1, city: s.city.trim() || undefined })),
      itinerary: days.filter((d) => d.title.trim()).map((d) => ({ dayNumber: Number(d.dayNumber), title: d.title.trim(), description: d.description.trim() || undefined })),
      highlights: lines(text.highlights),
      inclusions: lines(text.inclusions),
      exclusions: lines(text.exclusions),
      images,
      cancellationPolicy: { windows: policy.windows.map((w) => ({ hoursBefore: Number(w.hoursBefore), refundPercent: Number(w.refundPercent) })), defaultRefundPercent: Number(policy.defaultRefundPercent) },
    };
    try {
      const res = isNew ? await yatraOperator.createTour(body) : await yatraOperator.updateTour(tourId!, body);
      toast.success("Tour draft saved.");
      if (isNew) navigate(`/operator/tours/${res.data.data.id}`, { replace: true });
      else existing.reload();
    } catch (err) {
      setError(getErrorMessage(err, "The tour could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={save} className="space-y-5">
      <EnterprisePageHeader
        title={isNew ? "New tour" : tour.title}
        subtitle={isNew ? "Start from a Pilgrimage Circuit or from scratch. Tirvona reviews every tour before it is published." : `Status: ${tour.status.replace(/_/g, " ")}`}
        icon={<Route size={20} />}
        actions={!isNew && <StatusPill status={tour.status} />}
      />
      {!isNew && tour.reviewNote && <p className="text-xs rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">Note from Tirvona: {tour.reviewNote}</p>}
      {!editable && <p className="text-xs rounded-2xl p-3 bg-gray-50 dark:bg-slate-900 text-gray-600">{tour?.status === "pending_review" ? "This tour is waiting for Tirvona's review." : "Published and approved tours cannot be edited. Ask Tirvona to unpublish it if it must change."}</p>}

      <fieldset disabled={!editable} className="space-y-5">
        {isNew && (
          <Panel title={<span className="flex items-center gap-2"><Compass size={15} className="text-[#F28C28]" /> Start from a Pilgrimage Circuit (optional)</span>}>
            <select className={inputClass} defaultValue="" onChange={(e) => applyTemplate(e.target.value)} aria-label="Pilgrimage circuit template">
              <option value="">Start from scratch</option>
              {(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.durationDays} day{t.durationDays === 1 ? "" : "s"}{t.startCity ? ` · from ${t.startCity}` : ""}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1.5">Stops and days are copied into your tour; the circuit itself does not change.</p>
          </Panel>
        )}

        <Panel title="Basics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Tour name" required className="sm:col-span-2"><input className={inputClass} value={f.title} onChange={set("title")} required minLength={3} /></Field>
            <Field label="How it is sold" hint="Seat-by-seat sale only if your permit allows it">
              <select className={inputClass} value={f.productType} onChange={set("productType")}><option value="group_tour">Group tour package</option><option value="seat_journey">Seat-by-seat journey</option></select>
            </Field>
            <Field label="Fare per seat (₹)" required><input type="number" min={1} step="0.01" className={inputClass} value={f.baseFare} onChange={set("baseFare")} required /></Field>
            <Field label="From city" required><input className={inputClass} value={f.originCity} onChange={set("originCity")} required minLength={2} /></Field>
            <Field label="From state"><input className={inputClass} value={f.originState} onChange={set("originState")} /></Field>
            <Field label="To city" required><input className={inputClass} value={f.destinationCity} onChange={set("destinationCity")} required minLength={2} /></Field>
            <Field label="To state"><input className={inputClass} value={f.destinationState} onChange={set("destinationState")} /></Field>
            <Field label="Days" required><input type="number" min={1} max={30} className={inputClass} value={f.durationDays} onChange={set("durationDays")} required /></Field>
            <Field label="Nights"><input type="number" min={0} max={30} className={inputClass} value={f.durationNights} onChange={set("durationNights")} /></Field>
            <Field label="Short summary" className="sm:col-span-2"><input className={inputClass} value={f.summary} onChange={set("summary")} maxLength={300} /></Field>
            <Field label="Full description" className="sm:col-span-2 lg:col-span-4"><textarea rows={4} className={inputClass} value={f.description} onChange={set("description")} maxLength={6000} /></Field>
          </div>
        </Panel>

        <Panel title="Day-by-day itinerary" actions={editable && <EnterpriseButton type="button" size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setDays([...days, { dayNumber: days.length + 1, title: "", description: "" }])}>Add day</EnterpriseButton>}>
          <div className="space-y-3">
            {days.map((d, i) => (
              <div key={i} className="grid grid-cols-[70px_1fr_auto] gap-2 items-start">
                <input aria-label="Day number" type="number" min={1} max={30} className={inputClass} value={d.dayNumber} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, dayNumber: Number(e.target.value) } : x)))} />
                <div className="space-y-2">
                  <input aria-label={`Day ${d.dayNumber} title`} placeholder="Title, e.g. Mathura darshan" className={inputClass} value={d.title} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <textarea aria-label={`Day ${d.dayNumber} plan`} rows={2} placeholder="What happens this day" className={inputClass} value={d.description} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                </div>
                <button type="button" aria-label="Remove day" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setDays(days.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Route stops" actions={editable && <EnterpriseButton type="button" size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setStops([...stops, { name: "", dayNumber: 1, city: "" }])}>Add stop</EnterpriseButton>}>
          {!stops.length ? <p className="text-xs text-gray-500">No stops added.</p> : (
            <div className="space-y-2">
              {stops.map((s, i) => (
                <div key={i} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2">
                  <input aria-label="Day" type="number" min={1} max={30} className={inputClass} value={s.dayNumber} onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, dayNumber: Number(e.target.value) } : x)))} />
                  <input aria-label="Stop name" placeholder="Temple or place" className={inputClass} value={s.name} onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input aria-label="City" placeholder="City" className={inputClass} value={s.city} onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                  <button type="button" aria-label="Remove stop" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setStops(stops.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="What travellers get">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Included (one per line)" required><textarea rows={5} className={inputClass} value={text.inclusions} onChange={(e) => setText({ ...text, inclusions: e.target.value })} placeholder={"AC bus\nGuide\nBreakfast"} /></Field>
            <Field label="Not included (one per line)"><textarea rows={5} className={inputClass} value={text.exclusions} onChange={(e) => setText({ ...text, exclusions: e.target.value })} placeholder={"Lunch and dinner\nTemple donations"} /></Field>
            <Field label="Highlights (one per line)"><textarea rows={5} className={inputClass} value={text.highlights} onChange={(e) => setText({ ...text, highlights: e.target.value })} /></Field>
          </div>
        </Panel>

        <Panel title="Photos">
          <div className="flex flex-wrap gap-3">
            {images.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className={`h-20 w-28 rounded-xl object-cover ${f.coverImage === url ? "ring-2 ring-[#F28C28]" : ""}`} />
                <div className="absolute inset-x-1 bottom-1 flex gap-1">
                  <button type="button" className="text-[9px] font-black bg-white/90 rounded px-1" onClick={() => setF({ ...f, coverImage: url })}>Cover</button>
                  <button type="button" className="text-[9px] font-black bg-white/90 rounded px-1" onClick={() => { setImages(images.filter((x) => x !== url)); if (f.coverImage === url) setF({ ...f, coverImage: "" }); }}>Remove</button>
                </div>
              </div>
            ))}
            {editable && images.length < 12 && (
              <label className="h-20 w-28 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-[10px] font-bold text-gray-500 cursor-pointer hover:border-[#F28C28]">
                <Upload size={16} /> Add photo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => addImage(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </Panel>

        <Panel title="Cancellation policy" actions={editable && policy.windows.length < 6 && <EnterpriseButton type="button" size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setPolicy({ ...policy, windows: [...policy.windows, { hoursBefore: 0, refundPercent: 0 }] })}>Add window</EnterpriseButton>}>
          <div className="space-y-2">
            {policy.windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                Cancel at least
                <input aria-label="Hours before departure" type="number" min={0} max={2160} className={`${inputClass} !w-24`} value={w.hoursBefore} onChange={(e) => setPolicy({ ...policy, windows: policy.windows.map((x, j) => (j === i ? { ...x, hoursBefore: Number(e.target.value) } : x)) })} />
                hours before departure:
                <input aria-label="Refund percent" type="number" min={0} max={100} className={`${inputClass} !w-20`} value={w.refundPercent} onChange={(e) => setPolicy({ ...policy, windows: policy.windows.map((x, j) => (j === i ? { ...x, refundPercent: Number(e.target.value) } : x)) })} />
                % refund
                <button type="button" aria-label="Remove window" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => setPolicy({ ...policy, windows: policy.windows.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              Any later:
              <input aria-label="Default refund percent" type="number" min={0} max={100} className={`${inputClass} !w-20`} value={policy.defaultRefundPercent} onChange={(e) => setPolicy({ ...policy, defaultRefundPercent: Number(e.target.value) })} />
              % refund
            </div>
            <p className="text-[10px] text-gray-400">This policy is copied into every booking. Refunds go to the customer's Tirvona wallet after Tirvona approves the cancellation.</p>
          </div>
        </Panel>
      </fieldset>

      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <Link to="/operator/tours" className="text-xs font-bold text-gray-500 hover:underline self-center">Back to tours</Link>
        {editable && (
          <div className="flex gap-2">
            <EnterpriseButton type="submit" variant="outline" icon={<Save size={13} />} disabled={busy}>{busy ? "Saving…" : "Save draft"}</EnterpriseButton>
            {!isNew && <EnterpriseButton type="button" icon={<Send size={13} />} disabled={busy || acting === "submit"} onClick={() => run("submit", () => yatraOperator.submitTour(tourId!), existing.reload, "Sent to Tirvona for review.")}>Submit for review</EnterpriseButton>}
          </div>
        )}
      </div>
    </form>
  );
};
