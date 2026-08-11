import { CalendarDays, Loader2 } from "lucide-react";
import { formatCurrency } from "../utils/format";

type AvailabilityDay = {
  date: string;
  price: number;
  available: number;
  isClosed?: boolean;
};

type Props = {
  days: AvailabilityDay[];
  loading: boolean;
  roomName?: string;
  selectedDate?: string;
  onSelect: (date: string) => void;
};

const parseDay = (date: string) => new Date(`${date}T00:00:00`);

export function RoomAvailabilityCalendar({
  days,
  loading,
  roomName,
  selectedDate,
  onSelect,
}: Props) {
  const visibleDays = days.slice(0, 35);

  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/70">
        <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
      </div>
    );
  }

  if (!visibleDays.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-center text-[11px] font-semibold text-gray-400 dark:border-slate-700">
        Availability has not been published for this room yet.
      </div>
    );
  }

  const firstDate = parseDay(visibleDays[0].date);
  const lastDate = parseDay(visibleDays[visibleDays.length - 1].date);
  const leadingBlanks = firstDate.getDay();
  const monthLabel =
    firstDate.getMonth() === lastDate.getMonth()
      ? firstDate.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        })
      : `${firstDate.toLocaleDateString("en-IN", { month: "short" })} – ${lastDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;

  return (
    <section className="rounded-2xl border border-[#E58C28]/30 bg-white p-3 shadow-sm dark:bg-[#0B192C]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#0B192C] dark:text-white">
            <CalendarDays size={14} className="text-[#0A4DA6]" />
            Select an available date
          </p>
          <p className="mt-0.5 truncate text-[9px] font-semibold text-gray-400">
            {roomName || "Selected room"} · one-night stay
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#0A4DA6]/8 px-2 py-1 text-[9px] font-extrabold text-[#0A4DA6]">
          {monthLabel}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] font-bold text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border border-emerald-400 bg-emerald-100" />Available</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border border-amber-400 bg-amber-100" />Limited</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border border-red-400 bg-red-100" />Sold out</span>
      </div>

      <div className="grid grid-cols-7 text-center text-[8px] font-extrabold uppercase tracking-wide text-gray-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((name) => (
          <span key={name} className="pb-1.5">{name}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 place-items-center gap-y-1.5">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} className="h-9 w-9" aria-hidden />
        ))}
        {visibleDays.map((day) => {
          const soldOut = day.available <= 0 || day.isClosed;
          const limited = !soldOut && day.available <= 5;
          const selected = selectedDate === day.date;
          const date = parseDay(day.date);
          const color = soldOut
            ? "border-red-300 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/40"
            : limited
              ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300";

          return (
            <button
              key={day.date}
              type="button"
              disabled={soldOut}
              onClick={() => onSelect(day.date)}
              title={`${date.toLocaleDateString("en-IN", { dateStyle: "full" })} · ${soldOut ? "Sold out" : `${day.available} available`} · ${formatCurrency(day.price)}`}
              aria-label={`${date.toLocaleDateString("en-IN", { dateStyle: "long" })}, ${soldOut ? "sold out" : `${day.available} available`}`}
              aria-pressed={selected}
              className={`relative flex h-9 w-9 flex-col items-center justify-center rounded-full border text-center transition-all ${color} ${soldOut ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm"} ${selected ? "ring-2 ring-[#0A4DA6] ring-offset-2 dark:ring-offset-[#0B192C]" : ""}`}
            >
              <span className="text-[10px] font-black leading-none">{date.getDate()}</span>
              <span className="mt-0.5 max-w-8 truncate text-[6px] font-extrabold leading-none">
                {soldOut ? "FULL" : formatCurrency(day.price)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[8px] font-semibold text-gray-400">
        Choose a green or yellow date to update your stay dates.
      </p>
    </section>
  );
}
