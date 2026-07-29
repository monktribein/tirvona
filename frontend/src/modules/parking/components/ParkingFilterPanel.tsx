import React from 'react';
import { SlidersHorizontal, Star, X, Umbrella, Zap, Navigation } from 'lucide-react';
import { amenityLabel } from '../utils/parkingFormat';

interface ParkingFilterPanelProps {
  amenityOptions: { key: string; label: string }[];
  selectedAmenities: string[];
  covered: boolean;
  evCharging: boolean;
  minRating: number;
  radiusKm: number;
  hasCoordinates: boolean;
  sortBy: string;
  sortOptions: { value: string; label: string }[];
  onChange: (patch: Record<string, unknown>) => void;
  onReset: () => void;
}

/**
 * Search filter rail.
 *
 * The distance control only renders when the visitor has actually shared a
 * location — a radius slider that silently does nothing is worse than no
 * slider at all.
 */
export const ParkingFilterPanel: React.FC<ParkingFilterPanelProps> = ({
  amenityOptions,
  selectedAmenities,
  covered,
  evCharging,
  minRating,
  radiusKm,
  hasCoordinates,
  sortBy,
  sortOptions,
  onChange,
  onReset,
}) => {
  const toggleAmenity = (key: string) => {
    const next = selectedAmenities.includes(key)
      ? selectedAmenities.filter((a) => a !== key)
      : [...selectedAmenities, key];
    onChange({ amenities: next });
  };

  const activeCount = selectedAmenities.length + (covered ? 1 : 0) + (evCharging ? 1 : 0) + (minRating > 0 ? 1 : 0);

  return (
    <aside className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 space-y-5 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
          <SlidersHorizontal size={15} className="text-[#0A4DA6] stroke-[2.5]" />
          Filters
          {activeCount > 0 && (
            <span className="bg-[#0A4DA6] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <X size={11} className="stroke-[2.5]" />
            Reset
          </button>
        )}
      </header>

      {/* Sort */}
      <div className="space-y-2">
        <label htmlFor="parking-sort" className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">
          Sort By
        </label>
        <select
          id="parking-sort"
          value={sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value })}
          className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Distance — only meaningful once we have coordinates */}
      {hasCoordinates && (
        <div className="space-y-2">
          <label
            htmlFor="parking-radius"
            className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-gray-400"
          >
            <span className="inline-flex items-center gap-1">
              <Navigation size={11} className="stroke-[2.5]" />
              Within
            </span>
            <span className="text-[#0A4DA6] dark:text-blue-300 normal-case tracking-normal">{radiusKm} km</span>
          </label>
          <input
            id="parking-radius"
            type="range"
            min={1}
            max={50}
            step={1}
            value={radiusKm}
            onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
            className="w-full accent-[#0A4DA6] cursor-pointer"
          />
        </div>
      )}

      {/* Quick toggles */}
      <div className="space-y-2">
        <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Quick Filters</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ covered: !covered })}
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              covered
                ? 'bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]'
            }`}
          >
            <Umbrella size={12} className="stroke-[2.5]" />
            Covered
          </button>
          <button
            type="button"
            onClick={() => onChange({ evCharging: !evCharging })}
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              evCharging
                ? 'bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]'
            }`}
          >
            <Zap size={12} className="stroke-[2.5]" />
            EV Charging
          </button>
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Minimum Rating</span>
        <div className="flex flex-wrap gap-1.5">
          {[0, 3, 4, 4.5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ minRating: value })}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                minRating === value
                  ? 'bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]'
              }`}
            >
              {value === 0 ? (
                'Any'
              ) : (
                <>
                  <Star size={11} className={minRating === value ? 'fill-white' : 'fill-[#D4AF37] text-[#D4AF37]'} />
                  {value}+
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Amenities */}
      <div className="space-y-2">
        <span className="block text-[10px] uppercase tracking-wider font-bold text-gray-400">Amenities</span>
        <div className="space-y-1">
          {amenityOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedAmenities.includes(option.key)}
                onChange={() => toggleAmenity(option.key)}
                className="w-3.5 h-3.5 accent-[#0A4DA6] cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-slate-700 dark:text-gray-200">
                {option.label || amenityLabel(option.key)}
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ParkingFilterPanel;
