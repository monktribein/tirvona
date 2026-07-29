import ParkingPartner from '../models/ParkingPartner.js';
import ParkingLocation from '../models/ParkingLocation.js';
import ParkingCommission from '../models/ParkingCommission.js';
import ParkingHoliday from '../models/ParkingHoliday.js';
import ParkingVehicleType from '../models/ParkingVehicleType.js';
import AuditLog from '../../../models/AuditLog.js';
import staffRepo from '../repositories/parkingStaffRepository.js';
import bookingRepo from '../repositories/parkingBookingRepository.js';
import reportService from '../services/parkingReportService.js';
import ledgerService from '../services/parkingLedgerService.js';
import bookingService from '../services/parkingBookingService.js';
import { saveSettings, resolveSettings } from '../services/parkingSettingsService.js';
import { generatePartnerCode, generatePayoutBatchId } from '../utils/parkingIds.js';
import { escapeRegex } from '../../../utils/sanitize.js';
import {
  PARKING_VEHICLE_TYPE_VALUES,
  PARKING_VEHICLE_TYPE_META,
} from '../config/parkingConfig.js';
import { validateObjectId } from '../validators/parkingValidators.js';

// Super Admin surface for the parking module.
//
// Reached only by a caller whose core `User.role` is `super_admin` — resolved by
// `resolveParkingAccess`, which grants that role the full capability set without
// needing a parking_staff row.

const parsePage = (v) => Math.max(1, parseInt(v, 10) || 1);
const parseLimit = (v, max = 100, fallback = 25) =>
  Math.min(max, Math.max(1, parseInt(v, 10) || fallback));

const audit = async (req, action, details) => {
  try {
    await AuditLog.create({
      userId: req.user._id,
      action,
      module: 'PARKING',
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Parking admin audit error:', error.message);
  }
};

// ── Partners ────────────────────────────────────────────────────────────────

// @desc    All parking partners
// @route   GET /api/parking/admin/partners
// @access  Private (manage_partners)
export const listPartners = async (req, res) => {
  try {
    const { items, total } = await staffRepo.findPartnersPaged({
      status: req.query.status,
      // Escaped so a search term is matched literally.
      search: req.query.search ? escapeRegex(req.query.search) : undefined,
      page: parsePage(req.query.page),
      limit: parseLimit(req.query.limit),
    });

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('List parking partners error:', error);
    return res.status(500).json({ success: false, message: 'Could not load partners.' });
  }
};

// @desc    Onboard a parking partner against an existing platform user
// @route   POST /api/parking/admin/partners
// @access  Private (manage_partners)
export const createPartner = async (req, res) => {
  try {
    const { userId, businessName } = req.body;

    const idError = validateObjectId(userId, 'user');
    if (idError) return res.status(400).json({ success: false, message: idError });
    if (!businessName) return res.status(400).json({ success: false, message: 'A business name is required.' });

    const partner = await ParkingPartner.create({
      partnerCode: generatePartnerCode(),
      userId,
      businessName,
      contactPerson: req.body.contactPerson,
      contactEmail: req.body.contactEmail,
      contactPhone: req.body.contactPhone,
      gstNumber: req.body.gstNumber,
      panNumber: req.body.panNumber,
      address: req.body.address,
      commissionPercent: req.body.commissionPercent ?? null,
      status: 'pending',
    });

    await audit(req, 'PARKING_PARTNER_CREATED', { partnerId: partner._id, businessName });

    return res.status(201).json({ success: true, message: 'Parking partner created.', data: partner });
  } catch (error) {
    console.error('Create parking partner error:', error);
    return res.status(500).json({ success: false, message: 'Could not create this partner.' });
  }
};

// @desc    Approve, suspend or reject a partner
// @route   PATCH /api/parking/admin/partners/:id/status
// @access  Private (manage_partners)
export const updatePartnerStatus = async (req, res) => {
  try {
    const { status, rejectionReason, commissionPercent } = req.body;

    if (!['pending', 'active', 'suspended', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid partner status.' });
    }

    const partner = await ParkingPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    partner.status = status;
    if (status === 'active') {
      partner.isVerified = true;
      partner.verifiedAt = new Date();
      partner.verifiedBy = req.user._id;
    }
    if (status === 'rejected') partner.rejectionReason = rejectionReason || '';
    if (commissionPercent !== undefined) partner.commissionPercent = commissionPercent;

    await partner.save();

    // Suspending a partner must take their listings off sale immediately,
    // otherwise a suspended operator keeps taking bookings.
    if (status === 'suspended') {
      await ParkingLocation.updateMany(
        { partnerId: partner._id, status: 'active' },
        { $set: { status: 'suspended' } }
      );
    }

    await audit(req, 'PARKING_PARTNER_STATUS_CHANGED', { partnerId: partner._id, status });

    return res.json({ success: true, message: `Partner ${status}.`, data: partner });
  } catch (error) {
    console.error('Update partner status error:', error);
    return res.status(500).json({ success: false, message: 'Could not update this partner.' });
  }
};

// ── Locations ───────────────────────────────────────────────────────────────

// @desc    All facilities, any status
// @route   GET /api/parking/admin/locations
// @access  Private (manage_partners)
export const listAllLocations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.partnerId) filter.partnerId = req.query.partnerId;
    if (req.query.search) {
      const safe = escapeRegex(req.query.search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { 'address.city': { $regex: safe, $options: 'i' } },
      ];
    }

    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const [items, total] = await Promise.all([
      ParkingLocation.find(filter)
        .populate('partnerId', 'businessName partnerCode status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ParkingLocation.countDocuments(filter),
    ]);

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('List all parking locations error:', error);
    return res.status(500).json({ success: false, message: 'Could not load locations.' });
  }
};

// @desc    Approve, suspend or deactivate a facility
// @route   PATCH /api/parking/admin/locations/:id/status
// @access  Private (manage_partners)
export const updateLocationStatus = async (req, res) => {
  try {
    const { status, isVerified, isFeatured } = req.body;

    if (status && !['draft', 'pending', 'active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid location status.' });
    }

    const location = await ParkingLocation.findById(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking not found.' });

    if (status) location.status = status;
    if (isVerified !== undefined) location.isVerified = Boolean(isVerified);
    if (isFeatured !== undefined) location.isFeatured = Boolean(isFeatured);

    await location.save();
    await audit(req, 'PARKING_LOCATION_STATUS_CHANGED', { locationId: location._id, status });

    return res.json({ success: true, message: 'Parking updated.', data: location });
  } catch (error) {
    console.error('Update location status error:', error);
    return res.status(500).json({ success: false, message: 'Could not update this parking.' });
  }
};

// ── Bookings & refunds ──────────────────────────────────────────────────────

// @desc    All parking bookings
// @route   GET /api/parking/admin/bookings
// @access  Private (manage_bookings)
export const listAllBookings = async (req, res) => {
  try {
    const { items, total } = await bookingRepo.findForOperations({
      scopeFilter: {}, // Super Admin: unrestricted.
      locationId: req.query.locationId,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      vehicleNumber: req.query.vehicleNumber,
      page: parsePage(req.query.page),
      limit: parseLimit(req.query.limit),
    });

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('Admin list parking bookings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load bookings.' });
  }
};

// @desc    Cancel and refund a booking on the visitor's behalf
// @route   POST /api/parking/admin/bookings/:id/refund
// @access  Private (issue_refund)
export const refundBooking = async (req, res) => {
  try {
    const booking = await bookingRepo.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const result = await bookingService.cancelBooking({
      booking,
      actor: req.user,
      reason: req.body.reason || 'Refunded by administrator',
      req,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    await audit(req, 'PARKING_BOOKING_REFUNDED', {
      bookingReference: booking.bookingReference,
      refundAmount: result.refund.refundAmount,
    });

    return res.json({
      success: true,
      message: `Booking cancelled and ₹${result.refund.refundAmount} refunded.`,
      data: { booking: result.booking, refund: result.refund },
    });
  } catch (error) {
    console.error('Admin refund error:', error);
    return res.status(500).json({ success: false, message: 'Could not refund this booking.' });
  }
};

// ── Commission & settlement ─────────────────────────────────────────────────

// @desc    Commission rows, filterable by partner and settlement state
// @route   GET /api/parking/admin/commissions
// @access  Private (manage_commission)
export const listCommissions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.partnerId) filter.partnerId = req.query.partnerId;
    if (req.query.settlementStatus) filter.settlementStatus = req.query.settlementStatus;

    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const [items, total] = await Promise.all([
      ParkingCommission.find(filter)
        .populate('partnerId', 'businessName partnerCode')
        .populate('bookingId', 'bookingReference entryAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ParkingCommission.countDocuments(filter),
    ]);

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('List commissions error:', error);
    return res.status(500).json({ success: false, message: 'Could not load commissions.' });
  }
};

// @desc    Settle every pending commission for a partner as one batch
// @route   POST /api/parking/admin/commissions/settle
// @access  Private (manage_commission)
export const settleCommissions = async (req, res) => {
  try {
    const { partnerId, reference } = req.body;

    const idError = validateObjectId(partnerId, 'partner');
    if (idError) return res.status(400).json({ success: false, message: idError });

    const batchId = generatePayoutBatchId();

    // Only `pending` rows are swept, so a reversed (refunded) commission is
    // never paid out and a re-run cannot double-settle.
    const pending = await ParkingCommission.find({ partnerId, settlementStatus: 'pending' });
    const totalEarning = pending.reduce((sum, c) => sum + c.partnerEarning, 0);

    await ParkingCommission.updateMany(
      { partnerId, settlementStatus: 'pending' },
      {
        $set: {
          settlementStatus: 'settled',
          settledAt: new Date(),
          settlementReference: reference || batchId,
          payoutBatchId: batchId,
        },
      }
    );

    if (totalEarning > 0) {
      await ledgerService.recordTransaction({
        partnerId,
        type: 'payout',
        direction: 'debit',
        amount: -Math.abs(totalEarning),
        description: `Partner payout batch ${batchId}`,
        meta: { bookings: pending.length, batchId },
        recordedBy: req.user._id,
      });
    }

    await audit(req, 'PARKING_COMMISSION_SETTLED', { partnerId, batchId, totalEarning, count: pending.length });

    return res.json({
      success: true,
      message: `Settled ${pending.length} booking(s) totalling ₹${totalEarning}.`,
      data: { batchId, count: pending.length, totalEarning },
    });
  } catch (error) {
    console.error('Settle commissions error:', error);
    return res.status(500).json({ success: false, message: 'Could not settle commissions.' });
  }
};

// ── Analytics ───────────────────────────────────────────────────────────────

// @desc    Platform-wide parking analytics
// @route   GET /api/parking/admin/analytics
// @access  Private (view_analytics)
export const getAnalytics = async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30 * 86400000);
    const to = req.query.to || new Date();

    const all = await ParkingLocation.find({}).select('_id');
    const locationIds = all.map((l) => l._id);

    const [revenue, peakHours, cancellations, averageStay, popular, occupancy, partnerEarnings, ledger] =
      await Promise.all([
        reportService.getRevenueReport({ locationIds, from, to }),
        reportService.getPeakHours({ locationIds, from, to }),
        reportService.getCancellationReport({ locationIds, from, to }),
        reportService.getAverageStay({ locationIds, from, to }),
        reportService.getPopularLocations({ locationIds, from, to }),
        reportService.getOccupancyReport({ locationIds, from, to }),
        reportService.getPartnerEarnings({ from, to }),
        ledgerService.summarise({ from, to }),
      ]);

    return res.json({
      success: true,
      data: {
        revenue, peakHours, cancellations, averageStay, popular, occupancy,
        partnerEarnings, ledger,
        totals: {
          locations: locationIds.length,
          partners: await ParkingPartner.countDocuments({}),
          activeLocations: await ParkingLocation.countDocuments({ status: 'active' }),
        },
        range: { from, to },
      },
    });
  } catch (error) {
    console.error('Parking analytics error:', error);
    return res.status(500).json({ success: false, message: 'Could not build analytics.' });
  }
};

// @desc    The parking money ledger
// @route   GET /api/parking/admin/transactions
// @access  Private (view_analytics)
export const listTransactions = async (req, res) => {
  try {
    const { items, total } = await ledgerService.listTransactions({
      partnerId: req.query.partnerId,
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      page: parsePage(req.query.page),
      limit: parseLimit(req.query.limit),
    });

    return res.json({ success: true, count: items.length, total, data: items });
  } catch (error) {
    console.error('List parking transactions error:', error);
    return res.status(500).json({ success: false, message: 'Could not load transactions.' });
  }
};

// ── Settings, holidays, catalogue ───────────────────────────────────────────

// @desc    Read platform parking settings
// @route   GET /api/parking/admin/settings
// @access  Private (manage_settings)
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await resolveSettings({});
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get platform parking settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load settings.' });
  }
};

// @desc    Update platform parking settings
// @route   PUT /api/parking/admin/settings
// @access  Private (manage_settings)
export const updatePlatformSettings = async (req, res) => {
  try {
    const saved = await saveSettings({
      scope: 'platform',
      values: req.body,
      updatedBy: req.user._id,
    });

    await audit(req, 'PARKING_SETTINGS_UPDATED', { scope: 'platform' });
    return res.json({ success: true, message: 'Parking settings updated.', data: saved });
  } catch (error) {
    console.error('Update platform parking settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not update settings.' });
  }
};

// @desc    Peak-pricing / closure windows
// @route   GET /api/parking/admin/holidays
// @access  Private (manage_settings)
export const listHolidays = async (req, res) => {
  try {
    const holidays = await ParkingHoliday.find({}).sort({ startDate: -1 }).limit(200);
    return res.json({ success: true, count: holidays.length, data: holidays });
  } catch (error) {
    console.error('List parking holidays error:', error);
    return res.status(500).json({ success: false, message: 'Could not load holidays.' });
  }
};

// @desc    Create a peak / closure window
// @route   POST /api/parking/admin/holidays
// @access  Private (manage_settings)
export const createHoliday = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Name, start date and end date are required.' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'End date must be on or after the start date.' });
    }

    const holiday = await ParkingHoliday.create({
      name,
      description: req.body.description,
      partnerId: req.body.partnerId || null,
      locationId: req.body.locationId || null,
      startDate,
      endDate,
      peakMultiplier: Number(req.body.peakMultiplier) || 1,
      isClosed: Boolean(req.body.isClosed),
      type: req.body.type || 'festival',
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: 'Peak window created.', data: holiday });
  } catch (error) {
    console.error('Create parking holiday error:', error);
    return res.status(500).json({ success: false, message: 'Could not create this peak window.' });
  }
};

// @desc    Delete a peak / closure window
// @route   DELETE /api/parking/admin/holidays/:id
// @access  Private (manage_settings)
export const deleteHoliday = async (req, res) => {
  try {
    await ParkingHoliday.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Peak window removed.' });
  } catch (error) {
    console.error('Delete parking holiday error:', error);
    return res.status(500).json({ success: false, message: 'Could not remove this peak window.' });
  }
};

// @desc    Seed the vehicle-type catalogue from the code constants
// @route   POST /api/parking/admin/vehicle-types/seed
// @access  Private (manage_settings)
//
// Idempotent: upserts by code, so running it repeatedly is safe and it never
// disturbs a label an operator has customised beyond re-asserting the defaults.
export const seedVehicleTypes = async (req, res) => {
  try {
    let seeded = 0;

    for (const [index, code] of PARKING_VEHICLE_TYPE_VALUES.entries()) {
      const meta = PARKING_VEHICLE_TYPE_META[code];
      await ParkingVehicleType.findOneAndUpdate(
        { code },
        {
          $setOnInsert: {
            code,
            label: meta.label,
            icon: meta.icon,
            footprint: meta.footprint,
            displayOrder: index,
            isActive: true,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      seeded += 1;
    }

    return res.json({ success: true, message: `${seeded} vehicle type(s) available.` });
  } catch (error) {
    console.error('Seed vehicle types error:', error);
    return res.status(500).json({ success: false, message: 'Could not seed vehicle types.' });
  }
};

// @desc    Release stale holds and mark no-shows
// @route   POST /api/parking/admin/maintenance/sweep
// @access  Private (manage_settings)
//
// Exposed as an endpoint rather than a timer so it can be driven by whatever
// scheduler the deployment already uses, without this module starting its own
// background process inside the API container.
export const runMaintenanceSweep = async (req, res) => {
  try {
    const [holds, noShows] = await Promise.all([
      bookingService.sweepExpiredHolds(200),
      bookingService.sweepNoShows(200),
    ]);

    return res.json({
      success: true,
      message: `Released ${holds.released} expired hold(s), marked ${noShows.marked} no-show(s).`,
      data: { ...holds, ...noShows },
    });
  } catch (error) {
    console.error('Parking maintenance sweep error:', error);
    return res.status(500).json({ success: false, message: 'Could not run the maintenance sweep.' });
  }
};

export default {
  listPartners,
  createPartner,
  updatePartnerStatus,
  listAllLocations,
  updateLocationStatus,
  listAllBookings,
  refundBooking,
  listCommissions,
  settleCommissions,
  getAnalytics,
  listTransactions,
  getPlatformSettings,
  updatePlatformSettings,
  listHolidays,
  createHoliday,
  deleteHoliday,
  seedVehicleTypes,
  runMaintenanceSweep,
};
