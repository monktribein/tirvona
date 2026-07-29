import mongoose from 'mongoose';
import ParkingStaff from '../models/ParkingStaff.js';
import ParkingLocation from '../models/ParkingLocation.js';
import {
  PARKING_ROLES,
  PARKING_ROLE_CAPABILITIES,
  PARKING_SUPER_ADMIN_CAPABILITIES,
  PARKING_PLATFORM_ADMIN_ROLES,
} from '../config/parkingConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking authorization.
//
// This layers ON TOP of the platform's existing `protect` middleware — it never
// replaces it and never re-implements authentication. `protect` establishes WHO
// the caller is (and is imported unmodified); everything here answers WHAT they
// may do inside the parking module.
//
// The design point: parking roles are grants in `parking_staff`, not values of
// `User.role`. That is what lets the Parking System add three roles without a
// single edit to the User schema, `restrictTo`, or any existing middleware.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve every parking capability the signed-in user holds.
 *
 * Attaches `req.parking = { isPlatformAdmin, roles, capabilities, partnerIds,
 * locationIds, scopedToAllLocations, staffRecords }` and always calls next() —
 * a user with no grants simply resolves to an empty capability set, which the
 * gates below then reject. Read-only: it never writes to any collection.
 */
export const resolveParkingAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Super Admin reaches every facility without needing a parking_staff row.
    const isPlatformAdmin = PARKING_PLATFORM_ADMIN_ROLES.includes(req.user.role);

    if (isPlatformAdmin) {
      req.parking = {
        isPlatformAdmin: true,
        roles: [],
        capabilities: new Set(PARKING_SUPER_ADMIN_CAPABILITIES),
        partnerIds: [],
        locationIds: [],
        scopedToAllLocations: true,
        staffRecords: [],
      };
      return next();
    }

    const grants = await ParkingStaff.find({
      userId: req.user._id,
      status: 'active',
    }).select('partnerId locationIds parkingRole capabilityOverrides');

    const capabilities = new Set();
    const roles = [];
    const partnerIds = [];
    const locationIds = [];
    // A partner-level grant carries no explicit locations: it covers every
    // facility owned by that partner, expanded below.
    let hasPartnerWideGrant = false;

    for (const grant of grants) {
      roles.push(grant.parkingRole);
      partnerIds.push(grant.partnerId);

      const roleCaps = PARKING_ROLE_CAPABILITIES[grant.parkingRole] || [];

      // An override may only NARROW the role. Intersecting rather than unioning
      // is what stops a guard's grant from being edited into an admin one.
      const effective = grant.capabilityOverrides?.length
        ? roleCaps.filter((c) => grant.capabilityOverrides.includes(c))
        : roleCaps;

      effective.forEach((c) => capabilities.add(c));

      if (grant.locationIds?.length) {
        grant.locationIds.forEach((id) => locationIds.push(id));
      } else {
        hasPartnerWideGrant = true;
      }
    }

    // Expand partner-wide grants into concrete location ids so every downstream
    // scope check is a simple membership test.
    if (hasPartnerWideGrant && partnerIds.length) {
      const owned = await ParkingLocation.find({ partnerId: { $in: partnerIds } }).select('_id');
      owned.forEach((loc) => locationIds.push(loc._id));
    }

    req.parking = {
      isPlatformAdmin: false,
      roles,
      capabilities,
      partnerIds,
      locationIds,
      scopedToAllLocations: false,
      staffRecords: grants,
    };

    return next();
  } catch (error) {
    console.error('Parking access resolution error:', error);
    return res.status(500).json({ success: false, message: 'Could not resolve parking permissions' });
  }
};

/**
 * Require every listed capability.
 *
 * Must run after `resolveParkingAccess`; the guard below makes a mis-ordered
 * route fail closed rather than silently allowing the request through.
 */
export const requireParkingCapability = (...required) => (req, res, next) => {
  if (!req.parking) {
    console.error('requireParkingCapability used without resolveParkingAccess');
    return res.status(500).json({ success: false, message: 'Parking permissions were not resolved' });
  }

  const missing = required.filter((c) => !req.parking.capabilities.has(c));
  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this parking action.',
    });
  }
  return next();
};

/** Require at least one of the listed parking roles (Super Admin always passes). */
export const requireParkingRole = (...allowed) => (req, res, next) => {
  if (!req.parking) {
    return res.status(500).json({ success: false, message: 'Parking permissions were not resolved' });
  }
  if (req.parking.isPlatformAdmin) return next();

  if (!req.parking.roles.some((r) => allowed.includes(r))) {
    return res.status(403).json({
      success: false,
      message: 'This area is restricted to authorised parking staff.',
    });
  }
  return next();
};

/** True when the caller is scoped to this facility. */
export const canAccessLocation = (req, locationId) => {
  if (!req.parking) return false;
  if (req.parking.isPlatformAdmin) return true;
  if (!locationId) return false;
  return req.parking.locationIds.some((id) => id.toString() === locationId.toString());
};

/**
 * Enforce facility scope for a route that names a location, reading it from
 * `req.params[param]`, the body, or the query — whichever the route uses.
 *
 * Without this a guard employed at one facility could scan and check in a
 * booking belonging to another. Mirrors the intent of the platform's own
 * `scopedAshramIds` checks in the booking controller.
 */
export const enforceLocationScope = (param = 'locationId') => (req, res, next) => {
  const locationId = req.params?.[param] || req.body?.[param] || req.query?.[param];

  if (!locationId) {
    return res.status(400).json({ success: false, message: 'A parking location must be specified.' });
  }
  if (!mongoose.Types.ObjectId.isValid(String(locationId))) {
    return res.status(400).json({ success: false, message: 'Invalid parking location.' });
  }
  if (!canAccessLocation(req, locationId)) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this parking location.',
    });
  }
  return next();
};

/**
 * Mongo filter limiting a query to the caller's facilities.
 * Super Admin gets `{}` (everything); a user with no grants gets a filter that
 * matches nothing, so an unscoped list can never leak.
 */
export const locationScopeFilter = (req, field = 'locationId') => {
  if (req.parking?.isPlatformAdmin) return {};
  const ids = req.parking?.locationIds || [];
  if (!ids.length) return { [field]: { $in: [] } };
  return { [field]: { $in: ids } };
};

export { PARKING_ROLES };

export default {
  resolveParkingAccess,
  requireParkingCapability,
  requireParkingRole,
  canAccessLocation,
  enforceLocationScope,
  locationScopeFilter,
};
