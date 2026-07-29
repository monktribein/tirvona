import scanService from '../services/parkingScanService.js';
import staffRepo from '../repositories/parkingStaffRepository.js';
import ParkingLocation from '../models/ParkingLocation.js';
import { locationScopeFilter } from '../middlewares/parkingAuth.js';
import {
  validateQrToken,
  validateObjectId,
  validateVehicleNumber,
  firstError,
} from '../validators/parkingValidators.js';

// The Security Guard panel.
//
// Five actions and nothing else: verify, check in, check out, look a vehicle up,
// read a booking. There is deliberately no delete, no pricing, no refund and no
// management handler in this file — the capability gates on the routes enforce
// it, and the absence of the code makes it structural rather than just policy.

// @desc    Verify a pass without changing anything
// @route   POST /api/parking/scan/verify
// @access  Private (scan_qr)
export const verifyPass = async (req, res) => {
  try {
    const { token, locationId } = req.body;

    const error = firstError([
      validateQrToken(token),
      validateObjectId(locationId, 'parking location'),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await scanService.verifyScan({ req, token, locationId });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, code: result.code, message: result.message });
    }

    await staffRepo.touchLastActive(req.user._id);

    const b = result.booking;

    // Only what the guard needs at the gate. No pricing internals, no customer
    // contact details beyond the driver on the booking.
    return res.json({
      success: true,
      data: {
        bookingReference: b.bookingReference,
        status: b.status,
        paymentStatus: b.paymentStatus,
        vehicleNumber: b.vehicleNumber,
        vehicleType: b.vehicleType,
        vehicleModel: b.vehicleModel,
        driverName: b.driverName,
        driverPhone: b.driverPhone,
        entryAt: b.entryAt,
        exitAt: b.exitAt,
        checkedInAt: b.checkedInAt,
        checkedOutAt: b.checkedOutAt,
        assignedSlotNumber: b.assignedSlotNumber,
        slotType: b.slotTypeId?.name,
        location: b.locationId?.name,
      },
    });
  } catch (error) {
    console.error('Parking verify scan error:', error);
    return res.status(500).json({ success: false, message: 'Could not verify this pass.' });
  }
};

// @desc    ENTRY — validate, check in, store entry time, assign a bay
// @route   POST /api/parking/scan/check-in
// @access  Private (check_in)
export const checkIn = async (req, res) => {
  try {
    const { token, locationId } = req.body;

    const error = firstError([
      validateQrToken(token),
      validateObjectId(locationId, 'parking location'),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await scanService.checkIn({ req, token, locationId });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, code: result.code, message: result.message });
    }

    await staffRepo.touchLastActive(req.user._id);

    return res.json({
      success: true,
      message: result.message,
      data: {
        bookingReference: result.booking.bookingReference,
        vehicleNumber: result.booking.vehicleNumber,
        status: result.booking.status,
        checkedInAt: result.booking.checkedInAt,
        assignedSlotNumber: result.booking.assignedSlotNumber,
        exitAt: result.booking.exitAt,
      },
    });
  } catch (error) {
    console.error('Parking check-in error:', error);
    return res.status(500).json({ success: false, message: 'Could not complete check-in.' });
  }
};

// @desc    EXIT — compute stay, assess overstay, take payment, release the bay
// @route   POST /api/parking/scan/check-out
// @access  Private (check_out)
export const checkOut = async (req, res) => {
  try {
    const { token, locationId, overstayPaymentMethod } = req.body;

    const error = firstError([
      validateQrToken(token),
      validateObjectId(locationId, 'parking location'),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await scanService.checkOut({
      req,
      token,
      locationId,
      overstayPaymentMethod: overstayPaymentMethod || 'cash',
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, code: result.code, message: result.message });
    }

    await staffRepo.touchLastActive(req.user._id);

    return res.json({
      success: true,
      message: result.message,
      data: {
        bookingReference: result.booking.bookingReference,
        vehicleNumber: result.booking.vehicleNumber,
        status: result.booking.status,
        checkedInAt: result.booking.checkedInAt,
        checkedOutAt: result.booking.checkedOutAt,
        actualDurationMinutes: result.booking.actualDurationMinutes,
        overstay: {
          minutes: result.overstay.overstayMinutes,
          chargeableHours: result.overstay.chargeableHours,
          amount: result.overstay.totalAmount,
        },
        releasedSlot: result.booking.assignedSlotNumber,
      },
    });
  } catch (error) {
    console.error('Parking check-out error:', error);
    return res.status(500).json({ success: false, message: 'Could not complete check-out.' });
  }
};

// @desc    Manual lookup by plate, for a dead phone or an unreadable screen
// @route   POST /api/parking/scan/lookup
// @access  Private (view_booking)
export const lookupVehicle = async (req, res) => {
  try {
    const { vehicleNumber, locationId } = req.body;

    const error = firstError([
      validateVehicleNumber(vehicleNumber),
      validateObjectId(locationId, 'parking location'),
    ]);
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await scanService.lookupByVehicle({ req, locationId, vehicleNumber });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const b = result.booking;
    return res.json({
      success: true,
      data: {
        bookingId: b._id,
        bookingReference: b.bookingReference,
        status: b.status,
        paymentStatus: b.paymentStatus,
        vehicleNumber: b.vehicleNumber,
        vehicleType: b.vehicleType,
        driverName: b.driverName,
        driverPhone: b.driverPhone,
        entryAt: b.entryAt,
        exitAt: b.exitAt,
        checkedInAt: b.checkedInAt,
        assignedSlotNumber: b.assignedSlotNumber,
        location: b.locationId?.name,
      },
    });
  } catch (error) {
    console.error('Parking vehicle lookup error:', error);
    return res.status(500).json({ success: false, message: 'Could not look up this vehicle.' });
  }
};

// @desc    Scan history (QR logs), scoped to the caller's facilities
// @route   GET /api/parking/scan/logs
// @access  Private (view_qr_logs or view_reports)
export const listScanLogs = async (req, res) => {
  try {
    const { items, total } = await scanService.listScanLogs({
      scopeFilter: locationScopeFilter(req),
      locationId: req.query.locationId,
      result: req.query.result,
      from: req.query.from,
      to: req.query.to,
      page: Math.max(1, parseInt(req.query.page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50)),
    });

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('Parking scan logs error:', error);
    return res.status(500).json({ success: false, message: 'Could not load scan logs.' });
  }
};

// @desc    The facilities this staff member may scan at
// @route   GET /api/parking/scan/my-locations
// @access  Private (scan_qr)
//
// Backs the location picker in the guard app: a guard sees only their own posts,
// so they cannot accidentally scan against a facility they do not work at.
export const myLocations = async (req, res) => {
  try {
    const filter = req.parking.isPlatformAdmin
      ? { status: 'active' }
      : { _id: { $in: req.parking.locationIds }, status: 'active' };

    const locations = await ParkingLocation.find(filter)
      .select('name slug address.city address.line1')
      .sort({ name: 1 })
      .limit(200);

    return res.json({
      success: true,
      data: locations,
      roles: req.parking.roles,
      capabilities: Array.from(req.parking.capabilities),
    });
  } catch (error) {
    console.error('Parking my-locations error:', error);
    return res.status(500).json({ success: false, message: 'Could not load your parking locations.' });
  }
};

export default { verifyPass, checkIn, checkOut, lookupVehicle, listScanLogs, myLocations };
