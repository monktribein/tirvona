import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { searchService } from "../../../services";
import {
  Building,
  Car,
  ClipboardList,
  CornerDownLeft,
  LayoutDashboard,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";

export interface SearchableLink {
  label: string;
  path: string;
  group: string;
}

interface RemoteHit {
  type: "ashram" | "user" | "booking" | "parking";
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  url: string;
}

interface Row {
  key: string;
  kind: "page" | RemoteHit["type"];
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
}

const SECTION: Record<Row["kind"], { label: string; icon: React.ReactNode }> = {
  page: { label: "Pages", icon: <LayoutDashboard size={13} /> },
  ashram: { label: "Ashrams", icon: <Building size={13} /> },
  user: { label: "Users", icon: <Users size={13} /> },
  booking: { label: "Bookings", icon: <ClipboardList size={13} /> },
  parking: { label: "Parking", icon: <Car size={13} /> },
};

const SECTION_ORDER: Row["kind"][] = [
  "page",
  "ashram",
  "user",
  "booking",
  "parking",
];

const MIN_QUERY = 2;

/**
 * Global search for the admin console.
 *
 * Two sources, deliberately: console pages are matched locally from the same
 * nav tree the sidebar renders, so navigation is instant and works offline,
 * while records come from `/search`, which decides per entity what this caller
 * may see. Both land in one keyboard-navigable list.
 */
export const GlobalSearch: React.FC<{ links: SearchableLink[] }> = ({
  links,
}) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [remote, setRemote] = useState<RemoteHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce so a typed word costs one request, not one per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    if (debounced.length < MIN_QUERY) {
      setRemote([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    searchService
      .global(debounced, 5, controller.signal)
      .then((res) => {
        setRemote(res.data?.data?.results ?? []);
        setFailed(false);
      })
      .catch((error) => {
        // An aborted request is the previous keystroke being superseded, not a
        // failure — surfacing it would flash an error on every character.
        if (axios.isCancel(error) || controller.signal.aborted) return;
        setRemote([]);
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced]);

  const pageRows = useMemo<Row[]>(() => {
    const query = term.trim().toLowerCase();
    if (query.length < 1) return [];
    return links
      .filter(
        (link) =>
          link.label.toLowerCase().includes(query) ||
          link.group.toLowerCase().includes(query),
      )
      .slice(0, 6)
      .map((link) => ({
        key: `page:${link.path}:${link.label}`,
        kind: "page" as const,
        title: link.label,
        subtitle: link.group,
        url: link.path,
      }));
  }, [links, term]);

  const rows = useMemo<Row[]>(() => {
    const remoteRows: Row[] = remote.map((hit) => ({
      key: `${hit.type}:${hit.id}`,
      kind: hit.type,
      title: hit.title,
      subtitle: hit.subtitle,
      badge: hit.badge,
      url: hit.url,
    }));
    const all = [...pageRows, ...remoteRows];
    // Grouped for display but kept as one flat list, so arrow keys move through
    // sections without the caller tracking two indexes.
    return SECTION_ORDER.flatMap((kind) =>
      all.filter((row) => row.kind === kind),
    );
  }, [pageRows, remote]);

  useEffect(() => setActive(0), [rows.length, debounced]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
  }, []);

  const go = useCallback(
    (row: Row) => {
      close();
      setTerm("");
      navigate(row.url);
    },
    [close, navigate],
  );

  // Ctrl/Cmd+K focuses the bar from anywhere in the console.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [close]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
      inputRef.current?.blur();
      return;
    }
    if (!rows.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % rows.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) go(row);
    }
  };

  const showPanel = open && term.trim().length > 0;
  const searching = loading && debounced.length >= MIN_QUERY;

  return (
    <div ref={containerRef} className="relative w-full">
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A4DA6] pointer-events-none"
        size={16}
      />
      <input
        ref={inputRef}
        type="text"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search pages, ashrams, bookings, users..."
        aria-label="Global search"
        aria-expanded={showPanel}
        role="combobox"
        aria-controls="global-search-results"
        className="w-full pl-10 pr-16 py-2.5 bg-[#F8FAFC] dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-full text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0A4DA6] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0A4DA6]/15 transition-all shadow-inner"
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {searching && (
          <Loader2 size={13} className="animate-spin text-[#0A4DA6]" />
        )}
        {term ? (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded border border-blue-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-[9px] font-bold text-slate-400">
            Ctrl K
          </kbd>
        )}
      </div>

      {/* `overscroll-contain` on the panel stops scroll chaining: without it,
          reaching the end of the results hands the remaining wheel delta to the
          dashboard behind, so the page lurches while the reader is still inside
          the list. It also suppresses pull-to-refresh on touch. */}
      {showPanel && (
        <div
          id="global-search-results"
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 max-h-[420px] overflow-y-auto overscroll-contain bg-white dark:bg-[#0B192C] border border-blue-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2"
        >
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                {term.trim().length < MIN_QUERY
                  ? `Type at least ${MIN_QUERY} characters`
                  : searching
                    ? "Searching..."
                    : "No matches found"}
              </p>
              {failed && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Record search is unavailable right now — page results still
                  work.
                </p>
              )}
              {!failed && !searching && term.trim().length >= MIN_QUERY && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Nothing matched “{term.trim()}” in the records you can access.
                </p>
              )}
            </div>
          ) : (
            SECTION_ORDER.map((kind) => {
              const section = rows.filter((row) => row.kind === kind);
              if (!section.length) return null;
              return (
                <div key={kind} className="px-2 pb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-black tracking-wider text-slate-400">
                    {SECTION[kind].icon}
                    {SECTION[kind].label}
                  </div>
                  {section.map((row) => {
                    const index = rows.indexOf(row);
                    const isActive = index === active;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        data-index={index}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(row)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isActive
                            ? "bg-[#EBF2FA] dark:bg-slate-800"
                            : "hover:bg-[#F5F8FC] dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-[#0B192C] dark:text-white truncate">
                            {row.title}
                          </span>
                          {row.subtitle && (
                            <span className="block text-[11px] text-slate-500 truncate">
                              {row.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {row.badge && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[9px] font-black text-slate-600 dark:text-slate-200">
                              {row.badge}
                            </span>
                          )}
                          {isActive && (
                            <CornerDownLeft size={12} className="text-[#0A4DA6]" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between px-4 pt-2 mt-1 border-t border-blue-50 dark:border-slate-800 text-[10px] text-slate-400 font-semibold">
              <span>
                {rows.length} result{rows.length === 1 ? "" : "s"}
              </span>
              <span className="hidden sm:block">↑↓ navigate · ↵ open · esc close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
