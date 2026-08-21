import type {
  ParkingBookingStatus,
  ParkingVehicleTypeCode,
} from "../types/parking.types";
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

export const formatDuration = (minutes?: number | null) => {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};

export const formatDistance = (km?: number | null) => {
  if (km === null || km === undefined) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
};

export const toLocalInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const nextHalfHour = (from = new Date()) => {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)));
  return d;
};

export const getMinimumParkingEntry = () =>
  toLocalInputValue(nextHalfHour());

export const getMinimumParkingExit = (entryAt: string) => {
  const entry = new Date(entryAt);
  const validEntry = Number.isNaN(entry.getTime()) ? nextHalfHour() : entry;
  return toLocalInputValue(new Date(validEntry.getTime() + 30 * 60_000));
};

export const normalizeParkingWindow = (entryAt?: string, exitAt?: string) => {
  const minimumEntry = getMinimumParkingEntry();
  const entry = entryAt && entryAt >= minimumEntry ? entryAt : minimumEntry;
  const minimumExit = getMinimumParkingExit(entry);
  const exit =
    exitAt && exitAt >= minimumExit
      ? exitAt
      : toLocalInputValue(new Date(new Date(entry).getTime() + 3 * 3_600_000));
  return { entry, exit };
};

export const VEHICLE_LABELS: Record<ParkingVehicleTypeCode, string> = {
  bike: "Bike",
  scooter: "Scooter",
  car: "Car",
  suv: "SUV",
  luxury_car: "Luxury Car",
  tempo: "Tempo",
  mini_bus: "Mini Bus",
  bus: "Bus",
  ev: "EV",
};

export const vehicleLabel = (code?: ParkingVehicleTypeCode | string) =>
  (code && VEHICLE_LABELS[code as ParkingVehicleTypeCode]) ||
  String(code || "").replace(/_/g, " ");

export const AMENITY_LABELS: Record<string, string> = {
  covered: "Covered Parking",
  cctv: "CCTV Surveillance",
  security: "24×7 Security",
  washroom: "Washroom",
  ev_charging: "EV Charging",
  wheelchair_access: "Wheelchair Access",
  valet: "Valet Service",
  car_wash: "Car Wash",
  drinking_water: "Drinking Water",
  waiting_lounge: "Waiting Lounge",
};

export const amenityLabel = (key: string) =>
  AMENITY_LABELS[key] ||
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const STATUS_LABELS: Record<ParkingBookingStatus, string> = {
  pending: "Awaiting Payment",
  upcoming: "Upcoming",
  checked_in: "Parked",
  checked_out: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  no_show: "No Show",
};

export const statusLabel = (status: ParkingBookingStatus) =>
  STATUS_LABELS[status] || status;

export const STATUS_STYLES: Record<ParkingBookingStatus, string> = {
  pending:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  upcoming:
    "bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  checked_in:
    "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  checked_out:
    "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  cancelled:
    "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  expired:
    "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700",
  no_show:
    "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/50",
};

export const availabilityTone = (available: number, total: number) => {
  if (available <= 0) return "text-rose-600 dark:text-rose-400";
  if (total > 0 && available / total < 0.15)
    return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

export const normalizeVehicleNumber = (value: string) =>
  String(value || "")
    .toUpperCase()
    .replace(/[\s.-]/g, "");

export const isValidVehicleNumber = (value: string) =>
  /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(normalizeVehicleNumber(value));

export const isCompleteScanInput = (value: string): boolean => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("TVNPK1.")) return trimmed.split(".").length === 4;
  return trimmed.toUpperCase().replace(/[^0-9A-Z]/g, "").length === 8;
};
