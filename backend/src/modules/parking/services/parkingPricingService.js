import ParkingPricing from '../models/ParkingPricing.js';
import ParkingHoliday from '../models/ParkingHoliday.js';
import { PARKING_PRICING_MODES } from '../config/parkingConfig.js';
import { billableHours, datesInSpan, minutesBetween } from '../utils/parkingTime.js';
import { resolveSettings } from './parkingSettingsService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Quote engine.
//
// The single place a parking amount is computed. Both the pre-booking quote the
// visitor sees and the amount actually charged come from `quote()`, so the price
// on the review screen and the price on the invoice cannot diverge.
//
// Every figure is derived server-side. A client-supplied amount is never trusted
// — the booking service ignores it entirely.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the rate card for a (location, slot type, vehicle type).
 *
 * Prefers a card pinned to the specific slot type over a location-wide one, and
 * only considers cards whose validity window covers the entry moment.
 */
export const findRateCard = async ({ locationId, slotTypeId, vehicleType, at = new Date() }) => {
  const moment = new Date(at);

  const cards = await ParkingPricing.find({
    locationId,
    vehicleType,
    isActive: true,
    slotTypeId: { $in: [slotTypeId, null] },
    $and: [
      { $or: [{ validFrom: null }, { validFrom: { $lte: moment } }] },
      { $or: [{ validUntil: null }, { validUntil: { $gte: moment } }] },
    ],
  }).lean();

  if (!cards.length) return null;

  // Slot-type-specific beats location-wide; among equals, most recent wins.
  cards.sort((a, b) => {
    const aSpecific = a.slotTypeId ? 1 : 0;
    const bSpecific = b.slotTypeId ? 1 : 0;
    if (aSpecific !== bSpecific) return bSpecific - aSpecific;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  return cards[0];
};

/** Highest peak multiplier in force across the booked dates. */
export const resolvePeakMultiplier = async ({ locationId, partnerId, entryAt, exitAt }) => {
  const holidays = await ParkingHoliday.find({
    isActive: true,
    startDate: { $lte: new Date(exitAt) },
    endDate: { $gte: new Date(entryAt) },
    $or: [
      { locationId },
      { partnerId, locationId: null },
      { locationId: null, partnerId: null },
    ],
  }).lean();

  if (!holidays.length) return { multiplier: 1, closed: false, holidays: [] };

  // A closure anywhere in the window blocks the booking outright.
  const closed = holidays.some((h) => h.isClosed);
  const multiplier = holidays.reduce((max, h) => Math.max(max, h.peakMultiplier || 1), 1);

  return { multiplier, closed, holidays: holidays.map((h) => ({ name: h.name, type: h.type })) };
};

/** Duration charge under the card's mode. */
const computeDurationAmount = (card, hours) => {
  const dailyCap = card.dailyRate > 0 ? card.dailyRate : Infinity;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;

  if (card.mode === PARKING_PRICING_MODES.FLAT_DAY) {
    // Any part-day counts as a full day.
    return Math.ceil(hours / 24) * (card.dailyRate || 0);
  }

  const chargeForHours = (h) => {
    if (h <= 0) return 0;

    if (card.mode === PARKING_PRICING_MODES.HOURLY) {
      return Math.min(h * (card.hourlyRate || 0), dailyCap);
    }

    // Slab mode: walk the slabs in ascending order; the first whose ceiling
    // covers the duration sets the price. An open-ended final slab (uptoHours
    // null) bills its flat price plus perHourAfter for the excess.
    const slabs = [...(card.slabs || [])].sort((a, b) => {
      if (a.uptoHours === null) return 1;
      if (b.uptoHours === null) return -1;
      return a.uptoHours - b.uptoHours;
    });

    if (!slabs.length) return Math.min(h * (card.hourlyRate || 0), dailyCap);

    let amount = 0;
    let matched = false;

    for (const slab of slabs) {
      if (slab.uptoHours === null || slab.uptoHours === undefined) {
        const previousCeiling = slabs
          .filter((s) => s.uptoHours !== null && s.uptoHours !== undefined)
          .reduce((max, s) => Math.max(max, s.uptoHours), 0);
        const excess = Math.max(0, h - previousCeiling);
        amount = slab.price + excess * (slab.perHourAfter || card.hourlyRate || 0);
        matched = true;
        break;
      }
      if (h <= slab.uptoHours) {
        amount = slab.price;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Beyond every finite slab and no open-ended one: bill the largest slab
      // then the hourly rate for the overflow.
      const largest = slabs[slabs.length - 1];
      const excess = Math.max(0, h - (largest.uptoHours || 0));
      amount = largest.price + excess * (largest.perHourAfter || card.hourlyRate || 0);
    }

    return Math.min(amount, dailyCap);
  };

  // Whole days bill at the daily cap; the remainder bills normally.
  const wholeDayAmount = days * (card.dailyRate > 0 ? card.dailyRate : chargeForHours(24));
  return wholeDayAmount + chargeForHours(remainderHours);
};

/**
 * Produce a full quote for a booking window.
 *
 * Returns `{ ok:false, code, message }` rather than throwing, so callers map it
 * straight onto the project's `{ success, message }` response shape.
 */
export const quote = async ({ location, slotType, vehicleType, entryAt, exitAt }) => {
  const settings = await resolveSettings({
    locationId: location._id,
    partnerId: location.partnerId,
  });

  const card = await findRateCard({
    locationId: location._id,
    slotTypeId: slotType._id,
    vehicleType,
    at: entryAt,
  });

  if (!card) {
    return {
      ok: false,
      code: 'NO_RATE_CARD',
      message: 'Pricing is not published for this vehicle type at this parking.',
    };
  }

  const peak = await resolvePeakMultiplier({
    locationId: location._id,
    partnerId: location.partnerId,
    entryAt,
    exitAt,
  });

  if (peak.closed) {
    return {
      ok: false,
      code: 'CLOSED_PERIOD',
      message: 'This parking is closed for the dates you selected.',
    };
  }

  const minHours = card.minimumBillableHours ?? settings.minimumBillableHours;
  const totalMinutes = minutesBetween(entryAt, exitAt);

  // A very short stay inside the free window costs nothing but the base fee.
  const withinFreeWindow = card.freeMinutes > 0 && totalMinutes <= card.freeMinutes;
  const hours = billableHours(entryAt, exitAt, minHours);

  const baseFee = card.baseFee || 0;
  const rawDuration = withinFreeWindow ? 0 : computeDurationAmount(card, hours);

  const effectivePeak = card.peakMultiplier > 1 ? Math.max(card.peakMultiplier, peak.multiplier) : peak.multiplier;
  const durationAmount = Math.round(rawDuration * effectivePeak);

  const subtotal = Math.round(baseFee + durationAmount);
  const taxPercent = card.taxPercent ?? settings.taxPercent;
  const taxAmount = Math.round((subtotal * taxPercent) / 100);
  const totalAmount = subtotal + taxAmount;

  return {
    ok: true,
    quote: {
      vehicleType,
      slotTypeId: slotType._id,
      slotTypeName: slotType.name,
      durationHours: hours,
      durationMinutes: totalMinutes,
      baseFee,
      durationAmount,
      peakMultiplier: effectivePeak,
      isPeak: effectivePeak > 1,
      peakReasons: peak.holidays,
      subtotal,
      taxPercent,
      taxAmount,
      totalAmount,
      currency: 'INR',
      freeMinutesApplied: withinFreeWindow ? card.freeMinutes : 0,
      pricingMode: card.mode,
    },
    settings,
    card,
  };
};

/**
 * Overstay charge assessed at exit.
 *
 * Bills only beyond the grace period, at the hourly rate times the overstay
 * multiplier, rounded up to the hour.
 */
export const quoteOverstay = async ({ booking, location, actualExitAt }) => {
  const settings = await resolveSettings({
    locationId: location._id,
    partnerId: location.partnerId,
  });

  const overdueMinutes = minutesBetween(booking.exitAt, actualExitAt);
  const grace = settings.overstayGraceMinutes;

  if (overdueMinutes <= grace) {
    return { overstayMinutes: overdueMinutes, chargeableHours: 0, amount: 0, taxAmount: 0, totalAmount: 0 };
  }

  const card = await findRateCard({
    locationId: location._id,
    slotTypeId: booking.slotTypeId,
    vehicleType: booking.vehicleType,
    at: booking.entryAt,
  });

  const chargeableMinutes = overdueMinutes - grace;
  const chargeableHours = Math.ceil(chargeableMinutes / 60);

  const hourly = card?.hourlyRate || 0;
  const multiplier = card?.overstayMultiplier ?? settings.overstayMultiplier;

  const amount = Math.round(chargeableHours * hourly * multiplier);
  const taxPercent = card?.taxPercent ?? settings.taxPercent;
  const taxAmount = Math.round((amount * taxPercent) / 100);

  return {
    overstayMinutes: overdueMinutes,
    chargeableHours,
    hourlyRate: hourly,
    multiplier,
    amount,
    taxPercent,
    taxAmount,
    totalAmount: amount + taxAmount,
  };
};

/** Refund due on cancellation, per the facility's cancellation policy. */
export const quoteRefund = async ({ booking, location, at = new Date() }) => {
  const settings = await resolveSettings({
    locationId: location?._id || booking.locationId,
    partnerId: location?.partnerId,
  });

  if (!settings.allowCancellation) {
    return { allowed: false, refundAmount: 0, percent: 0, message: 'This booking cannot be cancelled online.' };
  }

  const paid = booking.pricing?.amountPaid || 0;
  if (paid <= 0) return { allowed: true, refundAmount: 0, percent: 0 };

  const hoursUntilEntry = (new Date(booking.entryAt).getTime() - new Date(at).getTime()) / 3600000;
  const percent =
    hoursUntilEntry >= settings.freeCancellationHours
      ? settings.refundPercentInsideWindow
      : settings.refundPercentOutsideWindow;

  return {
    allowed: true,
    percent,
    refundAmount: Math.round((paid * percent) / 100),
    hoursUntilEntry: Number(hoursUntilEntry.toFixed(1)),
    freeCancellationHours: settings.freeCancellationHours,
  };
};

/** Commission split for a confirmed booking. */
export const computeCommission = async ({ location, partner, grossAmount }) => {
  const settings = await resolveSettings({
    locationId: location._id,
    partnerId: location.partnerId,
  });

  // A rate negotiated on the partner record beats the settings tier.
  const percent =
    partner?.commissionPercent !== null && partner?.commissionPercent !== undefined
      ? partner.commissionPercent
      : settings.commissionPercent;

  const commissionAmount = Math.round((grossAmount * percent) / 100);

  return {
    percent,
    amount: commissionAmount,
    partnerEarning: Math.max(0, grossAmount - commissionAmount),
  };
};

export { datesInSpan };

export default {
  findRateCard,
  resolvePeakMultiplier,
  quote,
  quoteOverstay,
  quoteRefund,
  computeCommission,
};
