import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Get all ashrams requiring verification
// @route   GET /api/verify/pending
// @access  Private (District Officer / Govt Admin / Super Admin)
export const getPendingVerifications = async (req, res) => {
  try {
    const query = { status: { $in: ['pending_inspection', 'pending_docs'] } };

    // District officers can only verify ashrams in their registered district
    if (req.user.role === 'district_officer') {
      query['address.district'] = req.user.district;
      query['address.state'] = req.user.state;
    } else if (req.user.role === 'govt_admin') {
      // Govt admins see all in their state
      query['address.state'] = req.user.state;
    }

    const pendingList = await Ashram.find(query)
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      count: pendingList.length,
      data: pendingList,
    });
  } catch (error) {
    console.error('Fetch pending verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving verification queue' });
  }
};

// @desc    Schedule physical inspection date
// @route   POST /api/verify/:id/schedule
// @access  Private (District Officer / Super Admin)
export const scheduleInspection = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Inspection date is required' });
    }

    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Verify district authority
    if (req.user.role === 'district_officer' && 
       (ashram.address.district !== req.user.district || ashram.address.state !== req.user.state)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this district jurisdiction' });
    }

    ashram.inspectionDetails.scheduledDate = new Date(date);
    ashram.inspectionDetails.officerId = req.user.id;
    ashram.status = 'pending_inspection';

    await ashram.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASHRAM_INSPECTION_SCHEDULED',
      module: 'GOVT_APPROVAL',
      details: { ashramId: ashram._id, scheduledDate: date },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Inspection scheduled successfully',
      data: ashram,
    });
  } catch (error) {
    console.error('Schedule inspection error:', error);
    res.status(500).json({ success: false, message: 'Server error scheduling inspection' });
  }
};

// @desc    Approve, Reject, or Suspend Ashram Listing
// @route   POST /api/verify/:id/status
// @access  Private (District Officer / Govt Admin / Super Admin)
export const updateVerificationStatus = async (req, res) => {
  try {
    const { status, comments, rejectionReason } = req.body;
    
    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid target status' });
    }

    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Verify district jurisdiction
    if (req.user.role === 'district_officer' && 
       (ashram.address.district !== req.user.district || ashram.address.state !== req.user.state)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this district jurisdiction' });
    }

    // Update status
    ashram.status = status;
    if (status === 'rejected') {
      ashram.rejectionReason = rejectionReason || 'Failed document check or fire inspection safety requirements';
    } else {
      ashram.rejectionReason = '';
    }

    // Add officer comments
    ashram.inspectionDetails.comments = comments || 'Completed inspection review';
    ashram.inspectionDetails.officerId = req.user.id;
    ashram.inspectionDetails.reportUrl = req.body.reportUrl || 'https://res.cloudinary.com/ashray-bharat/raw/upload/reports/inspection_report_mock.pdf';

    await ashram.save();

    await AuditLog.create({
      userId: req.user.id,
      action: `ASHRAM_VERIFY_${status.toUpperCase()}`,
      module: 'GOVT_APPROVAL',
      details: { ashramId: ashram._id, comments, status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Ashram status updated to: ${status}`,
      data: ashram,
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({ success: false, message: 'Error executing verification update' });
  }
};
