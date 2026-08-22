import type { EventFacility, RegistrationStatus } from "../types/event.types";
import { getFormattingLocale } from "../../../utils/format";

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

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(getFormattingLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** `09:00` rendered the way a devotee reads a notice board. */
export const formatClock = (clock?: string | null) => {
  if (!clock) return "—";
  const [hours, minutes] = clock.split(":").map(Number);
  if (Number.isNaN(hours)) return clock;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes ?? 0).padStart(2, "0")} ${suffix}`;
};

/**
 * A multi-day festival reads better as one range than two full dates, and a
 * single-day event should not repeat itself.
 */
export const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start) return "—";
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return formatDate(start);
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const locale = getFormattingLocale();
  if (sameMonth)
    return `${from.toLocaleDateString(locale, { day: "2-digit" })} – ${to.toLocaleDateString(
      locale,
      { day: "2-digit", month: "short", year: "numeric" },
    )}`;
  return `${from.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  })} – ${to.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
};

export const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const FACILITY_LABELS: Record<EventFacility, string> = {
  seating: "Seating",
  prasad: "Prasad",
  bhandara: "Bhandara",
  parking: "Parking",
  drinking_water: "Drinking Water",
  medical_camp: "Medical Camp",
  shoe_stand: "Shoe Stand",
  wheelchair_access: "Wheelchair Access",
  cloak_room: "Cloak Room",
  live_stream: "Live Stream",
  photography: "Photography Allowed",
  volunteer_support: "Volunteer Support",
};

export const facilityLabel = (value: string) =>
  FACILITY_LABELS[value as EventFacility] ??
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  confirmed: "Confirmed",
  checked_in: "Admitted",
  attended: "Attended",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export const statusLabel = (status: RegistrationStatus) =>
  STATUS_LABELS[status] || status;

export const STATUS_STYLES: Record<RegistrationStatus, string> = {
  confirmed:
    "bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  checked_in:
    "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  attended:
    "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  cancelled:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  no_show:
    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700",
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "In Review",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
  archived: "Archived",
};

export const LISTING_STATUS_STYLES: Record<string, string> = {
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

export const listingStatusLabel = (status?: string) =>
  LISTING_STATUS_LABELS[status ?? ""] || status || "Draft";

export const listingStatusStyle = (status?: string) =>
  LISTING_STATUS_STYLES[status ?? ""] || LISTING_STATUS_STYLES.draft;

/** Green while places are comfortable, amber as they run out, rose when full. */
export const seatsTone = (remaining: number | null, total: number) => {
  if (remaining === null) return "text-gray-500 dark:text-gray-400";
  if (remaining <= 0) return "text-rose-600 dark:text-rose-400";
  if (total > 0 && remaining / total <= 0.2)
    return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

export const arriveByTime = (
  startsAt?: string | null,
  gateOpensBeforeMinutes = 90,
) => {
  if (!startsAt) return "—";
  return formatTime(
    new Date(
      new Date(startsAt).getTime() - gateOpensBeforeMinutes * 60_000,
    ).toISOString(),
  );
};
