import mongoose from 'mongoose';
import {
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_DEFAULTS,
} from '../config/parkingConfig.js';
import { isValidDate } from '../utils/parkingTime.js';

// Input validation for the parking module.
//
// Follows the convention already established in utils/validators.js: each helper
// returns `null` when the value is acceptable, or a human-readable message when
// it is not, and `firstError` collapses a list down to the first failure.

/** Indian registration plates: MH12AB1234, DL8CAF5030, and BH-series. */
const VEHICLE_NUMBER_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;

/** Strip spaces, hyphens and dots so `MH 12 AB 1234` and `MH12AB1234` match. */
export const normalizeVehicleNumber = (value) =>
  String(value || '').toUpperCase().replace(/[\s.\-]/g, '');

export const validateVehicleNumber = (value) => {
  if (typeof value !== 'string' || !value.trim()) return 'Vehicle number is required';
  const normalized = normalizeVehicleNumber(value);
  if (normalized.length < 6 || normalized.length > 12) {
    return 'Please enter a valid vehicle registration number';
  }
  if (!VEHICLE_NUMBER_PATTERN.test(normalized)) {
    return 'Please enter a valid vehicle number, e.g. MH12AB1234';
  }
  return null;
};

export const validateVehicleType = (value) => {
  if (!value) return 'Vehicle type is required';
  if (!PARKING_VEHICLE_TYPE_VALUES.includes(value)) return 'Unsupported vehicle type';
  return null;
};

export const validateObjectId = (value, label = 'identifier') => {
  if (!value) return `${label} is required`;
  if (!mongoose.Types.ObjectId.isValid(String(value))) return `Invalid ${label}`;
  return null;
};

/**
 * Validate the booked window.
 *
 * Rejects the reversed and zero-length cases outright, and caps the span at 30
 * days so a single reservation cannot lock a bay for a year. A small backdating
 * tolerance is allowed because a visitor filling the form at 09:59 for a 10:00
 * entry should not be rejected by clock skew.
 */
export const validateBookingWindow = (entryAt, exitAt) => {
  if (!isValidDate(entryAt)) return 'Please choose a valid entry date and time';
  if (!isValidDate(exitAt)) return 'Please choose a valid exit date and time';

  const entry = new Date(entryAt);
  const exit = new Date(exitAt);

  if (exit <= entry) return 'Exit time must be after the entry time';

  const TOLERANCE_MINUTES = 10;
  if (entry.getTime() < Date.now() - TOLERANCE_MINUTES * 60 * 1000) {
    return 'Entry time cannot be in the past';
  }

  const MAX_ADVANCE_DAYS = 90;
  if (entry.getTime() > Date.now() + MAX_ADVANCE_DAYS * 86400000) {
    return `Parking can be booked up to ${MAX_ADVANCE_DAYS} days in advance`;
  }

  const MAX_STAY_DAYS = 30;
  if (exit.getTime() - entry.getTime() > MAX_STAY_DAYS * 86400000) {
    return `A single parking booking cannot exceed ${MAX_STAY_DAYS} days`;
  }

  return null;
};

export const validateRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Rating is required';
  if (n < 1 || n > 5) return 'Rating must be between 1 and 5';
  return null;
};

export const validateSearchRadius = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Search radius must be a positive number';
  if (n > PARKING_DEFAULTS.maxSearchRadiusKm) {
    return `Search radius cannot exceed ${PARKING_DEFAULTS.maxSearchRadiusKm} km`;
  }
  return null;
};

export const validateQrToken = (value) => {
  if (typeof value !== 'string' || !value.trim()) return 'QR token is required';
  if (value.length > 2048) return 'QR token is malformed';
  return null;
};

/** Return the first failure from a list of validator results. */
export const firstError = (checks) => {
  for (const error of checks) {
    if (error) return error;
  }
  return null;
};

export default {
  normalizeVehicleNumber,
  validateVehicleNumber,
  validateVehicleType,
  validateObjectId,
  validateBookingWindow,
  validateRating,
  validateSearchRadius,
  validateQrToken,
  firstError,
};
