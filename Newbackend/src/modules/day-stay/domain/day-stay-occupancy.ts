import { addDays, istDateString, istInstant, parseClockMinutes } from "./day-stay-time";

// Day Stay and overnight bookings share the same physical rooms. These pure
// helpers let each side see the other: overnight holds count the Short Stay
// guests inside a night's window, and Day Stay counts overnight guests until
// the property's real check-out time.

/** Defaults when the property has no check-in / check-out time set (IST). */
export const DEFAULT_CHECKIN_MINUTES = 12 * 60;
export const DEFAULT_CHECKOUT_MINUTES = 11 * 60;

export const DAY_STAY_BOOKING_TYPES = ["day_rest", "freshen_up"];

export function policyClockMinutes(policies: any): { checkIn: number; checkOut: number } {
  return {
    checkIn: parseClockMinutes(policies?.checkInTime, DEFAULT_CHECKIN_MINUTES),
    checkOut: parseClockMinutes(policies?.checkOutTime, DEFAULT_CHECKOUT_MINUTES),
  };
}

/** The real stay of the night starting on `nightDate` (YYYY-MM-DD, IST). */
export function nightWindow(
  nightDate: string,
  clocks: { checkIn: number; checkOut: number },
): { start: Date; end: Date } {
  return {
    start: istInstant(nightDate, clocks.checkIn),
    end: istInstant(addDays(nightDate, 1), clocks.checkOut),
  };
}

/**
 * Real occupancy of an overnight booking. Plain dates are stored as UTC
 * midnight (05:30 IST); the guest actually holds the room from the check-in
 * time on the first day to the check-out time on the last day.
 */
export function overnightOccupancy(
  bk: { checkInDate: Date | string; checkOutDate: Date | string },
  clocks: { checkIn: number; checkOut: number },
  bufferMinutes = 0,
): { start: Date; end: Date } {
  const storedIn = new Date(bk.checkInDate);
  const storedOut = new Date(bk.checkOutDate);
  const policyIn = istInstant(istDateString(storedIn), clocks.checkIn);
  const policyOut = istInstant(istDateString(storedOut), clocks.checkOut + bufferMinutes);
  return {
    start: policyIn > storedIn ? policyIn : storedIn,
    end: policyOut > storedOut ? policyOut : storedOut,
  };
}

/** A Day Stay booking's slot including grace and housekeeping turnaround. */
export function dayStayOccupancy(bk: any): { start: Date; end: Date } | null {
  const d = bk?.dayStayDetails;
  if (!d?.slotStartTime || !d?.slotEndTime) return null;
  const start = new Date(d.slotStartTime);
  const end = d.housekeepingEndsAt
    ? new Date(d.housekeepingEndsAt)
    : new Date(
        new Date(d.slotEndTime).getTime() +
          ((d.graceMinutes ?? 15) + (d.housekeepingBufferMinutes ?? 45)) * 60000,
      );
  return { start, end };
}

/**
 * Most units Day Stay guests use at the same moment inside `window`. Two
 * back-to-back short stays on one unit count as 1, not 2.
 */
export function peakDayStayUnits(bookings: any[], window: { start: Date; end: Date }): number {
  const events: Array<[number, number]> = [];
  for (const bk of bookings) {
    const occ = dayStayOccupancy(bk);
    if (!occ) continue;
    const start = Math.max(occ.start.getTime(), window.start.getTime());
    const end = Math.min(occ.end.getTime(), window.end.getTime());
    if (start >= end) continue;
    const units = Number(bk.roomsBookedCount) || 1;
    events.push([start, units], [end, -units]);
  }
  // Ends sort before starts at the same instant, so touching slots don't overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

/** Mongo filter for Day Stay bookings that currently occupy a room. */
export function activeDayStayFilter(roomId: unknown, from: Date, to: Date, now = new Date()): any {
  return {
    "rooms.roomId": roomId,
    bookingType: { $in: DAY_STAY_BOOKING_TYPES },
    "dayStayDetails.slotStartTime": { $lt: to },
    "dayStayDetails.slotEndTime": { $gt: new Date(from.getTime() - 6 * 3600000) },
    $or: [
      { status: { $in: ["confirmed", "checked_in"] } },
      { status: "pending", reservationExpiresAt: { $gt: now } },
    ],
  };
}
