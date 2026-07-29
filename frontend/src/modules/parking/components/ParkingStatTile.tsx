import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ParkingStatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

// Dashboard stat tile. Mirrors the shape of the platform's EnterpriseStatsCard
// while carrying the parking module's own tone set.

const TONES: Record<string, { chip: string; value: string }> = {
  primary: {
    chip: 'bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-300',
    value: 'text-[#0B192C] dark:text-white',
  },
  success: {
    chip: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    chip: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
    value: 'text-amber-700 dark:text-amber-300',
  },
  danger: {
    chip: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300',
    value: 'text-rose-700 dark:text-rose-300',
  },
  neutral: {
    chip: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-300',
    value: 'text-[#0B192C] dark:text-white',
  },
};

export const ParkingStatTile: React.FC<ParkingStatTileProps> = ({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'primary',
}) => {
  const style = TONES[tone] || TONES.primary;

  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 space-y-2 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 line-clamp-1">{label}</span>
        <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${style.chip}`}>
          <Icon size={14} className="stroke-[2.5]" />
        </span>
      </div>
      <p className={`text-xl font-black leading-none ${style.value}`}>{value}</p>
      {sub && <p className="text-[10px] font-semibold text-gray-400 line-clamp-1">{sub}</p>}
    </div>
  );
};

export default ParkingStatTile;
