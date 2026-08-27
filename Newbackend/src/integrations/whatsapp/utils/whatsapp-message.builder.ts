/**
 * Builds the WhatsApp body for an outbox notification.
 *
 * Notification rows only carry a one-line title and message, which reads as raw
 * data on a phone ("Reservation expired / The payment hold for TRV-… expired").
 * When the worker supplies booking context we compose a proper message instead:
 * who it is for, which ashram, the dates, and the code they need at the gate.
 */

export interface WhatsAppStayContext {
  guestName?: string;
  reference?: string;
  ashramName?: string;
  ashramCity?: string;
  ashramState?: string;
  roomName?: string;
  checkInDate?: Date | string;
  checkOutDate?: Date | string;
  guestsCount?: number;
  roomsCount?: number;
  checkInCode?: string;
  amountPaid?: number;
  totalAmount?: number;
  currency?: string;
}

export interface WhatsAppParkingContext {
  reference?: string;
  locationName?: string;
  locationCity?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  entryAt?: Date | string;
  exitAt?: Date | string;
  displayCode?: string;
  passUrl?: string;
  amountPaid?: number;
  currency?: string;
}

const TIME_ZONE = "Asia/Kolkata";

const asDate = (value?: Date | string): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const formatDateTime = (value?: Date | string): string => {
  const date = asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const formatDate = (value?: Date | string): string => {
  const date = asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatMoney = (
  amount?: number,
  currency = "INR",
): string => {
  if (amount === undefined || amount === null || !Number.isFinite(amount))
    return "";
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${Number(amount).toLocaleString("en-IN")}`;
};

const place = (city?: string, state?: string): string =>
  [city, state].filter(Boolean).join(", ");

/**
 * Joins the message rows. An absent field must not leave a hole, but the
 * empty entries written between sections are deliberate spacing, so blanks
 * are kept and then collapsed: a run of them becomes one empty line, and any
 * at the start or end are dropped.
 */
const lines = (...entries: (string | false | null | undefined)[]): string => {
  const out: string[] = [];
  for (const entry of entries) {
    if (entry === false || entry === null || entry === undefined) continue;
    const row = String(entry);
    if (!row.trim()) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(row);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
};

const greeting = (name?: string): string =>
  name ? `Namaste ${String(name).trim().split(" ")[0]},` : "Namaste,";

export const stayBlock = (context: WhatsAppStayContext): string =>
  lines(
    context.ashramName && `*Ashram:* ${context.ashramName}`,
    place(context.ashramCity, context.ashramState) &&
      `*Location:* ${place(context.ashramCity, context.ashramState)}`,
    context.reference && `*Booking ID:* ${context.reference}`,
    context.roomName && `*Room:* ${context.roomName}`,
    formatDateTime(context.checkInDate) &&
      `*Check-in:* ${formatDateTime(context.checkInDate)}`,
    formatDateTime(context.checkOutDate) &&
      `*Check-out:* ${formatDateTime(context.checkOutDate)}`,
    context.guestsCount || context.roomsCount
      ? `*Guests:* ${context.guestsCount ?? 1}   *Rooms:* ${context.roomsCount ?? 1}`
      : "",
  );

export const buildStayMessage = (
  kind:
    | "confirmed"
    | "held"
    | "expired"
    | "cancelled"
    | "payment_success"
    | "payment_failed"
    | "refund"
    | "checkin_reminder",
  context: WhatsAppStayContext,
  fallback: { title?: string; message?: string } = {},
): string => {
  const details = stayBlock(context);
  const paid = formatMoney(context.amountPaid, context.currency);
  const total = formatMoney(context.totalAmount, context.currency);

  switch (kind) {
    case "confirmed":
      return lines(
        "*Booking Confirmed*",
        "",
        greeting(context.guestName),
        context.ashramName
          ? `Your stay at *${context.ashramName}* is confirmed.`
          : "Your Tirvona stay is confirmed.",
        "",
        details,
        paid && `*Amount paid:* ${paid}`,
        "",
        context.checkInCode &&
          `*Check-in code:* ${context.checkInCode}\nShow this code at the front desk.`,
        "",
        "Thank you for booking with Tirvona.",
      );

    case "held":
      return lines(
        "*Reservation Held*",
        "",
        greeting(context.guestName),
        "Your rooms are held while the payment is completed.",
        "",
        details,
        total && `*Amount due:* ${total}`,
        "",
        "Please complete the payment before the hold expires, or the rooms will be released.",
      );

    case "expired":
      return lines(
        "*Reservation Expired*",
        "",
        greeting(context.guestName),
        "The payment hold on this reservation has expired and the rooms have been released.",
        "",
        details,
        "",
        "You can book again on Tirvona whenever you are ready.",
      );

    case "cancelled":
      return lines(
        "*Booking Cancelled*",
        "",
        greeting(context.guestName),
        context.ashramName
          ? `Your stay at *${context.ashramName}* has been cancelled.`
          : "Your Tirvona stay has been cancelled.",
        "",
        details,
        "",
        "Any eligible refund follows the cancellation policy for this booking.",
      );

    case "payment_success":
      return lines(
        "*Payment Received*",
        "",
        greeting(context.guestName),
        paid ? `We have received ${paid}.` : "We have received your payment.",
        "",
        details,
        "",
        context.checkInCode && `*Check-in code:* ${context.checkInCode}`,
      );

    case "payment_failed":
      return lines(
        "*Payment Not Completed*",
        "",
        greeting(context.guestName),
        "The payment for this booking could not be completed.",
        "",
        details,
        "",
        "Please try again to keep your rooms.",
      );

    case "refund":
      return lines(
        "*Refund Update*",
        "",
        greeting(context.guestName),
        "There is an update on the refund for this booking.",
        "",
        details,
        paid && `*Refund amount:* ${paid}`,
      );

    case "checkin_reminder":
      return lines(
        "*Check-in Reminder*",
        "",
        greeting(context.guestName),
        context.ashramName
          ? `Your stay at *${context.ashramName}* begins soon.`
          : "Your Tirvona stay begins soon.",
        "",
        details,
        "",
        context.checkInCode && `*Check-in code:* ${context.checkInCode}`,
      );

    default:
      return lines(fallback.title, "", fallback.message);
  }
};

export const buildParkingMessage = (
  kind: "confirmed" | "cancelled" | "reminder",
  context: WhatsAppParkingContext,
  fallback: { title?: string; message?: string } = {},
): string => {
  const details = lines(
    context.locationName && `*Parking:* ${context.locationName}`,
    context.locationCity && `*Location:* ${context.locationCity}`,
    context.reference && `*Booking ID:* ${context.reference}`,
    context.vehicleNumber && `*Vehicle:* ${context.vehicleNumber}`,
    context.vehicleType && `*Vehicle type:* ${context.vehicleType}`,
    formatDateTime(context.entryAt) &&
      `*Entry:* ${formatDateTime(context.entryAt)}`,
    formatDateTime(context.exitAt) &&
      `*Exit:* ${formatDateTime(context.exitAt)}`,
  );
  const paid = formatMoney(context.amountPaid, context.currency);

  if (kind === "cancelled")
    return lines("*Parking Cancelled*", "", details, "", fallback.message);

  return lines(
    kind === "reminder" ? "*Parking Reminder*" : "*Parking Confirmed*",
    "",
    details,
    paid && `*Amount paid:* ${paid}`,
    "",
    // The provider sends text only, so the pass is linked rather than attached.
    context.displayCode && `*Gate code:* ${context.displayCode}`,
    context.passUrl && `*Scan your QR pass:*\n${context.passUrl}`,
    "",
    "Show the QR pass or gate code at the entry barrier.",
  );
};
