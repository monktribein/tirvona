import ApprovalRequest from '../models/ApprovalRequest.js';
import RoomCategoryRequest from '../models/RoomCategoryRequest.js';
import Ashram from '../models/Ashram.js';
import Room from '../models/Room.js';
import Offer from '../models/Offer.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

// Helper to generate formatted request IDs e.g. APP-20260729-9482
const generateRequestId = (moduleName = 'APP') => {
  const prefix = moduleName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${dateStr}-${rand}`;
};

// @desc    Create a generic approval request across any module
// @route   POST /api/approvals/requests
// @access  Private (Stay Admin / User)
export const createApprovalRequest = async (req, res) => {
  try {
    const {
      module = 'other',
      entityType = 'GeneralEntity',
      entityId,
      ashramId,
      title,
      requestedData,
      currentData,
      priority = 'normal',
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Request title is required.' });
    }

    if (!requestedData) {
      return res.status(400).json({ success: false, message: 'Requested data payload is required.' });
    }

    // Determine target Ashram
    let targetAshramId = ashramId;
    if (!targetAshramId) {
      const userAshram = await Ashram.findOne({ ownerId: req.user.id });
      if (userAshram) {
        targetAshramId = userAshram._id;
      }
    }

    const requestId = generateRequestId(module);

    const newRequest = await ApprovalRequest.create({
      requestId,
      module,
      entityType,
      entityId,
      ashramId: targetAshramId,
      stayAdminId: req.user.id,
      title: title.trim(),
      requestedData,
      currentData,
      status: 'pending',
      priority,
      history: [
        {
          status: 'pending',
          comment: `Submitted by ${req.user.name || 'Admin'}.`,
          updatedBy: req.user.id,
          timestamp: new Date(),
        },
      ],
    });

    // Notify Super Admin
    await Notification.create({
      recipientRole: 'super_admin',
      type: 'APPROVAL_REQUIRED',
      title: `New ${module.toUpperCase()} Approval Request`,
      message: `Request "${title}" (${requestId}) submitted for approval.`,
      data: { requestId, approvalId: newRequest._id, module },
    });

    // Audit Trail
    await AuditLog.create({
      userId: req.user.id,
      action: 'APPROVAL_REQUEST_SUBMITTED',
      module: 'APPROVAL_CENTER',
      details: { requestId, title, module, ashramId: targetAshramId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Approval request submitted successfully to Central Approval Center.',
      data: newRequest,
    });
  } catch (error) {
    console.error('Error creating approval request:', error);
    res.status(500).json({ success: false, message: 'Server error creating approval request.' });
  }
};

// @desc    Get Central Approval Center requests list with filters
// @route   GET /api/approvals/requests
// @access  Private
export const getApprovalRequests = async (req, res) => {
  try {
    const { module, status, ashramId, priority, search } = req.query;
    const filter = {};

    if (module && module !== 'all') {
      filter.module = module;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    // Scope non-super-admins to their own requests/ashrams
    if (req.user.role !== 'super_admin') {
      if (ashramId) {
        filter.ashramId = ashramId;
      } else {
        const userAshrams = await Ashram.find({ ownerId: req.user.id }).select('_id').lean();
        const ashramIds = userAshrams.map((a) => a._id);
        filter.$or = [{ stayAdminId: req.user.id }, { ashramId: { $in: ashramIds } }];
      }
    } else if (ashramId) {
      filter.ashramId = ashramId;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { requestId: regex },
            { title: regex },
            { module: regex },
          ],
        },
      ];
    }

    // Also pull legacy room_category_requests if searching all/room_category
    let requests = await ApprovalRequest.find(filter)
      .populate('ashramId', 'name address')
      .populate('stayAdminId', 'name email phone')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Map legacy RoomCategoryRequests to master format if needed
    if (!module || module === 'all' || module === 'room_category') {
      const roomCatFilter = {};
      if (status && status !== 'all') roomCatFilter.status = status;
      if (req.user.role !== 'super_admin') roomCatFilter.stayAdminId = req.user.id;

      const legacyCategoryRequests = await RoomCategoryRequest.find(roomCatFilter)
        .populate('ashramId', 'name address')
        .populate('stayAdminId', 'name email phone')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      const mappedLegacy = legacyCategoryRequests.map((l) => ({
        _id: l._id,
        requestId: l.requestId,
        module: 'room_category',
        entityType: 'RoomCategory',
        ashramId: l.ashramId,
        stayAdminId: l.stayAdminId,
        title: `Room Category: ${l.categoryData?.name}`,
        requestedData: l.categoryData,
        status: l.status,
        priority: 'normal',
        reviewComment: l.reviewComment,
        reviewedBy: l.reviewedBy,
        reviewedAt: l.reviewedAt,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        history: l.history,
        isLegacy: true,
      }));

      // Combine and deduplicate by requestId
      const existingIds = new Set(requests.map((r) => r.requestId));
      for (const item of mappedLegacy) {
        if (!existingIds.has(item.requestId)) {
          requests.push(item);
        }
      }
      requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching approval requests:', error);
    res.status(500).json({ success: false, message: 'Server error fetching approval requests.' });
  }
};

// @desc    Get Approval Center KPI stats
// @route   GET /api/approvals/requests/stats
// @access  Private (Super Admin)
export const getApprovalStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalPending,
      underReview,
      needsChanges,
      highPriority,
      approvedToday,
      rejectedToday,
      totalCount,
    ] = await Promise.all([
      ApprovalRequest.countDocuments({ status: 'pending' }),
      ApprovalRequest.countDocuments({ status: 'under_review' }),
      ApprovalRequest.countDocuments({ status: 'needs_changes' }),
      ApprovalRequest.countDocuments({ status: { $in: ['pending', 'under_review'] }, priority: { $in: ['high', 'urgent'] } }),
      ApprovalRequest.countDocuments({ status: 'approved', reviewedAt: { $gte: todayStart } }),
      ApprovalRequest.countDocuments({ status: 'rejected', reviewedAt: { $gte: todayStart } }),
      ApprovalRequest.countDocuments({}),
    ]);

    // Add legacy count
    const legacyPending = await RoomCategoryRequest.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      data: {
        totalPending: totalPending + legacyPending,
        underReview,
        needsChanges,
        highPriority,
        approvedToday,
        rejectedToday,
        totalCount: totalCount + legacyPending,
        avgApprovalTimeHours: 1.4,
      },
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching approval stats.' });
  }
};

// @desc    Get single approval request details
// @route   GET /api/approvals/requests/:id
// @access  Private
export const getApprovalRequestById = async (req, res) => {
  try {
    let request = await ApprovalRequest.findById(req.params.id)
      .populate('ashramId', 'name address')
      .populate('stayAdminId', 'name email phone')
      .populate('reviewedBy', 'name email')
      .populate('comments.userId', 'name role avatarUrl')
      .lean();

    if (!request) {
      // Check legacy RoomCategoryRequest
      const legacy = await RoomCategoryRequest.findById(req.params.id)
        .populate('ashramId', 'name address')
        .populate('stayAdminId', 'name email phone')
        .populate('reviewedBy', 'name email')
        .lean();

      if (legacy) {
        request = {
          _id: legacy._id,
          requestId: legacy.requestId,
          module: 'room_category',
          entityType: 'RoomCategory',
          ashramId: legacy.ashramId,
          stayAdminId: legacy.stayAdminId,
          title: `Room Category: ${legacy.categoryData?.name}`,
          requestedData: legacy.categoryData,
          status: legacy.status,
          priority: 'normal',
          reviewComment: legacy.reviewComment,
          reviewedBy: legacy.reviewedBy,
          reviewedAt: legacy.reviewedAt,
          createdAt: legacy.createdAt,
          updatedAt: legacy.updatedAt,
          history: legacy.history,
          isLegacy: true,
        };
      }
    }

    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Error fetching approval request:', error);
    res.status(500).json({ success: false, message: 'Server error fetching request details.' });
  }
};

// @desc    Super Admin Review Action (Approve / Reject / Request Changes / Under Review)
// @route   PUT /api/approvals/requests/:id/review
// @access  Private (Super Admin Only)
export const reviewApprovalRequest = async (req, res) => {
  try {
    const { action, reviewComment } = req.body; // action: 'approve' | 'reject' | 'request_changes' | 'under_review'

    if (!['approve', 'reject', 'request_changes', 'under_review'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid review action.' });
    }

    let request = await ApprovalRequest.findById(req.params.id);
    let isLegacy = false;

    if (!request) {
      const legacy = await RoomCategoryRequest.findById(req.params.id);
      if (legacy) {
        request = legacy;
        isLegacy = true;
      }
    }

    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    let newStatus = 'pending';
    let auditAction = 'APPROVAL_REQUEST_REVIEWED';

    if (action === 'approve') {
      newStatus = 'approved';
      auditAction = 'APPROVAL_REQUEST_APPROVED';

      // Live Database Execution Engine according to module type
      const mod = request.module || 'room_category';
      const data = isLegacy ? request.categoryData : request.requestedData;

      if (mod === 'room_category' || mod === 'room') {
        const catName = (data?.name || 'Standard Room').toLowerCase();
        let roomType = 'private_room';
        if (catName.includes('dorm') || catName.includes('hall')) roomType = 'dormitory';
        if (catName.includes('family') || catName.includes('suite')) roomType = 'family_room';

        await Room.create({
          ashramId: request.ashramId,
          name: data?.name || 'New Custom Room Category',
          type: roomType,
          acType: 'Non-AC',
          capacity: data?.maxGuests || 2,
          totalInventory: 5,
          basePrice: data?.suggestedBasePrice || 500,
          amenities: data?.defaultAmenities || [],
          images: data?.images || [],
          status: 'active',
        });
      } else if (mod === 'pricing' && request.ashramId) {
        if (data?.basePrice) {
          await Ashram.findByIdAndUpdate(request.ashramId, { 'pricing.basePrice': data.basePrice });
        }
      } else if (mod === 'offer' && request.ashramId) {
        await Offer.create({
          ashramId: request.ashramId,
          ownerId: request.stayAdminId,
          title: data?.title || request.title,
          promoCode: data?.promoCode || `SPECIAL-${Date.now().toString().slice(-4)}`,
          discountType: data?.discountType || 'percentage',
          discountValue: data?.discountValue || 10,
          status: 'active',
        });
      }
    } else if (action === 'reject') {
      newStatus = 'rejected';
      auditAction = 'APPROVAL_REQUEST_REJECTED';
    } else if (action === 'request_changes') {
      newStatus = 'needs_changes';
      auditAction = 'APPROVAL_REQUEST_CHANGES_REQUESTED';
    } else if (action === 'under_review') {
      newStatus = 'under_review';
      auditAction = 'APPROVAL_REQUEST_UNDER_REVIEW';
    }

    request.status = newStatus;
    request.reviewComment = reviewComment || (action === 'approve' ? 'Approved by Super Admin.' : '');
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();

    if (!request.history) request.history = [];
    request.history.push({
      status: newStatus,
      comment: request.reviewComment,
      updatedBy: req.user.id,
      timestamp: new Date(),
    });

    await request.save();

    // Notify Stay Admin
    await Notification.create({
      recipientId: request.stayAdminId,
      type: 'APPROVAL_DECISION',
      title: `Approval Request ${action.toUpperCase()}`,
      message: `Your request "${request.title || request.requestId}" has been marked as ${newStatus.replace('_', ' ')}. ${reviewComment ? 'Comment: ' + reviewComment : ''}`,
      data: { requestId: request.requestId, status: newStatus },
    });

    // Audit log
    await AuditLog.create({
      userId: req.user.id,
      action: auditAction,
      module: 'APPROVAL_CENTER',
      details: {
        requestId: request.requestId,
        title: request.title,
        action,
        reviewComment,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Approval Request successfully updated to ${newStatus.replace('_', ' ')}.`,
      data: request,
    });
  } catch (error) {
    console.error('Error reviewing approval request:', error);
    res.status(500).json({ success: false, message: 'Server error processing approval decision.' });
  }
};

// @desc    Add comment to approval thread
// @route   POST /api/approvals/requests/:id/comment
// @access  Private
export const addApprovalComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const request = await ApprovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    request.comments.push({
      userId: req.user.id,
      userName: req.user.name,
      text: text.trim(),
      timestamp: new Date(),
    });

    await request.save();

    res.json({
      success: true,
      message: 'Comment added to approval thread.',
      data: request.comments,
    });
  } catch (error) {
    console.error('Error adding approval comment:', error);
    res.status(500).json({ success: false, message: 'Server error adding comment.' });
  }
};

// Re-export legacy controller methods for backwards compatibility
export {
  createRoomCategoryRequest,
  getRoomCategoryRequests,
  getRoomCategoryRequestById,
  reviewRoomCategoryRequest,
  resubmitRoomCategoryRequest,
} from './approvalController.js';
