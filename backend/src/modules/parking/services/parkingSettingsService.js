import ParkingSetting from '../models/ParkingSetting.js';
import { PARKING_DEFAULTS } from '../config/parkingConfig.js';

// Resolves operational policy for a facility.
//
// Four tiers, most specific wins:
//   PARKING_DEFAULTS (code) ← platform row ← partner row ← location row
//
// A field set to null at any tier means "inherit", not "zero". Getting that
// wrong would silently set grace periods and commission to 0, so the merge is
// centralised here and every caller goes through it.

const NUMERIC_KEYS = [
  'reservationHoldMinutes',
  'overstayGraceMinutes',
  'noShowAfterMinutes',
  'overstayMultiplier',
  'commissionPercent',
  'taxPercent',
  'minimumBillableHours',
  'freeCancellationHours',
  'refundPercentInsideWindow',
  'refundPercentOutsideWindow',
  'qrValidityBufferMinutes',
];

const BOOLEAN_KEYS = ['allowOnlineBooking', 'allowCancellation', 'requireVehicleNumber'];

/** Overlay only the fields the row actually specifies. */
const overlay = (base, row) => {
  if (!row) return base;
  const merged = { ...base };

  NUMERIC_KEYS.forEach((key) => {
    if (row[key] !== null && row[key] !== undefined) merged[key] = row[key];
  });
  BOOLEAN_KEYS.forEach((key) => {
    if (row[key] !== null && row[key] !== undefined) merged[key] = row[key];
  });

  return merged;
};

/**
 * Effective settings for a facility.
 *
 * `partnerId` is optional; pass it when known to avoid a second lookup. The
 * three tier rows are fetched in one query and applied in precedence order.
 */
export const resolveSettings = async ({ locationId = null, partnerId = null } = {}) => {
  const or = [{ scope: 'platform' }];
  if (partnerId) or.push({ scope: 'partner', partnerId });
  if (locationId) or.push({ scope: 'location', locationId });

  const rows = await ParkingSetting.find({ $or: or }).lean();

  const platformRow = rows.find((r) => r.scope === 'platform');
  const partnerRow = rows.find((r) => r.scope === 'partner');
  const locationRow = rows.find((r) => r.scope === 'location');

  const base = {
    ...PARKING_DEFAULTS,
    allowOnlineBooking: true,
    allowCancellation: true,
    requireVehicleNumber: true,
  };

  return overlay(overlay(overlay(base, platformRow), partnerRow), locationRow);
};

/** Upsert the settings row for one scope target. */
export const saveSettings = async ({ scope, partnerId = null, locationId = null, values = {}, updatedBy }) => {
  const allowed = {};
  [...NUMERIC_KEYS, ...BOOLEAN_KEYS].forEach((key) => {
    if (values[key] !== undefined) allowed[key] = values[key];
  });

  return ParkingSetting.findOneAndUpdate(
    { scope, partnerId, locationId },
    { $set: { ...allowed, updatedBy }, $setOnInsert: { scope, partnerId, locationId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export default { resolveSettings, saveSettings };
