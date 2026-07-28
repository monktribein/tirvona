import ContentChangeRequest from '../models/ContentChangeRequest.js';
import Banner from '../models/Banner.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Submit a CMS content edit request (BannerBoy)
// @route   POST /api/cms/request-change
// @access  Private (banner_manager, super_admin)
export const submitChangeRequest = async (req, res) => {
  try {
    const { page = 'homepage', section, title, oldValue, newValue } = req.body;

    if (!section || !newValue) {
      return res.status(400).json({ success: false, message: 'Section and proposed newValue are required' });
    }

    const changeRequest = await ContentChangeRequest.create({
      userId: req.user.id,
      role: req.user.role,
      page,
      section,
      title: title || `Edit ${section} on ${page}`,
      oldValue: oldValue || null,
      newValue,
      status: 'pending',
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'CMS_CHANGE_REQUEST_SUBMITTED',
      module: 'CMS',
      details: { requestId: changeRequest._id, page, section },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      message: 'Content change request submitted for Owner approval',
      data: changeRequest,
    });
  } catch (error) {
    console.error('Submit change request error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error submitting change request' });
  }
};

// @desc    Get all pending content change requests (Owner / Admin)
// @route   GET /api/cms/pending-approvals
// @access  Private (owner, manager, super_admin, govt_admin)
export const getPendingRequests = async (req, res) => {
  try {
    const { page, status = 'pending' } = req.query;
    const filter = { status };
    if (page) filter.page = page;

    const requests = await ContentChangeRequest.find(filter)
      .populate('userId', 'name email phone role employeeId')
      .populate('approvedBy', 'name email role')
      .populate('rejectedBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error loading change requests' });
  }
};

// @desc    Get my change requests history (BannerBoy)
// @route   GET /api/cms/my-requests
// @access  Private (banner_manager, super_admin)
export const getMyRequests = async (req, res) => {
  try {
    const requests = await ContentChangeRequest.find({ userId: req.user.id })
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    return res.status(500).json({ success: false, message: 'Server error loading your activity' });
  }
};

// @desc    Approve a content change request (Owner / Admin)
// @route   POST /api/cms/approve/:id
// @access  Private (owner, super_admin, govt_admin)
export const approveChangeRequest = async (req, res) => {
  try {
    const request = await ContentChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status = 'approved';
    request.approvedBy = req.user.id;
    await request.save();

    // If section is a banner, also sync/upsert to Banner model
    if (request.section.includes('banner') && typeof request.newValue === 'object') {
      await Banner.create({
        title: request.newValue.title || request.title,
        imageUrl: request.newValue.imageUrl || request.newValue.bannerImage || '/banner/ashram_rishikesh.png',
        linkUrl: request.newValue.linkUrl || '/',
        status: 'active',
        createdBy: request.userId,
      }).catch((e) => console.warn('Banner sync note:', e.message));
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'CMS_CHANGE_REQUEST_APPROVED',
      module: 'CMS',
      details: { requestId: request._id, section: request.section, bannerBoy: request.userId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Content change approved and published successfully', data: request });
  } catch (error) {
    console.error('Approve request error:', error);
    return res.status(500).json({ success: false, message: 'Server error approving request' });
  }
};

// @desc    Reject a content change request with comments (Owner / Admin)
// @route   POST /api/cms/reject/:id
// @access  Private (owner, super_admin, govt_admin)
export const rejectChangeRequest = async (req, res) => {
  try {
    const { reason = 'Content does not align with trust guidelines' } = req.body;
    const request = await ContentChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status = 'rejected';
    request.rejectedBy = req.user.id;
    request.reason = reason;
    await request.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'CMS_CHANGE_REQUEST_REJECTED',
      module: 'CMS',
      details: { requestId: request._id, reason, bannerBoy: request.userId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, message: 'Content change request rejected with feedback', data: request });
  } catch (error) {
    console.error('Reject request error:', error);
    return res.status(500).json({ success: false, message: 'Server error rejecting request' });
  }
};

// @desc    Get current approved CMS config/content
// @route   GET /api/cms/published
// @access  Public
export const getPublishedContent = async (req, res) => {
  try {
    const approvedRequests = await ContentChangeRequest.find({ status: 'approved' })
      .sort({ updatedAt: -1 })
      .limit(100);

    const publishedSections = {};
    approvedRequests.forEach((reqItem) => {
      if (!publishedSections[reqItem.section]) {
        publishedSections[reqItem.section] = reqItem.newValue;
      }
    });

    return res.json({ success: true, data: publishedSections });
  } catch (error) {
    console.error('Get published content error:', error);
    return res.status(500).json({ success: false, message: 'Server error loading published CMS content' });
  }
};
