import React from "react";
import { Search, X } from "lucide-react";

interface SearchBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onSearchChange: (val: string) => void;
  placeholder?: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onSearchChange,
  placeholder = "Search records, modules...",
  className = "",
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search
        className="absolute left-3.5 text-gray-400 pointer-events-none"
        size={14}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none focus:border-[#0A4DA6] transition-colors"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBox;
