import { useCallback, useEffect, useRef, useState } from "react";
import { ashramService } from "../services";

/**
 * Sentinel for the "All Ashrams" filter. Never sent to the API — it only tells
 * a page to gather every managed property into one view. Matches the value
 * already used by the owner guest list, so the option reads the same
 * everywhere.
 */
export const ALL_ASHRAMS = "all";

const readStored = (key: string): string => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    // Private-mode / blocked storage. The filter falls back to its default.
    return "";
  }
};

export interface UseAshramSelectionOptions {
  /** Where to remember the filter, so a reload lands where the admin left. */
  storageKey: string;
  /** Whether `ALL_ASHRAMS` is an offered — and therefore valid — choice. */
  allowAll?: boolean;
  /** Reported rather than swallowed: each page words its own toast. */
  onError?: (error: unknown) => void;
}

/**
 * Owns the "which ashram am I looking at" question for every management page.
 *
 * Written because three pages each re-derived it and each got it wrong in the
 * same two ways: the selection was reset to `list[0]` on every re-fetch — so a
 * toast could silently move an admin to another property mid-edit — and it was
 * never persisted, so a reload dropped them onto the first ashram, which is
 * routinely an empty one while their rooms sit elsewhere.
 *
 * The selection resolves in a fixed order: whatever is already on screen, then
 * the remembered choice, then the default. Every candidate is validated against
 * the freshly fetched list, so an ashram that has since been removed — or a
 * remembered "all" on an account now down to one property — falls back cleanly
 * instead of leaving the page pointed at nothing.
 */
export function useAshramSelection({
  storageKey,
  allowAll = false,
  onError,
}: UseAshramSelectionOptions) {
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [selectedAshramId, setSelectedAshramId] = useState("");
  const [loadingAshrams, setLoadingAshrams] = useState(true);

  // Held in a ref so a caller passing an inline arrow cannot rebuild `reload`
  // on every render and re-trigger the mount effect — the exact loop that made
  // the selection jump in the first place.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const reload = useCallback(async () => {
    setLoadingAshrams(true);
    try {
      const res = await ashramService.myListings();
      const list =
        res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
      setAshrams(list);

      if (list.length === 0) {
        setSelectedAshramId("");
        return;
      }

      const isValid = (value: string) =>
        value === ALL_ASHRAMS
          ? allowAll && list.length > 1
          : !!value && list.some((a: any) => a._id === value);

      setSelectedAshramId((current) => {
        if (isValid(current)) return current;
        const stored = readStored(storageKey);
        if (isValid(stored)) return stored;
        // Prefer showing everything over one arbitrary property, which is how
        // an admin ended up staring at an empty ashram on load.
        return allowAll && list.length > 1 ? ALL_ASHRAMS : list[0]._id;
      });
    } catch (error) {
      console.error("Fetch ashrams error:", error);
      setAshrams([]);
      setSelectedAshramId("");
      onErrorRef.current?.(error);
    } finally {
      setLoadingAshrams(false);
    }
  }, [storageKey, allowAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedAshramId) return;
    try {
      localStorage.setItem(storageKey, selectedAshramId);
    } catch {
      // Storage unavailable — the filter just resets on the next reload.
    }
  }, [selectedAshramId, storageKey]);

  /** The properties a fetch should actually cover for the current filter. */
  const targetAshrams: any[] =
    selectedAshramId === ALL_ASHRAMS
      ? ashrams
      : ashrams.filter((a: any) => a._id === selectedAshramId);

  return {
    ashrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    reload,
    targetAshrams,
    isAllSelected: selectedAshramId === ALL_ASHRAMS,
  };
}
