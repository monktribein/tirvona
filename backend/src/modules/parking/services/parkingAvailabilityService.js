import ParkingSlotType from '../models/ParkingSlotType.js';
import ParkingSlot from '../models/ParkingSlot.js';
import availabilityRepo from '../repositories/parkingAvailabilityRepository.js';
import { quote } from './parkingPricingService.js';
import { unitsFor } from './parkingBookingService.js';
import { datesInSpan } from '../utils/parkingTime.js';
import { PARKING_SLOT_STATUS } from '../config/parkingConfig.js';

// Live availability and quoting for a facility.
//
// Backs the "View Live Availability" the visitor sees on search results and on
// the detail page, and the occupancy figures the partner dashboard shows.

/**
 * For each slot type that accepts the vehicle: how many bays are free across the
 * requested window, and what the stay would cost.
 *
 * Free capacity is the LOWEST across the span — a bay is only bookable if it is
 * free every day of the stay, so reporting the minimum is the honest number.
 */
export const getAvailability = async ({ location, vehicleType, entryAt, exitAt }) => {
  const slotTypes = await ParkingSlotType.find({
    locationId: location._id,
    isActive: true,
    ...(vehicleType ? { vehicleTypes: vehicleType } : {}),
  }).sort({ displayOrder: 1, name: 1 });

  if (!slotTypes.length) return [];

  const dates = datesInSpan(entryAt, exitAt);
  const units = vehicleType ? unitsFor(vehicleType) : 1;

  const results = await Promise.all(
    slotTypes.map(async (slotType) => {
      const freeUnits = await availabilityRepo.lowestFreeCapacity(
        slotType._id,
        dates,
        slotType.totalCapacity
      );

      // A large vehicle consumes several units, so the bookable count is the
      // free units divided by its footprint.
      const availableForVehicle = Math.floor(freeUnits / units);

      let pricing = null;
      if (vehicleType) {
        const priced = await quote({ location, slotType, vehicleType, entryAt, exitAt });
        pricing = priced.ok ? priced.quote : null;
      }

      return {
        slotTypeId: slotType._id,
        name: slotType.name,
        code: slotType.code,
        description: slotType.description,
        vehicleTypes: slotType.vehicleTypes,
        isCovered: slotType.isCovered,
        hasEvCharging: slotType.hasEvCharging,
        floorLabel: slotType.floorLabel,
        totalCapacity: slotType.totalCapacity,
        availableCount: availableForVehicle,
        isAvailable: availableForVehicle > 0,
        pricing,
      };
    })
  );

  return results;
};

/** Total free capacity at a facility right now — the search-card summary. */
export const getSummary = async (locationId, { entryAt, exitAt } = {}) => {
  const slotTypes = await ParkingSlotType.find({ locationId, isActive: true });
  if (!slotTypes.length) return { totalCapacity: 0, availableCount: 0 };

  const from = entryAt || new Date();
  const to = exitAt || new Date(Date.now() + 3600000);
  const dates = datesInSpan(from, to);

  let totalCapacity = 0;
  let availableCount = 0;

  for (const slotType of slotTypes) {
    totalCapacity += slotType.totalCapacity;
    availableCount += await availabilityRepo.lowestFreeCapacity(
      slotType._id,
      dates,
      slotType.totalCapacity
    );
  }

  return {
    totalCapacity,
    availableCount,
    occupancyPercent:
      totalCapacity > 0
        ? Number((((totalCapacity - availableCount) / totalCapacity) * 100).toFixed(1))
        : 0,
  };
};

/** Physical bay counts by status — the partner's live occupancy board. */
export const getSlotOccupancy = async (locationIds) => {
  const rows = await ParkingSlot.aggregate([
    { $match: { locationId: { $in: locationIds }, isActive: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = rows.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const occupied = byStatus[PARKING_SLOT_STATUS.OCCUPIED] || 0;

  return {
    total,
    available: byStatus[PARKING_SLOT_STATUS.AVAILABLE] || 0,
    occupied,
    reserved: byStatus[PARKING_SLOT_STATUS.RESERVED] || 0,
    maintenance: byStatus[PARKING_SLOT_STATUS.MAINTENANCE] || 0,
    blocked: byStatus[PARKING_SLOT_STATUS.BLOCKED] || 0,
    occupancyPercent: total > 0 ? Number(((occupied / total) * 100).toFixed(1)) : 0,
  };
};

/** Day-by-day calendar for a facility, for the partner's availability screen. */
export const getCalendar = async ({ locationId, startDate, endDate }) => {
  const [slotTypes, rows] = await Promise.all([
    ParkingSlotType.find({ locationId, isActive: true }).lean(),
    availabilityRepo.findRange(locationId, startDate, endDate),
  ]);

  const capacityByType = new Map(slotTypes.map((s) => [s._id.toString(), s.totalCapacity]));

  return rows.map((row) => {
    const capacity = row.totalCapacity ?? capacityByType.get(row.slotTypeId.toString()) ?? 0;
    return {
      date: row.date,
      slotTypeId: row.slotTypeId,
      totalCapacity: capacity,
      bookedCount: row.bookedCount,
      blockedCount: row.blockedCount,
      availableCount: Math.max(0, capacity - row.bookedCount - row.blockedCount),
      customPrice: row.customPrice,
      isClosed: row.isClosed,
      note: row.note,
    };
  });
};

export default { getAvailability, getSummary, getSlotOccupancy, getCalendar };
