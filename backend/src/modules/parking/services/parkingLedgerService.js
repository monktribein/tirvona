import ParkingTransaction from '../models/ParkingTransaction.js';
import { generateTransactionReference } from '../utils/parkingIds.js';

// The parking money ledger.
//
// Every rupee that moves through the module lands here as an append-only row.
// Reports read this collection rather than summing booking documents, so a
// gateway retry or a re-confirmed booking cannot inflate reported revenue.
//
// Kept separate from the platform `payments` collection by design: parking
// accounting and ashram accounting never mix.

/**
 * Append a ledger row.
 *
 * Never throws: a ledger write must not be able to roll back a booking the
 * visitor has already paid for. Failures are logged for reconciliation.
 */
export const recordTransaction = async ({
  bookingId = null,
  paymentId = null,
  partnerId = null,
  locationId = null,
  type,
  direction,
  amount,
  description = '',
  meta = {},
  recordedBy = null,
  occurredAt = new Date(),
}) => {
  try {
    return await ParkingTransaction.create({
      bookingId,
      paymentId,
      partnerId,
      locationId,
      type,
      direction,
      amount,
      description,
      reference: generateTransactionReference(),
      meta,
      recordedBy,
      occurredAt,
    });
  } catch (error) {
    console.error('Parking ledger write failed:', error.message, { bookingId, type, amount });
    return null;
  }
};

/** Net totals by transaction type over a window, optionally scoped. */
export const summarise = async ({ partnerId = null, locationIds = null, from, to } = {}) => {
  const match = {};
  if (partnerId) match.partnerId = partnerId;
  if (locationIds) match.locationId = { $in: locationIds };
  if (from || to) {
    match.occurredAt = {};
    if (from) match.occurredAt.$gte = new Date(from);
    if (to) match.occurredAt.$lte = new Date(to);
  }

  const rows = await ParkingTransaction.aggregate([
    { $match: match },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  return rows.reduce(
    (acc, row) => {
      acc[row._id] = { total: row.total, count: row.count };
      return acc;
    },
    {}
  );
};

export const listTransactions = async ({ partnerId, locationIds, type, from, to, page = 1, limit = 50 } = {}) => {
  const filter = {};
  if (partnerId) filter.partnerId = partnerId;
  if (locationIds) filter.locationId = { $in: locationIds };
  if (type) filter.type = type;
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(from);
    if (to) filter.occurredAt.$lte = new Date(to);
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingTransaction.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit),
    ParkingTransaction.countDocuments(filter),
  ]);

  return { items, total };
};

export default { recordTransaction, summarise, listTransactions };
