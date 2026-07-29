import ParkingReview from '../models/ParkingReview.js';
import ParkingLocation from '../models/ParkingLocation.js';

// Data access for parking reviews, plus the rating roll-up.

export const findForLocation = async (locationId, { page = 1, limit = 10 } = {}) => {
  const filter = { locationId, status: 'approved' };
  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingReview.find(filter)
      .populate('customerId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ParkingReview.countDocuments(filter),
  ]);

  return { items, total };
};

export const findByBooking = (bookingId) => ParkingReview.findOne({ bookingId });

export const create = (payload) => ParkingReview.create(payload);

/**
 * Recompute a facility's rating from its approved reviews and write it back.
 *
 * Aggregated rather than incremented so a moderated-away or edited review can
 * never leave the stored average permanently wrong.
 */
export const recalculateRating = async (locationId) => {
  const [agg] = await ParkingReview.aggregate([
    { $match: { locationId, status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating.overall' },
        count: { $sum: 1 },
      },
    },
  ]);

  const average = agg?.average ? Number(agg.average.toFixed(2)) : 0;
  const count = agg?.count || 0;

  await ParkingLocation.findByIdAndUpdate(locationId, {
    $set: { 'rating.average': average, 'rating.count': count },
  });

  return { average, count };
};

export default { findForLocation, findByBooking, create, recalculateRating };
