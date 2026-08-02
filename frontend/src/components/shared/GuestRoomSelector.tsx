import React, { useState, useRef, useEffect } from "react";
import { Users, ChevronDown, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useBookingSearch,
  formatBookingSummary,
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
}

const Stepper: React.FC<{
  value: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
}> = ({ value, min, max, onDecrement, onIncrement }) => (
  <div className="flex items-center gap-2.5">
    <button
      type="button"
      onClick={onDecrement}
      disabled={value <= min}
      className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer select-none ${
        value <= min
          ? "border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed"
          : "border-[#0A4DA6] text-[#0A4DA6] hover:bg-[#0A4DA6]/10 active:scale-90"
      }`}
    >
      <Minus size={14} strokeWidth={2.5} />
    </button>
    <span className="w-6 text-center text-sm font-extrabold text-[#0B192C] dark:text-white tabular-nums">
      {value}
    </span>
    <button
      type="button"
      onClick={onIncrement}
      disabled={value >= max}
      className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer select-none ${
        value >= max
          ? "border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed"
          : "border-[#0A4DA6] text-[#0A4DA6] hover:bg-[#0A4DA6]/10 active:scale-90"
      }`}
    >
      <Plus size={14} strokeWidth={2.5} />
    </button>
  </div>
);

export const GuestRoomSelector: React.FC<GuestRoomSelectorProps> = ({
  values: propValues,
  onChange,
  compact = false,
}) => {
  const { searchState, updateBookingSearch } = useBookingSearch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active values from props or global context
  const activeRooms = propValues?.rooms ?? searchState.rooms ?? 1;
  const activeAdults = propValues?.adults ?? searchState.adults ?? 2;
  const activeChildren = propValues?.children ?? searchState.children ?? 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleUpdate = (field: keyof GuestRoomValues, delta: number) => {
    const mins: Record<keyof GuestRoomValues, number> = {
      rooms: 1,
      adults: 1,
      children: 0,
    };
    const maxes: Record<keyof GuestRoomValues, number> = {
      rooms: 9,
      adults: 20,
      children: 10,
    };

    const currentMap = {
      rooms: activeRooms,
      adults: activeAdults,
      children: activeChildren,
    };
    const nextVal = Math.max(
      mins[field],
      Math.min(maxes[field], currentMap[field] + delta),
    );
    const updated = { ...currentMap, [field]: nextVal };

    updateBookingSearch(updated);
    onChange?.(updated);
  };

  const summaryLabel = formatBookingSummary(
    activeRooms,
    activeAdults,
    activeChildren,
  );
  const totalGuests = activeAdults + activeChildren;

  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs font-semibold focus:outline-none flex items-center justify-between text-left cursor-pointer truncate"
        >
          <span className="truncate">{summaryLabel}</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        <Users className="absolute left-3 top-3.5 text-gray-400" size={14} />

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-0 top-full mt-2 w-[280px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-5 space-y-4"
            >
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Guests & Rooms
              </h4>

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                  Rooms
                </p>
                <Stepper
                  value={activeRooms}
                  min={1}
                  max={9}
                  onDecrement={() => handleUpdate("rooms", -1)}
                  onIncrement={() => handleUpdate("rooms", 1)}
                />
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                    Adults
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    18+ Years
                  </p>
                </div>
                <Stepper
                  value={activeAdults}
                  min={1}
                  max={20}
                  onDecrement={() => handleUpdate("adults", -1)}
                  onIncrement={() => handleUpdate("adults", 1)}
                />
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                    Children
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    0–17 Years
                  </p>
                </div>
                <Stepper
                  value={activeChildren}
                  min={0}
                  max={10}
                  onDecrement={() => handleUpdate("children", -1)}
                  onIncrement={() => handleUpdate("children", 1)}
                />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98]"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">
        Guests & Rooms
      </label>
      <div className="relative flex items-center" ref={containerRef}>
        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2.5">
          <Users size={16} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full text-left bg-transparent p-0 pr-5 text-xs sm:text-sm font-bold focus:outline-none cursor-pointer text-[#0B192C] dark:text-white truncate"
        >
          {summaryLabel}
        </button>
        <ChevronDown
          size={14}
          className={`absolute right-0 text-gray-400 pointer-events-none transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full mt-3 w-[280px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-[#0B192C]/10 z-50 p-5 space-y-5"
            >
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                Guests & Rooms
              </h4>

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                  Rooms
                </p>
                <Stepper
                  value={activeRooms}
                  min={1}
                  max={9}
                  onDecrement={() => handleUpdate("rooms", -1)}
                  onIncrement={() => handleUpdate("rooms", 1)}
                />
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                    Adults
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    18+ Years
                  </p>
                </div>
                <Stepper
                  value={activeAdults}
                  min={1}
                  max={20}
                  onDecrement={() => handleUpdate("adults", -1)}
                  onIncrement={() => handleUpdate("adults", 1)}
                />
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                    Children
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    0–17 Years
                  </p>
                </div>
                <Stepper
                  value={activeChildren}
                  min={0}
                  max={10}
                  onDecrement={() => handleUpdate("children", -1)}
                  onIncrement={() => handleUpdate("children", 1)}
                />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98]"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <input type="hidden" name="guests" value={totalGuests.toString()} />
      </div>
    </div>
  );
};

export default GuestRoomSelector;
