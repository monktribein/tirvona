import type { StopType } from "../types/pilgrimage.types";
import { getFormattingLocale } from "../../../utils/format";

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(getFormattingLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const titleCase = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const STOP_TYPE_LABELS: Record<StopType, string> = {
  temple: "Temple",
  ghat: "Ghat",
  ashram: "Ashram",
  math: "Math",
  gurudwara: "Gurudwara",
  monastery: "Monastery",
  viewpoint: "Viewpoint",
  sangam: "Sangam",
  transit: "Transit",
  rest: "Rest Stop",
};

export const stopTypeLabel = (value?: string) =>
  STOP_TYPE_LABELS[value as StopType] ?? titleCase(value ?? "stop");

export const seasonLabel = (value: string) => titleCase(value);
export const difficultyLabel = (value?: string) =>
  titleCase(value ?? "moderate");

export const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  moderate:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  strenuous:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
};

export const difficultyStyle = (value?: string) =>
  DIFFICULTY_STYLES[value ?? "moderate"] ?? DIFFICULTY_STYLES.moderate;

export const CIRCUIT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "In Review",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
  archived: "Archived",
};

export const CIRCUIT_STATUS_STYLES: Record<string, string> = {
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

export const circuitStatusLabel = (status?: string) =>
  CIRCUIT_STATUS_LABELS[status ?? ""] || status || "Draft";

export const circuitStatusStyle = (status?: string) =>
  CIRCUIT_STATUS_STYLES[status ?? ""] || CIRCUIT_STATUS_STYLES.draft;

export const formatDuration = (days?: number) => {
  if (!days || days < 1) return "—";
  return `${days} day${days === 1 ? "" : "s"}`;
};

export const formatDistance = (km?: number) => {
  if (!km || km <= 0) return "—";
  return `${Math.round(km)} km`;
};

/** `90` minutes reads better as `1 hr 30 min` on an itinerary card. */
export const formatMinutes = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
};
