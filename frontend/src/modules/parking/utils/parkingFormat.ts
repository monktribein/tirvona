import type {
  ParkingBookingStatus,
  ParkingVehicleTypeCode,
} from "../types/parking.types";

// Display helpers for the Parking module.

/** Indian rupee formatting, matching how prices read elsewhere on the site. */
export const formatCurrency = (amount: number | undefined | null) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
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

/** `datetime-local` input value for a Date — the browser wants local, not ISO. */
export const toLocalInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Round a Date up to the next half hour — a sensible default entry time. */
export const nextHalfHour = (from = new Date()) => {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)));
  return d;
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

/** Human label for a booking status. */
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

/**
 * Tailwind classes per status.
 *
 * The shared EnterpriseStatusBadge already covers the platform's common
 * statuses, but parking adds `upcoming`, `expired` and `no_show`, so the module
 * carries its own palette rather than editing that shared component.
 */
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

/** Colour for an availability count, so "2 left" reads as urgent. */
export const availabilityTone = (available: number, total: number) => {
  if (available <= 0) return "text-rose-600 dark:text-rose-400";
  if (total > 0 && available / total < 0.15)
    return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

/** Normalise a plate the way the API does, so client validation agrees. */
export const normalizeVehicleNumber = (value: string) =>
  String(value || "")
    .toUpperCase()
    .replace(/[\s.-]/g, "");

export const isValidVehicleNumber = (value: string) =>
  /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(normalizeVehicleNumber(value));

/**
 * Whether the scanner box holds something worth sending.
 *
 * Mirrors what the API accepts, so the gate can fire the moment a code lands
 * instead of waiting for Enter or a tap: a sealed pass (`TVNPK1.iv.data.tag`)
 * or an 8-character gate code. Deliberately strict — a half-typed code must not
 * fire and burn a scan, and the guard can always press the button.
 */
export const isCompleteScanInput = (value: string): boolean => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("TVNPK1.")) return trimmed.split(".").length === 4;
  return trimmed.toUpperCase().replace(/[^0-9A-Z]/g, "").length === 8;
};
