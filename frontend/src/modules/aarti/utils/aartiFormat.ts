import type { AartiBookingStatus, AartiFacility } from "../types/aarti.types";
import {
  formatCurrency as formatGlobalCurrency,
  getFormattingLocale,
} from "../../../utils/format";

export const formatCurrency = (amount: number | undefined | null) =>
  formatGlobalCurrency(amount);

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(getFormattingLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** `18:30` rendered the way a devotee reads a schedule board. */
export const formatClock = (clock?: string | null) => {
  if (!clock) return "—";
  const [hours, minutes] = clock.split(":").map(Number);
  if (Number.isNaN(hours)) return clock;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes ?? 0).padStart(2, "0")} ${suffix}`;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const formatSchedule = (daysOfWeek?: number[]) => {
  if (!daysOfWeek?.length) return "Every day";
  if (daysOfWeek.length === 7) return "Every day";
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS[day])
    .join(", ");
};

export const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const FACILITY_LABELS: Record<AartiFacility, string> = {
  seating: "Seating",
  vip_ghat: "VIP Ghat",
  front_row: "Front Row",
  prasad_included: "Prasad Included",
  garland_included: "Garland Included",
  priest_sankalp: "Priest Sankalp",
  photography: "Photography Allowed",
  wheelchair_access: "Wheelchair Access",
  shoe_stand: "Shoe Stand",
  drinking_water: "Drinking Water",
  live_stream: "Live Stream",
};

export const facilityLabel = (value: string) =>
  FACILITY_LABELS[value as AartiFacility] ??
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const STATUS_LABELS: Record<AartiBookingStatus, string> = {
  pending: "Awaiting Payment",
  upcoming: "Confirmed",
  checked_in: "Admitted",
  attended: "Attended",
  cancelled: "Cancelled",
  expired: "Expired",
  no_show: "No Show",
};

export const statusLabel = (status: AartiBookingStatus) =>
  STATUS_LABELS[status] || status;

export const STATUS_STYLES: Record<AartiBookingStatus, string> = {
  pending:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  upcoming:
    "bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  checked_in:
    "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  attended:
    "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  cancelled:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  expired:
    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700",
  no_show:
    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "In Review",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
  archived: "Archived",
};

export const SESSION_STATUS_STYLES: Record<string, string> = {
  draft:
    "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  pending:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  approved:
    "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  rejected:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  suspended:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  archived:
    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700",
};

export const sessionStatusLabel = (status?: string) =>
  SESSION_STATUS_LABELS[status ?? ""] || status || "Draft";

export const sessionStatusStyle = (status?: string) =>
  SESSION_STATUS_STYLES[status ?? ""] || SESSION_STATUS_STYLES.draft;

/** Green while seats are comfortable, amber as they run out, rose when full. */
export const seatsTone = (remaining: number, total: number) => {
  if (remaining <= 0) return "text-rose-600 dark:text-rose-400";
  if (total > 0 && remaining / total <= 0.2)
    return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

/**
 * The gate opens well before the aarti begins, so a devotee's "arrive by" time
 * is what the pass should show — not the ritual's start time.
 */
export const arriveByTime = (
  startsAt?: string | null,
  gateOpensBeforeMinutes = 60,
) => {
  if (!startsAt) return "—";
  return formatTime(
    new Date(new Date(startsAt).getTime() - gateOpensBeforeMinutes * 60_000).toISOString(),
  );
};
