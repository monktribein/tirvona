import ParkingBooking from '../models/ParkingBooking.js';
import ParkingCommission from '../models/ParkingCommission.js';
import ParkingLocation from '../models/ParkingLocation.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import { getSlotOccupancy } from './parkingAvailabilityService.js';
import { PARKING_BOOKING_STATUS } from '../config/parkingConfig.js';

// Reporting for the partner/manager dashboard and the Super Admin analytics.
//
// Every query is driven by a caller-supplied `locationIds` scope, resolved from
// parkingAuth. A partner therefore cannot widen a report past their own estate,
// and Super Admin passes the unrestricted set.

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Owner dashboard: today's revenue and bookings, slot state, expected traffic
 * and occupancy — exactly the tiles the operations screen renders.
 */
export const getOwnerDashboard = async (locationIds) => {
  const dayStart = startOfDay();
  const dayEnd = endOfDay();

  const [counters, slots] = await Promise.all([
    bookingRepo.dashboardCounters(locationIds, dayStart, dayEnd),
    getSlotOccupancy(locationIds),
  ]);

  return {
    todayRevenue: counters.todayRevenue,
    todayBookings: counters.todayBookings,
    todayCommission: counters.todayCommission,
    todayPartnerEarning: counters.todayPartnerEarning,
    occupiedSlots: slots.occupied,
    availableSlots: slots.available,
    reservedSlots: counters.byStatus[PARKING_BOOKING_STATUS.UPCOMING] || 0,
    maintenanceSlots: slots.maintenance,
    totalSlots: slots.total,
    expectedArrivals: counters.expectedArrivals,
    expectedExits: counters.expectedExits,
    occupancyPercent: slots.occupancyPercent,
    currentlyParked: counters.byStatus[PARKING_BOOKING_STATUS.CHECKED_IN] || 0,
    statusBreakdown: counters.byStatus,
  };
};

/** Revenue over a window, bucketed by day. */
export const getRevenueReport = async ({ locationIds, from, to }) => {
  const rows = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        paymentStatus: 'paid',
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$pricing.amountPaid' },
        commission: { $sum: '$commission.amount' },
        partnerEarning: { $sum: '$commission.partnerEarning' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      commission: acc.commission + r.commission,
      partnerEarning: acc.partnerEarning + r.partnerEarning,
      bookings: acc.bookings + r.bookings,
    }),
    { revenue: 0, commission: 0, partnerEarning: 0, bookings: 0 }
  );

  return { series: rows.map((r) => ({ date: r._id, ...r, _id: undefined })), totals };
};

/**
 * Booking counts by hour of entry — the peak-hours report.
 * Uses the booked entry time rather than the creation time, because staffing
 * decisions follow when vehicles actually arrive.
 */
export const getPeakHours = async ({ locationIds, from, to }) => {
  const rows = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        entryAt: { $gte: new Date(from), $lte: new Date(to) },
        status: { $nin: [PARKING_BOOKING_STATUS.CANCELLED, PARKING_BOOKING_STATUS.EXPIRED] },
      },
    },
    { $group: { _id: { $hour: '$entryAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Emit all 24 buckets so the chart has no gaps.
  const byHour = new Map(rows.map((r) => [r._id, r.count]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    count: byHour.get(hour) || 0,
  }));
};

/** Cancellation rate and no-show rate over a window. */
export const getCancellationReport = async ({ locationIds, from, to }) => {
  const rows = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = rows.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const cancelled = byStatus[PARKING_BOOKING_STATUS.CANCELLED] || 0;
  const noShow = byStatus[PARKING_BOOKING_STATUS.NO_SHOW] || 0;

  return {
    total,
    cancelled,
    noShow,
    completed: byStatus[PARKING_BOOKING_STATUS.CHECKED_OUT] || 0,
    cancellationRate: total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0,
    noShowRate: total > 0 ? Number(((noShow / total) * 100).toFixed(1)) : 0,
    byStatus,
  };
};

/** Mean actual stay, in minutes and hours, over completed bookings. */
export const getAverageStay = async ({ locationIds, from, to }) => {
  const [row] = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        status: PARKING_BOOKING_STATUS.CHECKED_OUT,
        checkedOutAt: { $gte: new Date(from), $lte: new Date(to) },
        actualDurationMinutes: { $ne: null },
      },
    },
    {
      $group: {
        _id: null,
        averageMinutes: { $avg: '$actualDurationMinutes' },
        maxMinutes: { $max: '$actualDurationMinutes' },
        minMinutes: { $min: '$actualDurationMinutes' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!row) return { averageMinutes: 0, averageHours: 0, count: 0 };

  return {
    averageMinutes: Math.round(row.averageMinutes),
    averageHours: Number((row.averageMinutes / 60).toFixed(1)),
    maxMinutes: row.maxMinutes,
    minMinutes: row.minMinutes,
    count: row.count,
  };
};

/** Busiest facilities by booking count, with revenue alongside. */
export const getPopularLocations = async ({ locationIds, from, to, limit = 10 }) => {
  const rows = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
        status: { $nin: [PARKING_BOOKING_STATUS.CANCELLED, PARKING_BOOKING_STATUS.EXPIRED] },
      },
    },
    {
      $group: {
        _id: '$locationId',
        bookings: { $sum: 1 },
        revenue: { $sum: '$pricing.amountPaid' },
      },
    },
    { $sort: { bookings: -1 } },
    { $limit: limit },
  ]);

  const locations = await ParkingLocation.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name slug address.city rating')
    .lean();

  const byId = new Map(locations.map((l) => [l._id.toString(), l]));

  return rows.map((r) => ({
    locationId: r._id,
    name: byId.get(r._id.toString())?.name || 'Unknown',
    city: byId.get(r._id.toString())?.address?.city || '',
    rating: byId.get(r._id.toString())?.rating?.average || 0,
    bookings: r.bookings,
    revenue: r.revenue,
  }));
};

/** Earnings per partner, with settlement state — the Super Admin payout view. */
export const getPartnerEarnings = async ({ from, to, partnerId = null }) => {
  const match = { createdAt: { $gte: new Date(from), $lte: new Date(to) } };
  if (partnerId) match.partnerId = partnerId;

  const rows = await ParkingCommission.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$partnerId',
        gross: { $sum: '$grossAmount' },
        commission: { $sum: '$commissionAmount' },
        earning: { $sum: '$partnerEarning' },
        bookings: { $sum: 1 },
        settled: {
          $sum: { $cond: [{ $eq: ['$settlementStatus', 'settled'] }, '$partnerEarning', 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$settlementStatus', 'pending'] }, '$partnerEarning', 0] },
        },
      },
    },
    { $sort: { earning: -1 } },
  ]);

  return ParkingCommission.populate(rows, {
    path: '_id',
    model: 'ParkingPartner',
    select: 'businessName partnerCode status',
  });
};

/** Occupancy trend by day, derived from bookings that held inventory. */
export const getOccupancyReport = async ({ locationIds, from, to }) => {
  const rows = await ParkingBooking.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        status: {
          $in: [
            PARKING_BOOKING_STATUS.UPCOMING,
            PARKING_BOOKING_STATUS.CHECKED_IN,
            PARKING_BOOKING_STATUS.CHECKED_OUT,
          ],
        },
        entryAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryAt' } },
        vehicles: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({ date: r._id, vehicles: r.vehicles }));
};

export { startOfDay, endOfDay };

export default {
  getOwnerDashboard,
  getRevenueReport,
  getPeakHours,
  getCancellationReport,
  getAverageStay,
  getPopularLocations,
  getPartnerEarnings,
  getOccupancyReport,
};
