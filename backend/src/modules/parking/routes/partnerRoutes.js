import express from 'express';
import { protect } from '../../../middlewares/authMiddleware.js';
import {
  resolveParkingAccess,
  requireParkingCapability,
} from '../middlewares/parkingAuth.js';
import { PARKING_CAPABILITIES as C } from '../config/parkingConfig.js';
import {
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
} from '../controllers/parkingPartnerController.js';

// Parking Partner & Parking Manager operations.
//
// Capability-gated per route rather than role-gated, so the manager/partner
// split is expressed once (in the capability matrix) instead of being restated
// on every endpoint. Facility scoping is enforced inside each handler.
const router = express.Router();

router.use(protect, resolveParkingAccess);

router.get('/dashboard', requireParkingCapability(C.VIEW_OCCUPANCY), getDashboard);
router.get('/reports', requireParkingCapability(C.VIEW_REPORTS), getReports);
router.get('/bookings', requireParkingCapability(C.MANAGE_BOOKINGS), listBookings);

// ── Locations ───────────────────────────────────────────────────────────────
router.get('/locations', requireParkingCapability(C.VIEW_OCCUPANCY), listLocations);
router.post('/locations', requireParkingCapability(C.MANAGE_LOCATION), createLocation);
router.put('/locations/:id', requireParkingCapability(C.MANAGE_LOCATION), updateLocation);

router.get('/locations/:id/settings', requireParkingCapability(C.MANAGE_LOCATION), getLocationSettings);
router.put('/locations/:id/settings', requireParkingCapability(C.MANAGE_LOCATION), updateLocationSettings);

// ── Slot types & bays ───────────────────────────────────────────────────────
router.get('/locations/:id/slot-types', requireParkingCapability(C.VIEW_OCCUPANCY), listSlotTypes);
router.post('/locations/:id/slot-types', requireParkingCapability(C.MANAGE_SLOTS), createSlotType);
router.put('/slot-types/:id', requireParkingCapability(C.MANAGE_SLOTS), updateSlotType);

router.get('/locations/:id/slots', requireParkingCapability(C.VIEW_OCCUPANCY), listSlots);
router.post('/locations/:id/slots/bulk', requireParkingCapability(C.MANAGE_SLOTS), bulkCreateSlots);
router.patch('/slots/:id', requireParkingCapability(C.MANAGE_SLOTS), updateSlotStatus);

// ── Pricing ─────────────────────────────────────────────────────────────────
router.get('/locations/:id/pricing', requireParkingCapability(C.MANAGE_PRICING), listPricing);
router.post('/locations/:id/pricing', requireParkingCapability(C.MANAGE_PRICING), upsertPricing);

// ── Availability ────────────────────────────────────────────────────────────
router.get('/locations/:id/calendar', requireParkingCapability(C.VIEW_OCCUPANCY), getCalendar);
router.post('/locations/:id/availability', requireParkingCapability(C.MANAGE_AVAILABILITY), setAvailability);

// ── Staff ───────────────────────────────────────────────────────────────────
router.get('/staff', requireParkingCapability(C.MANAGE_STAFF), listStaff);
router.post('/staff', requireParkingCapability(C.MANAGE_STAFF), assignStaff);
router.delete('/staff/:id', requireParkingCapability(C.MANAGE_STAFF), revokeStaff);

export default router;
