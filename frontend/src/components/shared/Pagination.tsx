import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePagination, type PaginationState } from "../../hooks/usePagination";

type Props = Pick<
  PaginationState<unknown>,
  "page" | "setPage" | "totalPages" | "total" | "pageSize"
> & {
  className?: string;
  /** Scroll the viewport to this element's top when the page changes. */
  scrollToRef?: React.RefObject<HTMLElement | null>;
};

const pageWindow = (page: number, totalPages: number): (number | "…")[] => {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
};

export const Pagination: React.FC<Props> = ({
  page,
  setPage,
  totalPages,
  total,
  pageSize,
  className = "",
  scrollToRef,
}) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const go = (next: number) => {
    setPage(next);
    scrollToRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const btn =
    "min-w-9 h-9 px-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#F28C28] transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs text-gray-500 dark:text-gray-400 ${className}`}
    >
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${
                p === page
                  ? "!bg-[#F28C28] !border-[#F28C28] text-white"
                  : "text-gray-700 dark:text-gray-200"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;

interface PaginatedProps<T> {
  items: readonly T[] | null | undefined;
  pageSize?: number;
  /** Change this (filters, search) to jump back to page 1. */
  resetKey?: unknown;
  /** Receives the current page slice and the absolute index of its first item. */
  children: (pageItems: T[], offset: number) => React.ReactNode;
  className?: string;
}

/** Render-prop wrapper: paginates `items` and shows controls beneath. */
export function Paginated<T>({
  items,
  pageSize = 12,
  resetKey,
  children,
  className,
}: PaginatedProps<T>) {
  const state = usePagination(items, pageSize, resetKey);
  const topRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={topRef} className={className} style={{ scrollMarginTop: 96 }}>
      {children(state.pageItems, (state.page - 1) * state.pageSize)}
      <Pagination {...state} scrollToRef={topRef} />
    </div>
  );
}
