import ParkingBooking from '../models/ParkingBooking.js';
import ParkingLocation from '../models/ParkingLocation.js';
import ParkingSlotType from '../models/ParkingSlotType.js';
import ParkingPartner from '../models/ParkingPartner.js';
import ParkingCommission from '../models/ParkingCommission.js';
import availabilityRepo from '../repositories/parkingAvailabilityRepository.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import { quote, computeCommission, quoteRefund } from './parkingPricingService.js';
import { resolveSettings } from './parkingSettingsService.js';
import { issueQrForBooking, revokeForBooking } from './parkingQrService.js';
import { notify, PARKING_NOTIFICATION_EVENTS } from './parkingNotificationService.js';
import { recordTransaction } from './parkingLedgerService.js';
import { generateBookingReference } from '../utils/parkingIds.js';
import {
  datesInSpan,
  billableHours,
  addMinutes,
  isWithinOpeningHours,
} from '../utils/parkingTime.js';
import {
  PARKING_BOOKING_STATUS,
  PARKING_PAYMENT_STATUS,
  PARKING_VEHICLE_TYPE_META,
  PARKING_NOTIFICATION_EVENTS as EVENTS,
} from '../config/parkingConfig.js';
import { normalizeVehicleNumber } from '../validators/parkingValidators.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking booking lifecycle.
//
// pending → upcoming → checked_in → checked_out
//              ↘ cancelled / expired / no_show
//
// Inventory is taken at creation (as a time-boxed hold) and released on exactly
// one path out: cancel, expire, no-show, or check-out. That single-release rule
// is what keeps capacity honest.
//
// Completely independent of the ashram booking engine: different collections,
// different service, different controller. Neither reads the other.
// ─────────────────────────────────────────────────────────────────────────────

/** How many capacity units a vehicle consumes in its slot type. */
const unitsFor = (vehicleType) =>
  Math.max(1, Math.ceil(PARKING_VEHICLE_TYPE_META[vehicleType]?.footprint || 1));

/**
 * Create a reservation and hold inventory.
 *
 * The hold is time-boxed: an unpaid booking releases its bay automatically once
 * `reservationExpiresAt` passes (see `sweepExpiredHolds`), so an abandoned
 * checkout cannot strand capacity.
 *
 * Returns `{ ok:false, status, code, message }` on every rejection rather than
 * throwing, so the controller maps it directly onto an HTTP response.
 */
export const createBooking = async ({
  user,
  locationId,
  slotTypeId,
  vehicleType,
  vehicleNumber,
  entryAt,
  exitAt,
  vehicleModel = '',
  driverName = '',
  driverPhone = '',
  req = null,
}) => {
  const location = await ParkingLocation.findById(locationId);
  if (!location || location.status !== 'active') {
    return { ok: false, status: 404, code: 'LOCATION_NOT_FOUND', message: 'This parking is not available.' };
  }

  const slotType = await ParkingSlotType.findOne({ _id: slotTypeId, locationId, isActive: true });
  if (!slotType) {
    return { ok: false, status: 404, code: 'SLOT_TYPE_NOT_FOUND', message: 'This parking area is not available.' };
  }

  if (!slotType.vehicleTypes.includes(vehicleType)) {
    return {
      ok: false,
      status: 400,
      code: 'VEHICLE_NOT_SUPPORTED',
      message: 'This parking area does not accept the selected vehicle type.',
    };
  }

  const settings = await resolveSettings({ locationId: location._id, partnerId: location.partnerId });
  if (!settings.allowOnlineBooking) {
    return {
      ok: false,
      status: 400,
      code: 'BOOKING_DISABLED',
      message: 'Online booking is currently disabled for this parking.',
    };
  }

  // A facility with fixed hours must not sell an entry it cannot honour.
  if (!isWithinOpeningHours(entryAt, location.openingHours)) {
    return {
      ok: false,
      status: 400,
      code: 'OUTSIDE_OPENING_HOURS',
      message: `This parking accepts entry between ${location.openingHours?.opensAt} and ${location.openingHours?.closesAt}.`,
    };
  }

  // Price is computed server-side. Any amount the client sent is ignored.
  const priced = await quote({ location, slotType, vehicleType, entryAt, exitAt });
  if (!priced.ok) {
    return { ok: false, status: 400, code: priced.code, message: priced.message };
  }

  const dates = datesInSpan(entryAt, exitAt);
  const units = unitsFor(vehicleType);

  // Atomic, all-or-nothing capacity claim across every date touched.
  const lock = await availabilityRepo.reserve({
    locationId: location._id,
    slotTypeId: slotType._id,
    dates,
    units,
    totalCapacity: slotType.totalCapacity,
  });

  if (!lock.ok) {
    return {
      ok: false,
      status: 409,
      code: 'NO_AVAILABILITY',
      message: `This parking is full on ${lock.failedDate}. Try a different area or time.`,
    };
  }

  try {
    const q = priced.quote;

    const booking = await bookingRepo.create({
      bookingReference: generateBookingReference(),
      customerId: user._id,
      locationId: location._id,
      partnerId: location.partnerId,
      slotTypeId: slotType._id,
      vehicleType,
      vehicleNumber: normalizeVehicleNumber(vehicleNumber),
      vehicleModel,
      driverName: driverName || user.name,
      driverPhone: driverPhone || user.phone,
      entryAt: new Date(entryAt),
      exitAt: new Date(exitAt),
      durationHours: q.durationHours,
      occupiedDates: dates,
      pricing: {
        baseFee: q.baseFee,
        durationAmount: q.durationAmount,
        peakMultiplier: q.peakMultiplier,
        subtotal: q.subtotal,
        taxPercent: q.taxPercent,
        taxAmount: q.taxAmount,
        overstayAmount: 0,
        totalAmount: q.totalAmount,
        amountPaid: 0,
        refundAmount: 0,
        currency: q.currency,
      },
      status: PARKING_BOOKING_STATUS.PENDING,
      paymentStatus: PARKING_PAYMENT_STATUS.PENDING,
      reservationExpiresAt: addMinutes(new Date(), settings.reservationHoldMinutes),
      history: [{ status: PARKING_BOOKING_STATUS.PENDING, note: 'Booking created', updatedBy: user._id }],
      source: 'web',
    });

    return { ok: true, booking, quote: q, location, slotType, settings };
  } catch (error) {
    // Creation failed after the capacity was claimed — give it straight back
    // rather than leaving a phantom hold for the sweeper.
    await availabilityRepo.release({ slotTypeId: slotType._id, dates: lock.dates, units });
    throw error;
  }
};

/**
 * Move a paid booking to `upcoming`, issue the pass, book the commission.
 *
 * Called only by the payment service after a verified payment — never by a
 * client-facing route, so a confirmation cannot be forged.
 */
export const confirmBooking = async ({ booking, req = null, actorId = null }) => {
  const location = await ParkingLocation.findById(booking.locationId);
  const partner = await ParkingPartner.findById(booking.partnerId);

  const commission = await computeCommission({
    location,
    partner,
    grossAmount: booking.pricing.totalAmount,
  });

  booking.status = PARKING_BOOKING_STATUS.UPCOMING;
  booking.paymentStatus = PARKING_PAYMENT_STATUS.PAID;
  booking.pricing.amountPaid = booking.pricing.totalAmount;
  booking.commission = commission;
  // The hold has served its purpose; a paid booking is not swept.
  booking.reservationExpiresAt = null;
  bookingRepo.pushHistory(booking, PARKING_BOOKING_STATUS.UPCOMING, 'Payment confirmed', actorId);
  await booking.save();

  // One commission row per booking; upsert so a duplicated webhook cannot
  // double-book the platform's revenue.
  await ParkingCommission.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        partnerId: booking.partnerId,
        locationId: booking.locationId,
        grossAmount: booking.pricing.totalAmount,
        commissionPercent: commission.percent,
        commissionAmount: commission.amount,
        partnerEarning: commission.partnerEarning,
        settlementStatus: 'pending',
      },
      $setOnInsert: { bookingId: booking._id },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await recordTransaction({
    bookingId: booking._id,
    partnerId: booking.partnerId,
    locationId: booking.locationId,
    type: 'booking',
    direction: 'credit',
    amount: booking.pricing.totalAmount,
    description: `Parking booking ${booking.bookingReference}`,
    meta: { commissionPercent: commission.percent, commissionAmount: commission.amount },
    recordedBy: actorId,
  });

  const pass = await issueQrForBooking(booking, { location });

  await notify({
    req,
    userId: booking.customerId,
    booking,
    event: EVENTS.BOOKING_CONFIRMED,
    context: { locationName: location?.name },
  });
  await notify({
    req,
    userId: booking.customerId,
    booking,
    event: EVENTS.QR_READY,
    context: { locationName: location?.name, displayCode: pass.displayCode },
  });

  return { booking, pass, location };
};

/**
 * Cancel a booking and release its inventory.
 *
 * Refund is computed from the facility's policy; the actual money movement is
 * recorded in the ledger. A checked-in or completed stay cannot be cancelled.
 */
export const cancelBooking = async ({ booking, actor, reason = '', req = null }) => {
  if ([PARKING_BOOKING_STATUS.CANCELLED, PARKING_BOOKING_STATUS.CHECKED_OUT].includes(booking.status)) {
    return { ok: false, status: 400, message: 'This booking is already closed.' };
  }
  if (booking.status === PARKING_BOOKING_STATUS.CHECKED_IN) {
    return { ok: false, status: 400, message: 'A vehicle already inside cannot be cancelled. Please check out instead.' };
  }

  const location = await ParkingLocation.findById(booking.locationId);
  const refund = await quoteRefund({ booking, location });

  if (!refund.allowed) {
    return { ok: false, status: 400, message: refund.message };
  }

  const heldInventory = [PARKING_BOOKING_STATUS.PENDING, PARKING_BOOKING_STATUS.UPCOMING].includes(booking.status);

  booking.status = PARKING_BOOKING_STATUS.CANCELLED;
  booking.cancellation = {
    reason: reason || 'Cancelled by user',
    cancelledAt: new Date(),
    cancelledBy: actor?._id || null,
    refundAmount: refund.refundAmount,
    refundReference: refund.refundAmount > 0 ? `PKREF-${Date.now().toString().slice(-8)}` : '',
  };
  booking.pricing.refundAmount = refund.refundAmount;
  booking.paymentStatus =
    refund.refundAmount > 0 ? PARKING_PAYMENT_STATUS.REFUNDED : booking.paymentStatus;
  booking.reservationExpiresAt = null;
  bookingRepo.pushHistory(booking, PARKING_BOOKING_STATUS.CANCELLED, reason, actor?._id);
  await booking.save();

  if (heldInventory) {
    await availabilityRepo.release({
      slotTypeId: booking.slotTypeId,
      dates: booking.occupiedDates,
      units: unitsFor(booking.vehicleType),
    });
  }

  await revokeForBooking(booking._id, 'Booking cancelled');

  if (refund.refundAmount > 0) {
    await recordTransaction({
      bookingId: booking._id,
      partnerId: booking.partnerId,
      locationId: booking.locationId,
      type: 'refund',
      direction: 'debit',
      amount: -Math.abs(refund.refundAmount),
      description: `Refund for ${booking.bookingReference}`,
      meta: { percent: refund.percent },
      recordedBy: actor?._id,
    });

    // The platform's cut reverses along with the refund.
    await ParkingCommission.findOneAndUpdate(
      { bookingId: booking._id },
      { $set: { settlementStatus: 'reversed', reversedAt: new Date(), reversalReason: 'Booking cancelled' } }
    );
  }

  await notify({
    req,
    userId: booking.customerId,
    booking,
    event: EVENTS.CANCELLATION,
    context: { locationName: location?.name },
  });

  if (refund.refundAmount > 0) {
    await notify({
      req,
      userId: booking.customerId,
      booking,
      event: EVENTS.REFUND,
      context: { locationName: location?.name, amount: refund.refundAmount },
    });
  }

  return { ok: true, booking, refund };
};

/**
 * Release the bays held by unpaid bookings whose hold has lapsed.
 * Safe to run repeatedly: only `pending` rows are touched, and each is flipped
 * to `expired` before its capacity is returned.
 */
export const sweepExpiredHolds = async (limit = 100) => {
  const stale = await bookingRepo.findExpiredHolds(limit);
  let released = 0;

  for (const booking of stale) {
    booking.status = PARKING_BOOKING_STATUS.EXPIRED;
    bookingRepo.pushHistory(booking, PARKING_BOOKING_STATUS.EXPIRED, 'Reservation hold expired before payment');
    await booking.save();

    await availabilityRepo.release({
      slotTypeId: booking.slotTypeId,
      dates: booking.occupiedDates,
      units: unitsFor(booking.vehicleType),
    });
    await revokeForBooking(booking._id, 'Reservation expired');
    released += 1;
  }

  return { released };
};

/** Mark confirmed bookings that never arrived, and free their bays. */
export const sweepNoShows = async (limit = 100) => {
  const settings = await resolveSettings({});
  const cutoff = addMinutes(new Date(), -settings.noShowAfterMinutes);

  const candidates = await bookingRepo.findNoShowCandidates(cutoff, limit);
  let marked = 0;

  for (const booking of candidates) {
    booking.status = PARKING_BOOKING_STATUS.NO_SHOW;
    bookingRepo.pushHistory(booking, PARKING_BOOKING_STATUS.NO_SHOW, 'Vehicle did not arrive');
    await booking.save();

    await availabilityRepo.release({
      slotTypeId: booking.slotTypeId,
      dates: booking.occupiedDates,
      units: unitsFor(booking.vehicleType),
    });
    await revokeForBooking(booking._id, 'Marked as no-show');
    marked += 1;
  }

  return { marked };
};

export { unitsFor, billableHours };

export default {
  createBooking,
  confirmBooking,
  cancelBooking,
  sweepExpiredHolds,
  sweepNoShows,
  unitsFor,
};
