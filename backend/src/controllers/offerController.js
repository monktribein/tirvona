import Offer from '../models/Offer.js';
import Ashram from '../models/Ashram.js';

// @desc    Create a new promotion offer (Owner / Manager / Admin)
// @route   POST /api/offers
// @access  Private (Owner / Admin)
export const createOffer = async (req, res) => {
  try {
    const {
      ashramId,
      applicableAshrams,
      applicableCities,
      applicableStates,
      applicableRoomCategories,
      offerTitle,
      shortTitle,
      subtitle,
      offerType,
      description,
      fullHtmlDescription,
      highlights,
      termsAndConditions,
      bannerImage,
      thumbnailImage,
      desktopBanner,
      mobileBanner,
      galleryImages,
      promoCode,
      discountType,
      discountValue,
      maximumDiscount,
      minimumBookingAmount,
      validFrom,
      validTill,
      maximumRedemptions,
      perUserLimit,
      priority,
      featured,
      status,
    } = req.body;

    if (!offerTitle || !description || !promoCode || discountValue === undefined || !validTill) {
      return res.status(400).json({
        success: false,
        message: 'Offer title, description, promo code, discount value, and valid till date are required.',
      });
    }

    // Check promo code uniqueness
    const existingPromo = await Offer.findOne({ promoCode: promoCode.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: `Promo code "${promoCode.toUpperCase()}" is already in use. Please use a unique promo code.`,
      });
    }

    const offer = await Offer.create({
      ownerId: req.user.id,
      ashramId: ashramId || null,
      applicableAshrams: applicableAshrams || (ashramId ? [ashramId] : []),
      applicableCities: applicableCities || [],
      applicableStates: applicableStates || [],
      applicableRoomCategories: applicableRoomCategories || [],
      offerTitle,
      shortTitle: shortTitle || offerTitle,
      subtitle: subtitle || '',
      offerType: offerType || 'Festival Offer',
      description,
      fullHtmlDescription: fullHtmlDescription || description,
      highlights: highlights || [],
      termsAndConditions: termsAndConditions || [],
      bannerImage: bannerImage || '/banner/ashram_rishikesh.png',
      thumbnailImage: thumbnailImage || bannerImage || '/banner/ashram_rishikesh.png',
      desktopBanner: desktopBanner || bannerImage || '/banner/ashram_rishikesh.png',
      mobileBanner: mobileBanner || thumbnailImage || bannerImage || '/banner/ashram_rishikesh.png',
      galleryImages: galleryImages || [],
      promoCode: promoCode.toUpperCase(),
      discountType: discountType || 'Percentage',
      discountValue: Number(discountValue),
      maximumDiscount: Number(maximumDiscount || 0),
      minimumBookingAmount: Number(minimumBookingAmount || 0),
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTill: new Date(validTill),
      maximumRedemptions: Number(maximumRedemptions || 100),
      remainingRedemptions: Number(maximumRedemptions || 100),
      perUserLimit: Number(perUserLimit || 1),
      priority: Number(priority || 1),
      featured: Boolean(featured),
      status: status || 'active',
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Offer created successfully!',
      data: offer,
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating offer' });
  }
};

// @desc    Get all active public offers (with filtering, category, city, search, pagination)
// @route   GET /api/offers
// @access  Public
export const getActiveOffers = async (req, res) => {
  try {
    const { category, city, ashramId, search, featured, page = 1, limit = 12 } = req.query;

    const query = { status: 'active', validTill: { $gte: new Date() } };

    if (category) {
      query.offerType = { $regex: new RegExp(category, 'i') };
    }
    if (city) {
      query.$or = [
        { applicableCities: { $regex: new RegExp(city, 'i') } },
        { applicableStates: { $regex: new RegExp(city, 'i') } },
      ];
    }
    if (ashramId) {
      query.$or = [{ ashramId }, { applicableAshrams: ashramId }];
    }
    if (featured === 'true') {
      query.featured = true;
    }
    if (search) {
      query.$or = [
        { offerTitle: { $regex: search, $options: 'i' } },
        { promoCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { offerType: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Offer.countDocuments(query);
    const offers = await Offer.find(query)
      .populate('ashramId', 'name address images city')
      .populate('applicableAshrams', 'name address images city')
      .sort({ featured: -1, priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      data: offers,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get active offers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching offers' });
  }
};

// @desc    Get owner's created offers with dashboard statistics
// @route   GET /api/offers/my-offers
// @access  Private (Owner / Admin)
export const getMyOffers = async (req, res) => {
  try {
    const isMasterOwner = req.user.email === 'owner@tirvona.com' || req.user.role === 'super_admin';
    const filter = isMasterOwner ? {} : { ownerId: req.user.id };

    const offers = await Offer.find(filter)
      .populate('ashramId', 'name address city')
      .sort({ createdAt: -1 });

    const totalOffers = offers.length;
    const activeOffers = offers.filter((o) => o.status === 'active' && new Date(o.validTill) >= new Date()).length;
    const scheduledOffers = offers.filter((o) => o.status === 'scheduled' || new Date(o.validFrom) > new Date()).length;
    const expiredOffers = offers.filter((o) => o.status === 'expired' || new Date(o.validTill) < new Date()).length;
    const redeemedOffers = offers.reduce((acc, o) => acc + (o.redemptionsCount || 0), 0);
    const revenueGenerated = offers.reduce((acc, o) => acc + (o.revenueGenerated || 0), 0);

    res.json({
      success: true,
      stats: {
        totalOffers,
        activeOffers,
        scheduledOffers,
        expiredOffers,
        redeemedOffers,
        revenueGenerated,
      },
      data: offers,
    });
  } catch (error) {
    console.error('Get my offers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching owner offers' });
  }
};

// @desc    Get single offer details by ID (with countdown timer & related offers)
// @route   GET /api/offers/:id
// @access  Public
export const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('ashramId', 'name address images description history rules amenities city state')
      .populate('applicableAshrams', 'name address images description history rules amenities city state');

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    // Increment view count
    offer.viewsCount = (offer.viewsCount || 0) + 1;
    await offer.save();

    // Fetch related offers
    const relatedOffers = await Offer.find({
      _id: { $ne: offer._id },
      status: 'active',
      validTill: { $gte: new Date() },
    })
      .limit(3)
      .select('offerTitle shortTitle promoCode discountType discountValue bannerImage thumbnailImage validTill offerType');

    res.json({
      success: true,
      data: offer,
      relatedOffers,
    });
  } catch (error) {
    console.error('Get offer by id error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching offer details' });
  }
};

// @desc    Update offer details
// @route   PUT /api/offers/:id
// @access  Private (Owner / Admin)
export const updateOffer = async (req, res) => {
  try {
    let offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const isMasterOwner = req.user.email === 'owner@tirvona.com' || req.user.role === 'super_admin';
    if (offer.ownerId.toString() !== req.user.id && !isMasterOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this offer' });
    }

    req.body.updatedBy = req.user.id;
    if (req.body.promoCode) {
      req.body.promoCode = req.body.promoCode.toUpperCase();
    }

    offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: 'Offer updated successfully',
      data: offer,
    });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating offer' });
  }
};

// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private (Owner / Admin)
export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const isMasterOwner = req.user.email === 'owner@tirvona.com' || req.user.role === 'super_admin';
    if (offer.ownerId.toString() !== req.user.id && !isMasterOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this offer' });
    }

    await offer.deleteOne();

    res.json({
      success: true,
      message: 'Offer deleted successfully',
    });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting offer' });
  }
};

// @desc    Duplicate an existing offer
// @route   POST /api/offers/:id/duplicate
// @access  Private (Owner / Admin)
export const duplicateOffer = async (req, res) => {
  try {
    const original = await Offer.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Original offer not found' });
    }

    const copyObj = original.toObject();
    delete copyObj._id;
    delete copyObj.createdAt;
    delete copyObj.updatedAt;

    copyObj.offerTitle = `${original.offerTitle} (Copy)`;
    copyObj.promoCode = `${original.promoCode}_COPY_${Math.floor(100 + Math.random() * 900)}`;
    copyObj.ownerId = req.user.id;
    copyObj.createdBy = req.user.id;
    copyObj.status = 'draft';

    const newOffer = await Offer.create(copyObj);

    res.status(201).json({
      success: true,
      message: 'Offer duplicated as draft!',
      data: newOffer,
    });
  } catch (error) {
    console.error('Duplicate offer error:', error);
    res.status(500).json({ success: false, message: 'Server error duplicating offer' });
  }
};

// @desc    Validate promo code during booking calculation
// @route   POST /api/offers/validate-promo
// @access  Public
export const validatePromoCode = async (req, res) => {
  try {
    const { promoCode, bookingAmount = 0, ashramId } = req.body;

    if (!promoCode) {
      return res.status(400).json({ success: false, message: 'Promo code is required.' });
    }

    const offer = await Offer.findOne({
      promoCode: promoCode.toUpperCase().trim(),
      status: 'active',
      validTill: { $gte: new Date() },
    }).populate('ashramId', 'name');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired promo code.',
      });
    }

    if (offer.minimumBookingAmount > 0 && bookingAmount < offer.minimumBookingAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of ₹${offer.minimumBookingAmount} is required for this offer.`,
      });
    }

    if (offer.remainingRedemptions <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This promo code has reached its maximum redemption limit.',
      });
    }

    let discountAmount = 0;
    if (offer.discountType === 'Percentage') {
      discountAmount = (bookingAmount * offer.discountValue) / 100;
      if (offer.maximumDiscount > 0 && discountAmount > offer.maximumDiscount) {
        discountAmount = offer.maximumDiscount;
      }
    } else if (offer.discountType === 'Flat Amount') {
      discountAmount = Math.min(offer.discountValue, bookingAmount);
    }

    res.json({
      success: true,
      valid: true,
      message: `Promo code "${offer.promoCode}" applied! You saved ₹${Math.round(discountAmount)}.`,
      data: {
        offerId: offer._id,
        promoCode: offer.promoCode,
        offerTitle: offer.offerTitle,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        discountAmount: Math.round(discountAmount),
        finalAmount: Math.max(0, Math.round(bookingAmount - discountAmount)),
        benefits: {
          upgrade: offer.discountType === 'Free Upgrade',
          meal: offer.discountType === 'Free Meal',
          prasad: offer.discountType === 'Free Prasad',
          donationCoupon: offer.discountType === 'Free Donation Coupon',
        },
      },
    });
  } catch (error) {
    console.error('Validate promo error:', error);
    res.status(500).json({ success: false, message: 'Server error validating promo code' });
  }
};
