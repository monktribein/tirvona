import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  Link2,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Empty, Field, inputClass, Panel, PanelState, useRemote } from "../../marketplace/ui";
import { yatraCustomer, yatraPublic } from "../services/yatra.service";
import {
  dateLong,
  dateTimeIst,
  InfoRow,
  mmss,
  paymentError,
  rupees,
  runPayment,
  SeatMap,
  StatusPill,
  timeOnly,
  useCountdown,
  YatraGate,
} from "../yatraUi";

const LINK_KEY = "tirvona:yatra:link";
/** The organiser link a visitor arrived through, kept for 24 hours. */
const rememberedLink = (): string | undefined => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(LINK_KEY) ?? "null");
    return raw && Date.now() - raw.at < 86_400_000 ? raw.code : undefined;
  } catch {
    return undefined;
  }
};

const PageTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
    <h1 className="font-['Kalam'] text-2xl sm:text-4xl font-bold text-[#E58C28]">{title}</h1>
    <div className="flex items-center justify-center gap-2.5 my-1.5" aria-hidden="true">
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
      <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
    </div>
    {subtitle && <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
  </div>
);

const ErrorNote: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
    <AlertCircle size={15} className="shrink-0 mt-0.5" />
    <p className="text-xs font-semibold">{message}</p>
  </div>
);

// ===================================================================== search
export const YatraHomePage: React.FC = () => (
  <YatraGate>
    <YatraSearch />
  </YatraGate>
);

const YatraSearch: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({
    origin: params.get("origin") ?? "",
    destination: params.get("destination") ?? "",
    date: params.get("date") ?? "",
    seats: params.get("seats") ?? "1",
  });
  const filters = useRemote<{ origins: string[]; destinations: string[] }>(() => yatraPublic.filters(), []);
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const results = useRemote<any[]>(() => yatraPublic.search({ ...query, limit: 30 }), [JSON.stringify(query)]);
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(Object.fromEntries(Object.entries(form).filter(([, v]) => v)) as Record<string, string>);
  };

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <PageTitle title="Tirvona Yatra" subtitle="Bus and group pilgrimages run by verified organisers. Choose your seat, pay Tirvona securely and keep the whole journey in one place." />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <form onSubmit={submit} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" aria-label="Search Yatra departures">
          <Field label="From">
            <select className={inputClass} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
              <option value="">Any city</option>
              {(filters.data?.origins ?? []).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className={inputClass} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
              <option value="">Any destination</option>
              {(filters.data?.destinations ?? []).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Travel date">
            <input type="date" min={today} className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Travellers">
            <input type="number" min={1} max={20} className={inputClass} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
          </Field>
          <EnterpriseButton type="submit" icon={<Search size={14} />} className="w-full justify-center">
            Search
          </EnterpriseButton>
        </form>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-4" aria-live="polite">
        <h2 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
          {results.state === "ready" ? `${results.meta.total} departure${results.meta.total === 1 ? "" : "s"}` : "Finding departures…"}
        </h2>
        {results.state !== "ready" ? (
          <PanelState state={results.state} error={results.error} onRetry={results.reload} />
        ) : !results.data?.length ? (
          <Empty icon={<Bus size={28} className="text-gray-300" />} title="No departures match" text="Try another date or destination. New departures are added as organisers are verified." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.data.map((d) => <DepartureCard key={d.departureCode} d={d} />)}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Search size={18} />, title: "Find a departure", text: "Every departure is from an organiser verified by Tirvona, on a verified vehicle." },
          { icon: <Ticket size={18} />, title: "Pick seats and pay Tirvona", text: "Seats are held while you pay. Payment goes to Tirvona, never to a third party." },
          { icon: <Route size={18} />, title: "Manage your journey", text: "Ticket, boarding point, itinerary, meals and puja requests in My Journeys." },
        ].map((s) => (
          <div key={s.title} className="tv-stat">
            <div className="tv-stat-head">
              <span className="tv-stat-label">{s.title}</span>
              <span className="tv-stat-icon">{s.icon}</span>
            </div>
            <p className="tv-stat-hint !mt-2">{s.text}</p>
          </div>
        ))}
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
        <Link to="/yatra-partner" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#F28C28] hover:underline">
          Are you a pilgrimage tour organiser? Partner with Tirvona Yatra <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

const DepartureCard: React.FC<{ d: any }> = ({ d }) => (
  <Link
    to={`/yatra/departures/${d.departureCode}`}
    className="group bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col hover:border-[#F28C28]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50"
  >
    <div className="h-36 bg-orange-50 dark:bg-slate-900 relative">
      {d.tour.coverImage ? (
        <img src={d.tour.coverImage} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#F28C28]"><Bus size={36} /></div>
      )}
      <span className="absolute top-3 left-3 bg-white/95 dark:bg-[#0B192C]/95 rounded-full px-2.5 py-1 text-[10px] font-black text-[#0B192C] dark:text-white">
        {d.tour.durationDays} day{d.tour.durationDays === 1 ? "" : "s"}{d.vehicle?.isAc ? " · AC" : ""}
      </span>
    </div>
    <div className="p-4 flex-1 flex flex-col gap-2">
      <h3 className="font-black text-sm text-[#0B192C] dark:text-white group-hover:text-[#F28C28]">{d.tour.title}</h3>
      <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><MapPin size={12} /> {d.tour.originCity} → {d.tour.destinationCity}</p>
      <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><CalendarDays size={12} /> {dateLong(d.departAt)} · {timeOnly(d.departAt)}</p>
      <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><BadgeCheck size={12} className="text-emerald-500" /> {d.operator?.name}</p>
      <div className="mt-auto pt-2 flex items-end justify-between">
        <span className={`text-[11px] font-black ${d.seatsLeft <= 5 ? "text-amber-600" : "text-emerald-600"}`}>{d.seatsLeft} seat{d.seatsLeft === 1 ? "" : "s"} left</span>
        <span className="text-right">
          <span className="block text-[10px] text-gray-400 font-bold">per seat</span>
          <span className="text-base font-black text-[#0B192C] dark:text-white">{rupees(d.fare)}</span>
        </span>
      </div>
    </div>
  </Link>
);

// ============================================================= departure page
export const YatraDeparturePage: React.FC = () => (
  <YatraGate>
    <DepartureDetail />
  </YatraGate>
);

const blankPassenger = () => ({ name: "", age: "", gender: "" });

const DepartureDetail: React.FC = () => {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const detail = useRemote<any>(() => yatraPublic.departure(code), [code]);
  const seatMap = useRemote<any>(() => yatraPublic.seats(code), [code]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [boarding, setBoarding] = useState("");
  const [travellers, setTravellers] = useState([blankPassenger()]);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const d = detail.data;
  const choose = d?.departure.seatMode === "choose";
  const seatsWanted = choose ? selected.length : count;
  const max = d?.maxSeatsPerBooking ?? 10;

  useEffect(() => {
    if (user) setContact((c) => ({ name: c.name || user.name || "", phone: c.phone || user.phone || "", email: c.email || user.email || "" }));
  }, [user]);
  useEffect(() => {
    setTravellers((list) => {
      const n = Math.max(1, seatsWanted);
      return list.length === n ? list : Array.from({ length: n }, (_, i) => list[i] ?? blankPassenger());
    });
  }, [seatsWanted]);
  useEffect(() => {
    if (d?.departure.boardingPoints?.length && !boarding) setBoarding(d.departure.boardingPoints[0].id);
  }, [d, boarding]);

  if (detail.state !== "ready" || !d)
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <PanelState state={detail.state} error={detail.error} onRetry={detail.reload} missingText="This departure was not found or is no longer listed." />
      </div>
    );

  const toggle = (seatNo: string) =>
    setSelected((s) => (s.includes(seatNo) ? s.filter((x) => x !== seatNo) : s.length >= max ? s : [...s, seatNo]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (seatsWanted < 1) return setError("Choose at least one seat.");
    if (travellers.some((t) => t.name.trim().length < 2)) return setError("Enter every traveller's name.");
    if (!/^\+?[0-9][0-9 -]{7,15}$/.test(contact.phone)) return setError("Enter a valid contact phone number.");
    setBusy(true);
    try {
      const res = await yatraCustomer.createBooking({
        departureCode: code,
        seats: choose ? selected : undefined,
        passengers: travellers.map((t) => ({ name: t.name.trim(), age: t.age ? Number(t.age) : undefined, gender: t.gender || undefined })),
        contact: { name: contact.name.trim() || travellers[0].name.trim(), phone: contact.phone.trim(), email: contact.email.trim() || undefined },
        boardingPointId: boarding,
        linkCode: rememberedLink(),
      });
      navigate(`/yatra/checkout/${res.data.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Those seats could not be held. Please try again."));
      seatMap.reload();
      setSelected([]);
    } finally {
      setBusy(false);
    }
  };

  const tour = d.tour;
  const dep = d.departure;
  return (
    <div className="pb-16 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          <div className="rounded-[24px] overflow-hidden bg-orange-50 dark:bg-slate-900 h-48 sm:h-64">
            {tour.coverImage ? <img src={tour.coverImage} alt={tour.title} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[#F28C28]"><Bus size={48} /></div>}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">{tour.title}</h1>
            <p className="text-xs font-bold text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {tour.originCity} → {tour.destinationCity}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {dateTimeIst(dep.departAt)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {tour.durationDays} day{tour.durationDays === 1 ? "" : "s"}{tour.durationNights ? ` / ${tour.durationNights} night${tour.durationNights === 1 ? "" : "s"}` : ""}</span>
            </p>
            <p className="text-[11px] text-gray-500 inline-flex items-center gap-1"><BadgeCheck size={12} className="text-emerald-500" /> Organised by {d.operator?.name} · verified by Tirvona</p>
          </div>
          {tour.summary && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tour.summary}</p>}

          <Panel title="Day-by-day itinerary">
            <ol className="space-y-3">
              {tour.itinerary.map((day: any) => (
                <li key={day.dayNumber} className="flex gap-3">
                  <span className="w-8 h-8 rounded-full bg-orange-50 dark:bg-slate-800 text-[#F28C28] text-xs font-black flex items-center justify-center shrink-0">{day.dayNumber}</span>
                  <div>
                    <p className="text-xs font-black text-[#0B192C] dark:text-white">{day.title}</p>
                    {day.description && <p className="text-xs text-gray-500 leading-relaxed mt-0.5 whitespace-pre-line">{day.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          {tour.stops?.length > 0 && (
            <Panel title="Route and stops">
              <ul className="flex flex-wrap gap-2">
                {tour.stops.map((s: any) => (
                  <li key={`${s.order}-${s.name}`} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                    Day {s.dayNumber} · {s.name}{s.city ? `, ${s.city}` : ""}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Panel title="Included">
              <ul className="space-y-1.5">{tour.inclusions.map((x: string) => <li key={x} className="text-xs flex gap-2"><CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />{x}</li>)}</ul>
            </Panel>
            <Panel title="Not included">
              {tour.exclusions?.length ? <ul className="space-y-1.5">{tour.exclusions.map((x: string) => <li key={x} className="text-xs text-gray-500">• {x}</li>)}</ul> : <p className="text-xs text-gray-400">Nothing listed.</p>}
            </Panel>
          </div>

          <Panel title="Cancellation policy">
            <ul className="space-y-1.5 text-xs">
              {(tour.cancellationPolicy?.windows ?? []).map((w: any) => (
                <li key={w.hoursBefore}>Cancel {w.hoursBefore} hours or more before departure: <b>{w.refundPercent}% refund</b></li>
              ))}
              <li>Later than that: <b>{tour.cancellationPolicy?.defaultRefundPercent ?? 0}% refund</b></li>
            </ul>
            <p className="text-[11px] text-gray-400 mt-2">Cancellations are reviewed by Tirvona. Approved refunds go to your Tirvona wallet.</p>
          </Panel>
        </div>

        <form onSubmit={submit} className="lg:sticky lg:top-24 space-y-4" aria-label="Book seats">
          <Panel title={<span className="flex items-center gap-2"><Ticket size={15} className="text-[#F28C28]" /> Book seats · {rupees(dep.fare)} per seat</span>}>
            {!d.bookable ? (
              <ErrorNote message={d.unavailableReason ?? "Booking is closed for this departure."} />
            ) : (
              <div className="space-y-4">
                {choose ? (
                  seatMap.state === "ready" ? (
                    <SeatMap seats={seatMap.data.seats} columns={seatMap.data.columns} selected={selected} onToggle={toggle} max={max} />
                  ) : (
                    <PanelState state={seatMap.state} error={seatMap.error} onRetry={seatMap.reload} />
                  )
                ) : (
                  <Field label="Number of seats" hint={`Seats are assigned automatically. ${dep.seatsLeft} left.`}>
                    <input type="number" min={1} max={Math.min(max, dep.seatsLeft)} className={inputClass} value={count} onChange={(e) => setCount(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} />
                  </Field>
                )}
                {choose && <p className="text-[11px] text-gray-500">{selected.length ? `Seats ${selected.join(", ")}` : "Tap seats to choose them"} · up to {max}</p>}

                <Field label="Boarding point" required>
                  <select className={inputClass} value={boarding} onChange={(e) => setBoarding(e.target.value)} required>
                    {dep.boardingPoints.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}{p.time ? ` · ${timeOnly(p.time)}` : ""}</option>
                    ))}
                  </select>
                </Field>

                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300 mb-1">Travellers</legend>
                  {travellers.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_64px_96px] gap-2">
                      <input aria-label={`Traveller ${i + 1} name`} placeholder={`Traveller ${i + 1}${choose && selected[i] ? ` · seat ${selected[i]}` : ""}`} className={inputClass} value={t.name} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} required minLength={2} />
                      <input aria-label={`Traveller ${i + 1} age`} placeholder="Age" type="number" min={0} max={120} className={inputClass} value={t.age} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))} />
                      <select aria-label={`Traveller ${i + 1} gender`} className={inputClass} value={t.gender} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}>
                        <option value="">Gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  ))}
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Contact phone" required>
                    <input type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required />
                  </Field>
                  <Field label="Email (optional)">
                    <input type="email" className={inputClass} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </Field>
                </div>

                {error && <ErrorNote message={error} />}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-gray-500">Total</span>
                  <span className="text-lg font-black text-[#0B192C] dark:text-white">{rupees(dep.fare * Math.max(0, seatsWanted))}</span>
                </div>
                <EnterpriseButton type="submit" disabled={busy || seatsWanted < 1} icon={<ShieldCheck size={14} />} className="w-full justify-center">
                  {busy ? "Holding seats…" : user ? "Hold seats and continue to payment" : "Sign in to book"}
                </EnterpriseButton>
                <p className="text-[10px] text-gray-400 text-center">Seats are held for a few minutes while you pay Tirvona.</p>
              </div>
            )}
          </Panel>
          {dep.boardingPoints?.length > 0 && (
            <Panel title="Boarding points">
              {dep.boardingPoints.map((p: any) => (
                <InfoRow key={p.id} label={p.name}>{[p.landmark, p.address].filter(Boolean).join(", ") || "—"}{p.time ? ` · ${timeOnly(p.time)}` : ""}</InfoRow>
              ))}
            </Panel>
          )}
        </form>
      </div>
    </div>
  );
};

// ================================================================== checkout
export const YatraCheckoutPage: React.FC = () => (
  <YatraGate>
    <Checkout />
  </YatraGate>
);

const Checkout: React.FC = () => {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const remote = useRemote<any>(() => yatraCustomer.booking(bookingId), [bookingId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const b = remote.data?.booking;
  const left = useCountdown(b?.holdExpiresAt);

  if (remote.state !== "ready" || !b)
    return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} onRetry={remote.reload} /></div>;

  const open = ["held", "payment_pending"].includes(b.status);
  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const order = await yatraCustomer.paymentOrder(b.id);
      const res = await runPayment(order.data.data, { name: b.contact.name || user?.name, email: b.contact.email || user?.email, contact: b.contact.phone || user?.phone }, (proof) =>
        yatraCustomer.confirmPayment(b.id, proof),
      );
      toast.success("Your Yatra booking is confirmed.");
      const journeyId = res.data.data.journeyId;
      navigate(journeyId ? `/profile/journeys/${journeyId}` : "/profile/journeys", { replace: true });
    } catch (err) {
      setError(paymentError(err));
      remote.reload();
    } finally {
      setBusy(false);
    }
  };
  const release = async () => {
    setBusy(true);
    try {
      await yatraCustomer.release(b.id);
      navigate(`/yatra`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      <PageTitle title="Complete your booking" />
      <Panel title={<span className="flex items-center gap-2"><Bus size={15} className="text-[#F28C28]" /> {b.tourTitle}</span>} actions={<StatusPill status={b.status} />}>
        <InfoRow label="Booking">{b.bookingReference}</InfoRow>
        <InfoRow label="Departure">{dateTimeIst(b.departAt)}</InfoRow>
        <InfoRow label="Boarding point">{b.boardingPointName}</InfoRow>
        <InfoRow label="Seats">{b.seats.join(", ")}</InfoRow>
        <InfoRow label="Travellers">{b.passengers.map((p: any) => p.name).join(", ")}</InfoRow>
        <InfoRow label="Total">{rupees(b.pricing.totalAmount)}</InfoRow>
      </Panel>
      {error && <ErrorNote message={error} />}
      {open ? (
        left > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 text-center" role="timer" aria-live="off">Your seats are held for {mmss(left)} more.</p>
            <EnterpriseButton onClick={pay} disabled={busy} icon={<IndianRupee size={14} />} className="w-full justify-center">
              {busy ? "Opening secure payment…" : `Pay ${rupees(b.pricing.totalAmount)} to Tirvona`}
            </EnterpriseButton>
            <EnterpriseButton variant="ghost" onClick={release} disabled={busy} className="w-full justify-center">Release these seats</EnterpriseButton>
          </div>
        ) : (
          <Empty icon={<Clock size={26} className="text-amber-500" />} title="Your seat hold expired" text="The seats went back on sale. You can book again if they are still free." action={<Link className="text-xs font-extrabold text-[#F28C28]" to="/yatra">Back to Yatra</Link>} />
        )
      ) : b.status === "confirmed" ? (
        <Empty icon={<CheckCircle2 size={26} className="text-emerald-500" />} title="This booking is confirmed" action={<Link className="text-xs font-extrabold text-[#F28C28]" to={b.journeyId ? `/profile/journeys/${b.journeyId}` : "/profile/journeys"}>Open my journey</Link>} />
      ) : (
        <Empty title={`This booking is ${b.status.replace(/_/g, " ")}`} action={<Link className="text-xs font-extrabold text-[#F28C28]" to="/yatra">Back to Yatra</Link>} />
      )}
      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1.5"><ShieldCheck size={12} /> Paid to Tirvona through Razorpay. A booking is confirmed only after the payment is verified.</p>
    </div>
  );
};

// ============================================================ organiser link
export const YatraLinkPage: React.FC = () => (
  <YatraGate>
    <LinkLanding />
  </YatraGate>
);

const LinkLanding: React.FC = () => {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const remote = useRemote<any>(() => yatraPublic.link(code), [code]);
  useEffect(() => {
    if (remote.state !== "ready" || !remote.data) return;
    try {
      sessionStorage.setItem(LINK_KEY, JSON.stringify({ code: remote.data.code, at: Date.now() }));
    } catch {
      // Private mode: the booking simply counts as a website booking.
    }
    if (remote.data.departureCode) navigate(`/yatra/departures/${remote.data.departureCode}`, { replace: true });
  }, [remote.state, remote.data, navigate]);

  if (remote.state !== "ready") return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} missingText="This booking link is no longer active." /></div>;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageTitle title={remote.data.tourTitle} subtitle="Choose a departure to continue." />
      {remote.data.departures.length === 0 ? (
        <Empty title="No upcoming departures" text="Please check back later." />
      ) : (
        <div className="space-y-2">
          {remote.data.departures.map((d: any) => (
            <Link key={d.departureCode} to={`/yatra/departures/${d.departureCode}`} className="flex items-center justify-between gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 hover:border-[#F28C28]/50">
              <span className="text-xs font-black">{dateTimeIst(d.departAt)}</span>
              <span className="text-xs text-gray-500">{d.seatsLeft} seats left · <b className="text-[#0B192C] dark:text-white">{rupees(d.fare)}</b></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================================================== organiser payment link
export const YatraPayLinkPage: React.FC = () => (
  <YatraGate>
    <PayLink />
  </YatraGate>
);

const PayLink: React.FC = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const remote = useRemote<any>(() => yatraPublic.paymentLink(token), [token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = remote.data;
  const left = useCountdown(s?.holdExpiresAt);

  if (remote.state !== "ready" || !s) return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} missingText="This payment link is not valid." /></div>;

  const pay = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const order = await yatraCustomer.linkOrder(token);
      const res = await runPayment(order.data.data, { name: user.name, email: user.email, contact: user.phone }, (proof) => yatraCustomer.linkConfirm(token, proof));
      toast.success("Payment received. The booking is confirmed.");
      navigate(res.data.data.journeyId ? `/profile/journeys/${res.data.data.journeyId}` : "/profile/journeys", { replace: true });
    } catch (err) {
      setError(paymentError(err));
      remote.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageTitle title="Pay for your Yatra" subtitle={`Booked for you by ${s.organiser}. You pay Tirvona directly.`} />
      <Panel title={s.tourTitle}>
        <InfoRow label="Booking">{s.bookingReference}</InfoRow>
        <InfoRow label="Departure">{dateTimeIst(s.departAt)}</InfoRow>
        <InfoRow label="Boarding point">{s.boardingPointName}</InfoRow>
        <InfoRow label="Seats">{s.seats.join(", ")}</InfoRow>
        <InfoRow label="Travellers">{s.travellers.join(", ")}</InfoRow>
        <InfoRow label="Amount">{rupees(s.amount)}</InfoRow>
      </Panel>
      {error && <ErrorNote message={error} />}
      {s.status === "payable" ? (
        <div className="space-y-2">
          {left > 0 && <p className="text-xs font-bold text-amber-700 dark:text-amber-400 text-center">Seats are held for {mmss(left)} more.</p>}
          <EnterpriseButton onClick={pay} disabled={busy} icon={<IndianRupee size={14} />} className="w-full justify-center">
            {busy ? "Opening secure payment…" : user ? `Pay ${rupees(s.amount)} to Tirvona` : "Sign in to pay"}
          </EnterpriseButton>
          <p className="text-[10px] text-gray-400 text-center">The booking will be saved to the Tirvona account you pay from, so you can see your ticket and any refund there.</p>
        </div>
      ) : s.status === "paid" ? (
        <Empty icon={<CheckCircle2 size={26} className="text-emerald-500" />} title="This booking is paid and confirmed" action={<Link to="/profile/journeys" className="text-xs font-extrabold text-[#F28C28]">My journeys</Link>} />
      ) : (
        <Empty icon={<Clock size={26} className="text-amber-500" />} title={s.status === "cancelled" ? "This booking was cancelled" : "This payment link has expired"} text="Ask your organiser to send a new link." />
      )}
    </div>
  );
};

// ================================================================ partner page
export const YatraPartnerPage: React.FC = () => (
  <YatraGate>
    <Partner />
  </YatraGate>
);

const Partner: React.FC = () => {
  const items = [
    { icon: <Bus size={18} />, title: "One organiser console", text: "Tours, vehicles, departures, seats, bookings, manifests and boarding check-in in one place." },
    { icon: <Users size={18} />, title: "Pilgrims from Tirvona", text: "Published tours appear on Tirvona Yatra, next to stays, aarti, parking and food." },
    { icon: <Link2 size={18} />, title: "Your own booking links", text: "Share a link or QR with your customers. Those bookings are recorded as yours." },
    { icon: <Wallet size={18} />, title: "Payments handled by Tirvona", text: "Customers pay Tirvona through Razorpay. No cash handling; refunds follow your published policy." },
    { icon: <ShieldCheck size={18} />, title: "Verified listing", text: "Tirvona checks your KYC, vehicle permits and insurance before anything is sold." },
    { icon: <Route size={18} />, title: "Complete journeys", text: "Pilgrims can add meals, puja and stays to the trip you run." },
  ];
  const steps = ["Register with your Tirvona account", "Add PAN, business and payout details", "Upload KYC, vehicle RC, permit and insurance", "Tirvona verifies your organisation", "Submit tours; Tirvona reviews and publishes them", "Open departures and start selling"];
  return (
    <div className="pb-16 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <PageTitle title="Tirvona Yatra for organisers" subtitle="A growth platform for pilgrimage tour organisers: sell seats from one central inventory, with payments and verification handled by Tirvona." />
      </div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.title} className="tv-stat">
            <div className="tv-stat-head"><span className="tv-stat-label">{s.title}</span><span className="tv-stat-icon">{s.icon}</span></div>
            <p className="tv-stat-hint !mt-2">{s.text}</p>
          </div>
        ))}
      </section>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-10 space-y-4">
        <Panel title="How to join">
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3 items-start text-xs">
                <span className="w-6 h-6 rounded-full bg-[#F28C28] text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-1 font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><FileText size={15} className="text-[#F28C28]" /> Keep these ready</span>}>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">PAN card; GST certificate or business registration (if you have one); for each vehicle its registration certificate (RC), a valid permit and insurance. Documents are stored privately and seen only by Tirvona's verification team.</p>
        </Panel>
        <p className="text-[11px] text-gray-400 text-center">Commission, referral rates and payout terms are shared by Tirvona during onboarding.</p>
        <div className="text-center">
          <Link to="/operator/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#F28C28] px-5 py-3 text-xs font-extrabold text-white hover:bg-[#E57C18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50">
            Register as an organiser <ArrowRight size={14} />
          </Link>
        </div>
        <p className="text-xs text-center text-gray-500">
          Drive a cab, auto or tempo traveller in a pilgrimage town?{" "}
          <Link to="/ride-partner/dashboard" className="font-bold text-[#F28C28] hover:underline">Become a ride partner</Link>
        </p>
      </section>
    </div>
  );
};
