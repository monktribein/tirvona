import ParkingLocation from '../models/ParkingLocation.js';
import ParkingSlotType from '../models/ParkingSlotType.js';
import ParkingSlot from '../models/ParkingSlot.js';
import ParkingPricing from '../models/ParkingPricing.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import staffRepo from '../repositories/parkingStaffRepository.js';
import availabilityRepo from '../repositories/parkingAvailabilityRepository.js';
import reportService from '../services/parkingReportService.js';
import availabilityService from '../services/parkingAvailabilityService.js';
import { saveSettings, resolveSettings } from '../services/parkingSettingsService.js';
import { locationScopeFilter, canAccessLocation } from '../middlewares/parkingAuth.js';
import { generateLocationSlug } from '../utils/parkingIds.js';
import { escapeRegex } from '../../../utils/sanitize.js';
import {
  PARKING_ROLES,
  PARKING_AMENITIES,
  PARKING_VEHICLE_TYPE_VALUES,
} from '../config/parkingConfig.js';
import { validateObjectId, firstError } from '../validators/parkingValidators.js';

// Parking Partner & Parking Manager surface.
//
// Every read is filtered through `locationScopeFilter(req)` and every write is
// gated by `canAccessLocation`, so a partner can only ever touch their own
// estate — the same scoping discipline the ashram controllers apply through
// `scopedAshramIds`.

const parsePage = (v) => Math.max(1, parseInt(v, 10) || 1);
const parseLimit = (v, max = 50, fallback = 25) =>
  Math.min(max, Math.max(1, parseInt(v, 10) || fallback));

/** The location ids this caller may act on. */
const scopedIds = async (req) => {
  if (req.parking.isPlatformAdmin) {
    const all = await ParkingLocation.find({}).select('_id');
    return all.map((l) => l._id);
  }
  return req.parking.locationIds;
};

/** Reject a write against a facility outside the caller's scope. */
const assertLocationAccess = (req, res, locationId) => {
  if (!canAccessLocation(req, locationId)) {
    res.status(403).json({ success: false, message: 'You are not assigned to this parking location.' });
    return false;
  }
  return true;
};

// ── Dashboard ───────────────────────────────────────────────────────────────

// @desc    Owner dashboard tiles
// @route   GET /api/parking/partner/dashboard
// @access  Private (view_occupancy)
export const getDashboard = async (req, res) => {
  try {
    const locationIds = await scopedIds(req);
    if (!locationIds.length) {
      return res.json({
        success: true,
        data: {
          todayRevenue: 0, todayBookings: 0, occupiedSlots: 0, availableSlots: 0,
          reservedSlots: 0, expectedArrivals: 0, expectedExits: 0, occupancyPercent: 0,
          totalSlots: 0, currentlyParked: 0, statusBreakdown: {},
        },
      });
    }

    const data = await reportService.getOwnerDashboard(locationIds);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Parking dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Could not load the dashboard.' });
  }
};

// ── Locations ───────────────────────────────────────────────────────────────

// @desc    Facilities in the caller's scope
// @route   GET /api/parking/partner/locations
// @access  Private (view_occupancy)
export const listLocations = async (req, res) => {
  try {
    const filter = req.parking.isPlatformAdmin ? {} : { _id: { $in: req.parking.locationIds } };
    const locations = await ParkingLocation.find(filter).sort({ createdAt: -1 });

    const withOccupancy = await Promise.all(
      locations.map(async (loc) => ({
        ...loc.toObject(),
        liveOccupancy: await availabilityService.getSlotOccupancy([loc._id]),
      }))
    );

    return res.json({ success: true, count: withOccupancy.length, data: withOccupancy });
  } catch (error) {
    console.error('List parking locations error:', error);
    return res.status(500).json({ success: false, message: 'Could not load your parking locations.' });
  }
};

/** Fields a partner may write on a location. Status and verification are not
 *  among them — only a Super Admin sets those, via the admin controller. */
const LOCATION_WRITABLE = [
  'name', 'description', 'images', 'coverImage', 'address', 'latitude', 'longitude',
  'googleMapsUrl', 'nearbyDestinations', 'supportedVehicleTypes', 'amenities',
  'isCovered', 'hasCctv', 'hasSecurity', 'hasWashroom', 'hasEvCharging',
  'hasWheelchairAccess', 'openingHours', 'totalCapacity', 'contactPhone',
  'termsAndConditions', 'instructions',
];

const pickWritable = (body, allowed) => {
  const clean = {};
  allowed.forEach((key) => {
    if (body[key] !== undefined) clean[key] = body[key];
  });
  return clean;
};

// @desc    Create a parking facility (starts as draft, pending admin approval)
// @route   POST /api/parking/partner/locations
// @access  Private (manage_location)
export const createLocation = async (req, res) => {
  try {
    const partnerId = req.body.partnerId || req.parking.partnerIds[0];
    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'No parking partner account is linked to you.' });
    }
    if (!req.parking.isPlatformAdmin && !req.parking.partnerIds.some((p) => p.toString() === partnerId.toString())) {
      return res.status(403).json({ success: false, message: 'You cannot create a location for another partner.' });
    }

    const payload = pickWritable(req.body, LOCATION_WRITABLE);
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'A parking name is required.' });
    }

    payload.amenities = (payload.amenities || []).filter((a) => PARKING_AMENITIES.includes(a));
    payload.supportedVehicleTypes = (payload.supportedVehicleTypes || []).filter((v) =>
      PARKING_VEHICLE_TYPE_VALUES.includes(v)
    );

    const location = await ParkingLocation.create({
      ...payload,
      partnerId,
      slug: generateLocationSlug(payload.name, payload.address?.city),
      // A new listing is never live until an administrator reviews it.
      status: 'pending',
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Parking submitted for review.',
      data: location,
    });
  } catch (error) {
    console.error('Create parking location error:', error);
    return res.status(500).json({ success: false, message: 'Could not create this parking location.' });
  }
};

// @desc    Update a facility
// @route   PUT /api/parking/partner/locations/:id
// @access  Private (manage_location)
export const updateLocation = async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id, 'parking location');
    if (idError) return res.status(400).json({ success: false, message: idError });
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const payload = pickWritable(req.body, LOCATION_WRITABLE);

    if (payload.amenities) {
      payload.amenities = payload.amenities.filter((a) => PARKING_AMENITIES.includes(a));
    }
    if (payload.supportedVehicleTypes) {
      payload.supportedVehicleTypes = payload.supportedVehicleTypes.filter((v) =>
        PARKING_VEHICLE_TYPE_VALUES.includes(v)
      );
    }

    // Loaded and saved (rather than findByIdAndUpdate) so the pre-save hook
    // keeps the GeoJSON point in step with any lat/lng change.
    const location = await ParkingLocation.findById(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking not found.' });

    Object.assign(location, payload);
    await location.save();

    return res.json({ success: true, message: 'Parking updated.', data: location });
  } catch (error) {
    console.error('Update parking location error:', error);
    return res.status(500).json({ success: false, message: 'Could not update this parking location.' });
  }
};

// ── Slot types & bays ───────────────────────────────────────────────────────

// @desc    Slot types for a facility
// @route   GET /api/parking/partner/locations/:id/slot-types
// @access  Private (manage_slots or view_occupancy)
export const listSlotTypes = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;
    const slotTypes = await ParkingSlotType.find({ locationId: req.params.id }).sort({ displayOrder: 1 });
    return res.json({ success: true, count: slotTypes.length, data: slotTypes });
  } catch (error) {
    console.error('List slot types error:', error);
    return res.status(500).json({ success: false, message: 'Could not load parking areas.' });
  }
};

// @desc    Create a slot type
// @route   POST /api/parking/partner/locations/:id/slot-types
// @access  Private (manage_slots)
export const createSlotType = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const { name, code, description, vehicleTypes, totalCapacity, isCovered, hasEvCharging, floorLabel, displayOrder } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'A name is required.' });
    if (!Number.isInteger(Number(totalCapacity)) || Number(totalCapacity) < 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be a whole number.' });
    }

    const slotType = await ParkingSlotType.create({
      locationId: req.params.id,
      name,
      code,
      description,
      vehicleTypes: (vehicleTypes || []).filter((v) => PARKING_VEHICLE_TYPE_VALUES.includes(v)),
      totalCapacity: Number(totalCapacity),
      isCovered: Boolean(isCovered),
      hasEvCharging: Boolean(hasEvCharging),
      floorLabel,
      displayOrder: Number(displayOrder) || 0,
    });

    return res.status(201).json({ success: true, message: 'Parking area created.', data: slotType });
  } catch (error) {
    console.error('Create slot type error:', error);
    return res.status(500).json({ success: false, message: 'Could not create this parking area.' });
  }
};

// @desc    Update a slot type
// @route   PUT /api/parking/partner/slot-types/:id
// @access  Private (manage_slots)
export const updateSlotType = async (req, res) => {
  try {
    const slotType = await ParkingSlotType.findById(req.params.id);
    if (!slotType) return res.status(404).json({ success: false, message: 'Parking area not found.' });
    if (!assertLocationAccess(req, res, slotType.locationId)) return;

    const writable = ['name', 'code', 'description', 'vehicleTypes', 'totalCapacity', 'isCovered', 'hasEvCharging', 'floorLabel', 'isActive', 'displayOrder'];
    const payload = pickWritable(req.body, writable);

    if (payload.vehicleTypes) {
      payload.vehicleTypes = payload.vehicleTypes.filter((v) => PARKING_VEHICLE_TYPE_VALUES.includes(v));
    }

    Object.assign(slotType, payload);
    await slotType.save();

    return res.json({ success: true, message: 'Parking area updated.', data: slotType });
  } catch (error) {
    console.error('Update slot type error:', error);
    return res.status(500).json({ success: false, message: 'Could not update this parking area.' });
  }
};

// @desc    Physical bays for a facility
// @route   GET /api/parking/partner/locations/:id/slots
// @access  Private (manage_slots or view_occupancy)
export const listSlots = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const filter = { locationId: req.params.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.slotTypeId) filter.slotTypeId = req.query.slotTypeId;

    const slots = await ParkingSlot.find(filter)
      .populate('slotTypeId', 'name code')
      .sort({ slotNumber: 1 })
      .limit(500);

    return res.json({ success: true, count: slots.length, data: slots });
  } catch (error) {
    console.error('List slots error:', error);
    return res.status(500).json({ success: false, message: 'Could not load bays.' });
  }
};

// @desc    Create bays in bulk, e.g. B-001 … B-050
// @route   POST /api/parking/partner/locations/:id/slots/bulk
// @access  Private (manage_slots)
export const bulkCreateSlots = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const { slotTypeId, prefix = 'P', from = 1, to = 10, floorLabel = '', zone = '' } = req.body;

    const idError = validateObjectId(slotTypeId, 'parking area');
    if (idError) return res.status(400).json({ success: false, message: idError });

    const start = parseInt(from, 10);
    const end = parseInt(to, 10);

    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
      return res.status(400).json({ success: false, message: 'Provide a valid bay number range.' });
    }
    // Bounded so one request cannot insert an unbounded number of documents.
    if (end - start + 1 > 500) {
      return res.status(400).json({ success: false, message: 'Create at most 500 bays at a time.' });
    }

    const docs = [];
    for (let i = start; i <= end; i += 1) {
      docs.push({
        locationId: req.params.id,
        slotTypeId,
        slotNumber: `${prefix}${String(i).padStart(3, '0')}`.toUpperCase(),
        floorLabel,
        zone,
      });
    }

    // `ordered: false` so a clash with an existing bay label skips that one
    // rather than aborting the whole batch.
    let created = 0;
    try {
      const result = await ParkingSlot.insertMany(docs, { ordered: false });
      created = result.length;
    } catch (bulkError) {
      created = bulkError?.result?.nInserted ?? bulkError?.insertedDocs?.length ?? 0;
    }

    return res.status(201).json({
      success: true,
      message: `${created} bay(s) created.`,
      data: { created, requested: docs.length },
    });
  } catch (error) {
    console.error('Bulk create slots error:', error);
    return res.status(500).json({ success: false, message: 'Could not create bays.' });
  }
};

// @desc    Change a bay's status (maintenance, blocked, available)
// @route   PATCH /api/parking/partner/slots/:id
// @access  Private (manage_slots)
export const updateSlotStatus = async (req, res) => {
  try {
    const slot = await ParkingSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Bay not found.' });
    if (!assertLocationAccess(req, res, slot.locationId)) return;

    // An occupied bay must be released by a check-out, not by an edit — doing it
    // here would strand the booking that is physically parked in it.
    if (slot.status === 'occupied' && req.body.status && req.body.status !== 'occupied') {
      return res.status(400).json({
        success: false,
        message: 'This bay is occupied. Check the vehicle out before changing its status.',
      });
    }

    if (req.body.status) slot.status = req.body.status;
    if (req.body.maintenanceNote !== undefined) slot.maintenanceNote = req.body.maintenanceNote;
    if (req.body.isActive !== undefined) slot.isActive = Boolean(req.body.isActive);

    await slot.save();
    return res.json({ success: true, message: 'Bay updated.', data: slot });
  } catch (error) {
    console.error('Update slot error:', error);
    return res.status(500).json({ success: false, message: 'Could not update this bay.' });
  }
};

// ── Pricing ─────────────────────────────────────────────────────────────────

// @desc    Rate cards for a facility
// @route   GET /api/parking/partner/locations/:id/pricing
// @access  Private (manage_pricing)
export const listPricing = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;
    const cards = await ParkingPricing.find({ locationId: req.params.id }).sort({ vehicleType: 1 });
    return res.json({ success: true, count: cards.length, data: cards });
  } catch (error) {
    console.error('List pricing error:', error);
    return res.status(500).json({ success: false, message: 'Could not load pricing.' });
  }
};

// @desc    Create or replace a rate card
// @route   POST /api/parking/partner/locations/:id/pricing
// @access  Private (manage_pricing)
export const upsertPricing = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const { slotTypeId = null, vehicleType, mode, baseFee, hourlyRate, dailyRate, slabs, peakMultiplier, overstayMultiplier, taxPercent, minimumBillableHours, freeMinutes, validFrom, validUntil } = req.body;

    if (!PARKING_VEHICLE_TYPE_VALUES.includes(vehicleType)) {
      return res.status(400).json({ success: false, message: 'Select a valid vehicle type.' });
    }

    const card = await ParkingPricing.findOneAndUpdate(
      { locationId: req.params.id, slotTypeId: slotTypeId || null, vehicleType },
      {
        $set: {
          mode, baseFee, hourlyRate, dailyRate, slabs, peakMultiplier,
          overstayMultiplier, taxPercent, minimumBillableHours, freeMinutes,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          isActive: true,
          updatedBy: req.user._id,
        },
        $setOnInsert: { locationId: req.params.id, slotTypeId: slotTypeId || null, vehicleType },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, message: 'Pricing saved.', data: card });
  } catch (error) {
    console.error('Upsert pricing error:', error);
    return res.status(500).json({ success: false, message: 'Could not save pricing.' });
  }
};

// ── Availability ────────────────────────────────────────────────────────────

// @desc    Availability calendar for a facility
// @route   GET /api/parking/partner/locations/:id/calendar
// @access  Private (manage_availability or view_occupancy)
export const getCalendar = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const startDate = req.query.startDate || new Date();
    const endDate = req.query.endDate || new Date(Date.now() + 30 * 86400000);

    const calendar = await availabilityService.getCalendar({
      locationId: req.params.id,
      startDate,
      endDate,
    });

    return res.json({ success: true, count: calendar.length, data: calendar });
  } catch (error) {
    console.error('Parking calendar error:', error);
    return res.status(500).json({ success: false, message: 'Could not load the calendar.' });
  }
};

// @desc    Block bays or close a date
// @route   POST /api/parking/partner/locations/:id/availability
// @access  Private (manage_availability)
export const setAvailability = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const { slotTypeId, date, blockedCount, isClosed, note } = req.body;

    const error = firstError([
      validateObjectId(slotTypeId, 'parking area'),
      date ? null : 'A date is required',
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const slotType = await ParkingSlotType.findById(slotTypeId);
    if (!slotType || slotType.locationId.toString() !== req.params.id) {
      return res.status(404).json({ success: false, message: 'Parking area not found here.' });
    }

    let row;
    if (isClosed !== undefined) {
      row = await availabilityRepo.setClosed({
        locationId: req.params.id, slotTypeId, date, isClosed,
        totalCapacity: slotType.totalCapacity, note,
      });
    }
    if (blockedCount !== undefined) {
      row = await availabilityRepo.setBlocked({
        locationId: req.params.id, slotTypeId, date, blockedCount: Number(blockedCount),
        totalCapacity: slotType.totalCapacity, note,
      });
    }

    return res.json({ success: true, message: 'Availability updated.', data: row });
  } catch (error) {
    console.error('Set availability error:', error);
    return res.status(500).json({ success: false, message: 'Could not update availability.' });
  }
};

// ── Bookings ────────────────────────────────────────────────────────────────

// @desc    Bookings across the caller's facilities
// @route   GET /api/parking/partner/bookings
// @access  Private (manage_bookings)
export const listBookings = async (req, res) => {
  try {
    const { items, total } = await bookingRepo.findForOperations({
      scopeFilter: locationScopeFilter(req),
      locationId: req.query.locationId,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      vehicleNumber: req.query.vehicleNumber,
      page: parsePage(req.query.page),
      limit: parseLimit(req.query.limit),
    });

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('List parking bookings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load bookings.' });
  }
};

// ── Staff ───────────────────────────────────────────────────────────────────

// @desc    Staff grants for the caller's partner account
// @route   GET /api/parking/partner/staff
// @access  Private (manage_staff)
export const listStaff = async (req, res) => {
  try {
    const partnerId = req.query.partnerId || req.parking.partnerIds[0];
    if (!partnerId) return res.json({ success: true, count: 0, data: [] });

    if (!req.parking.isPlatformAdmin && !req.parking.partnerIds.some((p) => p.toString() === partnerId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorised for this partner.' });
    }

    const staff = await staffRepo.findStaffForPartner(partnerId);
    return res.json({ success: true, count: staff.length, data: staff });
  } catch (error) {
    console.error('List parking staff error:', error);
    return res.status(500).json({ success: false, message: 'Could not load staff.' });
  }
};

// @desc    Grant a parking role to an existing platform user
// @route   POST /api/parking/partner/staff
// @access  Private (manage_staff)
//
// Note what this does NOT do: it never touches the User document. The person
// must already have a Tirvona account; this only records a parking-module grant
// against it, which is what keeps the core auth schema untouched.
export const assignStaff = async (req, res) => {
  try {
    const { userId, parkingRole, locationIds = [], employeeCode, shift, phone } = req.body;

    const partnerId = req.body.partnerId || req.parking.partnerIds[0];
    const error = firstError([
      validateObjectId(userId, 'user'),
      validateObjectId(partnerId, 'partner'),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    if (!req.parking.isPlatformAdmin && !req.parking.partnerIds.some((p) => p.toString() === partnerId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorised for this partner.' });
    }

    // A manager may only appoint guards; promoting to partner or manager is a
    // partner/admin action. Without this a manager could grant themselves more.
    const isManagerOnly =
      !req.parking.isPlatformAdmin &&
      req.parking.roles.includes(PARKING_ROLES.MANAGER) &&
      !req.parking.roles.includes(PARKING_ROLES.PARTNER);

    if (isManagerOnly && parkingRole !== PARKING_ROLES.GUARD) {
      return res.status(403).json({
        success: false,
        message: 'A parking manager can only assign security guards.',
      });
    }

    // Every named location must be inside the caller's own scope.
    for (const locId of locationIds) {
      if (!canAccessLocation(req, locId)) {
        return res.status(403).json({ success: false, message: 'One of the locations is outside your scope.' });
      }
    }

    const grant = await staffRepo.upsertGrant({
      userId, partnerId, parkingRole, locationIds,
      employeeCode, shift, phone,
      assignedBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: 'Staff assigned.', data: grant });
  } catch (error) {
    if (error.message?.startsWith('Unknown parking role')) {
      return res.status(400).json({ success: false, message: 'Select a valid parking role.' });
    }
    console.error('Assign parking staff error:', error);
    return res.status(500).json({ success: false, message: 'Could not assign this staff member.' });
  }
};

// @desc    Revoke a staff grant
// @route   DELETE /api/parking/partner/staff/:id
// @access  Private (manage_staff)
export const revokeStaff = async (req, res) => {
  try {
    const grant = await staffRepo.findGrantById(req.params.id);
    if (!grant) return res.status(404).json({ success: false, message: 'Staff record not found.' });

    if (!req.parking.isPlatformAdmin && !req.parking.partnerIds.some((p) => p.toString() === grant.partnerId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorised for this partner.' });
    }

    await staffRepo.deactivateGrant(grant._id);
    return res.json({ success: true, message: 'Staff access revoked.' });
  } catch (error) {
    console.error('Revoke parking staff error:', error);
    return res.status(500).json({ success: false, message: 'Could not revoke this staff member.' });
  }
};

// ── Reports & settings ──────────────────────────────────────────────────────

// @desc    Partner reports
// @route   GET /api/parking/partner/reports
// @access  Private (view_reports)
export const getReports = async (req, res) => {
  try {
    const locationIds = await scopedIds(req);
    if (!locationIds.length) return res.json({ success: true, data: {} });

    const from = req.query.from || new Date(Date.now() - 30 * 86400000);
    const to = req.query.to || new Date();

    const [revenue, peakHours, cancellations, averageStay, popular, occupancy] = await Promise.all([
      reportService.getRevenueReport({ locationIds, from, to }),
      reportService.getPeakHours({ locationIds, from, to }),
      reportService.getCancellationReport({ locationIds, from, to }),
      reportService.getAverageStay({ locationIds, from, to }),
      reportService.getPopularLocations({ locationIds, from, to }),
      reportService.getOccupancyReport({ locationIds, from, to }),
    ]);

    return res.json({
      success: true,
      data: { revenue, peakHours, cancellations, averageStay, popular, occupancy, range: { from, to } },
    });
  } catch (error) {
    console.error('Parking reports error:', error);
    return res.status(500).json({ success: false, message: 'Could not build reports.' });
  }
};

// @desc    Read effective settings for a facility
// @route   GET /api/parking/partner/locations/:id/settings
// @access  Private (manage_location)
export const getLocationSettings = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    const location = await ParkingLocation.findById(req.params.id).select('partnerId');
    const settings = await resolveSettings({
      locationId: req.params.id,
      partnerId: location?.partnerId,
    });

    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get parking settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load settings.' });
  }
};

// @desc    Override settings for a facility
// @route   PUT /api/parking/partner/locations/:id/settings
// @access  Private (manage_location)
export const updateLocationSettings = async (req, res) => {
  try {
    if (!assertLocationAccess(req, res, req.params.id)) return;

    // A partner may tune operational policy but not the platform's commission —
    // that stays a Super Admin decision, in the admin controller.
    const { commissionPercent, ...safeValues } = req.body;

    const saved = await saveSettings({
      scope: 'location',
      locationId: req.params.id,
      values: safeValues,
      updatedBy: req.user._id,
    });

    return res.json({ success: true, message: 'Settings updated.', data: saved });
  } catch (error) {
    console.error('Update parking settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not update settings.' });
  }
};

export { escapeRegex };

export default {
  getDashboard,
  listLocations,
  createLocation,
  updateLocation,
  listSlotTypes,
  createSlotType,
  updateSlotType,
  listSlots,
  bulkCreateSlots,
  updateSlotStatus,
  listPricing,
  upsertPricing,
  getCalendar,
  setAvailability,
  listBookings,
  listStaff,
  assignStaff,
  revokeStaff,
  getReports,
  getLocationSettings,
  updateLocationSettings,
};
