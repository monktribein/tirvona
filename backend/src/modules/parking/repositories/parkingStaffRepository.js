import ParkingStaff from '../models/ParkingStaff.js';
import ParkingPartner from '../models/ParkingPartner.js';
import { PARKING_ROLE_VALUES } from '../config/parkingConfig.js';

// Data access for parking staff grants and partner accounts.

export const findGrantsForUser = (userId) =>
  ParkingStaff.find({ userId, status: 'active' });

export const findStaffForPartner = (partnerId, { status } = {}) =>
  ParkingStaff.find({ partnerId, ...(status ? { status } : {}) })
    .populate('userId', 'name email phone role status')
    .populate('locationIds', 'name slug')
    .sort({ createdAt: -1 });

export const findStaffForLocations = (locationIds) =>
  ParkingStaff.find({ locationIds: { $in: locationIds }, status: 'active' })
    .populate('userId', 'name email phone')
    .sort({ parkingRole: 1, createdAt: -1 });

/**
 * Create or update a grant.
 *
 * Upserts on (userId, partnerId, parkingRole) — the collection's unique index —
 * so re-assigning someone does not stack duplicate grants and leave capability
 * resolution ambiguous.
 */
export const upsertGrant = async ({
  userId,
  partnerId,
  parkingRole,
  locationIds = [],
  capabilityOverrides = [],
  employeeCode = '',
  shift = 'general',
  phone = '',
  assignedBy,
}) => {
  if (!PARKING_ROLE_VALUES.includes(parkingRole)) {
    throw new Error(`Unknown parking role: ${parkingRole}`);
  }

  return ParkingStaff.findOneAndUpdate(
    { userId, partnerId, parkingRole },
    {
      $set: {
        locationIds,
        capabilityOverrides,
        employeeCode,
        shift,
        phone,
        assignedBy,
        status: 'active',
      },
      $setOnInsert: { userId, partnerId, parkingRole },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Revoke a grant.
 *
 * Deactivates rather than deletes: the scan logs reference the staff row, and a
 * removed guard's historical scans must stay attributable.
 */
export const deactivateGrant = (grantId) =>
  ParkingStaff.findByIdAndUpdate(grantId, { $set: { status: 'inactive' } }, { new: true });

export const findGrantById = (grantId) => ParkingStaff.findById(grantId);

export const touchLastActive = (userId) =>
  ParkingStaff.updateMany({ userId, status: 'active' }, { $set: { lastActiveAt: new Date() } });

// ── Partners ────────────────────────────────────────────────────────────────

export const findPartnerById = (partnerId) => ParkingPartner.findById(partnerId);

export const findPartnerForUser = (userId) =>
  ParkingPartner.findOne({ userId, status: { $in: ['active', 'pending'] } });

export const findPartnersPaged = async ({ status, search, page = 1, limit = 25 } = {}) => {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (search) {
    // Escaped upstream by the controller; matched against the two identifying
    // fields an operator would search by.
    filter.$or = [
      { businessName: { $regex: search, $options: 'i' } },
      { partnerCode: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    ParkingPartner.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ParkingPartner.countDocuments(filter),
  ]);

  return { items, total };
};

export default {
  findGrantsForUser,
  findStaffForPartner,
  findStaffForLocations,
  upsertGrant,
  deactivateGrant,
  findGrantById,
  touchLastActive,
  findPartnerById,
  findPartnerForUser,
  findPartnersPaged,
};
