import ParkingVehicleType from '../models/ParkingVehicleType.js';
import locationRepo from '../repositories/parkingLocationRepository.js';
import reviewRepo from '../repositories/parkingReviewRepository.js';
import availabilityService from '../services/parkingAvailabilityService.js';
import { quote } from '../services/parkingPricingService.js';
import { buildGoogleMapsUrl, hasValidCoordinates } from '../utils/parkingGeo.js';
import {
  PARKING_VEHICLE_TYPE_META,
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_AMENITIES,
} from '../config/parkingConfig.js';
import {
  validateSearchRadius,
  validateVehicleType,
  validateBookingWindow,
  firstError,
} from '../validators/parkingValidators.js';

// Public discovery endpoints. No authentication: browsing parking is open, in
// the same way ashram and temple search already are.

const parsePage = (v, fallback = 1) => Math.max(1, parseInt(v, 10) || fallback);
const parseLimit = (v, fallback = 20) => Math.min(50, Math.max(1, parseInt(v, 10) || fallback));

// @desc    Search parking with filters and optional proximity ordering
// @route   GET /api/parking/locations
// @access  Public
export const searchParking = async (req, res) => {
  try {
    const {
      city, state, destination, templeSlug, vehicleType,
      amenities, covered, evCharging, minRating,
      latitude, longitude, radiusKm,
      entryAt, exitAt,
      sortBy = 'recommended',
      page, limit,
    } = req.query;

    const radiusError = validateSearchRadius(radiusKm);
    if (radiusError) return res.status(400).json({ success: false, message: radiusError });

    if (vehicleType) {
      const vtError = validateVehicleType(vehicleType);
      if (vtError) return res.status(400).json({ success: false, message: vtError });
    }

    const amenityList = amenities
      ? String(amenities).split(',').map((a) => a.trim()).filter((a) => PARKING_AMENITIES.includes(a))
      : [];

    const filter = locationRepo.buildSearchFilter({
      city, state, destination, templeSlug, vehicleType,
      amenities: amenityList,
      covered: covered === 'true',
      evCharging: evCharging === 'true',
      minRating,
    });

    const pageNum = parsePage(page);
    const limitNum = parseLimit(limit);
    const skip = (pageNum - 1) * limitNum;

    const useGeo = hasValidCoordinates(latitude, longitude);

    let items;
    let total;

    if (useGeo) {
      [items, total] = await Promise.all([
        locationRepo.findNearby({ latitude, longitude, radiusKm: radiusKm || 10, filter, skip, limit: limitNum }),
        locationRepo.countNearby({ latitude, longitude, radiusKm: radiusKm || 10, filter }),
      ]);
    } else {
      const sortMap = {
        rating: { 'rating.average': -1, 'rating.count': -1 },
        newest: { createdAt: -1 },
        name: { name: 1 },
        recommended: { isFeatured: -1, 'rating.average': -1, createdAt: -1 },
      };
      ({ items, total } = await locationRepo.findPaged({
        filter,
        sort: sortMap[sortBy] || sortMap.recommended,
        skip,
        limit: limitNum,
      }));
    }

    // Annotate each card with live availability so the results list can show
    // "12 bays free" rather than sending the visitor to a dead end.
    const withAvailability = await Promise.all(
      items.map(async (loc) => {
        const summary = await availabilityService.getSummary(loc._id, { entryAt, exitAt });
        return {
          ...loc,
          availability: summary,
          googleMapsUrl: loc.googleMapsUrl || buildGoogleMapsUrl(loc.latitude, loc.longitude, loc.name),
        };
      })
    );

    return res.json({
      success: true,
      count: withAvailability.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: withAvailability,
    });
  } catch (error) {
    console.error('Parking search error:', error);
    return res.status(500).json({ success: false, message: 'Could not search parking right now.' });
  }
};

// @desc    Full detail for one parking facility
// @route   GET /api/parking/locations/:idOrSlug
// @access  Public
export const getParkingDetail = async (req, res) => {
  try {
    const location = await locationRepo.findBySlugOrId(req.params.idOrSlug);

    if (!location || location.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Parking not found.' });
    }

    const { entryAt, exitAt, vehicleType, latitude, longitude } = req.query;

    // Default the preview window to "the next two hours from now" so the detail
    // page always shows meaningful availability before the visitor picks dates.
    const from = entryAt ? new Date(entryAt) : new Date();
    const to = exitAt ? new Date(exitAt) : new Date(Date.now() + 2 * 3600000);

    const [slotAvailability, reviews] = await Promise.all([
      availabilityService.getAvailability({ location, vehicleType, entryAt: from, exitAt: to }),
      reviewRepo.findForLocation(location._id, { page: 1, limit: 10 }),
    ]);

    const payload = location.toObject();

    return res.json({
      success: true,
      data: {
        ...payload,
        googleMapsUrl: payload.googleMapsUrl || buildGoogleMapsUrl(payload.latitude, payload.longitude, payload.name),
        distanceKm: hasValidCoordinates(latitude, longitude)
          ? locationRepo.annotateDistance([payload], latitude, longitude)[0].distanceKm
          : null,
        slotTypes: slotAvailability,
        reviews: reviews.items,
        reviewCount: reviews.total,
      },
    });
  } catch (error) {
    console.error('Parking detail error:', error);
    return res.status(500).json({ success: false, message: 'Could not load this parking.' });
  }
};

// @desc    Live availability + pricing for a specific window
// @route   GET /api/parking/locations/:id/availability
// @access  Public
export const getAvailability = async (req, res) => {
  try {
    const { entryAt, exitAt, vehicleType } = req.query;

    const error = firstError([
      validateBookingWindow(entryAt, exitAt),
      vehicleType ? validateVehicleType(vehicleType) : null,
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const location = await locationRepo.findById(req.params.id);
    if (!location || location.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Parking not found.' });
    }

    const slotTypes = await availabilityService.getAvailability({
      location, vehicleType, entryAt, exitAt,
    });

    return res.json({ success: true, data: { locationId: location._id, slotTypes } });
  } catch (error) {
    console.error('Parking availability error:', error);
    return res.status(500).json({ success: false, message: 'Could not check availability.' });
  }
};

// @desc    Price a stay before booking. Same engine that bills it.
// @route   POST /api/parking/quote
// @access  Public
export const getQuote = async (req, res) => {
  try {
    const { locationId, slotTypeId, vehicleType, entryAt, exitAt } = req.body;

    const error = firstError([
      validateVehicleType(vehicleType),
      validateBookingWindow(entryAt, exitAt),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const location = await locationRepo.findById(locationId);
    if (!location || location.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Parking not found.' });
    }

    const slotTypes = await locationRepo.findSlotTypes(locationId);
    const slotType = slotTypes.find((s) => s._id.toString() === String(slotTypeId));
    if (!slotType) {
      return res.status(404).json({ success: false, message: 'Parking area not found.' });
    }

    const priced = await quote({ location, slotType, vehicleType, entryAt, exitAt });
    if (!priced.ok) {
      return res.status(400).json({ success: false, code: priced.code, message: priced.message });
    }

    return res.json({ success: true, data: priced.quote });
  } catch (error) {
    console.error('Parking quote error:', error);
    return res.status(500).json({ success: false, message: 'Could not price this booking.' });
  }
};

// @desc    Reviews for a facility
// @route   GET /api/parking/locations/:id/reviews
// @access  Public
export const getReviews = async (req, res) => {
  try {
    const { items, total } = await reviewRepo.findForLocation(req.params.id, {
      page: parsePage(req.query.page),
      limit: parseLimit(req.query.limit, 10),
    });
    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('Parking reviews error:', error);
    return res.status(500).json({ success: false, message: 'Could not load reviews.' });
  }
};

// @desc    Supported vehicle types, for the booking form's picker
// @route   GET /api/parking/vehicle-types
// @access  Public
export const getVehicleTypes = async (req, res) => {
  try {
    const seeded = await ParkingVehicleType.find({ isActive: true }).sort({ displayOrder: 1 }).lean();

    // Fall back to the code catalogue when the collection has not been seeded,
    // so the booking form is never empty on a fresh install.
    const data = seeded.length
      ? seeded.map((v) => ({ code: v.code, label: v.label, icon: v.icon, footprint: v.footprint }))
      : PARKING_VEHICLE_TYPE_VALUES.map((code) => ({
          code,
          label: PARKING_VEHICLE_TYPE_META[code].label,
          icon: PARKING_VEHICLE_TYPE_META[code].icon,
          footprint: PARKING_VEHICLE_TYPE_META[code].footprint,
        }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Parking vehicle types error:', error);
    return res.status(500).json({ success: false, message: 'Could not load vehicle types.' });
  }
};

// @desc    Filter metadata for the search UI (amenities, vehicle types)
// @route   GET /api/parking/filters
// @access  Public
export const getFilterOptions = async (req, res) => {
  return res.json({
    success: true,
    data: {
      vehicleTypes: PARKING_VEHICLE_TYPE_VALUES.map((code) => ({
        code,
        label: PARKING_VEHICLE_TYPE_META[code].label,
        icon: PARKING_VEHICLE_TYPE_META[code].icon,
      })),
      amenities: PARKING_AMENITIES.map((key) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
      sortOptions: [
        { value: 'recommended', label: 'Recommended' },
        { value: 'rating', label: 'Top Rated' },
        { value: 'newest', label: 'Newest' },
        { value: 'name', label: 'Name (A–Z)' },
      ],
    },
  });
};

export default {
  searchParking,
  getParkingDetail,
  getAvailability,
  getQuote,
  getReviews,
  getVehicleTypes,
  getFilterOptions,
};
