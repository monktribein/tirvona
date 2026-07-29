import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware.js';
import {
  resolveParkingAccess,
  requireParkingCapability,
} from '../middlewares/parkingAuth.js';
import { PARKING_CAPABILITIES as C } from '../config/parkingConfig.js';
import {
  listPartners,
  createPartner,
  updatePartnerStatus,
  listAllLocations,
  updateLocationStatus,
  listAllBookings,
  refundBooking,
  listCommissions,
  settleCommissions,
  getAnalytics,
  listTransactions,
  getPlatformSettings,
  updatePlatformSettings,
  listHolidays,
  createHoliday,
  deleteHoliday,
  seedVehicleTypes,
  runMaintenanceSweep,
} from '../controllers/parkingAdminController.js';

// Super Admin surface.
//
// Belt and braces: `restrictTo('super_admin')` is the platform's own existing
// role gate (imported unmodified), and the capability gate behind it is the
// parking module's. Either alone would suffice; both together mean a future
// change to one cannot silently open this router.
const router = express.Router();

router.use(protect, restrictTo('super_admin'), resolveParkingAccess);

// ── Partners ────────────────────────────────────────────────────────────────
router.get('/partners', requireParkingCapability(C.MANAGE_PARTNERS), listPartners);
router.post('/partners', requireParkingCapability(C.MANAGE_PARTNERS), createPartner);
router.patch('/partners/:id/status', requireParkingCapability(C.MANAGE_PARTNERS), updatePartnerStatus);

// ── Locations ───────────────────────────────────────────────────────────────
router.get('/locations', requireParkingCapability(C.MANAGE_PARTNERS), listAllLocations);
router.patch('/locations/:id/status', requireParkingCapability(C.MANAGE_PARTNERS), updateLocationStatus);

// ── Bookings & refunds ──────────────────────────────────────────────────────
router.get('/bookings', requireParkingCapability(C.MANAGE_BOOKINGS), listAllBookings);
router.post('/bookings/:id/refund', requireParkingCapability(C.ISSUE_REFUND), refundBooking);

// ── Commission & settlement ─────────────────────────────────────────────────
router.get('/commissions', requireParkingCapability(C.MANAGE_COMMISSION), listCommissions);
router.post('/commissions/settle', requireParkingCapability(C.MANAGE_COMMISSION), settleCommissions);

// ── Analytics ───────────────────────────────────────────────────────────────
router.get('/analytics', requireParkingCapability(C.VIEW_ANALYTICS), getAnalytics);
router.get('/transactions', requireParkingCapability(C.VIEW_ANALYTICS), listTransactions);

// ── Settings & catalogue ────────────────────────────────────────────────────
router.get('/settings', requireParkingCapability(C.MANAGE_SETTINGS), getPlatformSettings);
router.put('/settings', requireParkingCapability(C.MANAGE_SETTINGS), updatePlatformSettings);

router.get('/holidays', requireParkingCapability(C.MANAGE_SETTINGS), listHolidays);
router.post('/holidays', requireParkingCapability(C.MANAGE_SETTINGS), createHoliday);
router.delete('/holidays/:id', requireParkingCapability(C.MANAGE_SETTINGS), deleteHoliday);

router.post('/vehicle-types/seed', requireParkingCapability(C.MANAGE_SETTINGS), seedVehicleTypes);
router.post('/maintenance/sweep', requireParkingCapability(C.MANAGE_SETTINGS), runMaintenanceSweep);

export default router;
