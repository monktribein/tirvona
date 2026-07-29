import mongoose from 'mongoose';
import { PARKING_ROLE_VALUES, PARKING_CAPABILITIES } from '../config/parkingConfig.js';

// parking_staff — grants an EXISTING platform user a parking-module role.
//
// This is why the core User model needed no change: parking roles
// (parking_partner / parking_manager / security_guard) are not values of
// `User.role`. A row here is the grant, and parkingAuth resolves it on each
// request after the platform's own `protect` has established identity.
//
// A user may hold several grants (e.g. manager at two facilities); the resolver
// unions their capabilities and the set of locations they are scoped to.
const parkingStaffSchema = new mongoose.Schema(
  {
    // FK → users._id
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // FK → parking_partners._id
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingPartner',
      required: true,
      index: true,
    },
    // FK → parking_locations._id. Empty means "every location of this partner",
    // which is how a partner-level grant is expressed.
    locationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLocation',
      },
    ],

    parkingRole: {
      type: String,
      enum: PARKING_ROLE_VALUES,
      required: true,
      index: true,
    },

    // Optional narrowing only: a grant can drop capabilities its role would
    // normally carry, but the resolver never lets it ADD one the role lacks.
    // A guard therefore cannot be escalated by editing this array.
    capabilityOverrides: [
      { type: String, enum: Object.values(PARKING_CAPABILITIES) },
    ],

    employeeCode: { type: String, default: '', trim: true, uppercase: true },
    shift: {
      type: String,
      enum: ['morning', 'evening', 'night', 'rotational', 'general'],
      default: 'general',
    },
    phone: { type: String, default: '' },

    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },

    // FK → users._id (the partner/manager/admin who created this grant).
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'parking_staff' }
);

// One grant per (user, partner, role) — re-assigning updates rather than
// duplicating, so capability resolution stays deterministic.
parkingStaffSchema.index({ userId: 1, partnerId: 1, parkingRole: 1 }, { unique: true });
// The hot path: resolve this signed-in user's parking grants.
parkingStaffSchema.index({ userId: 1, status: 1 });
parkingStaffSchema.index({ partnerId: 1, status: 1 });
parkingStaffSchema.index({ locationIds: 1, status: 1 });

const ParkingStaff = mongoose.model('ParkingStaff', parkingStaffSchema);
export default ParkingStaff;
