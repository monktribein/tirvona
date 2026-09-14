"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Sparkles, MapPin, Calendar, X } from "lucide-react";

const PUJA_OPTIONS = [
  "Rudrabhishek Puja",
  "Maha Mrityunjaya Jaap",
  "Sri Satyanarayan Katha",
  "Griha Pravesh & Vastu",
  "Navgraha Shanti Puja",
  "Kundali & Jyotish Consultation",
  "Vivah Sanskar Puja",
  "Durga Saptashati Path",
  "Sundarkand Path",
  "Kalsarp Dosh Nivaran",
  "Mahaganapati Homa",
];

const PLACE_OPTIONS = [
  "Varanasi (Kashi)",
  "Haridwar",
  "Rishikesh",
  "Ayodhya",
  "Ujjain (Mahakaleshwar)",
  "Prayagraj",
  "Mathura / Vrindavan",
  "Delhi NCR",
  "Mumbai / Pune",
  "Bengaluru",
  "Online (E-Puja / Video Sankalp)",
];

export const StructuredPujaSearch: React.FC<{
  initialPuja?: string;
  initialPlace?: string;
  initialDate?: string;
  className?: string;
}> = ({
  initialPuja = "",
  initialPlace = "",
  initialDate = "",
  className = "",
}) => {
  const router = useRouter();
  const [puja, setPuja] = useState(initialPuja);
  const [place, setPlace] = useState(initialPlace);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);

  // Dropdown UI states for custom pill styling
  const [showPujaDropdown, setShowPujaDropdown] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);

  const pujaRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pujaRef.current && !pujaRef.current.contains(event.target as Node)) {
        setShowPujaDropdown(false);
      }
      if (placeRef.current && !placeRef.current.contains(event.target as Node)) {
        setShowPlaceDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (puja) params.set("puja", puja);
    if (place) params.set("place", place);
    if (date) params.set("date", date);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className={`relative isolate overflow-visible bg-white dark:bg-[#0B192C] rounded-[28px] lg:rounded-full shadow-2xl shadow-[#0B192C]/15 border border-gray-200 dark:border-slate-800/80 p-1.5 sm:p-2 ${className}`}>
      <form
        onSubmit={handleSearch}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.55fr_1.35fr_1.15fr_auto] gap-1 lg:gap-0 items-center"
      >
        {/* 1. Puja / Ritual Selection ("Where" Pill Style in Tirvona) */}
        <div
          ref={pujaRef}
          className="group cursor-pointer rounded-2xl lg:rounded-full px-6 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-md transition-all flex flex-col justify-center min-h-[64px] lg:border-r border-gray-200/80 dark:border-slate-800/80 relative min-w-0 z-20"
          onClick={() => setShowPujaDropdown(!showPujaDropdown)}
        >
          <label className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white mb-0.5 select-none cursor-pointer">
            Puja / Service
          </label>
          <div className="relative flex items-center justify-between min-w-0 w-full">
            <span className={`text-xs sm:text-sm font-bold truncate ${puja ? "text-[#0B192C] dark:text-white" : "text-gray-400 font-medium"}`}>
              {puja || "Search rituals & pujas"}
            </span>
            <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2 group-hover:text-[#0A4DA6] transition" />
          </div>

          {/* Custom Dropdown List */}
          {showPujaDropdown && (
            <div className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-xs py-2 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPuja("");
                  setShowPujaDropdown(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>All Pujas & Hawan</span>
                {puja === "" && <span className="text-[#0A4DA6] font-bold">✓</span>}
              </button>
              {PUJA_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPuja(opt);
                    setShowPujaDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 font-bold text-[#0B192C] dark:text-white flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{opt}</span>
                  {puja === opt && <span className="text-[#0A4DA6] font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Place Selection ("Where/When" Style in Tirvona) */}
        <div
          ref={placeRef}
          className="group cursor-pointer rounded-2xl lg:rounded-full px-6 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-md transition-all flex flex-col justify-center min-h-[64px] lg:border-r border-gray-200/80 dark:border-slate-800/80 relative min-w-0 z-20"
          onClick={() => setShowPlaceDropdown(!showPlaceDropdown)}
        >
          <label className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white mb-0.5 select-none cursor-pointer">
            Place / Tirtha
          </label>
          <div className="relative flex items-center justify-between min-w-0 w-full">
            <span className={`text-xs sm:text-sm font-bold truncate ${place ? "text-[#0B192C] dark:text-white" : "text-gray-400 font-medium"}`}>
              {place || "Select sacred city"}
            </span>
            <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2 group-hover:text-[#0A4DA6] transition" />
          </div>

          {/* Custom Dropdown List */}
          {showPlaceDropdown && (
            <div className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-xs py-2 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlace("");
                  setShowPlaceDropdown(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>All Sacred Cities & Online</span>
                {place === "" && <span className="text-[#0A4DA6] font-bold">✓</span>}
              </button>
              {PLACE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlace(opt);
                    setShowPlaceDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 font-bold text-[#0B192C] dark:text-white flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{opt}</span>
                  {place === opt && <span className="text-[#0A4DA6] font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Auspicious Date / Muhurat ("When" Date Pill Style) */}
        <div className="group rounded-2xl lg:rounded-full px-6 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-md transition-all flex flex-col justify-center min-h-[64px] relative min-w-0 z-10">
          <label className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white mb-0.5 select-none">
            When / Muhurat
          </label>
          <div className="relative flex items-center min-w-0 w-full">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs sm:text-sm font-bold focus:outline-none text-[#0B192C] dark:text-white cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Search Icon Button (Exact Tirvona Circle Button) */}
        <div className="flex items-center justify-center p-1 col-span-1 sm:col-span-2 lg:col-span-1 min-h-[64px]">
          <button
            type="submit"
            aria-label="Search Pandits"
            className="w-full lg:w-14 h-12 lg:h-14 px-5 lg:px-0 bg-[#0A4DA6] hover:bg-[#083D85] text-white font-bold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 shadow-md shadow-[#0A4DA6]/20 hover:shadow-lg hover:shadow-[#0A4DA6]/30 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <span className="lg:hidden">Search Pandits</span>
            <Search size={18} className="stroke-[2.5]" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default StructuredPujaSearch;
