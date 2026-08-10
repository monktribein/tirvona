import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Users } from "lucide-react";
import {
  formatBookingSummary,
  useBookingSearch,
} from "../../contexts/BookingSearchContext";

export interface GuestRoomValues {
  rooms: number;
  adults: number;
  children: number;
}

interface GuestRoomSelectorProps {
  values?: GuestRoomValues;
  onChange?: (values: GuestRoomValues) => void;
  compact?: boolean;
  pill?: boolean;
}

const Stepper: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}> = ({ value, min, max, onChange }) => (
  <div className="flex items-center gap-3">
    <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)} className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[#0A4DA6] hover:border-[#0A4DA6] hover:bg-blue-50 dark:hover:bg-blue-950/40 active:scale-90 disabled:text-slate-300 disabled:border-slate-200 disabled:hover:bg-transparent disabled:cursor-not-allowed">
      <Minus size={14} strokeWidth={2.5} />
    </button>
    <span className="w-5 text-center text-sm font-extrabold tabular-nums text-[#0B192C] dark:text-white">{value}</span>
    <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(value + 1)} className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[#0A4DA6] hover:border-[#0A4DA6] hover:bg-blue-50 dark:hover:bg-blue-950/40 active:scale-90 disabled:text-slate-300 disabled:border-slate-200 disabled:hover:bg-transparent disabled:cursor-not-allowed">
      <Plus size={14} strokeWidth={2.5} />
    </button>
  </div>
);

export const GuestRoomSelector: React.FC<GuestRoomSelectorProps> = ({ values, onChange, compact = false, pill = false }) => {
  const { searchState, updateBookingSearch } = useBookingSearch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active: Required<GuestRoomValues> = {
    rooms: values?.rooms ?? searchState.rooms ?? 1,
    adults: values?.adults ?? searchState.adults ?? 2,
    children: values?.children ?? searchState.children ?? 0,
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const update = (field: keyof GuestRoomValues, value: number) => {
    const next = { ...active, [field]: value };
    updateBookingSearch(next);
    onChange?.(next);
  };

  const rows = [
    { field: "adults" as const, title: "Adults", detail: "Ages 18 or above", min: 1, max: 20 },
    { field: "children" as const, title: "Children", detail: "Ages 2–17", min: 0, max: 10 },
  ];

  const summary = formatBookingSummary(active.rooms, active.adults, active.children);

  return (
    <div className="relative w-full" ref={rootRef}>
      {!compact && !pill && <span className="block text-[9px] uppercase tracking-[0.14em] font-extrabold text-slate-400 mb-1">Guests</span>}
      <button type="button" onClick={() => setOpen((value) => !value)} className={`w-full flex items-center text-left ${compact ? "gap-2.5" : "gap-3"}`}>
        {!pill && <span className={`${compact ? "w-8 h-8" : "w-9 h-9"} rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0`}><Users size={compact ? 15 : 17} /></span>}
        <span className="min-w-0 flex-1">
          {pill ? (
            <>
              <span className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white">Who</span>
              <span className="block truncate text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300 mt-0.5">{summary}</span>
            </>
          ) : (
            <>
              {compact && <span className="block text-[9px] uppercase tracking-[0.14em] font-extrabold text-slate-400">Guests</span>}
              <span className="block truncate text-xs sm:text-sm font-extrabold text-[#0B192C] dark:text-white">{summary}</span>
            </>
          )}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute top-full bg-white dark:bg-[#0B192C] overflow-hidden text-xs ${
              pill
                ? "left-0 right-0 mt-3 w-full max-w-none border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl z-50"
                : "right-0 mt-4 w-[340px] max-w-[calc(100vw-2rem)] border border-slate-100 dark:border-slate-800 rounded-[28px] shadow-2xl shadow-[#0B192C]/15 z-[80]"
            }`}
          >
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-extrabold text-[#0B192C] dark:text-white">Who is joining the journey?</h3>
              <p className="text-[10px] font-semibold text-slate-400 mt-1">Set your group for the right stay and seva experience.</p>
            </div>
            <div className="px-5">
              {rows.map((row) => (
                <div key={row.field} className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                  <div>
                    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">{row.title}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{row.detail}</p>
                  </div>
                  <Stepper value={active[row.field]} min={row.min} max={row.max} onChange={(value) => update(row.field, value)} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">Rooms</p>
                <p className="text-[10px] text-slate-400 mt-0.5">For a peaceful, comfortable stay</p>
              </div>
              <Stepper value={active.rooms} min={1} max={9} onChange={(value) => update("rooms", value)} />
            </div>
            <div className="p-4 pt-3">
              <button type="button" onClick={() => setOpen(false)} className="w-full py-3 rounded-2xl bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold shadow-md shadow-blue-900/15 active:scale-[0.98]">Save guests</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GuestRoomSelector;
