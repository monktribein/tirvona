import React from "react";
import { SlidersHorizontal, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface AartiFilterPanelProps {
  facilityOptions: Option[];
  selectedFacilities: string[];
  sort: string;
  sortOptions: Option[];
  onChange: (patch: { facilities?: string[]; sort?: string }) => void;
  onReset: () => void;
}

export const AartiFilterPanel: React.FC<AartiFilterPanelProps> = ({
  facilityOptions,
  selectedFacilities,
  sort,
  sortOptions,
  onChange,
  onReset,
}) => {
  const toggleFacility = (value: string) => {
    onChange({
      facilities: selectedFacilities.includes(value)
        ? selectedFacilities.filter((item) => item !== value)
        : [...selectedFacilities, value],
    });
  };

  const activeCount = selectedFacilities.length;

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

      <div className="space-y-2">
        <label
          htmlFor="aarti-sort"
          className="block text-[10px] tracking-wider font-bold text-gray-400"
        >
          Sort By
        </label>
        <select
          id="aarti-sort"
          value={sort}
          onChange={(event) => onChange({ sort: event.target.value })}
          className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {facilityOptions.length > 0 && (
        <div className="space-y-2.5">
          <span className="block text-[10px] tracking-wider font-bold text-gray-400">
            What&rsquo;s Arranged
          </span>
          <div className="flex flex-wrap gap-2">
            {facilityOptions.map((option) => {
              const active = selectedFacilities.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleFacility(option.value)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-95 ${
                    active
                      ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm"
                      : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default AartiFilterPanel;
