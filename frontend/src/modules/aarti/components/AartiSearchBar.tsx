import React from "react";
import { CalendarDays, Flame, Loader2, MapPin, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface AartiSearchBarProps {
  q: string;
  city: string;
  date: string;
  kind: string;
  cityOptions: { city: string; state?: string; count: number }[];
  kindOptions: Option[];
  minDate: string;
  loading?: boolean;
  onChange: (patch: {
    q?: string;
    city?: string;
    date?: string;
    kind?: string;
  }) => void;
  onSubmit: () => void;
}

export const AartiSearchBar: React.FC<AartiSearchBarProps> = ({
  q,
  city,
  date,
  kind,
  cityOptions,
  kindOptions,
  minDate,
  loading = false,
  onChange,
  onSubmit,
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] p-3 sm:p-4 shadow-lg shadow-[#0B192C]/5"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="aarti-search"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Aarti, Deity or Ghat
          </label>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <input
              id="aarti-search"
              type="text"
              value={q}
              onChange={(event) => onChange({ q: event.target.value })}
              placeholder="Ganga Aarti, Har Ki Pauri, Mahakaleshwar…"
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label
            htmlFor="aarti-city"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            City
          </label>
          <div className="relative">
            <MapPin
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <select
              id="aarti-city"
              value={city}
              onChange={(event) => onChange({ city: event.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all cursor-pointer appearance-none"
            >
              <option value="">All cities</option>
              {cityOptions.map((option) => (
                <option key={option.city} value={option.city}>
                  {option.city} ({option.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label
            htmlFor="aarti-date"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Date
          </label>
          <div className="relative">
            <CalendarDays
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <input
              id="aarti-date"
              type="date"
              value={date}
              min={minDate}
              onChange={(event) => onChange({ date: event.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label
            htmlFor="aarti-kind"
            className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
          >
            Aarti Type
          </label>
          <div className="relative">
            <Flame
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
            />
            <select
              id="aarti-kind"
              value={kind}
              onChange={(event) => onChange({ kind: event.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all cursor-pointer appearance-none"
            >
              <option value="">All types</option>
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <span>{loading ? "Searching" : "Search Aarti"}</span>
        </button>
      </div>
    </form>
  );
};

export default AartiSearchBar;
