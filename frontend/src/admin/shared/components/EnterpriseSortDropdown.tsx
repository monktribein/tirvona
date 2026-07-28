import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export interface EnterpriseSortOption {
  label: string;
  value: string;
}

interface EnterpriseSortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: EnterpriseSortOption[];
  className?: string;
}

const defaultOptions: EnterpriseSortOption[] = [
  { label: 'Top Rated', value: 'rating' },
  { label: 'Most Popular', value: 'popularity' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low → High', value: 'price_low' },
  { label: 'Price: High → Low', value: 'price_high' },
];

export const EnterpriseSortDropdown: React.FC<EnterpriseSortDropdownProps> = ({
  value,
  onChange,
  options = defaultOptions,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center text-xs font-bold ${className}`}>
      <ArrowUpDown className="absolute left-3 text-[#0A4DA6] pointer-events-none" size={14} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] cursor-pointer appearance-none shadow-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default EnterpriseSortDropdown;
