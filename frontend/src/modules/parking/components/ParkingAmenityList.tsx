import React from "react";
import {
  Umbrella,
  Video,
  ShieldCheck,
  Droplets,
  Zap,
  Accessibility,
  Car,
  Sparkles,
  GlassWater,
  Sofa,
  Check,
} from "lucide-react";
import { amenityLabel } from "../utils/parkingFormat";

const ICONS: Record<string, React.ReactNode> = {
  covered: <Umbrella size={14} className="stroke-[2.5]" />,
  cctv: <Video size={14} className="stroke-[2.5]" />,
  security: <ShieldCheck size={14} className="stroke-[2.5]" />,
  washroom: <Droplets size={14} className="stroke-[2.5]" />,
  ev_charging: <Zap size={14} className="stroke-[2.5]" />,
  wheelchair_access: <Accessibility size={14} className="stroke-[2.5]" />,
  valet: <Car size={14} className="stroke-[2.5]" />,
  car_wash: <Sparkles size={14} className="stroke-[2.5]" />,
  drinking_water: <GlassWater size={14} className="stroke-[2.5]" />,
  waiting_lounge: <Sofa size={14} className="stroke-[2.5]" />,
};

interface ParkingAmenityListProps {
  amenities: string[];
  variant?: "chips" | "grid";
  limit?: number;
}

export const ParkingAmenityList: React.FC<ParkingAmenityListProps> = ({
  amenities,
  variant = "chips",
  limit,
}) => {
  if (!amenities?.length) return null;

  const shown = limit ? amenities.slice(0, limit) : amenities;
  const remaining = limit ? Math.max(0, amenities.length - limit) : 0;

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {amenities.map((key) => (
          <div
            key={key}
            className="flex items-center gap-2.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5"
          >
            <span className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-300 flex items-center justify-center shrink-0">
              {ICONS[key] || <Check size={14} className="stroke-[2.5]" />}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-gray-200">
              {amenityLabel(key)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 bg-blue-50/70 dark:bg-slate-800 text-[#0A4DA6] dark:text-blue-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-blue-100 dark:border-slate-700"
        >
          {ICONS[key] || <Check size={12} className="stroke-[2.5]" />}
          <span>{amenityLabel(key)}</span>
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
          +{remaining} more
        </span>
      )}
    </div>
  );
};

export default ParkingAmenityList;
