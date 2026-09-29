/* oxlint-disable react/only-export-components -- small shared kit for the seller and admin marketplace consoles */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, Loader2, PackageSearch, RefreshCw, ShieldAlert } from "lucide-react";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCurrency } from "../../utils/format";
import { humanizeLabel } from "../../utils/labels";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";

/** Backend money is INR; never convert it with the viewer's display currency. */
export const inr = (amount: unknown) => formatCurrency(Number(amount ?? 0), "INR");

export const shortDate = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const dateTime = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export type LoadState = "loading" | "ready" | "error" | "forbidden" | "missing";

/**
 * Loads one API call and tracks loading / error / 403 / 404 separately so
 * every console screen can show an honest state instead of empty numbers.
 */
export function useRemote<T>(fetcher: () => Promise<{ data: any }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number }>({ total: 0, page: 1, limit: 20 });
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const ticket = useRef(0);

  const reload = useCallback(async () => {
    const id = ++ticket.current;
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      const res = await fetcher();
      if (id !== ticket.current) return;
      setData((res.data?.data ?? null) as T);
      setMeta({
        total: Number(res.data?.total ?? 0),
        page: Number(res.data?.page ?? 1),
        limit: Number(res.data?.limit ?? 20),
      });
      setState("ready");
    } catch (err) {
      if (id !== ticket.current) return;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setError(getErrorMessage(err, "Could not load this page."));
      setState(status === 403 ? "forbidden" : status === 404 ? "missing" : "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, meta, state, error, reload, setData };
}

/** Full-panel state for loading, errors, 403 and empty lists. */
export const PanelState: React.FC<{
  state: LoadState;
  error?: string;
  onRetry?: () => void;
  missingText?: string;
}> = ({ state, error, onRetry, missingText }) => {
  if (state === "loading")
    return (
      <div className="py-16 flex justify-center" role="status" aria-live="polite">
        <Loader2 size={24} className="animate-spin text-[#F28C28]" />
        <span className="sr-only">Loading</span>
      </div>
    );
  if (state === "forbidden")
    return (
      <Empty
        icon={<ShieldAlert size={28} className="text-rose-400" />}
        title="You do not have access to this"
        text="Your account's permissions do not include this section. Ask a Super Admin if you need it."
      />
    );
  if (state === "missing")
    return <Empty icon={<PackageSearch size={28} className="text-gray-300" />} title="Not found" text={missingText ?? error} />;
  if (state === "error")
    return (
      <Empty
        icon={<AlertTriangle size={28} className="text-amber-500" />}
        title="This could not be loaded"
        text={error}
        action={
          onRetry && (
            <EnterpriseButton variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={onRetry}>
              Try again
            </EnterpriseButton>
          )
        }
      />
    );
  return null;
};

export const Empty: React.FC<{ icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  text,
  action,
}) => (
  <div className="py-14 px-4 text-center flex flex-col items-center gap-2.5">
    {icon ?? <PackageSearch size={28} className="text-gray-300" />}
    <p className="text-sm font-black text-[#0B192C] dark:text-white">{title}</p>
    {text && <p className="text-xs text-gray-500 max-w-md leading-relaxed">{text}</p>}
    {action}
  </div>
);

export const Panel: React.FC<{
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ title, actions, children, className = "", padded = true }) => (
  <section
    className={`bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm ${className}`}
  >
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800">
        {title && <h2 className="text-sm font-black text-[#0B192C] dark:text-white">{title}</h2>}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
  </section>
);

const TONES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  saffron: "bg-orange-50 text-[#C2410C] border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
  blue: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
  gray: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700",
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: "green", approved: "green", verified: "green", delivered: "green", paid: "green", published: "green", completed: "green", available: "green", in_stock: "green",
  pending: "amber", pending_verification: "amber", under_review: "amber", requested: "amber", pending_payment: "amber", return_requested: "amber", low_stock: "amber", not_submitted: "gray",
  confirmed: "saffron", processing: "saffron", partially_fulfilled: "saffron",
  shipped: "blue",
  rejected: "red", suspended: "red", cancelled: "red", failed: "red", out_of_stock: "red", disabled: "red",
  draft: "gray", inactive: "gray", archived: "gray", deactivated: "gray", expired: "gray", refunded: "gray", returned: "gray", hidden: "gray", unsettled: "gray", reversed: "gray",
};

/** Status chip; the colour follows the status name so every console agrees. */
export const Pill: React.FC<{ status?: string; label?: string; tone?: keyof typeof TONES }> = ({ status = "", label, tone }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black whitespace-nowrap ${
      TONES[tone ?? STATUS_TONE[status] ?? "gray"]
    }`}
  >
    {label ?? humanizeLabel(status)}
  </span>
);

/** Number card. With `to` the whole card opens the matching detail list. */
export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: "warn" | "ok"; to?: string }> = ({
  label,
  value,
  hint,
  icon,
  tone,
  to,
}) => {
  const body = (
  <div className={`h-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] p-4 shadow-sm space-y-1.5 min-w-0 ${to ? "transition-all hover:border-[#F28C28]/60 hover:shadow-md hover:-translate-y-0.5" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold truncate">{label}</span>
      {icon && <span className="text-[#F28C28] shrink-0">{icon}</span>}
    </div>
    <div
      className={`text-lg sm:text-xl font-black tracking-tight tabular-nums truncate ${
        tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "text-[#0B192C] dark:text-white"
      }`}
    >
      {value}
    </div>
    {hint && <p className="text-[10px] text-gray-400 leading-snug">{hint}</p>}
  </div>
  );
  return to ? (
    <Link to={to} aria-label={`${label}: open details`} className="block rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50">
      {body}
    </Link>
  ) : (
    body
  );
};

export const Pager: React.FC<{ page: number; limit: number; total: number; onPage: (p: number) => void }> = ({
  page,
  limit,
  total,
  onPage,
}) => {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs font-bold text-gray-500">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <EnterpriseButton variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </EnterpriseButton>
        <EnterpriseButton variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </EnterpriseButton>
      </div>
    </div>
  );
};

/** Horizontal filter chips (status tabs) that wrap on phones. */
export const Chips: React.FC<{ value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }> = ({
  value,
  options,
  onChange,
}) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-all border ${
          value === o.value
            ? "bg-[#F28C28] border-[#F28C28] text-white"
            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#F28C28]"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/60 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F28C28]/30 focus:border-[#F28C28] transition-all disabled:opacity-60";

export const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  required,
  hint,
  children,
  className = "",
}) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-[11px] font-extrabold text-gray-700 dark:text-gray-300">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
    {hint && <span className="block text-[10px] text-gray-400 leading-snug">{hint}</span>}
  </label>
);

/**
 * Responsive list: a table from `md` up, stacked cards on phones, so wide
 * console tables never just shrink.
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
}: {
  rows: T[];
  columns: Array<{ header: string; cell: (row: T) => React.ReactNode; className?: string; hideOnMobile?: boolean }>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-800">
              {columns.map((c) => (
                <th key={c.header} className={`py-2.5 px-3 font-black ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-orange-50/40 dark:hover:bg-slate-900/60" : ""}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`py-3 px-3 align-middle text-[#0B192C] dark:text-gray-200 ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2.5">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-2xl border border-gray-100 dark:border-slate-800 p-3.5 space-y-1.5 ${onRowClick ? "cursor-pointer active:bg-orange-50/40" : ""}`}
          >
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((c) => (
                <div key={c.header} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-[10px] uppercase tracking-wider font-black text-gray-400 pt-0.5 shrink-0">{c.header}</span>
                  <span className="text-right min-w-0 text-[#0B192C] dark:text-gray-200">{c.cell(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Runs a mutation with a busy flag. The API client already toasts backend
 * errors; `success` is toasted only after the backend accepted the change.
 */
export function useAction() {
  const [busy, setBusy] = useState("");
  const run = useCallback(async (key: string, action: () => Promise<unknown>, after?: () => unknown, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      await after?.();
      return true;
    } catch {
      return false;
    } finally {
      setBusy("");
    }
  }, []);
  return { busy, run };
}

/** Asks for a required reason (reject / suspend / cancel). Returns null when dismissed. */
export const askReason = (question: string, minLength = 3): string | null => {
  const value = window.prompt(question)?.trim() ?? "";
  if (!value) return null;
  if (value.length < minLength) {
    window.alert(`Please enter at least ${minLength} characters.`);
    return null;
  }
  return value;
};
