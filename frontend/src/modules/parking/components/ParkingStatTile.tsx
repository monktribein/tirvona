import React from "react";
import type { LucideIcon } from "lucide-react";

interface ParkingStatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}

const TONES: Record<string, { chip: string; value: string }> = {
  primary: {
    chip: "bg-blue-50 dark:bg-blue-900/30 text-[#F28C28] dark:text-amber-300",
    value: "text-[#0B192C] dark:text-white",
  },
  success: {
    chip: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    chip: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
    value: "text-amber-700 dark:text-amber-300",
  },
  danger: {
    chip: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300",
    value: "text-rose-700 dark:text-rose-300",
  },
  neutral: {
    chip: "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-300",
    value: "text-[#0B192C] dark:text-white",
  },
};

export const ParkingStatTile: React.FC<ParkingStatTileProps> = ({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
}) => {
  const style = TONES[tone] || TONES.primary;

  return (
    <div className="tv-stat">
      <div className="tv-stat-head">
        <span className="tv-stat-label">{label}</span>
        <span className={`tv-stat-icon ${style.chip}`}>
          <Icon size={14} className="stroke-[2.5]" />
        </span>
      </div>
      <p className={`tv-stat-value ${style.value}`}>{value}</p>
      {sub && <p className="tv-stat-hint">{sub}</p>}
    </div>
  );
};

export default ParkingStatTile;
