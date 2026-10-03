import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  Check,
} from "lucide-react";
import { getTodayYMD } from "../contexts/BookingSearchContext";
import { useLanguage } from "../contexts/LanguageContext";
import { getFormattingLocale } from "../utils/format";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toYMD = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseYMD = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

export const formatTime12 = (hhmm?: string): string => {
  if (!hhmm) return "10:00 AM";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatShortDate = (ymd?: string) => {
  const date = parseYMD(ymd);
  return date
    ? date.toLocaleDateString(getFormattingLocale(), {
        day: "numeric",
        month: "short",
      })
    : "Select date";
};

const formatFullDate = (ymd?: string) => {
  const date = parseYMD(ymd);
  return date
    ? date.toLocaleDateString(getFormattingLocale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
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
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      current: false,
    });
  }
  return cells;
};

const POPULAR_SLOTS = [
  { time: "06:00", label: "06:00 AM", period: "morning" },
  { time: "07:00", label: "07:00 AM", period: "morning" },
  { time: "08:00", label: "08:00 AM", period: "morning" },
  { time: "09:00", label: "09:00 AM", period: "morning" },
  { time: "10:00", label: "10:00 AM", period: "morning" },
  { time: "11:00", label: "11:00 AM", period: "morning" },
  { time: "12:00", label: "12:00 PM", period: "afternoon" },
  { time: "13:00", label: "01:00 PM", period: "afternoon" },
  { time: "14:00", label: "02:00 PM", period: "afternoon" },
  { time: "15:00", label: "03:00 PM", period: "afternoon" },
  { time: "16:00", label: "04:00 PM", period: "afternoon" },
  { time: "17:00", label: "05:00 PM", period: "evening" },
  { time: "18:00", label: "06:00 PM", period: "evening" },
  { time: "19:00", label: "07:00 PM", period: "evening" },
  { time: "20:00", label: "08:00 PM", period: "evening" },
  { time: "21:00", label: "09:00 PM", period: "evening" },
];

export interface ShortStayDateTimePickerProps {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm format, e.g. "10:00"
  onChange: (date: string, time: string) => void;
  compact?: boolean;
  align?: "left" | "right";
  pill?: boolean;
}

export const ShortStayDateTimePicker: React.FC<
  ShortStayDateTimePickerProps
> = ({
  date,
  time = "10:00",
  onChange,
  compact = false,
  align = "left",
  pill = false,
}) => {
  const { language, t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => parseYMD(getTodayYMD())!, []);
  const initial = parseYMD(date) || today;

  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<"date" | "time">("date");
  const [view, setView] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const [periodFilter, setPeriodFilter] = useState<
    "all" | "morning" | "afternoon" | "evening"
  >("all");
  const [customTime, setCustomTime] = useState(time || "10:00");

  useEffect(() => {
    if (time) setCustomTime(time);
  }, [time]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const minimumMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousDisabled = view <= minimumMonth;

  const handleSelectDate = (d: Date) => {
    if (d < today) return;
    const ymd = toYMD(d);
    onChange(ymd, time || "10:00");
    // Seamlessly transition to time selection step
    setActiveStep("time");
  };

  const handleSelectTime = (tVal: string) => {
    setCustomTime(tVal);
    onChange(date || getTodayYMD(), tVal);
  };

  const filteredSlots = useMemo(() => {
    if (periodFilter === "all") return POPULAR_SLOTS;
    return POPULAR_SLOTS.filter((s) => s.period === periodFilter);
  }, [periodFilter]);

  const renderMonth = (month: Date) => (
    <div className="min-w-0 flex-1">
      <div className="flex h-9 items-center justify-between mb-2 relative px-1">
        <button
          type="button"
          aria-label={t("Previous month")}
          disabled={previousDisabled}
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
          }
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-50 text-[#F28C28] disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs sm:text-sm font-extrabold text-[#0B192C] dark:text-white">
          {month.toLocaleDateString(getFormattingLocale(), {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          aria-label={t("Next month")}
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
          }
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-50 text-[#F28C28] cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1 text-center">
        {(language === "hi"
          ? ["र", "सो", "मं", "बु", "गु", "शु", "श"]
          : WEEKDAYS
        ).map((day) => (
          <span
            key={day}
            className="text-[10px] font-bold py-1 text-slate-400 dark:text-slate-500"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthCells(month).map(({ date: cellDate, current }, cellIndex) => {
          const value = toYMD(cellDate);
          const disabled = cellDate < today || !current;
          const isSelected = value === date;
          return (
            <div
              key={`${value}-${cellIndex}`}
              className="relative h-8 sm:h-9 flex items-center justify-center"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleSelectDate(cellDate)}
                className={`relative z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#F28C28] text-white shadow-md shadow-[#F28C28]/30 font-black scale-105"
                    : disabled
                      ? "text-slate-200 dark:text-slate-700 cursor-not-allowed"
                      : "text-[#0B192C] dark:text-slate-200 hover:bg-[#F28C28]/15 hover:text-[#B96509]"
                }`}
              >
                {cellDate.getDate()}
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
        onClick={() => {
          setOpen((v) => !v);
          setActiveStep("date");
        }}
        className={`w-full text-left flex items-center ${compact ? "gap-2" : "gap-3"} cursor-pointer`}
      >
        {pill ? (
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#0B192C] dark:text-white">
              <span>When</span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-[#E58C28]/15 text-[#E58C28] text-[9px] font-black uppercase">
                <Sparkles size={9} /> Short Stay
              </span>
            </span>
            <span className="flex items-center gap-1.5 truncate text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              <span>{formatShortDate(date)}</span>
              <span className="text-[#F28C28] dark:text-amber-400 font-bold">
                • {formatTime12(time)}
              </span>
            </span>
          </span>
        ) : (
          <>
            <span
              className={`${
                compact ? "w-8 h-8" : "w-9 h-9"
              } rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#F28C28] dark:text-amber-400 flex items-center justify-center shrink-0`}
            >
              <Clock size={compact ? 15 : 17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] uppercase tracking-[0.14em] font-extrabold text-slate-400">
                Date & Arrival Time
              </span>
              <span className="block truncate text-xs sm:text-sm font-extrabold text-[#0B192C] dark:text-white">
                {formatShortDate(date)} • {formatTime12(time)}
              </span>
            </span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[90] sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`fixed sm:absolute inset-x-2 sm:inset-x-auto ${
                align === "right" ? "sm:right-0" : "sm:left-0"
              } top-1/2 -translate-y-1/2 sm:translate-y-0 sm:top-full mt-0 sm:mt-3 w-auto sm:w-[460px] max-w-[calc(100vw-1rem)] mx-auto bg-white dark:bg-[#0B192C] rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-[#0B192C]/25 z-[95] overflow-hidden`}
            >
              {/* Header with Step Switcher */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#0B192C] dark:text-white flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#F28C28]" />
                      <span>Short Stay (Single Day & Arrival Time)</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                      Check-in and checkout on the same day for rest or freshen up
                    </p>
                  </div>
                </div>

                {/* Date & Time Step Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setActiveStep("date")}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeStep === "date"
                        ? "bg-[#F28C28] text-white shadow-xs font-black"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Calendar size={13} />
                    <span className="truncate">
                      {date ? formatShortDate(date) : "1. Select Date"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep("time")}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeStep === "time"
                        ? "bg-[#F28C28] text-white shadow-xs font-black"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Clock size={13} />
                    <span className="truncate">
                      {time ? formatTime12(time) : "2. Arrival Time"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5">
                {activeStep === "date" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
                      <span>Pick your stay date:</span>
                      <span className="text-[11px] text-[#F28C28] font-bold">
                        Single day stay
                      </span>
                    </div>
                    {renderMonth(view)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-[#0B192C] dark:text-white flex items-center gap-1.5">
                        <Clock size={13} className="text-[#F28C28]" />
                        <span>Choose Arrival Time</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">
                        Standard arrival slots
                      </span>
                    </div>

                    {/* Period filters */}
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-center">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "morning", label: "Morning" },
                          { id: "afternoon", label: "Afternoon" },
                          { id: "evening", label: "Evening" },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPeriodFilter(item.id)}
                          className={`py-1.5 rounded-md transition-all cursor-pointer ${
                            periodFilter === item.id
                              ? "bg-white dark:bg-slate-800 text-[#F28C28] dark:text-white shadow-2xs font-extrabold"
                              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Time Slot Chips Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredSlots.map((slot) => {
                        const isSelected = (time || customTime) === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => handleSelectTime(slot.time)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                              isSelected
                                ? "bg-[#F28C28] border-[#F28C28] text-white shadow-xs font-black"
                                : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#F28C28]/60 hover:text-[#F28C28]"
                            }`}
                          >
                            {slot.period === "evening" ? (
                              <Moon size={11} className="shrink-0 opacity-70" />
                            ) : (
                              <Sun size={11} className="shrink-0 opacity-70" />
                            )}
                            <span className="truncate">{slot.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Time Input */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500 font-semibold">
                        Or specify custom time:
                      </span>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomTime(val);
                          handleSelectTime(val);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                  {date ? (
                    <span>
                      {formatFullDate(date)} •{" "}
                      <span className="text-[#F28C28] font-black">
                        {formatTime12(time)}
                      </span>
                    </span>
                  ) : (
                    <span>Please select a date</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeStep === "time" ? (
                    <button
                      type="button"
                      onClick={() => setActiveStep("date")}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Change Date
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveStep("time")}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-[#F28C28] hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer flex items-center gap-1"
                    >
                      Next: Time <ChevronRight size={13} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-[#F28C28] px-5 py-2 text-xs font-bold text-white hover:bg-[#D97706] cursor-pointer shadow-sm active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShortStayDateTimePicker;
