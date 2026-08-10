import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getTodayYMD } from "../contexts/BookingSearchContext";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toYMD = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseYMD = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const formatShort = (value?: string) => {
  const date = parseYMD(value);
  return date
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "Add date";
};

const monthCells = (view: Date) => {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; current: boolean }> = [];
  for (let offset = first - 1; offset >= 0; offset--)
    cells.push({ date: new Date(year, month, -offset), current: false });
  for (let day = 1; day <= total; day++)
    cells.push({ date: new Date(year, month, day), current: true });
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), current: false });
  }
  return cells;
};

interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  compact?: boolean;
  align?: "left" | "right";
  pill?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onChange,
  compact = false,
  align = "left",
  pill = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => parseYMD(getTodayYMD())!, []);
  const initial = parseYMD(checkIn) || today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [hovered, setHovered] = useState<string>("");
  const start = parseYMD(checkIn);
  const end = parseYMD(checkOut);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const minimumMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousDisabled = view <= minimumMonth;
  const selectingEnd = Boolean(start && !end);

  const choose = (date: Date) => {
    if (date < today) return;
    const value = toYMD(date);
    if (!start || end) {
      onChange(value, "");
      return;
    }
    if (date <= start) {
      onChange(value, "");
      return;
    }
    onChange(checkIn, value);
    setHovered("");
  };

  const isInRange = (date: Date) => {
    if (!start) return false;
    const previewEnd = end || (selectingEnd ? parseYMD(hovered) : null);
    return Boolean(previewEnd && date > start && date < previewEnd);
  };

  const renderMonth = (month: Date, index: number) => (
    <div className="min-w-0 flex-1" key={toYMD(month)}>
      <div className="flex h-9 items-center justify-center mb-2 relative">
        {index === 0 && (
          <button
            type="button"
            aria-label="Previous month"
            disabled={previousDisabled}
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            className="absolute left-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-50 text-[#0A4DA6] disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </span>
        {index === 1 && (
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            className="absolute right-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-50 text-[#0A4DA6]"
          >
            <ChevronRight size={17} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[10px] font-bold text-center py-1.5 text-slate-400">{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {monthCells(month).map(({ date, current }, cellIndex) => {
          const value = toYMD(date);
          const disabled = date < today || !current;
          const selectedStart = value === checkIn;
          const selectedEnd = value === checkOut;
          const ranged = isInRange(date);
          return (
            <div key={`${value}-${cellIndex}`} className={`relative h-9 flex items-center justify-center ${ranged ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}>
              <button
                type="button"
                disabled={disabled}
                onMouseEnter={() => selectingEnd && !disabled && setHovered(value)}
                onClick={() => choose(date)}
                className={`relative z-10 w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  selectedStart || selectedEnd
                    ? "bg-[#0A4DA6] text-white shadow-md shadow-blue-900/20"
                    : disabled
                      ? "text-slate-200 dark:text-slate-700 cursor-not-allowed"
                      : "text-[#0B192C] dark:text-slate-200 hover:bg-[#E58C28]/15 hover:text-[#B96509]"
                }`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`w-full text-left flex items-center ${compact ? "gap-2" : "gap-3"}`}
      >
        {pill ? (
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white">When</span>
            <span className="block truncate text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300 mt-0.5">
              {checkIn || checkOut
                ? `${formatShort(checkIn)}${checkOut ? ` – ${formatShort(checkOut)}` : ""}`
                : "Add dates"}
          </span>
          </span>
        ) : (
          <>
            <span className={`${compact ? "w-8 h-8" : "w-9 h-9"} rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0`}>
              <CalendarDays size={compact ? 15 : 17} />
            </span>
            <span className="grid grid-cols-2 min-w-0 flex-1">
              <span className="min-w-0 pr-3 border-r border-slate-200 dark:border-slate-700">
                <span className="block text-[9px] uppercase tracking-[0.14em] font-extrabold text-slate-400">Check-in</span>
                <span className="block truncate text-xs sm:text-sm font-extrabold text-[#0B192C] dark:text-white">{formatShort(checkIn)}</span>
              </span>
              <span className="min-w-0 pl-3">
                <span className="block text-[9px] uppercase tracking-[0.14em] font-extrabold text-slate-400">Check-out</span>
                <span className="block truncate text-xs sm:text-sm font-extrabold text-[#0B192C] dark:text-white">{formatShort(checkOut)}</span>
              </span>
            </span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-4 w-[min(720px,calc(100vw-2rem))] bg-white dark:bg-[#0B192C] rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-[#0B192C]/15 z-[80] overflow-hidden`}
          >
            <div className="px-5 sm:px-7 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-extrabold text-[#0B192C] dark:text-white">Choose your sacred stay</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{selectingEnd ? "Now select your check-out date" : "Select check-in to begin"}</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 flex gap-7">
              {renderMonth(view, 0)}
              <div className="hidden sm:block w-px bg-slate-100 dark:bg-slate-800" />
              <div className="hidden sm:block flex-1 min-w-0">
                {renderMonth(new Date(view.getFullYear(), view.getMonth() + 1, 1), 1)}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateRangePicker;
