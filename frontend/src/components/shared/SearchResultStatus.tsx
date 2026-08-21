import React from "react";

interface SearchResultStatusProps {
  loading: boolean;
  destination: string;
  count: number;
  fallbackLabel?: string;
}

export const SearchResultStatus: React.FC<SearchResultStatusProps> = ({
  loading,
  destination,
  count,
  fallbackLabel = "all locations",
}) => {
  const displayLabel = destination ? `"${destination}"` : fallbackLabel;

  if (loading) {
    return (
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
        <div className="text-xs font-bold text-gray-500">
          Finding Tirvona Verified Ashrams in{" "}
          <span className="text-[#0A4DA6] font-extrabold">{displayLabel}</span>
          <span className="inline-flex ml-1">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </div>
      </div>
    );
  }

  if (count > 0) {
    return (
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
        <div className="text-xs font-bold text-gray-500">
          Found{" "}
          <span className="text-[#0A4DA6] font-extrabold">
            {count} Tirvona Verified Ashrams
          </span>{" "}
          matching {displayLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
      <div className="text-xs font-bold text-gray-500">
        No Tirvona Verified Ashrams found matching{" "}
        <span className="text-[#0A4DA6] font-extrabold">{displayLabel}</span>
      </div>
    </div>
  );
};

export default SearchResultStatus;
