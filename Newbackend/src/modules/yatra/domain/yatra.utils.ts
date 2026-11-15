import { randomBytes } from "node:crypto";
import { calculateRefund } from "../../refunds/domain/refund-calculator";
import {
  MAX_SEATS_PER_VEHICLE,
  MEMBER_PERMISSIONS,
  type MemberPermission,
  type MemberRole,
  type SeatLayoutTemplate,
} from "./yatra.constants";

// ------------------------------------------------------------------ references
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const randomCode = (length: number): string =>
  Array.from(randomBytes(length), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

export const bookingReference = (): string => `TVN-YTR-${randomCode(8)}`;
export const departureCode = (): string => `YD${randomCode(7)}`;
export const journeyNumber = (): string => `JRN-${randomCode(8)}`;
export const serviceRequestNumber = (): string => `YSR-${randomCode(8)}`;
export const linkCode = (): string => randomCode(8).toLowerCase();
/** The code printed on a ticket and checked at boarding. */
export const ticketCode = (): string => `${randomCode(3)}-${randomCode(3)}`;

/** Money is stored in rupees with two decimals, like every other Tirvona module. */
export const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;
export const toPaise = (rupees: number): number => Math.round(roundMoney(rupees) * 100);

export const cityKey = (value: string): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();

export const vehicleNumberKey = (value: string): string =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// --------------------------------------------------------------- permissions
export const memberCan = (role: MemberRole | string | undefined, permission: MemberPermission): boolean =>
  Boolean(role) && (MEMBER_PERMISSIONS[permission] as readonly string[]).includes(String(role));

export const memberPermissions = (role: MemberRole | string | undefined): MemberPermission[] =>
  (Object.keys(MEMBER_PERMISSIONS) as MemberPermission[]).filter((key) => memberCan(role, key));

// --------------------------------------------------------------- seat layouts
export interface SeatSpec {
  seatNo: string;
  row: number;
  col: number;
  deck: "lower" | "upper";
  kind: "seater" | "sleeper";
}
export interface SeatLayout {
  template: SeatLayoutTemplate;
  columns: number;
  rows: number;
  seats: SeatSpec[];
}

/** Columns used by seats in each template; the gaps are the aisle. */
const TEMPLATE_COLUMNS: Record<Exclude<SeatLayoutTemplate, "custom">, { columns: number; used: number[]; kind: SeatSpec["kind"] }> = {
  "2x2": { columns: 5, used: [0, 1, 3, 4], kind: "seater" },
  "2x1": { columns: 4, used: [0, 1, 3], kind: "seater" },
  "1x1": { columns: 3, used: [0, 2], kind: "seater" },
  sleeper_2x1: { columns: 4, used: [0, 1, 3], kind: "sleeper" },
};

/** A standard layout: seats numbered 1..N row by row, front to back. */
export const generateSeatLayout = (
  template: Exclude<SeatLayoutTemplate, "custom">,
  capacity: number,
): SeatLayout => {
  const spec = TEMPLATE_COLUMNS[template];
  const count = Math.max(1, Math.min(MAX_SEATS_PER_VEHICLE, Math.floor(capacity)));
  const seats: SeatSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / spec.used.length);
    seats.push({
      seatNo: String(i + 1),
      row,
      col: spec.used[i % spec.used.length],
      deck: "lower",
      kind: spec.kind,
    });
  }
  return { template, columns: spec.columns, rows: Math.ceil(count / spec.used.length), seats };
};

/** Checks an organiser-drawn layout. Returns the error, or null when valid. */
export const validateCustomLayout = (seats: Array<Partial<SeatSpec>>): string | null => {
  if (!Array.isArray(seats) || seats.length === 0) return "Add at least one seat.";
  if (seats.length > MAX_SEATS_PER_VEHICLE) return `A vehicle can have at most ${MAX_SEATS_PER_VEHICLE} seats.`;
  const numbers = new Set<string>();
  const cells = new Set<string>();
  for (const seat of seats) {
    const seatNo = String(seat.seatNo ?? "").trim();
    if (!/^[A-Za-z0-9-]{1,6}$/.test(seatNo)) return `Seat number "${seatNo}" is not valid.`;
    if (numbers.has(seatNo.toUpperCase())) return `Seat ${seatNo} appears twice.`;
    numbers.add(seatNo.toUpperCase());
    const row = Number(seat.row);
    const col = Number(seat.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row > 60 || col > 8)
      return `Seat ${seatNo} has an invalid position.`;
    const cell = `${seat.deck ?? "lower"}:${row}:${col}`;
    if (cells.has(cell)) return `Two seats share the same position (seat ${seatNo}).`;
    cells.add(cell);
  }
  return null;
};

export const normaliseCustomLayout = (seats: Array<Partial<SeatSpec>>): SeatLayout => {
  const clean: SeatSpec[] = seats.map((seat) => ({
    seatNo: String(seat.seatNo).trim().toUpperCase(),
    row: Number(seat.row),
    col: Number(seat.col),
    deck: seat.deck === "upper" ? "upper" : "lower",
    kind: seat.kind === "sleeper" ? "sleeper" : "seater",
  }));
  return {
    template: "custom",
    columns: Math.max(...clean.map((s) => s.col)) + 1,
    rows: Math.max(...clean.map((s) => s.row)) + 1,
    seats: clean,
  };
};

// ------------------------------------------------------------------- refunds
export interface CancellationPolicy {
  windows: Array<{ hoursBefore: number; refundPercent: number; label?: string }>;
  defaultRefundPercent: number;
  notes?: string;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  windows: [
    { hoursBefore: 72, refundPercent: 90, label: "3 days or more before departure" },
    { hoursBefore: 24, refundPercent: 50, label: "1 to 3 days before departure" },
  ],
  defaultRefundPercent: 0,
  notes: "No refund within 24 hours of departure.",
};

/** Refund for a cancelled booking under the policy snapshot taken at booking time. */
export const yatraRefundQuote = (
  policy: CancellationPolicy | null | undefined,
  amountPaid: number,
  departAt: Date,
  now = new Date(),
  overridePercent?: number,
): { refundPercent: number; refundAmount: number; hoursBeforeDeparture: number; label: string } => {
  const effective = policy?.windows ? policy : DEFAULT_CANCELLATION_POLICY;
  const breakdown = calculateRefund(
    {
      cancellationWindows: effective.windows.map((w) => ({
        hoursBefore: Number(w.hoursBefore),
        refundPercent: Number(w.refundPercent),
        label: w.label,
      })),
      defaultRefundPercent: Number(effective.defaultRefundPercent ?? 0),
      processingFee: { type: "none" },
    },
    { amountPaid, baseAmount: amountPaid, serviceDate: departAt },
    now,
  );
  const percent =
    overridePercent === undefined ? breakdown.refundPercent : Math.min(100, Math.max(0, overridePercent));
  const refundAmount = roundMoney(Math.min(amountPaid, (amountPaid * percent) / 100));
  return {
    refundPercent: percent,
    refundAmount,
    hoursBeforeDeparture: Math.floor(breakdown.hoursBeforeService),
    label:
      overridePercent !== undefined
        ? `Set by Tirvona: ${percent}%`
        : breakdown.appliedWindow?.label ?? `Default: ${percent}%`,
  };
};

/** Checks a cancellation policy submitted by an organiser. */
export const validateCancellationPolicy = (policy: CancellationPolicy): string | null => {
  if (!policy || !Array.isArray(policy.windows)) return "Add a cancellation policy.";
  if (policy.windows.length > 6) return "Use at most six cancellation windows.";
  const hours = new Set<number>();
  for (const w of policy.windows) {
    if (!Number.isFinite(w.hoursBefore) || w.hoursBefore < 0 || w.hoursBefore > 24 * 90)
      return "Each window needs hours before departure between 0 and 2160.";
    if (!Number.isFinite(w.refundPercent) || w.refundPercent < 0 || w.refundPercent > 100)
      return "Refund percentages must be between 0 and 100.";
    if (hours.has(w.hoursBefore)) return "Two windows use the same number of hours.";
    hours.add(w.hoursBefore);
  }
  const d = Number(policy.defaultRefundPercent ?? 0);
  if (!Number.isFinite(d) || d < 0 || d > 100) return "The default refund must be between 0 and 100%.";
  return null;
};

// ---------------------------------------------------------- sellability rules
export interface SellabilityInput {
  departure: { status?: string; departAt?: Date | string; capacity?: number; bookedSeats?: number } | null;
  tour: { status?: string } | null;
  operator: { status?: string } | null;
  vehicle: { status?: string } | null;
  salesCloseMinutes: number;
  now?: Date;
}

/**
 * Why a departure cannot be sold right now, or null when it can. Only an
 * approved organiser's published tour, on an approved vehicle, with an open
 * departure before its sales cut-off, is bookable — by anyone.
 */
export const unsellableReason = ({
  departure,
  tour,
  operator,
  vehicle,
  salesCloseMinutes,
  now = new Date(),
}: SellabilityInput): string | null => {
  if (!departure) return "This departure does not exist.";
  if (!operator || operator.status !== "approved") return "This organiser is not currently approved.";
  if (!tour || tour.status !== "published") return "This tour is not published.";
  if (!vehicle || vehicle.status !== "approved") return "The vehicle for this departure is not verified.";
  if (departure.status !== "scheduled") return "Booking is closed for this departure.";
  const departAt = new Date(departure.departAt ?? 0).getTime();
  if (!departAt || departAt - salesCloseMinutes * 60_000 <= now.getTime())
    return "Booking has closed for this departure.";
  return null;
};

/** The journey's state from its dates, so it never needs a scheduled job. */
export const journeyStatusFor = (
  bookingStatus: string,
  startDate: Date | string,
  endDate: Date | string,
  now = new Date(),
): "upcoming" | "ongoing" | "completed" | "cancelled" => {
  if (["cancelled", "expired"].includes(bookingStatus)) return "cancelled";
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (now.getTime() > end) return "completed";
  if (now.getTime() >= start) return "ongoing";
  return "upcoming";
};

/** Last four characters only, for showing stored bank numbers. */
export const maskTail = (value: string, keep = 4): string => {
  const clean = String(value ?? "").replace(/\s+/g, "");
  return clean ? `••••${clean.slice(-keep)}` : "";
};

/** Detects JPEG, PNG, WEBP and PDF from the file's bytes, not its name. */
export const detectDocumentType = (bytes: Buffer): { mime: string; ext: string; resourceType: "image" | "raw" } | null => {
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { mime: "image/jpeg", ext: "jpg", resourceType: "image" };
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    return { mime: "image/png", ext: "png", resourceType: "image" };
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
    return { mime: "image/webp", ext: "webp", resourceType: "image" };
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: "pdf", resourceType: "raw" };
  return null;
};

/** CSV cell with quotes escaped and formula injection neutralised. */
export const csvCell = (value: unknown): string => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
