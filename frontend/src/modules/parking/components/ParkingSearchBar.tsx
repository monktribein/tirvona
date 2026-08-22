import React from "react";
import { Search, MapPin, LogIn, LogOut, Loader2 } from "lucide-react";
import type {
  ParkingVehicleType,
  ParkingVehicleTypeCode,
} from "../types/parking.types";
import VehicleTypePicker from "./VehicleTypePicker";
import {
  getMinimumParkingEntry,
  getMinimumParkingExit,
} from "../utils/parkingFormat";

interface ParkingSearchBarProps {
  destination: string;
  entryAt: string;
  exitAt: string;
  vehicleType: ParkingVehicleTypeCode | "";
  vehicleTypes: ParkingVehicleType[];
  loading?: boolean;
  onChange: (patch: {
    destination?: string;
    entryAt?: string;
    exitAt?: string;
    vehicleType?: ParkingVehicleTypeCode;
  }) => void;
  onSubmit: () => void;
}

export const ParkingSearchBar: React.FC<ParkingSearchBarProps> = ({
  destination,
  entryAt,
  exitAt,
  vehicleType,
  vehicleTypes,
  loading = false,
  onChange,
  onSubmit,
}) => {
  const minimumEntry = getMinimumParkingEntry();
  const minimumExit = getMinimumParkingExit(entryAt || minimumEntry);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] p-3 sm:p-4 shadow-lg shadow-[#0B192C]/5 space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-destination"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Destination or Temple
          </label>
          <div className="relative">
            <MapPin
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <input
              id="parking-destination"
              type="text"
              value={destination}
              onChange={(e) => onChange({ destination: e.target.value })}
              placeholder="Varanasi, Kashi Vishwanath, Rishikesh…"
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-entry"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Entry
          </label>
          <div className="relative">
            <LogIn
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <input
              id="parking-entry"
              type="datetime-local"
              value={entryAt}
              min={minimumEntry}
              onChange={(e) => {
                const nextEntry = e.target.value;
                const nextMinimumExit = getMinimumParkingExit(nextEntry);
                onChange({
                  entryAt: nextEntry,
                  ...(exitAt < nextMinimumExit
                    ? { exitAt: nextMinimumExit }
                    : {}),
                });
              }}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-exit"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Exit
          </label>
          <div className="relative">
            <LogOut
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <input
              id="parking-exit"
              type="datetime-local"
              value={exitAt}
              min={minimumExit}
              onChange={(e) => onChange({ exitAt: e.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-60 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin stroke-[2.5]" />
          ) : (
            <Search size={15} className="stroke-[2.5]" />
          )}
          <span>{loading ? "Searching" : "Search Parking"}</span>
        </button>
      </div>

      <div className="pt-1">
        <span className="block text-[10px] tracking-wider font-bold text-gray-400 mb-2 px-1">
          Vehicle Type
        </span>
        <VehicleTypePicker
          options={vehicleTypes}
          value={vehicleType}
          onChange={(code) => onChange({ vehicleType: code })}
        />
      </div>
    </form>
  );
};

export default ParkingSearchBar;
