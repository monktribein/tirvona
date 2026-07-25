import Room from '../models/Room.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';
import { canManageAshram } from '../utils/ashramAccess.js';

// @desc    Add a room category to an ashram
// @route   POST /api/rooms
// @access  Private (Owner / Manager)
export const createRoom = async (req, res) => {
  try {
    const { ashramId, name, type, acType, capacity, totalInventory, basePrice, amenities, pricingRules } = req.body;

    const ashram = await Ashram.findById(ashramId);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Auth validation
    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized to add rooms to this ashram' });
    }

    const room = await Room.create({
      ashramId,
      name,
      type,
      acType,
      capacity,
      totalInventory,
      basePrice,
      amenities: amenities || [],
      pricingRules: pricingRules || [],
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ROOM_CREATE',
      module: 'ROOM_INVENTORY',
      details: { roomId: room._id, name: room.name, ashramId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Server error creating room category' });
  }
};

// @desc    Update room details & pricing rules
// @route   PUT /api/rooms/:id
// @access  Private (Owner / Manager)
export const updateRoom = async (req, res) => {
  try {
    let room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }

    const ashram = await Ashram.findById(room.ashramId);
    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ROOM_UPDATE',
      module: 'ROOM_INVENTORY',
      details: { roomId: room._id, name: room.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating room details' });
  }
};

// @desc    Manually override daily availability / pricing for a date
// @route   POST /api/rooms/:id/availability
// @access  Private (Owner / Manager)
export const updateDailyAvailability = async (req, res) => {
  try {
    const { date, bookedCount, maintenanceCount, customPrice } = req.body;
    const roomId = req.params.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }

    const ashram = await Ashram.findById(room.ashramId);
    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const formattedDate = new Date(new Date(date).toISOString().split('T')[0]);

    // Find and update or create availability override
    const availability = await RoomAvailability.findOneAndUpdate(
      { roomId, date: formattedDate },
      {
        $set: {
          bookedCount: bookedCount !== undefined ? bookedCount : 0,
          maintenanceCount: maintenanceCount !== undefined ? maintenanceCount : 0,
          customPrice: customPrice || undefined,
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      userId: req.user.id,
      action: 'ROOM_AVAILABILITY_OVERRIDE',
      module: 'ROOM_INVENTORY',
      details: { roomId, date: formattedDate, override: availability },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error('Availability override error:', error);
    res.status(500).json({ success: false, message: 'Error updating daily calendar details' });
  }
};

// @desc    Get room inventory status over a 30-day window (for owner rate grid calendar)
// @route   GET /api/rooms/:id/calendar
// @access  Private (Owner / Manager / Staff)
export const getRoomCalendar = async (req, res) => {
  try {
    const roomId = req.params.id;
    const { startDate, endDate } = req.query;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const overrides = await RoomAvailability.find({
      roomId,
      date: { $gte: start, $lte: end },
    });

    const calendar = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const match = overrides.find((o) => o.date.toISOString().split('T')[0] === dateStr);

      let price = room.basePrice;
      if (match && match.customPrice) {
        price = match.customPrice;
      } else {
        const rule = room.pricingRules.find((r) => d >= r.startDate && d <= r.endDate);
        if (rule) {
          price = rule.overridePrice || (room.basePrice * rule.multiplier);
        }
      }

      calendar.push({
        date: dateStr,
        price,
        booked: match ? match.bookedCount : 0,
        maintenance: match ? match.maintenanceCount : 0,
        available: room.totalInventory - (match ? (match.bookedCount + match.maintenanceCount) : 0),
      });
    }

    res.json({
      success: true,
      data: calendar,
    });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving room calendar inventory' });
  }
};
