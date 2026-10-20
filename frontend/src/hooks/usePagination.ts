import { useEffect, useMemo, useState } from "react";

export interface PaginationState<T> {
  pageItems: T[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  total: number;
  pageSize: number;
}

/**
 * Client-side pagination for lists that are already fetched in full.
 * The page resets to 1 whenever `resetKey` changes (filters/search) and is
 * clamped if the list shrinks.
 */
export function usePagination<T>(
  items: readonly T[] | null | undefined,
  pageSize = 12,
  resetKey: unknown = "",
): PaginationState<T> {
  const list = items ?? [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPageState] = useState(1);

  useEffect(() => {
    setPageState(1);
  }, [resetKey, pageSize]);

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, safePage, pageSize],
  );

  const setPage = (next: number) =>
    setPageState(Math.min(Math.max(1, next), totalPages));

  return { pageItems, page: safePage, setPage, totalPages, total, pageSize };
}
