import { useCallback, useEffect, useRef, useState } from "react";
import { ashramService } from "../services";

export const ALL_ASHRAMS = "all";

const readStored = (key: string): string => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

export interface UseAshramSelectionOptions {
  storageKey: string;
  allowAll?: boolean;
  onError?: (error: unknown) => void;
}

export function useAshramSelection({
  storageKey,
  allowAll = false,
  onError,
}: UseAshramSelectionOptions) {
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [selectedAshramId, setSelectedAshramId] = useState("");
  const [loadingAshrams, setLoadingAshrams] = useState(true);

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
    }
  }, [selectedAshramId, storageKey]);

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
