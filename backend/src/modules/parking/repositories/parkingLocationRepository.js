import ParkingLocation from '../models/ParkingLocation.js';
import ParkingSlotType from '../models/ParkingSlotType.js';
import { escapeRegex } from '../../../utils/sanitize.js';
import { distanceKm, hasValidCoordinates } from '../utils/parkingGeo.js';
import { PARKING_DEFAULTS } from '../config/parkingConfig.js';

// Data access for parking locations. Query construction lives here so the
// controllers stay thin and every caller gets the same escaping and the same
// "only active listings" default.

/** Fields safe to return on a public listing. */
const PUBLIC_FIELDS =
  'name slug description images coverImage address geo latitude longitude ' +
  'googleMapsUrl nearbyDestinations supportedVehicleTypes amenities isCovered ' +
  'hasCctv hasSecurity hasWashroom hasEvCharging hasWheelchairAccess ' +
  'openingHours totalCapacity contactPhone termsAndConditions instructions ' +
  'rating status isFeatured isVerified partnerId createdAt';

/**
 * Build the search filter from validated query params.
 *
 * Every regex is escaped via the platform's existing `escapeRegex` helper, so an
 * attacker-supplied term is matched literally and cannot trigger catastrophic
 * backtracking — the same treatment ashramController applies.
 */
export const buildSearchFilter = ({
  city,
  state,
  destination,
  templeSlug,
  vehicleType,
  amenities,
  covered,
  evCharging,
  minRating,
} = {}) => {
  const filter = { status: 'active' };

  if (city) filter['address.city'] = { $regex: escapeRegex(city), $options: 'i' };
  if (state) filter['address.state'] = { $regex: escapeRegex(state), $options: 'i' };

  if (templeSlug) {
    filter['nearbyDestinations.templeSlug'] = String(templeSlug).toLowerCase();
  } else if (destination) {
    // Free-text destination matches either the facility name or a nearby
    // landmark, so "Kashi Vishwanath" finds bays that merely serve it.
    const safe = escapeRegex(destination);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { 'address.city': { $regex: safe, $options: 'i' } },
      { 'address.landmark': { $regex: safe, $options: 'i' } },
      { 'nearbyDestinations.name': { $regex: safe, $options: 'i' } },
    ];
  }

  if (vehicleType) filter.supportedVehicleTypes = vehicleType;

  if (Array.isArray(amenities) && amenities.length) {
    filter.amenities = { $all: amenities };
  }
  if (covered === true) filter.isCovered = true;
  if (evCharging === true) filter.hasEvCharging = true;

  if (Number.isFinite(Number(minRating)) && Number(minRating) > 0) {
    filter['rating.average'] = { $gte: Number(minRating) };
  }

  return filter;
};

/**
 * Proximity search. Uses $geoNear so the 2dsphere index does the distance work
 * in the database rather than sorting the whole collection in Node.
 */
export const findNearby = async ({ latitude, longitude, radiusKm, filter, skip = 0, limit = 20 }) => {
  const maxDistanceMeters =
    Math.min(Number(radiusKm) || 10, PARKING_DEFAULTS.maxSearchRadiusKm) * 1000;

  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
        distanceField: 'distanceMeters',
        maxDistance: maxDistanceMeters,
        query: filter,
        spherical: true,
      },
    },
    { $addFields: { distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] } } },
    { $sort: { distanceMeters: 1, 'rating.average': -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  return ParkingLocation.aggregate(pipeline);
};

/** Non-geo search, ordered by the caller's choice. */
export const findPaged = async ({ filter, sort = { isFeatured: -1, 'rating.average': -1 }, skip = 0, limit = 20 }) => {
  const [items, total] = await Promise.all([
    ParkingLocation.find(filter).select(PUBLIC_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
    ParkingLocation.countDocuments(filter),
  ]);
  return { items, total };
};

/** Count for a geo result set, which $geoNear cannot give alongside the page. */
export const countNearby = async ({ latitude, longitude, radiusKm, filter }) => {
  const maxDistanceMeters =
    Math.min(Number(radiusKm) || 10, PARKING_DEFAULTS.maxSearchRadiusKm) * 1000;

  const result = await ParkingLocation.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
        distanceField: 'distanceMeters',
        maxDistance: maxDistanceMeters,
        query: filter,
        spherical: true,
      },
    },
    { $count: 'total' },
  ]);
  return result[0]?.total || 0;
};

export const findBySlugOrId = async (idOrSlug) => {
  const byId = /^[0-9a-fA-F]{24}$/.test(String(idOrSlug));
  return ParkingLocation.findOne(
    byId ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() }
  ).select(PUBLIC_FIELDS);
};

export const findById = (id) => ParkingLocation.findById(id);

export const findSlotTypes = (locationId, { activeOnly = true } = {}) =>
  ParkingSlotType.find({
    locationId,
    ...(activeOnly ? { isActive: true } : {}),
  }).sort({ displayOrder: 1, name: 1 });

export const findByPartner = (partnerId, extra = {}) =>
  ParkingLocation.find({ partnerId, ...extra }).sort({ createdAt: -1 });

/** Annotate a result set with distance when the caller sent coordinates. */
export const annotateDistance = (items, latitude, longitude) => {
  if (!hasValidCoordinates(latitude, longitude)) return items;
  return items.map((item) => ({
    ...item,
    distanceKm:
      item.distanceKm ?? distanceKm(Number(latitude), Number(longitude), item.latitude, item.longitude),
  }));
};

export { PUBLIC_FIELDS };

export default {
  buildSearchFilter,
  findNearby,
  countNearby,
  findPaged,
  findBySlugOrId,
  findById,
  findSlotTypes,
  findByPartner,
  annotateDistance,
};
