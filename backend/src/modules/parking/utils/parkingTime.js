// Date/duration helpers for the parking module.
//
// Availability is accounted per calendar day, so every span has to be reduced
// to the set of UTC midnights it touches. Keeping that in one place stops the
// booking, cancellation and check-out paths from disagreeing about which days a
// reservation held — the class of drift that silently oversells inventory.

/** Midnight UTC of the day a moment falls in. */
export const toDateKey = (value) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Every calendar day a span touches, inclusive of both ends.
 *
 * Inclusive because a car that enters 23:00 Monday and leaves 01:00 Tuesday
 * occupies a bay on both days — unlike a hotel night, where the checkout day is
 * not occupied. This is the one place that difference from the ashram engine is
 * expressed.
 */
export const datesInSpan = (start, end) => {
  const first = toDateKey(start);
  const last = toDateKey(end);
  const out = [];

  for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(new Date(d));
    // Guard against a pathological range locking the event loop.
    if (out.length > 400) break;
  }
  return out;
};

/** Whole hours between two moments, rounded up, floored at `minimum`. */
export const billableHours = (start, end, minimum = 1) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return minimum;
  return Math.max(minimum, Math.ceil(ms / (1000 * 60 * 60)));
};

/** Exact minutes between two moments, never negative. */
export const minutesBetween = (start, end) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / (1000 * 60));
};

export const addMinutes = (date, minutes) =>
  new Date(new Date(date).getTime() + minutes * 60 * 1000);

/** True when `value` parses to a real date. */
export const isValidDate = (value) => {
  const d = new Date(value);
  return d instanceof Date && !Number.isNaN(d.getTime());
};

/**
 * Whether a moment falls inside a facility's opening window.
 * A 24×7 facility always returns true; otherwise the 'HH:mm' strings are
 * compared in local time, and a window that wraps past midnight is handled.
 */
export const isWithinOpeningHours = (moment, openingHours) => {
  if (!openingHours || openingHours.is24x7) return true;

  const d = new Date(moment);
  const minutesOfDay = d.getHours() * 60 + d.getMinutes();

  const parse = (hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };

  const opens = parse(openingHours.opensAt);
  const closes = parse(openingHours.closesAt);

  // Overnight window, e.g. opens 18:00 closes 06:00.
  if (closes < opens) return minutesOfDay >= opens || minutesOfDay <= closes;
  return minutesOfDay >= opens && minutesOfDay <= closes;
};

export default {
  toDateKey,
  datesInSpan,
  billableHours,
  minutesBetween,
  addMinutes,
  isValidDate,
  isWithinOpeningHours,
};
