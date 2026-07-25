import RoomUnit from '../models/RoomUnit.js';
import Room from '../models/Room.js';
import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';
import { scopedAshramIds, canManageAshram } from '../utils/ashramAccess.js';

// Ensure a RoomUnit document exists for every physical room implied by each
// room category's `totalInventory`. Idempotent: only creates missing units.
const provisionUnits = async (ashramId) => {
  const rooms = await Room.find({ ashramId });
  for (const room of rooms) {
    const existing = await RoomUnit.countDocuments({ roomId: room._id });
    if (existing >= room.totalInventory) continue;
    const toCreate = [];
    for (let i = existing + 1; i <= room.totalInventory; i++) {
      toCreate.push({
        ashramId,
        roomId: room._id,
        unitNumber: `${room.name.slice(0, 3).toUpperCase()}-${String(i).padStart(2, '0')}`,
        status: 'clean',
      });
    }
    if (toCreate.length) {
      // Ordered:false so a duplicate (from a concurrent request) doesn't abort the batch.
      await RoomUnit.insertMany(toCreate, { ordered: false }).catch(() => {});
    }
  }
};

// @desc    Housekeeping board — all room units for the staff member's ashram(s)
// @route   GET /api/housekeeping
// @access  Private (owner, manager, reception, housekeeping, super_admin)
export const getHousekeepingBoard = async (req, res) => {
  try {
    const ids = await scopedAshramIds(req.user, Ashram);

    // Determine which ashrams to show.
    let ashramFilter = {};
    if (ids === null) {
      // super_admin: optionally narrow by query param, else all.
      if (req.query.ashramId) ashramFilter = { ashramId: req.query.ashramId };
    } else {
      if (ids.length === 0) {
        return res.json({ success: true, count: 0, data: [] });
      }
      ashramFilter = { ashramId: { $in: ids } };
    }

    // Auto-provision units for the scoped ashrams so the board is never empty
    // when inventory exists.
    const provisionTargets = ids === null
      ? (req.query.ashramId ? [req.query.ashramId] : (await Ashram.find().select('_id')).map((a) => a._id))
      : ids;
    for (const aId of provisionTargets) {
      await provisionUnits(aId);
    }

    const units = await RoomUnit.find(ashramFilter)
      .populate('roomId', 'name type acType')
      .populate('assignedTo', 'name')
      .sort({ unitNumber: 1 });

    res.json({ success: true, count: units.length, data: units });
  } catch (error) {
    console.error('Housekeeping board error:', error);
    res.status(500).json({ success: false, message: 'Server error loading housekeeping board' });
  }
};

// @desc    Update a room unit's cleaning status
// @route   PATCH /api/housekeeping/:id
// @access  Private (owner, manager, reception, housekeeping, super_admin)
export const updateUnitStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['clean', 'dirty', 'cleaning', 'maintenance'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid room status' });
    }

    const unit = await RoomUnit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Room unit not found' });
    }

    // Authorization: staff scoped to this ashram, owner of it, or super_admin.
    const ids = await scopedAshramIds(req.user, Ashram);
    const ashram = await Ashram.findById(unit.ashramId);
    const allowed =
      ids === null ||
      ids.some((id) => id.toString() === unit.ashramId.toString()) ||
      canManageAshram(req.user, ashram);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ashram' });
    }

    unit.status = status;
    if (notes !== undefined) unit.notes = notes;
    // The staff member acting becomes the assignee when they start cleaning.
    if (status === 'cleaning' && ['housekeeping', 'reception', 'manager'].includes(req.user.role)) {
      unit.assignedTo = req.user.id;
    }
    await unit.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'HOUSEKEEPING_STATUS_UPDATE',
      module: 'HOUSEKEEPING',
      details: { unitId: unit._id, unitNumber: unit.unitNumber, status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Live update to the ashram owner's dashboard room.
    if (req.io && ashram?.ownerId) {
      req.io.to(ashram.ownerId.toString()).emit('housekeeping_update', {
        unitId: unit._id.toString(),
        unitNumber: unit.unitNumber,
        status,
      });
    }

    const populated = await unit.populate([
      { path: 'roomId', select: 'name type acType' },
      { path: 'assignedTo', select: 'name' },
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Update unit status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating room status' });
  }
};
