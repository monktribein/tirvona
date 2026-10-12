/**
 * Shared UI kit for the Pandit & Acharya experience (public, provider and admin screens).
 *
 * Brand (src/index.css): navy #0B192C for structure, saffron #F28C28 (hover #D97706, text #B45309, light #FFF4E5) for actions and accents.
 * Everything here is presentational: no data fetching and no business rules.
 */
import React, { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Rupees from minor units (paise). Returns null when the server did not send an amount. */
export const formatMinor = (minor?: number | null, currency = "INR") =>
  minor == null
    ? null
    : new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(
        minor / 100,
      );

// ─────────────────────────────────────────────────────────────── Buttons

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors select-none " +
  "min-h-[44px] px-5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-[#F28C28] dark:focus-visible:ring-offset-[#071322] disabled:opacity-50 disabled:cursor-not-allowed " +
  "active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[#F28C28] text-white hover:bg-[#D97706] active:bg-[#B45309] shadow-sm shadow-[#F28C28]/20",
  secondary: "bg-[#0B192C] text-white hover:bg-[#12284a] dark:bg-slate-700 dark:hover:bg-slate-600",
  outline:
    "border border-gray-300 dark:border-slate-600 text-[#0B192C] dark:text-gray-100 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800",
  ghost: "text-[#B45309] dark:text-[#FFA44D] hover:bg-[#FFF4E5] dark:hover:bg-slate-800",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
};

export const buttonClass = (variant: ButtonVariant = "primary", extra?: string) =>
  cx(BUTTON_BASE, BUTTON_VARIANTS[variant], extra);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }
> = ({ variant = "primary", loading, className, children, disabled, type = "button", ...rest }) => (
  <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, className)} {...rest}>
    {loading && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    {children}
  </button>
);

export const LinkButton: React.FC<{
  to: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}> = ({ to, variant = "primary", className, children }) => (
  <Link to={to} className={buttonClass(variant, className)}>
    {children}
  </Link>
);

// ───────────────────────────────────────────────────────────── Status badge

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  danger: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  neutral: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700",
  accent: "bg-[#FFF4E5] text-[#92400E] border-[#FFC88A] dark:bg-[#F28C28]/15 dark:text-[#FFC88A] dark:border-[#F28C28]/40",
};

const TONE_ICON: Record<Tone, React.ReactNode> = {
  success: <CheckCircle2 size={12} aria-hidden="true" />,
  warning: <Clock size={12} aria-hidden="true" />,
  danger: <XCircle size={12} aria-hidden="true" />,
  info: <Clock size={12} aria-hidden="true" />,
  neutral: <Clock size={12} aria-hidden="true" />,
  accent: <ShieldCheck size={12} aria-hidden="true" />,
};

/** Real server statuses (providers, bookings, offerings, verification cases, rituals, consultations). */
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  // provider
  ONBOARDING: { label: "Onboarding", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  PAUSED: { label: "Paused", tone: "neutral" },
  // verification
  UNVERIFIED: { label: "Not verified", tone: "neutral" },
  IDENTITY_VERIFIED: { label: "Identity verified", tone: "success" },
  PROFESSIONAL_VERIFIED: { label: "Lineage verified", tone: "success" },
  INSTITUTION_VERIFIED: { label: "Institution authorized", tone: "success" },
  TIRVONA_TRUSTED: { label: "Tirvona trusted", tone: "accent" },
  OPEN: { label: "Open", tone: "info" },
  IN_REVIEW: { label: "In review", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  // rituals
  DRAFT: { label: "Draft", tone: "neutral" },
  DOMAIN_REVIEW: { label: "In review", tone: "info" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
  // bookings
  PAYMENT_PENDING: { label: "Payment pending", tone: "warning" },
  PAYMENT_FAILED: { label: "Payment failed", tone: "danger" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  PROVIDER_ACCEPTED: { label: "Accepted", tone: "success" },
  PREPARATION_IN_PROGRESS: { label: "Preparing", tone: "info" },
  READY_FOR_FULFILMENT: { label: "Ready", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  SETTLEMENT_PENDING: { label: "Settlement pending", tone: "warning" },
  CLOSED: { label: "Closed", tone: "neutral" },
  CANCELLED_BY_CUSTOMER: { label: "Cancelled by customer", tone: "danger" },
  CANCELLED_BY_PROVIDER: { label: "Cancelled by provider", tone: "danger" },
  CANCELLED_BY_OPS: { label: "Cancelled by Tirvona", tone: "danger" },
  DISPUTED: { label: "Disputed", tone: "danger" },
  // consultations
  REQUESTED: { label: "Requested", tone: "warning" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  // zoom
  CREATING: { label: "Creating", tone: "warning" },
  CREATED: { label: "Ready", tone: "success" },
  STARTED: { label: "Live", tone: "success" },
  ENDED: { label: "Ended", tone: "neutral" },
  // wallet
  PENDING: { label: "On hold", tone: "warning" },
  AVAILABLE: { label: "Available", tone: "success" },
  REVERSED: { label: "Refunded", tone: "danger" },
  POSTED: { label: "Posted", tone: "neutral" },
  PROCESSING: { label: "Processing", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

export const StatusBadge: React.FC<{ status?: string | null; label?: string; tone?: Tone; className?: string }> = ({
  status,
  label,
  tone,
  className,
}) => {
  const meta = status ? STATUS_META[status] : undefined;
  const finalTone = tone ?? meta?.tone ?? "neutral";
  const text = label ?? meta?.label ?? (status ? titleCase(status) : "Unknown");
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-5 whitespace-nowrap",
        TONE_CLASS[finalTone],
        className,
      )}
    >
      {TONE_ICON[finalTone]}
      {text}
    </span>
  );
};

export const statusLabel = (status?: string | null) =>
  (status && STATUS_META[status]?.label) || (status ? titleCase(status) : "Unknown");

// ─────────────────────────────────────────────────────── Page structure

export const PageContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  // Same frame as the super admin dashboard: the layout supplies the page padding, content is full width.
  <div className={cx("mx-auto w-full space-y-5 sm:space-y-6", className)}>{children}</div>
);

export const PageHeader: React.FC<{
  eyebrow?: string;
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ eyebrow, icon, title, description, actions }) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F28C28]/15 bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-extrabold tracking-wide text-gray-500 dark:text-gray-400">{eyebrow}</p>}
        <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#0B192C] dark:text-white break-words">{title}</h1>
        {description && <p className="mt-0.5 max-w-2xl text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
  </header>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; as?: "div" | "section" | "article" }> = ({
  children,
  className,
  as: Tag = "div",
}) => (
  <Tag className={cx("rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0B192C]", className)}>
    {children}
  </Tag>
);

export const SectionCard: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className }) => (
  <Card as="section" className={cx("p-4 sm:p-6", className)}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-[#0B192C] dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {actions}
    </div>
    {children}
  </Card>
);

export const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  to?: string;
  cta?: string;
  action?: React.ReactNode;
}> = ({ icon, label, value, hint, to, cta, action }) => {
  // Compact tile, same proportions as the super admin dashboard's stat tiles. With `to` the whole tile is the link.
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-extrabold tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="mt-1 text-xl font-black tabular-nums text-[#0B192C] dark:text-white break-words">{value}</div>
      {hint && <div className="mt-1 text-[11px] font-semibold text-gray-400">{hint}</div>}
      {to && cta && (
        <span className="mt-auto inline-flex items-center gap-0.5 pt-2.5 text-[11px] font-bold text-[#B45309] dark:text-[#FFA44D]">
          {cta}
          <ChevronRight size={12} aria-hidden="true" />
        </span>
      )}
    </>
  );
  const frame =
    "flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0B192C]";
  if (to && !action)
    return (
      <Link
        to={to}
        className={cx(
          frame,
          "transition-colors hover:border-[#F28C28]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
        )}
      >
        {body}
      </Link>
    );
  return (
    <div className={frame}>
      {body}
      {action}
    </div>
  );
};

/** Small icon + label + value chip (the super admin dashboard's QuickPill). */
export const QuickPill: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; to?: string; tone?: string }> = ({
  icon,
  label,
  value,
  to,
  tone = "bg-[#F28C28]/10 text-[#F28C28]",
}) => {
  const body = (
    <>
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold leading-tight text-gray-500">{label}</span>
        <span className="block truncate text-xs font-black tabular-nums text-[#0B192C] dark:text-white">{value}</span>
      </span>
    </>
  );
  const frame = "flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900";
  return to ? (
    <Link to={to} className={cx(frame, "transition-colors hover:border-[#F28C28]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]")}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
};

// ───────────────────────────────────────── Empty / error / loading states

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center px-4 py-8 text-center">
    {icon && (
      <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gray-50 text-gray-300 dark:bg-slate-900 dark:text-slate-600" aria-hidden="true">
        {icon}
      </span>
    )}
    <h3 className="text-xs font-bold text-gray-600 dark:text-gray-300">{title}</h3>
    {description && <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-gray-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorNotice: React.FC<{ message: string; onRetry?: () => void; className?: string }> = ({ message, onRetry, className }) => (
  <div
    role="alert"
    className={cx(
      "flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200",
      className,
    )}
  >
    <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1 break-words">{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="shrink-0 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded">
        Retry
      </button>
    )}
  </div>
);

export const Notice: React.FC<{ tone?: "info" | "warning" | "success"; children: React.ReactNode; className?: string }> = ({
  tone = "info",
  children,
  className,
}) => {
  const toneClass = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
  }[tone];
  return (
    <div role="status" className={cx("flex items-start gap-2.5 rounded-xl border p-4 text-sm", toneClass, className)}>
      {tone === "success" ? <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cx("animate-pulse motion-reduce:animate-none rounded-xl bg-gray-200/80 dark:bg-slate-800", className)} />
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = "Loading" }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
    <Loader2 className="animate-spin motion-reduce:animate-none text-[#B45309]" size={20} aria-hidden="true" />
    <span>{label}…</span>
  </div>
);

// ───────────────────────────────────────────────────────────────── Forms

export const inputClass =
  "w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-[#F28C28] focus:outline-none focus:ring-2 focus:ring-[#F28C28]/30 disabled:bg-gray-50 disabled:text-gray-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 aria-[invalid=true]:border-rose-500";

/**
 * Label + control + helper/error text. The control is cloned so its id, aria-describedby and aria-invalid
 * always match the label, whichever input it is.
 */
export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactElement<any>;
}> = ({ label, required, hint, error, className, children }) => {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-200">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || children.props.required,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
};

export const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string; description?: string }> = ({
  checked,
  onChange,
  label,
  description,
}) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2 motion-reduce:transition-none",
          checked ? "bg-[#F28C28]" : "bg-gray-300 dark:bg-slate-600",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all motion-reduce:transition-none",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
};

// ───────────────────────────────────────────────── Modal / drawer / confirm

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: role=dialog, labelled, Escape closes, focus is trapped and restored, page scroll is locked.
 * On phones it is a bottom sheet that never exceeds the viewport; from `sm` up it is a centred dialog.
 */
export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  /** "right" renders a side drawer on larger screens (used for mobile filters). */
  variant?: "dialog" | "drawer";
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  /** Fixed-height panel (chat): fills the phone screen, a tall dialog on larger screens. */
  fullHeight?: boolean;
  /** Content area without padding, for layouts that manage their own (chat). */
  flush?: boolean;
  /** Extra content in the header, next to the title. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onClose, title, description, size = "md", variant = "dialog", footer, closeOnBackdrop = true, fullHeight, flush, headerExtra, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const width = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size];
  return (
    <div className={cx("fixed inset-0 z-[100] flex", variant === "drawer" ? "items-end sm:items-stretch sm:justify-end" : "items-end sm:items-center sm:justify-center")}>
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={closeOnBackdrop ? onClose : undefined} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex w-full flex-col bg-white shadow-2xl outline-none dark:bg-[#0B192C] dark:text-white",
          "max-h-[92dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
          fullHeight && "h-[92dvh] sm:h-[640px]",
          variant === "drawer" ? "sm:max-h-none sm:h-full sm:max-w-sm sm:rounded-none sm:rounded-l-3xl" : cx("sm:rounded-3xl sm:max-h-[90dvh]", width),
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-[#0B192C] dark:text-white break-words">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
            {headerExtra}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:hover:bg-slate-800"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={cx("min-h-0 flex-1 overscroll-contain", flush ? "flex flex-col overflow-hidden" : "overflow-y-auto px-5 py-4")}>{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}> = ({ open, title, description, confirmLabel, tone = "danger", loading, onConfirm, onCancel, children }) => (
  <Modal
    open={open}
    onClose={loading ? () => undefined : onCancel}
    title={title}
    size="sm"
    closeOnBackdrop={!loading}
    footer={
      <>
        <Button variant="outline" onClick={onCancel} disabled={loading} data-autofocus>
          Cancel
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
      <p>{description}</p>
      {children}
    </div>
  </Modal>
);

// ───────────────────────────────────────────────────────────── Pagination

export const Pagination: React.FC<{ page: number; pageCount: number; onChange: (page: number) => void }> = ({ page, pageCount, onChange }) => {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      <Button variant="outline" className="!min-h-[40px]" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
        Previous
      </Button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Page <strong>{page}</strong> of {pageCount}
      </span>
      <Button variant="outline" className="!min-h-[40px]" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
};

// ──────────────────────────────────────────────────────────── Data table

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Shown as the card title on small screens instead of a labelled row. */
  primary?: boolean;
  className?: string;
}

/**
 * A table from `md` up and a list of cards below it, so nothing ever scrolls sideways on a phone.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  actions,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  actions?: (row: T) => React.ReactNode;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-slate-800 dark:text-gray-400">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx("px-4 py-3 font-bold", c.className)}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-gray-50/70 dark:hover:bg-slate-900/50">
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-4 py-3 align-middle", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right align-middle">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-3 p-4">
            <div className="min-w-0 font-bold text-[#0B192C] dark:text-white">{primary.cell(row)}</div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              {rest.map((c) => (
                <React.Fragment key={c.key}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{c.header}</dt>
                  <dd className="min-w-0 break-words text-gray-800 dark:text-gray-200">{c.cell(row)}</dd>
                </React.Fragment>
              ))}
            </dl>
            {actions && <div className="flex flex-wrap gap-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

// ──────────────────────────────────────────────────────────── Misc helpers

export const Avatar: React.FC<{ name: string; src?: string | null; size?: number; className?: string }> = ({ name, src, size = 56, className }) => {
  const [failed, setFailed] = React.useState(false);
  const style = { width: size, height: size };
  if (src && !failed)
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={style}
        className={cx("shrink-0 rounded-2xl border border-gray-100 object-cover dark:border-slate-800", className)}
      />
    );
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.4 }}
      className={cx("flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F28C28] to-[#D97706] font-serif font-black text-white", className)}
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
};
