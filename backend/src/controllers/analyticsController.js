import Booking from '../models/Booking.js';
import Ashram from '../models/Ashram.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Room from '../models/Room.js';
import { scopedAshramIds } from '../utils/ashramAccess.js';

// @desc    Get dashboard analytics summaries
// @route   GET /api/analytics/dashboard
// @access  Private (Owner / Manager / Super Admin)
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { ashramId } = req.query;

    const query = {};
    const allowedIds = await scopedAshramIds(req.user, Ashram);
    if (allowedIds !== null) {
      const allowedStrs = allowedIds.map((id) => id.toString());
      if (ashramId) {
        if (!allowedStrs.includes(ashramId.toString())) {
          return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
        }
        query.ashramId = ashramId;
      } else {
        query.ashramId = { $in: allowedIds };
      }
    } else if (ashramId) {
      query.ashramId = ashramId;
    }

    const totalBookingsCount = await Booking.countDocuments(query);
    const confirmedCount = await Booking.countDocuments({ ...query, status: 'confirmed' });
    const checkedInCount = await Booking.countDocuments({ ...query, status: 'checked_in' });
    
    const bookings = await Booking.find(query);
    let totalRevenue = 0;
    let pendingPayments = 0;
    let todayRevenue = 0;
    let monthlyRevenue = 0;
    let cancelledBookingsCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    bookings.forEach((b) => {
      totalRevenue += b.pricing.amountPaid || 0;
      pendingPayments += (b.pricing.totalAmount - b.pricing.amountPaid) || 0;
      
      if (b.status === 'cancelled') {
        cancelledBookingsCount++;
      } else {
        const paymentDate = new Date(b.createdAt);
        if (paymentDate >= today) {
          todayRevenue += b.pricing.amountPaid || 0;
        }
        if (paymentDate >= firstDayOfMonth) {
          monthlyRevenue += b.pricing.amountPaid || 0;
        }
      }
    });

    const myStays = await Ashram.find(ashramId ? { _id: ashramId } : (query.ashramId ? { _id: query.ashramId } : {}));
    const totalRatingSum = myStays.reduce((acc, curr) => acc + (curr.rating?.average || 0), 0);
    const averageRating = myStays.length > 0 ? parseFloat((totalRatingSum / myStays.length).toFixed(1)) : 0;

    // available rooms
    const activeRooms = await Room.find(ashramId ? { ashramId } : { ashramId: { $in: myStays.map(s => s._id) } });
    const totalInventoryCount = activeRooms.reduce((acc, curr) => acc + curr.totalInventory, 0);
    const totalBookedToday = await Booking.countDocuments({
      ...query,
      status: { $in: ['confirmed', 'checked_in'] },
      checkInDate: { $lte: new Date() },
      checkOutDate: { $gte: new Date() }
    });
    const availableRoomsCount = Math.max(0, totalInventoryCount - totalBookedToday);

    const occupancyRate = totalBookingsCount > 0 ? Math.min(Math.round((confirmedCount + checkedInCount) * 100 / totalBookingsCount), 100) : 0;

    res.json({
      success: true,
      data: {
        totalBookings: totalBookingsCount,
        occupancyRate,
        revenue: totalRevenue,
        pendingPayments,
        checkInsToday: checkedInCount,
        checkoutSoon: await Booking.countDocuments({ ...query, status: 'checked_in' }),
        todayRevenue,
        monthlyRevenue,
        availableRooms: availableRoomsCount,
        cancelledBookings: cancelledBookingsCount,
        averageRating
      },
    });
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    res.status(500).json({ success: false, message: 'Server error computing dashboard metrics' });
  }
};

// @desc    Get system-wide analytics for Government and Super Admins
// @route   GET /api/analytics/system
// @access  Private (Super Admin / Govt Admin)
export const getSystemAnalytics = async (req, res) => {
  try {
    const totalAshrams = await Ashram.countDocuments();
    const approvedAshrams = await Ashram.countDocuments({ status: 'approved' });
    const pendingInspection = await Ashram.countDocuments({ status: 'pending_inspection' });
    const rejectedAshrams = await Ashram.countDocuments({ status: 'rejected' });
    const totalPilgrims = await User.countDocuments({ role: 'customer' });
    const totalOwners = await User.countDocuments({ role: 'owner' });

    const bookings = await Booking.find();
    let totalPayments = 0;
    let cancellations = 0;

    bookings.forEach((b) => {
      totalPayments += b.pricing.amountPaid;
      if (b.status === 'cancelled') cancellations++;
    });

    const cancellationRate = bookings.length > 0 ? Math.round((cancellations / bookings.length) * 100) : 0;

    // Top locations matching approved ashrams
    const locations = await Ashram.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$address.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // district statistics
    const districtStats = await Ashram.aggregate([
      { $group: { _id: '$address.district', approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending_inspection'] }, 1, 0] } } } },
      { $sort: { approved: -1 } }
    ]);

    const approvedCount = approvedAshrams;
    const totalDecided = approvedCount + rejectedAshrams;
    const approvalRate = totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : 0;

    // Real monthly inspection counts from the audit trail (last 6 months).
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const inspectionAgg = await AuditLog.aggregate([
      { $match: { module: 'GOVT_APPROVAL', action: { $regex: /^ASHRAM_VERIFY/ }, timestamp: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year: '$timestamp' }, m: { $month: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyInspections = inspectionAgg.map((d) => ({
      month: `${monthNames[d._id.m - 1]} ${d._id.y}`,
      count: d.count,
    }));

    res.json({
      success: true,
      data: {
        ashrams: {
          total: totalAshrams,
          approved: approvedAshrams,
          pending: pendingInspection,
          rejected: rejectedAshrams
        },
        users: {
          pilgrims: totalPilgrims,
          owners: totalOwners,
        },
        financials: {
          revenue: totalPayments,
          cancellationRate,
          totalBookings: bookings.length,
          approvalRate,
          monthlyInspections
        },
        popularDestinations: locations.map((loc) => ({ city: loc._id, count: loc.count })),
        districtStats: districtStats.map(d => ({ district: d._id || 'Unknown', approved: d.approved, pending: d.pending }))
      },
    });
  } catch (error) {
    console.error('System analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error compiling system metrics' });
  }
};

// @desc    Get complete system audit trail logs
// @route   GET /api/analytics/audit-logs
// @access  Private (Super Admin)
export const getSystemAuditLogs = async (req, res) => {
  try {
    const { module, action } = req.query;
    
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;

    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving system audit trail logs' });
  }
};
