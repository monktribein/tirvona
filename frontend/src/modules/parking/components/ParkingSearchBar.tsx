import React from 'react';
import { Search, MapPin, LogIn, LogOut, Loader2 } from 'lucide-react';
import type { ParkingVehicleType, ParkingVehicleTypeCode } from '../types/parking.types';
import VehicleTypePicker from './VehicleTypePicker';

interface ParkingSearchBarProps {
  destination: string;
  entryAt: string;
  exitAt: string;
  vehicleType: ParkingVehicleTypeCode | '';
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

/**
 * The parking search panel.
 *
 * Deliberately mirrors the home page's stay-search widget — same rounded white
 * card, same field dividers, same gold-on-navy submit pill — so the module
 * reads as part of the site rather than a bolt-on.
 */
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
        {/* Destination */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-destination"
            className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 px-1"
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

        {/* Entry */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-entry"
            className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 px-1"
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
              onChange={(e) => onChange({ entryAt: e.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        {/* Exit */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="parking-exit"
            className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 px-1"
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
              min={entryAt}
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
          <span>{loading ? 'Searching' : 'Search Parking'}</span>
        </button>
      </div>

      {/* Vehicle class */}
      <div className="pt-1">
        <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2 px-1">
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
