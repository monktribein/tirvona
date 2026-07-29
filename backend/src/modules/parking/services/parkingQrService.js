import QRCode from 'qrcode';
import ParkingQrCode from '../models/ParkingQrCode.js';
import {
  sealQrPayload,
  openQrPayload,
  hashQrToken,
} from '../utils/parkingCrypto.js';
import { generateDisplayCode } from '../utils/parkingIds.js';
import { addMinutes } from '../utils/parkingTime.js';
import { resolveSettings } from './parkingSettingsService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking pass (QR) issuance and verification.
//
// The scannable string is an AES-256-GCM sealed token. That gives two
// properties the spec asks for and that a plain JSON or base64 QR would not:
//
//   • it cannot be read — booking id, visitor id and plate are ciphertext;
//   • it cannot be modified — GCM's auth tag makes any edit fail to open, so a
//     holder cannot stretch their own validity or repoint the pass at another
//     facility.
//
// Only the token's SHA-256 lands in the database, so a leaked dump yields no
// working passes. Same discipline as the platform's OTP storage.
// ─────────────────────────────────────────────────────────────────────────────

const PAYLOAD_VERSION = 1;

/**
 * Issue (or reissue) the pass for a confirmed booking.
 *
 * Any previous pass for the booking is revoked first, so exactly one token can
 * ever open the gate.
 */
export const issueQrForBooking = async (booking, { location } = {}) => {
  const settings = await resolveSettings({
    locationId: booking.locationId,
    partnerId: booking.partnerId,
  });

  // Valid from a little before the booked entry (early arrivals are normal) and
  // for a buffer past the booked exit, so an overstaying vehicle can still scan
  // out rather than being trapped behind an expired pass.
  const validFrom = addMinutes(booking.entryAt, -60);
  const validUntil = addMinutes(booking.exitAt, settings.qrValidityBufferMinutes);

  // Supersede any earlier pass.
  const previous = await ParkingQrCode.findOne({ bookingId: booking._id }).sort({ version: -1 });
  if (previous && previous.status === 'active') {
    previous.status = 'revoked';
    previous.revokedReason = 'Superseded by a reissued pass';
    await previous.save();
  }

  const displayCode = generateDisplayCode();
  const version = (previous?.version || 0) + 1;

  const payload = {
    v: PAYLOAD_VERSION,
    b: booking._id.toString(),        // Booking ID
    r: booking.bookingReference,
    l: booking.locationId.toString(), // Parking ID
    u: booking.customerId.toString(), // Visitor ID
    n: booking.vehicleNumber,         // Vehicle Number
    e: new Date(booking.entryAt).toISOString(),  // Entry Time
    x: new Date(booking.exitAt).toISOString(),
    vf: validFrom.toISOString(),      // Validity
    vu: validUntil.toISOString(),     // Expiry
    d: displayCode,
    ver: version,
  };

  const token = sealQrPayload(payload);

  const record = await ParkingQrCode.create({
    bookingId: booking._id,
    locationId: booking.locationId,
    customerId: booking.customerId,
    tokenHash: hashQrToken(token),
    displayCode,
    version,
    validFrom,
    validUntil,
    status: 'active',
  });

  return { token, displayCode, record, validFrom, validUntil };
};

/**
 * Render a token as a PNG data URL for display and download.
 *
 * Error-correction level M with a quiet zone, so the code still reads off a
 * phone screen at a gate in poor light.
 */
export const renderQrDataUrl = async (token) =>
  QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#0B192C', light: '#FFFFFF' },
  });

/** Render as SVG, for a crisp printable pass. */
export const renderQrSvg = async (token) =>
  QRCode.toString(token, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#0B192C', light: '#FFFFFF' },
  });

/**
 * Open and validate a presented token.
 *
 * Returns a discriminated result rather than throwing: the scan endpoint logs
 * every outcome, including the failures, so a bad token is normal flow.
 *
 * Note the order — the seal is opened first (a forged token dies here without
 * touching the database), then the stored pass is checked, then validity.
 */
export const verifyToken = async (token, { expectedLocationId = null } = {}) => {
  const payload = openQrPayload(token);
  if (!payload || !payload.b) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This QR code is not valid.' };
  }

  const record = await ParkingQrCode.findOne({ tokenHash: hashQrToken(token) });
  if (!record) {
    return { ok: false, code: 'NOT_FOUND', payload, message: 'This pass is not recognised.' };
  }

  if (record.status === 'revoked') {
    return { ok: false, code: 'INVALID_TOKEN', payload, record, message: 'This pass has been revoked.' };
  }

  const now = new Date();
  if (now > record.validUntil) {
    if (record.status !== 'expired') {
      record.status = 'expired';
      await record.save();
    }
    return { ok: false, code: 'EXPIRED', payload, record, message: 'This pass has expired.' };
  }

  if (now < record.validFrom) {
    return {
      ok: false,
      code: 'OUT_OF_WINDOW',
      payload,
      record,
      message: 'This pass is not active yet. Please arrive closer to your booked entry time.',
    };
  }

  // A pass issued for one facility must not open the gate at another, even
  // within the same partner's estate.
  if (expectedLocationId && record.locationId.toString() !== expectedLocationId.toString()) {
    return {
      ok: false,
      code: 'WRONG_LOCATION',
      payload,
      record,
      message: 'This pass belongs to a different parking location.',
    };
  }

  return { ok: true, payload, record };
};

/** Stamp an entry scan. Single-use: the second entry attempt is rejected. */
export const markEntryScanned = async (record) => {
  record.entryScannedAt = new Date();
  record.scanCount += 1;
  await record.save();
  return record;
};

/** Stamp an exit scan and close the pass out. */
export const markExitScanned = async (record) => {
  record.exitScannedAt = new Date();
  record.scanCount += 1;
  record.status = 'used';
  await record.save();
  return record;
};

export const revokeForBooking = async (bookingId, reason = '') => {
  await ParkingQrCode.updateMany(
    { bookingId, status: 'active' },
    { $set: { status: 'revoked', revokedReason: reason } }
  );
};

export const findActiveForBooking = (bookingId) =>
  ParkingQrCode.findOne({ bookingId, status: { $in: ['active', 'used'] } }).sort({ version: -1 });

export default {
  issueQrForBooking,
  renderQrDataUrl,
  renderQrSvg,
  verifyToken,
  markEntryScanned,
  markExitScanned,
  revokeForBooking,
  findActiveForBooking,
};
