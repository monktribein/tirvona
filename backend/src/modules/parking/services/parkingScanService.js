import ParkingBooking from '../models/ParkingBooking.js';
import ParkingLocation from '../models/ParkingLocation.js';
import ParkingSlot from '../models/ParkingSlot.js';
import ParkingScanLog from '../models/ParkingScanLog.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import availabilityRepo from '../repositories/parkingAvailabilityRepository.js';
import {
  verifyToken,
  markEntryScanned,
  markExitScanned,
} from './parkingQrService.js';
import { quoteOverstay } from './parkingPricingService.js';
import { collectOverstay } from './parkingPaymentService.js';
import { unitsFor } from './parkingBookingService.js';
import { fingerprintQrToken } from '../utils/parkingCrypto.js';
import { minutesBetween } from '../utils/parkingTime.js';
import {
  PARKING_BOOKING_STATUS,
  PARKING_PAYMENT_STATUS,
  PARKING_SCAN_ACTIONS,
  PARKING_SCAN_RESULTS,
  PARKING_SLOT_STATUS,
} from '../config/parkingConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// Gate operations — the security guard's entire surface area.
//
// ENTRY: scan → validate → find booking → confirm it is live → mark check-in →
//        store entry time → assign a bay.
// EXIT:  scan → compute stay → assess overstay → take payment if owed →
//        mark check-out → release the bay and the day's capacity.
//
// Every scan is logged, including the failures, so a disputed entry or a
// probing attempt is answerable from parking_scan_logs.
// ─────────────────────────────────────────────────────────────────────────────

/** Map a verification failure onto its scan-log result code. */
const RESULT_FOR_CODE = {
  INVALID_TOKEN: PARKING_SCAN_RESULTS.INVALID_TOKEN,
  NOT_FOUND: PARKING_SCAN_RESULTS.NOT_FOUND,
  EXPIRED: PARKING_SCAN_RESULTS.EXPIRED,
  WRONG_LOCATION: PARKING_SCAN_RESULTS.WRONG_LOCATION,
  OUT_OF_WINDOW: PARKING_SCAN_RESULTS.OUT_OF_WINDOW,
};

/** Write a scan-log row. Never throws — logging must not break the gate. */
const logScan = async ({
  req,
  booking = null,
  record = null,
  locationId,
  action,
  result,
  token = '',
  message = '',
  slotNumber = '',
}) => {
  try {
    await ParkingScanLog.create({
      // Fall back to the pass's own bookingId. On the rejection paths (wrong
      // facility, expired, out-of-window) the booking is never loaded, but the
      // QR record is — and without this the rejected attempt would be filed
      // with a null bookingId, i.e. invisible to "show this booking's scan
      // history", which is precisely the query an audit starts from.
      bookingId: booking?._id || record?.bookingId || null,
      qrCodeId: record?._id || null,
      locationId,
      scannedByUserId: req.user._id,
      scannedByStaffId: req.parking?.staffRecords?.[0]?._id || null,
      action,
      result,
      tokenFingerprint: token ? fingerprintQrToken(token) : '',
      vehicleNumber: booking?.vehicleNumber || '',
      assignedSlotNumber: slotNumber,
      message,
      deviceInfo: req.headers['user-agent'] || '',
      ipAddress: req.ip,
      scannedAt: new Date(),
    });
  } catch (error) {
    console.error('Parking scan log write failed:', error.message);
  }
};

/**
 * Resolve a token to its booking, without changing anything.
 * Backs the guard's "Verify Booking" action and is the shared first step of
 * both the entry and the exit flow.
 */
export const verifyScan = async ({ req, token, locationId }) => {
  const verification = await verifyToken(token, { expectedLocationId: locationId });

  if (!verification.ok) {
    await logScan({
      req,
      record: verification.record,
      locationId,
      action: PARKING_SCAN_ACTIONS.VERIFY,
      result: RESULT_FOR_CODE[verification.code] || PARKING_SCAN_RESULTS.INVALID_TOKEN,
      token,
      message: verification.message,
    });
    return { ok: false, status: 400, code: verification.code, message: verification.message };
  }

  const booking = await bookingRepo.findByIdDetailed(verification.record.bookingId);
  if (!booking) {
    await logScan({
      req,
      record: verification.record,
      locationId,
      action: PARKING_SCAN_ACTIONS.VERIFY,
      result: PARKING_SCAN_RESULTS.NOT_FOUND,
      token,
      message: 'Booking not found',
    });
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Booking not found for this pass.' };
  }

  await logScan({
    req,
    booking,
    record: verification.record,
    locationId,
    action: PARKING_SCAN_ACTIONS.VERIFY,
    result: PARKING_SCAN_RESULTS.SUCCESS,
    token,
    message: 'Verified',
  });

  return { ok: true, booking, record: verification.record, payload: verification.payload };
};

/**
 * Assign a free bay of the booking's slot type.
 *
 * Claimed with a conditional findOneAndUpdate so two guards scanning at the same
 * moment cannot be handed the same bay. A facility that has not enumerated its
 * bays simply gets no assignment — the check-in still succeeds, because the
 * capacity accounting lives in parking_availability, not in the bay rows.
 */
const assignSlot = async (booking) => {
  const slot = await ParkingSlot.findOneAndUpdate(
    {
      locationId: booking.locationId,
      slotTypeId: booking.slotTypeId,
      status: PARKING_SLOT_STATUS.AVAILABLE,
      isActive: true,
    },
    {
      $set: {
        status: PARKING_SLOT_STATUS.OCCUPIED,
        currentBookingId: booking._id,
        occupiedAt: new Date(),
      },
    },
    { new: true, sort: { slotNumber: 1 } }
  );

  return slot;
};

/** ENTRY: verify the pass and check the vehicle in. */
export const checkIn = async ({ req, token, locationId }) => {
  const verification = await verifyToken(token, { expectedLocationId: locationId });

  if (!verification.ok) {
    await logScan({
      req,
      record: verification.record,
      locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY,
      result: RESULT_FOR_CODE[verification.code] || PARKING_SCAN_RESULTS.INVALID_TOKEN,
      token,
      message: verification.message,
    });
    return { ok: false, status: 400, code: verification.code, message: verification.message };
  }

  const booking = await ParkingBooking.findById(verification.record.bookingId);
  if (!booking) {
    await logScan({
      req, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY, result: PARKING_SCAN_RESULTS.NOT_FOUND, token,
      message: 'Booking not found',
    });
    return { ok: false, status: 404, message: 'Booking not found for this pass.' };
  }

  if (booking.status === PARKING_BOOKING_STATUS.CANCELLED) {
    await logScan({
      req, booking, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY, result: PARKING_SCAN_RESULTS.CANCELLED, token,
      message: 'Booking cancelled',
    });
    return { ok: false, status: 400, message: 'This booking was cancelled.' };
  }

  if (booking.status === PARKING_BOOKING_STATUS.CHECKED_IN) {
    await logScan({
      req, booking, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY, result: PARKING_SCAN_RESULTS.ALREADY_USED, token,
      message: 'Already checked in',
    });
    return {
      ok: false,
      status: 409,
      message: `This vehicle is already checked in${booking.assignedSlotNumber ? ` at bay ${booking.assignedSlotNumber}` : ''}.`,
    };
  }

  if (booking.status === PARKING_BOOKING_STATUS.CHECKED_OUT) {
    await logScan({
      req, booking, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY, result: PARKING_SCAN_RESULTS.ALREADY_USED, token,
      message: 'Already completed',
    });
    return { ok: false, status: 409, message: 'This booking has already been completed.' };
  }

  // An unpaid booking never becomes a live reservation.
  if (booking.paymentStatus !== PARKING_PAYMENT_STATUS.PAID) {
    await logScan({
      req, booking, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.ENTRY, result: PARKING_SCAN_RESULTS.NOT_PAID, token,
      message: 'Payment not completed',
    });
    return { ok: false, status: 402, message: 'Payment for this booking is not complete.' };
  }

  const slot = await assignSlot(booking);

  booking.status = PARKING_BOOKING_STATUS.CHECKED_IN;
  booking.checkedInAt = new Date();
  if (slot) {
    booking.assignedSlotId = slot._id;
    booking.assignedSlotNumber = slot.slotNumber;
  }
  bookingRepo.pushHistory(
    booking,
    PARKING_BOOKING_STATUS.CHECKED_IN,
    slot ? `Checked in at bay ${slot.slotNumber}` : 'Checked in',
    req.user._id
  );
  await booking.save();

  await markEntryScanned(verification.record);

  await logScan({
    req,
    booking,
    record: verification.record,
    locationId,
    action: PARKING_SCAN_ACTIONS.ENTRY,
    result: PARKING_SCAN_RESULTS.SUCCESS,
    token,
    slotNumber: slot?.slotNumber || '',
    message: 'Entry granted',
  });

  return {
    ok: true,
    booking,
    slot,
    message: slot
      ? `Entry granted. Direct the vehicle to bay ${slot.slotNumber}.`
      : 'Entry granted.',
  };
};

/**
 * EXIT: compute the stay, assess overstay, take payment if owed, check out and
 * release both the bay and the day's capacity.
 */
export const checkOut = async ({ req, token, locationId, overstayPaymentMethod = 'cash', collectOverstayNow = true }) => {
  const verification = await verifyToken(token, { expectedLocationId: locationId });

  if (!verification.ok) {
    await logScan({
      req,
      record: verification.record,
      locationId,
      action: PARKING_SCAN_ACTIONS.EXIT,
      result: RESULT_FOR_CODE[verification.code] || PARKING_SCAN_RESULTS.INVALID_TOKEN,
      token,
      message: verification.message,
    });
    return { ok: false, status: 400, code: verification.code, message: verification.message };
  }

  const booking = await ParkingBooking.findById(verification.record.bookingId);
  if (!booking) {
    return { ok: false, status: 404, message: 'Booking not found for this pass.' };
  }

  if (booking.status !== PARKING_BOOKING_STATUS.CHECKED_IN) {
    await logScan({
      req, booking, record: verification.record, locationId,
      action: PARKING_SCAN_ACTIONS.EXIT,
      result: booking.status === PARKING_BOOKING_STATUS.CHECKED_OUT
        ? PARKING_SCAN_RESULTS.ALREADY_USED
        : PARKING_SCAN_RESULTS.OUT_OF_WINDOW,
      token,
      message: `Cannot exit from status ${booking.status}`,
    });
    return {
      ok: false,
      status: 400,
      message:
        booking.status === PARKING_BOOKING_STATUS.CHECKED_OUT
          ? 'This vehicle has already exited.'
          : 'This vehicle is not currently checked in.',
    };
  }

  const now = new Date();
  const location = await ParkingLocation.findById(booking.locationId);

  const overstay = await quoteOverstay({ booking, location, actualExitAt: now });

  booking.checkedOutAt = now;
  booking.actualDurationMinutes = minutesBetween(booking.checkedInAt, now);
  booking.overstayMinutes = overstay.overstayMinutes;

  if (overstay.totalAmount > 0 && collectOverstayNow) {
    await collectOverstay({
      booking,
      amount: overstay.totalAmount,
      method: overstayPaymentMethod,
      collectedBy: req.user._id,
    });
    booking.pricing.overstayAmount = overstay.totalAmount;
    booking.pricing.amountPaid += overstay.totalAmount;
    booking.pricing.totalAmount += overstay.totalAmount;
  }

  booking.status = PARKING_BOOKING_STATUS.CHECKED_OUT;
  bookingRepo.pushHistory(
    booking,
    PARKING_BOOKING_STATUS.CHECKED_OUT,
    overstay.totalAmount > 0
      ? `Checked out with ₹${overstay.totalAmount} overstay (${overstay.overstayMinutes} min)`
      : 'Checked out',
    req.user._id
  );
  await booking.save();

  // Free the physical bay.
  if (booking.assignedSlotId) {
    await ParkingSlot.findByIdAndUpdate(booking.assignedSlotId, {
      $set: {
        status: PARKING_SLOT_STATUS.AVAILABLE,
        currentBookingId: null,
        occupiedAt: null,
      },
    });
  }

  // Give the day's capacity back — the single release point for a completed stay.
  await availabilityRepo.release({
    slotTypeId: booking.slotTypeId,
    dates: booking.occupiedDates,
    units: unitsFor(booking.vehicleType),
  });

  await markExitScanned(verification.record);

  await logScan({
    req,
    booking,
    record: verification.record,
    locationId,
    action: PARKING_SCAN_ACTIONS.EXIT,
    result: PARKING_SCAN_RESULTS.SUCCESS,
    token,
    slotNumber: booking.assignedSlotNumber,
    message: 'Exit granted',
  });

  return {
    ok: true,
    booking,
    overstay,
    message:
      overstay.totalAmount > 0
        ? `Exit granted. Overstay of ₹${overstay.totalAmount} collected.`
        : 'Exit granted. Thank you.',
  };
};

/** The guard's fallback when a phone is dead: look up the live booking by plate. */
export const lookupByVehicle = async ({ req, locationId, vehicleNumber }) => {
  const booking = await bookingRepo.findActiveByVehicle(locationId, vehicleNumber);

  await logScan({
    req,
    booking,
    locationId,
    action: PARKING_SCAN_ACTIONS.VERIFY,
    result: booking ? PARKING_SCAN_RESULTS.SUCCESS : PARKING_SCAN_RESULTS.NOT_FOUND,
    message: `Manual lookup for ${vehicleNumber}`,
  });

  if (!booking) {
    return { ok: false, status: 404, message: 'No active parking booking found for this vehicle here.' };
  }
  return { ok: true, booking };
};

/** Scan history, for the Super Admin "QR Logs" view and partner audits. */
export const listScanLogs = async ({ scopeFilter = {}, locationId, result, from, to, page = 1, limit = 50 }) => {
  const filter = { ...scopeFilter };
  if (locationId) filter.locationId = locationId;
  if (result) filter.result = result;
  if (from || to) {
    filter.scannedAt = {};
    if (from) filter.scannedAt.$gte = new Date(from);
    if (to) filter.scannedAt.$lte = new Date(to);
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingScanLog.find(filter)
      .populate('scannedByUserId', 'name email')
      .populate('locationId', 'name slug')
      .sort({ scannedAt: -1 })
      .skip(skip)
      .limit(limit),
    ParkingScanLog.countDocuments(filter),
  ]);

  return { items, total };
};

export default { verifyScan, checkIn, checkOut, lookupByVehicle, listScanLogs };
