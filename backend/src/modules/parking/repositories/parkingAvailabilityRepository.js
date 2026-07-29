import ParkingAvailability from '../models/ParkingAvailability.js';
import { toDateKey } from '../utils/parkingTime.js';

// ─────────────────────────────────────────────────────────────────────────────
// Availability inventory.
//
// This is the concurrency-critical part of the module. A reservation is taken by
// a CONDITIONAL $inc: the update only matches when the day still has room, so
// two simultaneous bookings for the last bay cannot both succeed. The same
// guarantee the ashram engine gets from lockInventory — implemented here
// independently, against parking_availability, touching nothing it owns.
// ─────────────────────────────────────────────────────────────────────────────

/** Ensure a row exists for (slot type, date) without disturbing live counts. */
export const ensureRow = async (locationId, slotTypeId, date, totalCapacity) => {
  await ParkingAvailability.updateOne(
    { slotTypeId, date: toDateKey(date) },
    {
      $setOnInsert: {
        locationId,
        slotTypeId,
        date: toDateKey(date),
        totalCapacity,
        bookedCount: 0,
        blockedCount: 0,
      },
    },
    { upsert: true }
  );
};

/**
 * Take `units` of capacity on `dates`, all-or-nothing.
 *
 * Each day is claimed with a guarded $inc; the first day that cannot satisfy the
 * request rolls back every day already claimed, so a partial hold is never left
 * behind for the sweeper to find.
 */
export const reserve = async ({ locationId, slotTypeId, dates, units, totalCapacity }) => {
  const claimed = [];

  for (const rawDate of dates) {
    const date = toDateKey(rawDate);
    await ensureRow(locationId, slotTypeId, date, totalCapacity);

    // Matches only while there is room AND the day is open for sale. Expressing
    // the capacity test inside the filter is what makes this atomic.
    const updated = await ParkingAvailability.findOneAndUpdate(
      {
        slotTypeId,
        date,
        isClosed: { $ne: true },
        $expr: {
          $lte: [
            { $add: ['$bookedCount', units] },
            { $subtract: ['$totalCapacity', '$blockedCount'] },
          ],
        },
      },
      { $inc: { bookedCount: units } },
      { new: true }
    );

    if (!updated) {
      await release({ slotTypeId, dates: claimed, units });
      return {
        ok: false,
        failedDate: date.toISOString().split('T')[0],
      };
    }
    claimed.push(date);
  }

  return { ok: true, dates: claimed };
};

/**
 * Give capacity back. Clamped at zero so a double-release (a cancel racing a
 * sweeper expiry) can never drive the count negative and manufacture inventory.
 */
export const release = async ({ slotTypeId, dates = [], units }) => {
  for (const rawDate of dates) {
    const date = toDateKey(rawDate);

    await ParkingAvailability.updateOne(
      { slotTypeId, date, bookedCount: { $gte: units } },
      { $inc: { bookedCount: -units } }
    );
    // Data drift (a row already below `units`): clamp rather than go negative.
    await ParkingAvailability.updateOne(
      { slotTypeId, date, bookedCount: { $lt: units, $gt: 0 } },
      { $set: { bookedCount: 0 } }
    );
  }
};

/** Availability rows for a facility across a date range. */
export const findRange = (locationId, startDate, endDate) =>
  ParkingAvailability.find({
    locationId,
    date: { $gte: toDateKey(startDate), $lte: toDateKey(endDate) },
  }).sort({ date: 1 });

/** Rows for one slot type across a range, keyed by ISO date for quick lookup. */
export const mapForSlotType = async (slotTypeId, dates) => {
  const keys = dates.map(toDateKey);
  const rows = await ParkingAvailability.find({ slotTypeId, date: { $in: keys } }).lean();

  const map = new Map();
  rows.forEach((r) => map.set(new Date(r.date).toISOString().split('T')[0], r));
  return map;
};

/**
 * Free units for a slot type on the tightest day of a span — the number the
 * search results and the detail page show as "live availability".
 */
export const lowestFreeCapacity = async (slotTypeId, dates, fallbackCapacity) => {
  const map = await mapForSlotType(slotTypeId, dates);
  let lowest = fallbackCapacity;

  for (const date of dates) {
    const key = toDateKey(date).toISOString().split('T')[0];
    const row = map.get(key);

    if (!row) {
      // No row yet means nothing booked that day — full capacity is free.
      lowest = Math.min(lowest, fallbackCapacity);
      continue;
    }
    if (row.isClosed) return 0;

    const free = (row.totalCapacity ?? fallbackCapacity) - row.bookedCount - row.blockedCount;
    lowest = Math.min(lowest, Math.max(0, free));
  }

  return Math.max(0, lowest);
};

/** Block or unblock bays on a date (maintenance, an event, a VIP hold). */
export const setBlocked = async ({ locationId, slotTypeId, date, blockedCount, totalCapacity, note = '' }) => {
  await ensureRow(locationId, slotTypeId, date, totalCapacity);
  return ParkingAvailability.findOneAndUpdate(
    { slotTypeId, date: toDateKey(date) },
    { $set: { blockedCount: Math.max(0, blockedCount), note } },
    { new: true }
  );
};

/** Close or reopen a date for sale. */
export const setClosed = async ({ locationId, slotTypeId, date, isClosed, totalCapacity, note = '' }) => {
  await ensureRow(locationId, slotTypeId, date, totalCapacity);
  return ParkingAvailability.findOneAndUpdate(
    { slotTypeId, date: toDateKey(date) },
    { $set: { isClosed: Boolean(isClosed), note } },
    { new: true }
  );
};

export default {
  ensureRow,
  reserve,
  release,
  findRange,
  mapForSlotType,
  lowestFreeCapacity,
  setBlocked,
  setClosed,
};
