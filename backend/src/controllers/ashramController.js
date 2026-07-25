import Ashram from '../models/Ashram.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Room from '../models/Room.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Create a new ashram listing
// @route   POST /api/ashrams
// @access  Private (Owner / Super Admin)
export const createAshram = async (req, res) => {
  try {
    const { name, description, address, history, rules, amenities } = req.body;

    if (address && (!address.district || !address.district.trim())) {
      address.district = address.city;
    }

    const ashram = await Ashram.create({
      ownerId: req.user.id,
      name,
      description: description || 'Spiritual Ashram lodging & accommodation.',
      address,
      history: history || '',
      rules: rules || [],
      amenities: amenities || [],
      status: 'pending_docs', // Starts here until docs uploaded
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASHRAM_CREATE',
      module: 'ASHRAM_MGMT',
      details: { ashramId: ashram._id, name: ashram.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: ashram,
    });
  } catch (error) {
    console.error('Create ashram error:', error);
    res.status(500).json({ success: false, message: 'Server error creating ashram listing' });
  }
};

// @desc    Upload documents for verification
// @route   POST /api/ashrams/:id/documents
// @access  Private (Owner)
export const uploadDocuments = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Verify ownership
    if (ashram.ownerId.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this ashram' });
    }

    // In production, files are uploaded via Multer to Cloudinary.
    // For local prototype/mock execution, we read file details or simulate upload links.
    const trustDeedUrl = req.body.trustDeedUrl || 'https://res.cloudinary.com/ashray-bharat/raw/upload/deeds/trust_deed_mock.pdf';
    const fireSafetyCertificateUrl = req.body.fireSafetyCertificateUrl || 'https://res.cloudinary.com/ashray-bharat/raw/upload/certificates/fire_safety_mock.pdf';
    const landOwnershipUrl = req.body.landOwnershipUrl || 'https://res.cloudinary.com/ashray-bharat/raw/upload/deeds/land_ownership_mock.pdf';

    ashram.documents = {
      trustDeedUrl,
      fireSafetyCertificateUrl,
      landOwnershipUrl,
    };
    ashram.status = 'pending_inspection'; // Advance verification state machine

    await ashram.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASHRAM_UPLOAD_DOCS',
      module: 'ASHRAM_MGMT',
      details: { ashramId: ashram._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Documents uploaded successfully. Ashram is now queued for Government Inspection.',
      data: ashram,
    });
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading certificates' });
  }
};

// @desc    Update basic ashram details
// @route   PUT /api/ashrams/:id
// @access  Private (Owner / Manager)
export const updateAshram = async (req, res) => {
  try {
    let ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Authorization checks
    if (
      ashram.ownerId.toString() !== req.user.id &&
      req.user.role !== 'super_admin' &&
      req.user.role !== 'manager'
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this ashram' });
    }

    // Keep documents and verification statuses untouched during edits
    const fieldsToExclude = ['ownerId', 'status', 'documents', 'inspectionDetails', 'rejectionReason'];
    fieldsToExclude.forEach((field) => delete req.body[field]);

    if (req.body.address && (!req.body.address.district || !req.body.address.district.trim())) {
      req.body.address.district = req.body.address.city;
    }

    ashram = await Ashram.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASHRAM_UPDATE',
      module: 'ASHRAM_MGMT',
      details: { ashramId: ashram._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: ashram,
    });
  } catch (error) {
    console.error('Update ashram error:', error);
    res.status(500).json({ success: false, message: 'Server error updating ashram' });
  }
};

// @desc    Get all ashrams owned by current user
// @route   GET /api/ashrams/my-listings/all
// @access  Private (Owner / Manager)
export const getMyAshrams = async (req, res) => {
  try {
    let listings = [];

    if (req.user.role === 'super_admin') {
      listings = await Ashram.find();
    } else {
      // 1. Direct query by ownerId
      listings = await Ashram.find({ ownerId: req.user.id });

      // 2. Fuzzy matching by User name or email if ownerId is not linked yet
      if (listings.length === 0 && req.user.name) {
        const cleanName = req.user.name
          .replace(/Trustee|-|Ashram|Trust|Owner/gi, '')
          .trim();

        if (cleanName.length >= 2) {
          const firstWord = cleanName.split(/\s+/)[0];
          listings = await Ashram.find({ name: { $regex: firstWord, $options: 'i' } });

          // Auto-link matching ashram to this owner account
          if (listings.length > 0) {
            for (const a of listings) {
              a.ownerId = req.user.id;
              await a.save();
            }
          }
        }
      }

      // 3. Fallback: If still empty, return top ashrams for general demo owner accounts
      if (listings.length === 0) {
        listings = await Ashram.find().limit(5);
      }
    }

    res.json({
      success: true,
      data: listings,
    });
  } catch (error) {
    console.error('Get my ashrams error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching listings' });
  }
};

// @desc    Search and filter ashrams
// @route   GET /api/ashrams
// @access  Public
export const searchAshrams = async (req, res) => {
  try {
    const {
      destination,
      type,
      checkIn,
      checkOut,
      guests,
      minPrice,
      maxPrice,
      amenities,
      rating,
      verified,
    } = req.query;

    const searchParam = destination || req.query.query || req.query.category || req.query.search;

    const query = { status: 'approved' }; // Only show fully approved ashrams to customers

    // 1. Geography, Name, Amenities, History, Description Search
    if (searchParam) {
      query.$or = [
        { 'address.city': { $regex: searchParam, $options: 'i' } },
        { 'address.district': { $regex: searchParam, $options: 'i' } },
        { 'address.state': { $regex: searchParam, $options: 'i' } },
        { 'address.pincode': searchParam },
        { name: { $regex: searchParam, $options: 'i' } },
        { amenities: { $regex: searchParam, $options: 'i' } },
        { description: { $regex: searchParam, $options: 'i' } },
        { history: { $regex: searchParam, $options: 'i' } },
      ];
    }

    if (type) {
      const typeRegex = new RegExp(type, 'i');
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: [{ name: typeRegex }, { description: typeRegex }, { history: typeRegex }] }
        ];
        delete query.$or;
      } else {
        query.$or = [{ name: typeRegex }, { description: typeRegex }, { history: typeRegex }];
      }
    }

    if (verified === 'true') {
      query.status = 'approved';
    }

    if (amenities) {
      const amenitiesList = amenities.split(',');
      query.amenities = { $all: amenitiesList };
    }

    if (rating) {
      query['rating.average'] = { $gte: parseFloat(rating) };
    }

    let ashrams = await Ashram.find(query);

    // Filter by price and availability if dates are provided
    if (checkIn && checkOut) {
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      const filteredAshrams = [];

      for (let ashram of ashrams) {
        const rooms = await Room.find({ ashramId: ashram._id, status: 'active' });
        let hasAvailableRoom = false;
        let lowestPrice = Infinity;

        for (let room of rooms) {
          // Check inventory for dates
          let isAvailable = true;
          let calculatedTotalPrice = 0;

          for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const availability = await RoomAvailability.findOne({
              roomId: room._id,
              date: new Date(dateStr),
            });

            const booked = availability ? availability.bookedCount : 0;
            const maintenance = availability ? availability.maintenanceCount : 0;
            const activeInventory = room.totalInventory - maintenance;

            if (activeInventory - booked <= 0) {
              isAvailable = false;
              break;
            }

            // Determine price for this day (check override -> check rules -> default)
            let dailyPrice = room.basePrice;
            if (availability && availability.customPrice) {
              dailyPrice = availability.customPrice;
            } else {
              // Check pricing rules matching this date
              const activeRule = room.pricingRules.find(
                (rule) => d >= rule.startDate && d <= rule.endDate
              );
              if (activeRule) {
                dailyPrice = activeRule.overridePrice || (room.basePrice * activeRule.multiplier);
              }
            }
            calculatedTotalPrice += dailyPrice;
          }

          if (isAvailable) {
            hasAvailableRoom = true;
            const avgNightPrice = calculatedTotalPrice / daysCount;
            if (avgNightPrice < lowestPrice) {
              lowestPrice = avgNightPrice;
            }
          }
        }

        if (hasAvailableRoom) {
          // Verify price limits
          const matchMin = minPrice ? lowestPrice >= parseFloat(minPrice) : true;
          const matchMax = maxPrice ? lowestPrice <= parseFloat(maxPrice) : true;

          if (matchMin && matchMax) {
            const ashramObj = ashram.toObject();
            ashramObj.lowestNightPrice = lowestPrice;
            filteredAshrams.push(ashramObj);
          }
        }
      }

      ashrams = filteredAshrams;
    } else {
      // If no dates provided, just append general rooms basic pricing
      const populatedAshrams = [];
      for (let ashram of ashrams) {
        const rooms = await Room.find({ ashramId: ashram._id, status: 'active' });
        const prices = rooms.map((r) => r.basePrice);
        const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
        
        const ashramObj = ashram.toObject();
        ashramObj.lowestNightPrice = lowestPrice;
        populatedAshrams.push(ashramObj);
      }
      ashrams = populatedAshrams;
    }

    res.json({
      success: true,
      count: ashrams.length,
      data: ashrams,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Error searching Ashram catalog' });
  }
};

// @desc    Get single ashram by ID
// @route   GET /api/ashrams/:id
// @access  Public
export const getAshramById = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id).populate('ownerId', 'name email phone');
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    const rooms = await Room.find({ ashramId: ashram._id });

    res.json({
      success: true,
      data: {
        ashram,
        rooms,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching Ashram details' });
  }
};
