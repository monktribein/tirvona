import ParkingBooking from '../models/ParkingBooking.js';
import {
  PARKING_BOOKING_STATUS,
  PARKING_INVENTORY_HOLDING_STATUSES,
} from '../config/parkingConfig.js';
import { normalizeVehicleNumber } from '../validators/parkingValidators.js';

// Data access for parking bookings.

/** Populate set used wherever a booking is shown to a human. */
const DETAIL_POPULATE = [
  { path: 'locationId', select: 'name slug address latitude longitude contactPhone images coverImage openingHours instructions termsAndConditions googleMapsUrl' },
  { path: 'slotTypeId', select: 'name code isCovered hasEvCharging floorLabel' },
];

export const create = (payload) => ParkingBooking.create(payload);

export const findById = (id) => ParkingBooking.findById(id);

export const findByIdDetailed = (id) => ParkingBooking.findById(id).populate(DETAIL_POPULATE);

export const findByReference = (reference) =>
  ParkingBooking.findOne({ bookingReference: String(reference).toUpperCase().trim() });

/** A visitor's own bookings, newest first, optionally filtered by status. */
export const findForCustomer = async (customerId, { status, page = 1, limit = 20 } = {}) => {
  const filter = { customerId };
  if (status) filter.status = status;

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingBooking.find(filter).populate(DETAIL_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ParkingBooking.countDocuments(filter),
  ]);

  return { items, total };
};

/**
 * Bookings for an operations dashboard. `scopeFilter` comes from
 * locationScopeFilter(), so a manager can never widen the query past their own
 * facilities by manipulating params.
 */
export const findForOperations = async ({
  scopeFilter = {},
  locationId,
  status,
  dateFrom,
  dateTo,
  vehicleNumber,
  page = 1,
  limit = 25,
} = {}) => {
  const filter = { ...scopeFilter };

  if (locationId) filter.locationId = locationId;
  if (status) filter.status = status;
  if (vehicleNumber) filter.vehicleNumber = normalizeVehicleNumber(vehicleNumber);

  if (dateFrom || dateTo) {
    filter.entryAt = {};
    if (dateFrom) filter.entryAt.$gte = new Date(dateFrom);
    if (dateTo) filter.entryAt.$lte = new Date(dateTo);
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingBooking.find(filter)
      .populate([...DETAIL_POPULATE, { path: 'customerId', select: 'name email phone' }])
      .sort({ entryAt: 1 })
      .skip(skip)
      .limit(limit),
    ParkingBooking.countDocuments(filter),
  ]);

  return { items, total };
};

/**
 * The guard's manual fallback when a QR will not scan: find the live booking
 * for a plate at this facility. Scoped to the location so a plate cannot be
 * looked up across the estate.
 */
export const findActiveByVehicle = (locationId, vehicleNumber) =>
  ParkingBooking.findOne({
    locationId,
    vehicleNumber: normalizeVehicleNumber(vehicleNumber),
    status: { $in: PARKING_INVENTORY_HOLDING_STATUSES },
  }).populate(DETAIL_POPULATE);

/** Unpaid holds whose reservation window has lapsed — the sweeper's input. */
export const findExpiredHolds = (limit = 100) =>
  ParkingBooking.find({
    status: PARKING_BOOKING_STATUS.PENDING,
    reservationExpiresAt: { $lt: new Date() },
  }).limit(limit);

/** Confirmed bookings whose entry window passed without a check-in. */
export const findNoShowCandidates = (cutoff, limit = 100) =>
  ParkingBooking.find({
    status: PARKING_BOOKING_STATUS.UPCOMING,
    entryAt: { $lt: cutoff },
    checkedInAt: null,
  }).limit(limit);

/** Append a lifecycle entry. Kept here so every path writes the same shape. */
export const pushHistory = (booking, status, note, userId) => {
  booking.history.push({ status, note: note || '', at: new Date(), updatedBy: userId || null });
};

/** Aggregate occupancy/revenue counters for one facility on one day. */
export const dashboardCounters = async (locationIds, dayStart, dayEnd) => {
  const match = { locationId: { $in: locationIds } };

  const [statusCounts, todayRevenue, arrivals, departures] = await Promise.all([
    ParkingBooking.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ParkingBooking.aggregate([
      {
        $match: {
          ...match,
          paymentStatus: 'paid',
          createdAt: { $gte: dayStart, $lte: dayEnd },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$pricing.amountPaid' },
          commission: { $sum: '$commission.amount' },
          partnerEarning: { $sum: '$commission.partnerEarning' },
          bookings: { $sum: 1 },
        },
      },
    ]),
    ParkingBooking.countDocuments({
      ...match,
      status: PARKING_BOOKING_STATUS.UPCOMING,
      entryAt: { $gte: dayStart, $lte: dayEnd },
    }),
    ParkingBooking.countDocuments({
      ...match,
      status: PARKING_BOOKING_STATUS.CHECKED_IN,
      exitAt: { $gte: dayStart, $lte: dayEnd },
    }),
  ]);

  const byStatus = statusCounts.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return {
    byStatus,
    todayRevenue: todayRevenue[0]?.revenue || 0,
    todayCommission: todayRevenue[0]?.commission || 0,
    todayPartnerEarning: todayRevenue[0]?.partnerEarning || 0,
    todayBookings: todayRevenue[0]?.bookings || 0,
    expectedArrivals: arrivals,
    expectedExits: departures,
  };
};

export { DETAIL_POPULATE };

export default {
  create,
  findById,
  findByIdDetailed,
  findByReference,
  findForCustomer,
  findForOperations,
  findActiveByVehicle,
  findExpiredHolds,
  findNoShowCandidates,
  pushHistory,
  dashboardCounters,
};
