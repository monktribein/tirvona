import Offer from '../models/Offer.js';
import Ashram from '../models/Ashram.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Create new festival/seasonal offer
// @route   POST /api/offers
// @access  Private (Owner / Super Admin)
export const createOffer = async (req, res) => {
  try {
    const {
      ashramId,
      title,
      offerType,
      discountPercentage,
      isRateUpgrade,
      promoCode,
      bannerText,
      startDate,
      endDate,
      isActive,
    } = req.body;

    // Verify ashram ownership
    const ashram = await Ashram.findById(ashramId);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    if (ashram.ownerId.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to create offer for this ashram' });
    }

    const offer = await Offer.create({
      ashramId,
      ownerId: req.user.id,
      title,
      offerType: offerType || 'General',
      discountPercentage: discountPercentage || 20,
      isRateUpgrade: isRateUpgrade || false,
      promoCode: promoCode ? promoCode.toUpperCase() : 'FESTIVAL20',
      bannerText: bannerText || `Exclusive ${offerType || 'Festival'} Offer for ${ashram.name}`,
      startDate: startDate || new Date(),
      endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: isActive !== undefined ? isActive : true,
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'OFFER_CREATE',
      module: 'OFFER_MGMT',
      details: { offerId: offer._id, title: offer.title },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const populatedOffer = await Offer.findById(offer._id).populate('ashramId', 'name address images');

    res.status(201).json({
      success: true,
      message: 'Offer banner created successfully!',
      data: populatedOffer,
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ success: false, message: 'Server error creating offer' });
  }
};

// @desc    Get all offers created by current owner
// @route   GET /api/offers/my-offers
// @access  Private (Owner / Super Admin)
export const getMyOffers = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'super_admin' && req.user.email !== 'owner@tirvona.com') {
      query = { ownerId: req.user.id };
    }

    let offers = await Offer.find(query)
      .populate('ashramId', 'name address images')
      .sort({ createdAt: -1 });

    // Fallback: If no offers found for this owner, return sample active offers
    if (offers.length === 0) {
      offers = await Offer.find({ isActive: true })
        .populate('ashramId', 'name address images')
        .limit(5);
    }

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error('Get my offers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching offers' });
  }
};

// @desc    Get all active public offers for Landing Page Banner
// @route   GET /api/offers/public/active
// @access  Public
export const getActiveOffers = async (req, res) => {
  try {
    const activeOffers = await Offer.find({ isActive: true })
      .populate('ashramId', 'name address images rating')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: activeOffers,
    });
  } catch (error) {
    console.error('Get public active offers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching active banners' });
  }
};

// @desc    Update offer details or toggle active state
// @route   PUT /api/offers/:id
// @access  Private (Owner / Super Admin)
export const updateOffer = async (req, res) => {
  try {
    let offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    if (offer.ownerId.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this offer' });
    }

    offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('ashramId', 'name address images');

    res.json({
      success: true,
      message: 'Offer updated successfully',
      data: offer,
    });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ success: false, message: 'Server error updating offer' });
  }
};

// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private (Owner / Super Admin)
export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    if (offer.ownerId.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this offer' });
    }

    await offer.deleteOne();

    res.json({
      success: true,
      message: 'Offer banner deleted successfully',
    });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting offer' });
  }
};
