import React from 'react';

interface SearchResultStatusProps {
  /** Whether the API call is still in progress */
  loading: boolean;
  /** The dynamic destination / search keyword (e.g. "Haridwar") */
  destination: string;
  /** Number of results returned by the API (only meaningful when loading is false) */
  count: number;
  /** Label shown when destination is empty. Defaults to "all locations" */
  fallbackLabel?: string;
}

/**
 * Reusable search-result status bar.
 *
 * 3 states:
 *  1. loading  → "Searching verified Ashrams in {destination}..."
 *  2. results  → "Found {count} verified Ashrams matching {destination}"
 *  3. empty    → "No verified Ashrams found matching {destination}"
 */
export const SearchResultStatus: React.FC<SearchResultStatusProps> = ({
  loading,
  destination,
  count,
  fallbackLabel = 'all locations',
}) => {
  const displayLabel = destination ? `"${destination}"` : fallbackLabel;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
        <div className="text-xs font-bold text-gray-500">
          Searching verified Ashrams in{' '}
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

  /* ── Results found ── */
  if (count > 0) {
    return (
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
        <div className="text-xs font-bold text-gray-500">
          Found{' '}
          <span className="text-[#0A4DA6] font-extrabold">{count} verified Ashrams</span>{' '}
          matching {displayLabel}
        </div>
      </div>
    );
  }

  /* ── No results ── */
  return (
    <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 px-5 py-3.5 rounded-[20px] shadow-sm">
      <div className="text-xs font-bold text-gray-500">
        No verified Ashrams found matching{' '}
        <span className="text-[#0A4DA6] font-extrabold">{displayLabel}</span>
      </div>
    </div>
  );
};

export default SearchResultStatus;
