import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../../../middlewares/authMiddleware.js';
import {
  resolveParkingAccess,
  requireParkingCapability,
  enforceLocationScope,
} from '../middlewares/parkingAuth.js';
import { PARKING_CAPABILITIES } from '../config/parkingConfig.js';
import {
  verifyPass,
  checkIn,
  checkOut,
  lookupVehicle,
  listScanLogs,
  myLocations,
} from '../controllers/parkingScanController.js';

// The Security Guard panel.
//
// Two layers of authorisation on every route:
//   1. `requireParkingCapability` — the guard role holds only SCAN_QR,
//      VIEW_BOOKING, CHECK_IN and CHECK_OUT, so there is no route here they
//      could reach that would delete, re-price, refund or manage anything.
//   2. `enforceLocationScope` — the facility must be one they are posted to, so
//      a guard at one site cannot operate the gate at another.
const router = express.Router();

// A gate is busy, but an unbounded scan endpoint is also a brute-force surface
// against the token space. This ceiling is generous for a real shift and still
// caps an attacker.
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many scans. Please wait a moment.' },
});

router.use(protect, resolveParkingAccess);

router.get(
  '/my-locations',
  requireParkingCapability(PARKING_CAPABILITIES.SCAN_QR),
  myLocations
);

router.post(
  '/verify',
  scanLimiter,
  requireParkingCapability(PARKING_CAPABILITIES.SCAN_QR, PARKING_CAPABILITIES.VIEW_BOOKING),
  enforceLocationScope('locationId'),
  verifyPass
);

router.post(
  '/check-in',
  scanLimiter,
  requireParkingCapability(PARKING_CAPABILITIES.CHECK_IN),
  enforceLocationScope('locationId'),
  checkIn
);

router.post(
  '/check-out',
  scanLimiter,
  requireParkingCapability(PARKING_CAPABILITIES.CHECK_OUT),
  enforceLocationScope('locationId'),
  checkOut
);

router.post(
  '/lookup',
  scanLimiter,
  requireParkingCapability(PARKING_CAPABILITIES.VIEW_BOOKING),
  enforceLocationScope('locationId'),
  lookupVehicle
);

// Reading the audit trail is a supervisory action, not a gate action — the
// guard capability set does not include it.
router.get(
  '/logs',
  requireParkingCapability(PARKING_CAPABILITIES.VIEW_REPORTS),
  listScanLogs
);

export default router;
