import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import connectDB from '../../../config/db.js';
import User from '../../../models/User.js';

import ParkingPartner from '../models/ParkingPartner.js';
import ParkingLocation from '../models/ParkingLocation.js';
import ParkingSlotType from '../models/ParkingSlotType.js';
import ParkingSlot from '../models/ParkingSlot.js';
import ParkingPricing from '../models/ParkingPricing.js';
import ParkingVehicleType from '../models/ParkingVehicleType.js';
import ParkingSetting from '../models/ParkingSetting.js';
import ParkingHoliday from '../models/ParkingHoliday.js';
import ParkingStaff from '../models/ParkingStaff.js';
import ParkingBooking from '../models/ParkingBooking.js';
import ParkingPayment from '../models/ParkingPayment.js';
import ParkingQrCode from '../models/ParkingQrCode.js';
import ParkingScanLog from '../models/ParkingScanLog.js';
import ParkingAvailability from '../models/ParkingAvailability.js';
import ParkingCommission from '../models/ParkingCommission.js';
import ParkingTransaction from '../models/ParkingTransaction.js';
import ParkingReview from '../models/ParkingReview.js';
import ParkingNotification from '../models/ParkingNotification.js';

import {
  PARKING_ROLES,
  PARKING_VEHICLE_TYPES as V,
  PARKING_VEHICLE_TYPE_META,
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_PRICING_MODES,
} from '../config/parkingConfig.js';
import { generatePartnerCode, generateLocationSlug } from '../utils/parkingIds.js';
import { createBooking, confirmBooking } from '../services/parkingBookingService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parking System — development seed.
//
//   node src/modules/parking/scripts/seed_parking.js
//   node src/modules/parking/scripts/seed_parking.js --reset
//
// SAFETY: this script writes to the eighteen `parking_*` collections and to
// nothing else, with one deliberate exception — it looks up (and, only if
// missing, creates) a handful of clearly-marked `@parking.dev` User accounts,
// because a staff grant has to reference a real user id. Existing users are
// reused, never modified. No other existing collection is read or written.
//
// `--reset` clears the parking collections first. Without it the script is
// idempotent: it upserts by natural key and leaves your bookings alone.
// ─────────────────────────────────────────────────────────────────────────────

const RESET = process.argv.includes('--reset');
const SKIP_BOOKING = process.argv.includes('--no-booking');

const log = (msg) => console.log(`  ${msg}`);
const section = (msg) => console.log(`\n\x1b[36m${msg}\x1b[0m`);

// ── Test accounts ───────────────────────────────────────────────────────────
// A recognisable domain so these are trivially identifiable and removable.
//
// The TLD is deliberately three characters: the User model validates email
// against /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, which caps the TLD at
// three. The conventional `.test` reserved domain is four and is rejected.
export const TEST_EMAIL_DOMAIN = 'parking.dev';

const TEST_ACCOUNTS = [
  { key: 'partner', name: 'Kashi Parking Services', email: `partner@${TEST_EMAIL_DOMAIN}`, phone: '9800000101' },
  { key: 'manager', name: 'Ramesh Yadav (Parking Manager)', email: `manager@${TEST_EMAIL_DOMAIN}`, phone: '9800000102' },
  { key: 'guard', name: 'Suresh Kumar (Security Guard)', email: `guard@${TEST_EMAIL_DOMAIN}`, phone: '9800000103' },
  { key: 'visitor', name: 'Test Pilgrim', email: `pilgrim@${TEST_EMAIL_DOMAIN}`, phone: '9800000104' },
];

const TEST_PASSWORD = 'parking123';

/**
 * Resolve the accounts the grants point at.
 *
 * Reuses any existing user with the same email — this never overwrites a real
 * account, and re-running the seed will not reset anyone's password.
 */
const ensureUsers = async () => {
  const users = {};

  for (const acc of TEST_ACCOUNTS) {
    let user = await User.findOne({ email: acc.email });

    if (user) {
      log(`reusing existing user ${acc.email}`);
    } else {
      user = await User.create({
        name: acc.name,
        email: acc.email,
        phone: acc.phone,
        passwordHash: TEST_PASSWORD, // hashed by the model's pre-save hook
        role: 'customer',            // core role stays 'customer' by design
        status: 'active',
        isVerified: true,
      });
      log(`created user ${acc.email}`);
    }
    users[acc.key] = user;
  }

  return users;
};

// ── Catalogue ───────────────────────────────────────────────────────────────

const seedVehicleTypes = async () => {
  for (const [index, code] of PARKING_VEHICLE_TYPE_VALUES.entries()) {
    const meta = PARKING_VEHICLE_TYPE_META[code];
    await ParkingVehicleType.findOneAndUpdate(
      { code },
      {
        $set: { label: meta.label, icon: meta.icon, footprint: meta.footprint, displayOrder: index, isActive: true },
        $setOnInsert: { code },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  log(`${PARKING_VEHICLE_TYPE_VALUES.length} vehicle types`);
};

const seedPlatformSettings = async () => {
  await ParkingSetting.findOneAndUpdate(
    { scope: 'platform', partnerId: null, locationId: null },
    {
      $set: {
        reservationHoldMinutes: 15,
        overstayGraceMinutes: 15,
        commissionPercent: 12,
        taxPercent: 18,
        freeCancellationHours: 6,
        refundPercentInsideWindow: 100,
        refundPercentOutsideWindow: 50,
        allowOnlineBooking: true,
        allowCancellation: true,
      },
      $setOnInsert: { scope: 'platform', partnerId: null, locationId: null },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log('platform settings');
};

// ── Facilities ──────────────────────────────────────────────────────────────

const IMG = {
  covered: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80',
  open: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
  garage: 'https://images.unsplash.com/photo-1470224114660-3f6686c562eb?auto=format&fit=crop&w=1200&q=80',
  lot: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
};

/**
 * Four facilities at real pilgrimage destinations, with genuine coordinates so
 * the 2dsphere proximity search returns believable distances.
 */
export const LOCATIONS = [
  {
    name: 'Kashi Vishwanath Corridor Parking',
    description:
      'Multi-level secure parking at the Godowlia end of the Kashi Vishwanath Corridor. Five minutes on foot to Gate 4, with covered bays, CCTV throughout and a 24-hour attended desk.',
    address: { line1: 'Godowlia Crossing, Dashashwamedh Road', landmark: 'Kashi Vishwanath Corridor Gate 4', city: 'Varanasi', district: 'Varanasi', state: 'Uttar Pradesh', pincode: '221001' },
    latitude: 25.3109, longitude: 83.0107,
    contactPhone: '+91 542 240 1100',
    images: [IMG.garage, IMG.covered, IMG.lot],
    amenities: ['covered', 'cctv', 'security', 'washroom', 'wheelchair_access', 'drinking_water'],
    isCovered: true, hasCctv: true, hasSecurity: true, hasWashroom: true, hasWheelchairAccess: true,
    openingHours: { is24x7: true },
    nearbyDestinations: [
      { name: 'Kashi Vishwanath Temple', templeSlug: 'kashi-vishwanath', distanceKm: 0.4, walkingMinutes: 5 },
      { name: 'Dashashwamedh Ghat', distanceKm: 0.7, walkingMinutes: 9 },
      { name: 'Manikarnika Ghat', distanceKm: 1.2, walkingMinutes: 15 },
    ],
    isFeatured: true,
    termsAndConditions:
      'Vehicles are parked at the owner\'s risk. The QR pass must be presented at both entry and exit. Overstay beyond the booked window is charged at the posted hourly rate after a 15-minute grace period. Valuables must not be left in the vehicle.',
    instructions: 'Enter from Godowlia Crossing. Two-wheelers use Ramp A; cars and SUVs use Ramp B.',
    rating: { average: 4.6, count: 214 },
    slotTypes: [
      { name: 'Covered Two-Wheeler Bay', code: 'CV-2W', vehicleTypes: [V.BIKE, V.SCOOTER], totalCapacity: 180, isCovered: true, floorLabel: 'Level B1', prefix: 'A' },
      { name: 'Covered Car Bay', code: 'CV-CAR', vehicleTypes: [V.CAR, V.SUV, V.EV], totalCapacity: 120, isCovered: true, floorLabel: 'Level B2', prefix: 'B' },
      { name: 'EV Charging Bay', code: 'EV', vehicleTypes: [V.EV, V.CAR], totalCapacity: 12, isCovered: true, hasEvCharging: true, floorLabel: 'Level B2', prefix: 'E' },
      { name: 'Open Coach & Bus Bay', code: 'OP-BUS', vehicleTypes: [V.TEMPO, V.MINI_BUS, V.BUS], totalCapacity: 20, isCovered: false, floorLabel: 'Ground', prefix: 'C' },
    ],
  },
  {
    name: 'Parmarth Niketan Ghat Parking',
    description:
      'Riverside parking beside Ram Jhula, serving Parmarth Niketan and the evening Ganga Aarti. Shaded bays, on-site security and a washroom block.',
    address: { line1: 'Ram Jhula Approach Road', landmark: 'Parmarth Niketan Ashram', city: 'Rishikesh', district: 'Dehradun', state: 'Uttarakhand', pincode: '249304' },
    latitude: 30.1187, longitude: 78.3197,
    contactPhone: '+91 135 244 0100',
    images: [IMG.open, IMG.lot],
    amenities: ['cctv', 'security', 'washroom', 'drinking_water', 'ev_charging'],
    hasCctv: true, hasSecurity: true, hasWashroom: true, hasEvCharging: true,
    openingHours: { is24x7: false, opensAt: '04:00', closesAt: '23:00' },
    nearbyDestinations: [
      { name: 'Parmarth Niketan Ashram', distanceKm: 0.2, walkingMinutes: 3 },
      { name: 'Triveni Ghat', distanceKm: 2.4, walkingMinutes: 30 },
      { name: 'Ram Jhula', distanceKm: 0.3, walkingMinutes: 4 },
    ],
    isFeatured: true,
    termsAndConditions:
      'Gates close at 23:00. Vehicles left overnight without a valid booking are charged the full daily rate. Please follow the attendant\'s directions during Ganga Aarti hours.',
    instructions: 'Approach via Ram Jhula road. Aarti-hour traffic is heavy between 17:30 and 19:30 — arrive early.',
    rating: { average: 4.4, count: 138 },
    slotTypes: [
      { name: 'Two-Wheeler Zone', code: 'RS-2W', vehicleTypes: [V.BIKE, V.SCOOTER], totalCapacity: 140, prefix: 'R' },
      { name: 'Car & SUV Zone', code: 'RS-CAR', vehicleTypes: [V.CAR, V.SUV, V.LUXURY_CAR, V.EV], totalCapacity: 85, prefix: 'S' },
      { name: 'Tempo Traveller Bay', code: 'RS-TT', vehicleTypes: [V.TEMPO, V.MINI_BUS], totalCapacity: 18, prefix: 'T' },
    ],
  },
  {
    name: 'Har Ki Pauri Yatri Parking',
    description:
      'The main pilgrim car park for Har Ki Pauri, a short walk from the Brahma Kund aarti steps. Large open lot built for peak Kanwar and Snan-day volumes.',
    address: { line1: 'Upper Road, Near Birla Ghat', landmark: 'Har Ki Pauri', city: 'Haridwar', district: 'Haridwar', state: 'Uttarakhand', pincode: '249401' },
    latitude: 29.9457, longitude: 78.1642,
    contactPhone: '+91 133 422 0500',
    images: [IMG.lot, IMG.open],
    amenities: ['cctv', 'security', 'washroom', 'drinking_water', 'waiting_lounge'],
    hasCctv: true, hasSecurity: true, hasWashroom: true,
    openingHours: { is24x7: true },
    nearbyDestinations: [
      { name: 'Har Ki Pauri', distanceKm: 0.6, walkingMinutes: 8 },
      { name: 'Mansa Devi Ropeway', distanceKm: 1.1, walkingMinutes: 14 },
      { name: 'Chandi Devi Temple', distanceKm: 3.2 },
    ],
    termsAndConditions:
      'Peak pricing applies on Snan days and through the Kanwar Yatra period. The lot may close at short notice on administration orders during major bathing festivals.',
    instructions: 'Enter from Upper Road. Follow marshals during Snan days — lanes are reversed.',
    rating: { average: 4.2, count: 96 },
    slotTypes: [
      { name: 'Two-Wheeler Lot', code: 'HD-2W', vehicleTypes: [V.BIKE, V.SCOOTER], totalCapacity: 300, prefix: 'H' },
      { name: 'Car Lot', code: 'HD-CAR', vehicleTypes: [V.CAR, V.SUV, V.EV], totalCapacity: 200, prefix: 'K' },
      { name: 'Bus & Coach Lot', code: 'HD-BUS', vehicleTypes: [V.MINI_BUS, V.BUS, V.TEMPO], totalCapacity: 45, prefix: 'L' },
    ],
  },
  {
    name: 'Banke Bihari Temple Parking',
    description:
      'Compact covered parking inside the Vrindavan parikrama zone, two minutes from the Banke Bihari gate. Two-wheelers and small cars only — the lanes will not take a coach.',
    address: { line1: 'Vidyapeeth Crossing, Parikrama Marg', landmark: 'Banke Bihari Mandir', city: 'Vrindavan', district: 'Mathura', state: 'Uttar Pradesh', pincode: '281121' },
    latitude: 27.5820, longitude: 77.7000,
    contactPhone: '+91 565 244 0088',
    images: [IMG.covered, IMG.garage],
    amenities: ['covered', 'cctv', 'security', 'wheelchair_access'],
    isCovered: true, hasCctv: true, hasSecurity: true, hasWheelchairAccess: true,
    openingHours: { is24x7: false, opensAt: '05:00', closesAt: '22:30' },
    nearbyDestinations: [
      { name: 'Banke Bihari Temple', distanceKm: 0.2, walkingMinutes: 3 },
      { name: 'Prem Mandir', distanceKm: 2.8 },
      { name: 'ISKCON Vrindavan', distanceKm: 3.4 },
    ],
    termsAndConditions:
      'Coaches and buses cannot be accommodated — the parikrama lanes are too narrow. Darshan-hour queues are managed by the temple trust.',
    instructions: 'Narrow approach lanes. Vehicles wider than 1.9m should use the Vidyapeeth overflow lot instead.',
    rating: { average: 4.1, count: 57 },
    slotTypes: [
      { name: 'Covered Two-Wheeler', code: 'VR-2W', vehicleTypes: [V.BIKE, V.SCOOTER], totalCapacity: 90, isCovered: true, prefix: 'V' },
      { name: 'Compact Car Bay', code: 'VR-CAR', vehicleTypes: [V.CAR, V.EV], totalCapacity: 40, isCovered: true, prefix: 'W' },
    ],
  },
];

/** Slab rate cards, in the shape the pricing engine evaluates. */
export const RATE_CARDS = {
  [V.BIKE]:       { baseFee: 0,  hourlyRate: 5,   dailyRate: 60,   slabs: [{ uptoHours: 2, price: 10 }, { uptoHours: 6, price: 25 }, { uptoHours: null, price: 25, perHourAfter: 5 }] },
  [V.SCOOTER]:    { baseFee: 0,  hourlyRate: 5,   dailyRate: 60,   slabs: [{ uptoHours: 2, price: 10 }, { uptoHours: 6, price: 25 }, { uptoHours: null, price: 25, perHourAfter: 5 }] },
  [V.CAR]:        { baseFee: 10, hourlyRate: 20,  dailyRate: 250,  slabs: [{ uptoHours: 2, price: 40 }, { uptoHours: 6, price: 90 }, { uptoHours: null, price: 90, perHourAfter: 20 }] },
  [V.SUV]:        { baseFee: 10, hourlyRate: 25,  dailyRate: 320,  slabs: [{ uptoHours: 2, price: 50 }, { uptoHours: 6, price: 115 }, { uptoHours: null, price: 115, perHourAfter: 25 }] },
  [V.LUXURY_CAR]: { baseFee: 20, hourlyRate: 35,  dailyRate: 450,  slabs: [{ uptoHours: 2, price: 70 }, { uptoHours: 6, price: 160 }, { uptoHours: null, price: 160, perHourAfter: 35 }] },
  [V.EV]:         { baseFee: 0,  hourlyRate: 18,  dailyRate: 220,  slabs: [{ uptoHours: 2, price: 35 }, { uptoHours: 6, price: 80 }, { uptoHours: null, price: 80, perHourAfter: 18 }] },
  [V.TEMPO]:      { baseFee: 25, hourlyRate: 45,  dailyRate: 600,  slabs: [{ uptoHours: 4, price: 120 }, { uptoHours: null, price: 120, perHourAfter: 45 }] },
  [V.MINI_BUS]:   { baseFee: 40, hourlyRate: 65,  dailyRate: 850,  slabs: [{ uptoHours: 4, price: 180 }, { uptoHours: null, price: 180, perHourAfter: 65 }] },
  [V.BUS]:        { baseFee: 50, hourlyRate: 90,  dailyRate: 1200, slabs: [{ uptoHours: 4, price: 260 }, { uptoHours: null, price: 260, perHourAfter: 90 }] },
};

const seedLocations = async (partner, adminUserId) => {
  const created = [];

  for (const spec of LOCATIONS) {
    const { slotTypes, ...locationData } = spec;

    // Upsert by name+city so a re-run updates rather than duplicating. Built
    // with new+save (not insertMany) so the pre-save hook keeps the GeoJSON
    // point in step with latitude/longitude — insertMany skips save hooks.
    let location = await ParkingLocation.findOne({
      name: locationData.name,
      'address.city': locationData.address.city,
    });

    if (location) {
      Object.assign(location, locationData);
      await location.save();
    } else {
      location = new ParkingLocation({
        ...locationData,
        partnerId: partner._id,
        slug: generateLocationSlug(locationData.name, locationData.address.city),
        status: 'active',
        isVerified: true,
        createdBy: adminUserId,
        totalCapacity: slotTypes.reduce((sum, s) => sum + s.totalCapacity, 0),
      });
      await location.save();
    }

    // Slot types
    const createdSlotTypes = [];
    for (const [index, st] of slotTypes.entries()) {
      const { prefix, ...stData } = st;

      const slotType = await ParkingSlotType.findOneAndUpdate(
        { locationId: location._id, code: st.code },
        { $set: { ...stData, locationId: location._id, displayOrder: index, isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      createdSlotTypes.push({ slotType, prefix });

      // Physical bays. Seeded at a tenth of capacity — enough to exercise bay
      // assignment at check-in without inserting hundreds of rows, and the
      // capacity accounting lives in parking_availability regardless.
      const bayCount = Math.max(6, Math.ceil(st.totalCapacity / 10));
      const bays = Array.from({ length: bayCount }, (_, i) => ({
        locationId: location._id,
        slotTypeId: slotType._id,
        slotNumber: `${prefix}${String(i + 1).padStart(3, '0')}`,
        floorLabel: st.floorLabel || '',
      }));

      // ordered:false so a re-run skips existing bay labels instead of aborting.
      try {
        await ParkingSlot.insertMany(bays, { ordered: false });
      } catch {
        // Duplicate keys on re-run are expected and harmless.
      }
    }

    // Rate cards, one per vehicle class the facility actually accepts.
    const supported = new Set(slotTypes.flatMap((s) => s.vehicleTypes));
    for (const vehicleType of supported) {
      const card = RATE_CARDS[vehicleType];
      if (!card) continue;

      await ParkingPricing.findOneAndUpdate(
        { locationId: location._id, slotTypeId: null, vehicleType },
        {
          $set: {
            ...card,
            mode: PARKING_PRICING_MODES.SLAB,
            minimumBillableHours: 1,
            freeMinutes: 15,
            peakMultiplier: 1,
            isActive: true,
            updatedBy: adminUserId,
          },
          $setOnInsert: { locationId: location._id, slotTypeId: null, vehicleType },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    // Keep the denormalised vehicle list in step with the slot types.
    location.supportedVehicleTypes = [...supported];
    await location.save();

    created.push({ location, slotTypes: createdSlotTypes });
    log(`${location.name} — ${slotTypes.length} areas, ${supported.size} rate cards`);
  }

  return created;
};

const seedHolidays = async (locations, adminUserId) => {
  const year = new Date().getFullYear();

  const windows = [
    {
      name: 'Maha Shivratri',
      description: 'Peak demand across all Shiva kshetras.',
      startDate: new Date(`${year}-02-15T00:00:00Z`),
      endDate: new Date(`${year}-02-17T23:59:59Z`),
      peakMultiplier: 2,
      type: 'festival',
    },
    {
      name: 'Kanwar Yatra',
      description: 'Haridwar and Rishikesh operate at capacity; lanes are reversed on peak days.',
      startDate: new Date(`${year}-07-10T00:00:00Z`),
      endDate: new Date(`${year}-07-26T23:59:59Z`),
      peakMultiplier: 2.5,
      type: 'peak_season',
    },
    {
      name: 'Dev Deepawali',
      description: 'Varanasi ghats — highest single-night demand of the year.',
      startDate: new Date(`${year}-11-14T00:00:00Z`),
      endDate: new Date(`${year}-11-16T23:59:59Z`),
      peakMultiplier: 3,
      type: 'festival',
      locationName: 'Kashi Vishwanath Corridor Parking',
    },
  ];

  for (const w of windows) {
    const { locationName, ...data } = w;
    const scoped = locationName ? locations.find((l) => l.location.name === locationName) : null;

    // `name` is already inside `data` and therefore inside `$set`. Repeating it
    // in `$setOnInsert` makes Mongo reject the whole update with
    // ConflictingUpdateOperators — a field may appear in only one operator.
    // The filter matches on name, so `$set` alone is correct on both paths.
    await ParkingHoliday.findOneAndUpdate(
      { name: w.name, locationId: scoped?.location._id || null },
      {
        $set: { ...data, locationId: scoped?.location._id || null, isActive: true, createdBy: adminUserId },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    log(`${w.name} (×${w.peakMultiplier})`);
  }
};

const seedStaff = async (users, partner, locations) => {
  const allLocationIds = locations.map((l) => l.location._id);

  // Partner grant: no explicit locations, which the resolver expands to every
  // facility this partner owns.
  await ParkingStaff.findOneAndUpdate(
    { userId: users.partner._id, partnerId: partner._id, parkingRole: PARKING_ROLES.PARTNER },
    {
      $set: { locationIds: [], status: 'active', employeeCode: 'PKP-OWNER', shift: 'general', assignedBy: users.partner._id },
      $setOnInsert: { userId: users.partner._id, partnerId: partner._id, parkingRole: PARKING_ROLES.PARTNER },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log(`partner grant → ${users.partner.email} (all ${allLocationIds.length} locations)`);

  // Manager: the two Uttarakhand facilities only.
  const managerLocations = locations
    .filter((l) => l.location.address.state === 'Uttarakhand')
    .map((l) => l.location._id);

  await ParkingStaff.findOneAndUpdate(
    { userId: users.manager._id, partnerId: partner._id, parkingRole: PARKING_ROLES.MANAGER },
    {
      $set: { locationIds: managerLocations, status: 'active', employeeCode: 'PKM-001', shift: 'general', assignedBy: users.partner._id },
      $setOnInsert: { userId: users.manager._id, partnerId: partner._id, parkingRole: PARKING_ROLES.MANAGER },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log(`manager grant → ${users.manager.email} (${managerLocations.length} locations)`);

  // Guard: a single post. This is what makes the location-scope check testable —
  // a pass for any other facility must be refused at this gate.
  const guardLocation = locations[0].location._id;

  await ParkingStaff.findOneAndUpdate(
    { userId: users.guard._id, partnerId: partner._id, parkingRole: PARKING_ROLES.GUARD },
    {
      $set: { locationIds: [guardLocation], status: 'active', employeeCode: 'PKG-014', shift: 'morning', assignedBy: users.manager._id },
      $setOnInsert: { userId: users.guard._id, partnerId: partner._id, parkingRole: PARKING_ROLES.GUARD },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log(`guard grant → ${users.guard.email} (1 location: ${locations[0].location.name})`);
};

/**
 * A confirmed booking with a live QR pass, so the gate scanner can be exercised
 * immediately. Goes through the real service functions rather than inserting
 * documents directly, so inventory, commission, ledger and pass issuance all
 * run exactly as they do in production.
 */
const seedSampleBooking = async (users, locations) => {
  const { location, slotTypes } = locations[0];
  const carArea = slotTypes.find((s) => s.slotType.code === 'CV-CAR');
  if (!carArea) return null;

  const entryAt = new Date(Date.now() + 45 * 60 * 1000);   // 45 min from now
  const exitAt = new Date(entryAt.getTime() + 4 * 3600000); // 4-hour stay

  const result = await createBooking({
    user: users.visitor,
    locationId: location._id,
    slotTypeId: carArea.slotType._id,
    vehicleType: V.CAR,
    vehicleNumber: 'UP65AB1234',
    entryAt,
    exitAt,
    vehicleModel: 'Maruti Swift, white',
    driverName: users.visitor.name,
    driverPhone: users.visitor.phone,
  });

  if (!result.ok) {
    log(`\x1b[33msample booking skipped: ${result.message}\x1b[0m`);
    return null;
  }

  // Mark it paid through the real confirmation path — issues the QR, books the
  // commission and writes the ledger entry.
  const { booking, pass } = await confirmBooking({ booking: result.booking, actorId: users.visitor._id });

  await ParkingPayment.create({
    bookingId: booking._id,
    userId: users.visitor._id,
    partnerId: booking.partnerId,
    amount: booking.pricing.totalAmount,
    purpose: 'booking',
    method: 'demo',
    status: 'paid',
    paidAt: new Date(),
    transactionId: `PKSEED-${Date.now()}`,
  });

  return { booking, pass, location };
};

// ── Runner ──────────────────────────────────────────────────────────────────

const PARKING_MODELS = [
  ParkingScanLog, ParkingQrCode, ParkingNotification, ParkingTransaction,
  ParkingCommission, ParkingPayment, ParkingReview, ParkingBooking,
  ParkingAvailability, ParkingSlot, ParkingPricing, ParkingSlotType,
  ParkingHoliday, ParkingStaff, ParkingLocation, ParkingPartner,
  ParkingSetting, ParkingVehicleType,
];

const run = async () => {
  try {
    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      console.error('\n\x1b[31mNot connected to MongoDB. Check MONGODB_URI in backend/.env\x1b[0m\n');
      process.exit(1);
    }

    console.log(`\n\x1b[1mSeeding Parking System\x1b[0m  (db: ${mongoose.connection.name})`);

    if (RESET) {
      section('Resetting parking collections');
      for (const Model of PARKING_MODELS) {
        const { deletedCount } = await Model.deleteMany({});
        if (deletedCount) log(`${Model.collection.collectionName}: ${deletedCount} removed`);
      }
      log('existing collections untouched');
    }

    section('Users');
    const users = await ensureUsers();

    section('Catalogue');
    await seedVehicleTypes();
    await seedPlatformSettings();

    section('Partner');
    const partner = await ParkingPartner.findOneAndUpdate(
      { userId: users.partner._id },
      {
        $set: {
          businessName: 'Kashi Parking Services Pvt Ltd',
          contactPerson: 'Anil Gupta',
          contactEmail: users.partner.email,
          contactPhone: users.partner.phone,
          gstNumber: '09AAACK1234M1ZP',
          address: { line1: 'Godowlia Crossing', city: 'Varanasi', state: 'Uttar Pradesh', pincode: '221001' },
          commissionPercent: 12,
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
        },
        $setOnInsert: { userId: users.partner._id, partnerCode: generatePartnerCode() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    log(`${partner.businessName} (${partner.partnerCode})`);

    section('Locations, areas, bays & pricing');
    const locations = await seedLocations(partner, users.partner._id);

    section('Peak windows');
    await seedHolidays(locations, users.partner._id);

    section('Staff grants');
    await seedStaff(users, partner, locations);

    let sample = null;
    if (!SKIP_BOOKING) {
      section('Sample booking');
      sample = await seedSampleBooking(users, locations);
      if (sample) log(`${sample.booking.bookingReference} — ₹${sample.booking.pricing.totalAmount}, pass issued`);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n\x1b[32m✓ Parking seed complete\x1b[0m');

    const counts = await Promise.all(
      PARKING_MODELS.map(async (M) => [M.collection.collectionName, await M.countDocuments()])
    );
    console.log('\n\x1b[1mCollections\x1b[0m');
    counts
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, n]) => console.log(`  ${String(n).padStart(5)}  ${name}`));

    console.log('\n\x1b[1mTest accounts\x1b[0m  (password: ' + TEST_PASSWORD + ')');
    const scopes = {
      partner: 'Parking Partner — all 4 locations   → /parking/partner',
      manager: 'Parking Manager — 2 Uttarakhand     → /parking/partner',
      guard: 'Security Guard  — Varanasi only      → /parking/gate',
      visitor: 'Visitor                              → /parking',
    };
    for (const acc of TEST_ACCOUNTS) {
      console.log(`  ${acc.email.padEnd(24)} ${scopes[acc.key]}`);
    }

    if (sample) {
      console.log('\n\x1b[1mGate-scanner test pass\x1b[0m');
      console.log(`  Booking    ${sample.booking.bookingReference}`);
      console.log(`  Vehicle    ${sample.booking.vehicleNumber}`);
      console.log(`  Gate code  ${sample.pass.displayCode}`);
      console.log(`  Location   ${sample.location.name}`);
      console.log('\n  Paste this token into the scanner at /parking/gate:\n');
      console.log(`\x1b[33m${sample.pass.token}\x1b[0m`);
      console.log('\n  Sign in as the guard account above, choose Entry, paste, submit.');
      console.log('  Then switch to Exit and paste the same token to test check-out.');
      console.log('  (The token is shown only here — the database stores only its hash.)');
    }

    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\n\x1b[31mParking seed failed:\x1b[0m', error);
    process.exit(1);
  }
};

// Only connect and write when invoked directly (`node seed_parking.js`).
// Importing this file — which the schema-validation test does — must never
// open a database connection or mutate anything.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) run();

export { run, TEST_ACCOUNTS, TEST_PASSWORD };
