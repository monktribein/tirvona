import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseYMD = (s?: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const fmtDisplay = (s?: string) => {
  const d = parseYMD(s);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

interface DatePickerProps {
  value: string; // yyyy-mm-dd
  onChange: (v: string) => void;
  min?: string; // yyyy-mm-dd — disable earlier days
  placeholder?: string;
  align?: "left" | "right";
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  min,
  placeholder = "Add Date",
  align = "left",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const requestedMin = parseYMD(min);
  const minMidnight =
    requestedMin && requestedMin > todayMidnight ? requestedMin : todayMidnight;
  const parsedValue = parseYMD(value);
  const selected =
    parsedValue && parsedValue >= minMidnight ? parsedValue : null;
  const [view, setView] = useState<Date>(() => selected || minMidnight);

  useEffect(() => {
    if (open) setView(selected || minMidnight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isPrevMonthDisabled =
    year < minMidnight.getFullYear() ||
    (year === minMidnight.getFullYear() && month <= minMidnight.getMonth());

  const cells: Array<{ date: Date; current: boolean }> = [];
  for (let i = firstWeekday - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      current: false,
    });
  }

  const isDisabled = (d: Date) => d < minMidnight;
  const pick = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toYMD(d));
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left bg-transparent p-0 text-xs sm:text-sm font-bold focus:outline-none cursor-pointer truncate ${value ? "text-[#0B192C] dark:text-white" : "text-gray-400"}`}
      >
        {selected ? fmtDisplay(toYMD(selected)) : placeholder}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-3 w-[288px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-[#0B192C]/10 z-[60] p-3`}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                {MONTHS[month]} {year}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isPrevMonthDisabled}
                  onClick={() => setView(new Date(year, month - 1, 1))}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isPrevMonthDisabled
                      ? "text-gray-300 dark:text-slate-700 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                  }`}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setView(new Date(year, month + 1, 1))}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-500 cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-bold text-gray-400 text-center py-1"
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((c, i) => {
                const isSel = selected && sameDay(c.date, selected);
                const isToday = sameDay(c.date, today);
                const dis = isDisabled(c.date);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={dis}
                    onClick={() => pick(c.date)}
                    className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                      isSel
                        ? "bg-[#0A4DA6] text-white"
                        : dis
                          ? "text-gray-300 dark:text-slate-700 cursor-not-allowed"
                          : c.current
                            ? "text-[#0B192C] dark:text-gray-200 hover:bg-[#0A4DA6]/10 hover:text-[#0A4DA6]"
                            : "text-gray-300 dark:text-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800"
                    } ${isToday && !isSel ? "ring-1 ring-[#0A4DA6]/40" : ""}`}
                  >
                    {c.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 px-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-[11px] font-bold text-gray-500 hover:text-danger cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={todayMidnight < minMidnight}
                onClick={() => pick(new Date())}
                className={`text-[11px] font-bold ${
                  todayMidnight < minMidnight
                    ? "text-gray-300 dark:text-slate-700 cursor-not-allowed"
                    : "text-[#0A4DA6] hover:underline cursor-pointer"
                }`}
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DatePicker;
