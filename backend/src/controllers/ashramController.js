import Ashram from '../models/Ashram.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Room from '../models/Room.js';
import AuditLog from '../models/AuditLog.js';
import { canManageAshram } from '../utils/ashramAccess.js';
import { escapeRegex } from '../utils/sanitize.js';

// @desc    Create a new ashram listing
// @route   POST /api/ashrams
// @access  Private (Owner / Super Admin)
// Normalise AC type values coming from the multi-step wizard to the Room enum.
const normalizeAcType = (value) => {
  if (!value) return 'Non-AC';
  const v = value.toString().toLowerCase();
  return v === 'ac' || v === 'a/c' ? 'AC' : 'Non-AC';
};

const VALID_ROOM_TYPES = ['dormitory', 'private_room', 'family_room', 'hall'];

export const createAshram = async (req, res) => {
  try {
    const {
      name, description, address, history, rules, amenities,
      tagline, ashramType, establishedYear, foundedBy,
      contact, trust, activities, dailySchedule, specialEvents,
      pricing, policies, food, transport, medical, nearbyAttractions,
      images, documents, rooms,
    } = req.body;

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
      tagline, ashramType, establishedYear, foundedBy,
      contact, trust,
      activities: activities || [],
      dailySchedule, specialEvents,
      pricing, policies, food, transport, medical,
      nearbyAttractions: nearbyAttractions || [],
      images: (images || []).filter(Boolean),
      // documents remain owner-uploaded via the verification flow, but accept
      // any pre-filled URLs from the wizard so nothing is silently lost.
      documents: documents ? {
        trustDeedUrl: documents.trustDeedUrl || '',
        fireSafetyCertificateUrl: documents.fireSafetyCertificateUrl || '',
        landOwnershipUrl: documents.landOwnershipUrl || '',
      } : undefined,
      status: 'pending_docs', // Starts here until docs uploaded
    });

    // Create the room categories entered in the wizard (Step 10) so the listing
    // is actually bookable instead of the data being discarded.
    let createdRooms = 0;
    if (Array.isArray(rooms) && rooms.length > 0) {
      const roomDocs = rooms
        .filter((r) => r && r.name && r.name.trim())
        .map((r) => ({
          ashramId: ashram._id,
          name: r.name.trim(),
          type: VALID_ROOM_TYPES.includes(r.type) ? r.type : 'private_room',
          acType: normalizeAcType(r.acType),
          capacity: parseInt(r.capacity, 10) || 1,
          totalInventory: parseInt(r.totalInventory, 10) || 1,
          basePrice: parseFloat(r.basePrice) || 0,
          amenities: typeof r.amenities === 'string'
            ? r.amenities.split(',').map((a) => a.trim()).filter(Boolean)
            : (Array.isArray(r.amenities) ? r.amenities : []),
        }));
      if (roomDocs.length > 0) {
        await Room.insertMany(roomDocs);
        createdRooms = roomDocs.length;
      }
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASHRAM_CREATE',
      module: 'ASHRAM_MGMT',
      details: { ashramId: ashram._id, name: ashram.name, roomsCreated: createdRooms },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: ashram,
      roomsCreated: createdRooms,
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

    // Verify ownership (document upload is owner/super_admin only)
    if (ashram.ownerId.toString() !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this ashram' });
    }
    // (kept strict: managers cannot alter trust/verification documents)

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

    const isMasterOwner = req.user.email === 'stayadmin@tirvona.com' || req.user.role === 'super_admin';

    // Authorization checks — H2: scope managers to the ashram they are employed
    // at (canManageAshram), instead of letting ANY manager edit ANY ashram.
    if (!isMasterOwner && !canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this ashram' });
    }

    // Only exclude administrative fields if NOT Master Owner / Super Admin
    if (!isMasterOwner) {
      const fieldsToExclude = ['ownerId', 'status', 'documents', 'inspectionDetails', 'rejectionReason'];
      fieldsToExclude.forEach((field) => delete req.body[field]);
    }

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

    if (req.user.email === 'owner@tirvona.com' || req.user.role === 'super_admin') {
      listings = await Ashram.find().populate('ownerId', 'name email phone');
    } else if (req.user.role === 'manager' && req.user.employerAshramId) {
      // Managers see only the ashram they are employed at.
      listings = await Ashram.find({ _id: req.user.employerAshramId }).populate('ownerId', 'name email phone');
    } else {
      // Owners see ONLY the ashrams they own. H1: no name-regex auto-linking and
      // no "top ashrams" fallback — both allowed cross-tenant hijack / leakage.
      listings = await Ashram.find({ ownerId: req.user.id }).populate('ownerId', 'name email phone');
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
      // M2: escape user input used in $regex so it is matched literally (no ReDoS / injection).
      const safe = escapeRegex(searchParam);
      query.$or = [
        { 'address.city': { $regex: safe, $options: 'i' } },
        { 'address.district': { $regex: safe, $options: 'i' } },
        { 'address.state': { $regex: safe, $options: 'i' } },
        { 'address.pincode': searchParam },
        { name: { $regex: safe, $options: 'i' } },
        { amenities: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { history: { $regex: safe, $options: 'i' } },
      ];
    }

    if (type) {
      const typeRegex = new RegExp(escapeRegex(type), 'i');
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

    // Auto-seed default add-ons if missing
    if (!ashram.addOnServices || ashram.addOnServices.length === 0) {
      ashram.addOnServices = [
        { name: 'Sacred Prasad Box', price: 50, unit: 'per_box', unitLabel: 'Box', maxQuantity: 10, enabled: true, description: 'Blessed mahaprasad prepared in traditional satvik method.' },
        { name: 'Satvik Meals (Pure Veg)', price: 120, unit: 'per_meal', unitLabel: 'Meal', maxQuantity: 10, enabled: true, description: 'Freshly prepared organic satvik thali meal.' },
        { name: 'Parking Slot (Car/Bus)', price: 80, unit: 'per_day', unitLabel: 'Day', maxQuantity: 5, enabled: true, description: 'Secured CCTV monitored parking inside premises.' },
        { name: 'Personal Locker Access', price: 30, unit: 'per_day', unitLabel: 'Day', maxQuantity: 5, enabled: true, description: 'Safe lockable storage for valuables.' },
      ];
      await ashram.save();
    }

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

// ── Add-On Services Controllers ──────────────────────────────────────────────

// @desc    Get Add-On Services for an ashram
// @route   GET /api/ashrams/:id/add-ons
// @access  Public
export const getAddOns = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    // Auto-seed if empty
    if (!ashram.addOnServices || ashram.addOnServices.length === 0) {
      ashram.addOnServices = [
        { name: 'Sacred Prasad Box', price: 50, unit: 'per_box', unitLabel: 'Box', maxQuantity: 10, enabled: true, description: 'Blessed mahaprasad prepared in traditional satvik method.' },
        { name: 'Satvik Meals (Pure Veg)', price: 120, unit: 'per_meal', unitLabel: 'Meal', maxQuantity: 10, enabled: true, description: 'Freshly prepared organic satvik thali meal.' },
        { name: 'Parking Slot (Car/Bus)', price: 80, unit: 'per_day', unitLabel: 'Day', maxQuantity: 5, enabled: true, description: 'Secured CCTV monitored parking inside premises.' },
        { name: 'Personal Locker Access', price: 30, unit: 'per_day', unitLabel: 'Day', maxQuantity: 5, enabled: true, description: 'Safe lockable storage for valuables.' },
      ];
      await ashram.save();
    }

    res.json({
      success: true,
      count: ashram.addOnServices.length,
      data: ashram.addOnServices,
    });
  } catch (error) {
    console.error('getAddOns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch add-on services' });
  }
};

// @desc    Add a new Add-On Service to an ashram
// @route   POST /api/ashrams/:id/add-ons
// @access  Private (Owner / Super Admin)
export const createAddOn = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this ashram' });
    }

    const { name, price, unit, unitLabel, maxQuantity, enabled, iconUrl, description } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const newAddOn = {
      name,
      price: parseFloat(price) || 0,
      unit: unit || 'per_day',
      unitLabel: unitLabel || 'Day',
      maxQuantity: parseInt(maxQuantity, 10) || 10,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      iconUrl: iconUrl || '',
      description: description || '',
    };

    ashram.addOnServices.push(newAddOn);
    await ashram.save();

    res.status(201).json({
      success: true,
      message: 'Add-On Service created successfully',
      data: ashram.addOnServices,
    });
  } catch (error) {
    console.error('createAddOn error:', error);
    res.status(500).json({ success: false, message: 'Failed to create add-on service' });
  }
};

// @desc    Update an Add-On Service
// @route   PUT /api/ashrams/:id/add-ons/:serviceId
// @access  Private (Owner / Super Admin)
export const updateAddOn = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this ashram' });
    }

    const service = ashram.addOnServices.id(req.params.serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Add-On service not found' });
    }

    const { name, price, unit, unitLabel, maxQuantity, enabled, iconUrl, description } = req.body;
    if (name !== undefined) service.name = name;
    if (price !== undefined) service.price = parseFloat(price) || 0;
    if (unit !== undefined) service.unit = unit;
    if (unitLabel !== undefined) service.unitLabel = unitLabel;
    if (maxQuantity !== undefined) service.maxQuantity = parseInt(maxQuantity, 10) || 10;
    if (enabled !== undefined) service.enabled = Boolean(enabled);
    if (iconUrl !== undefined) service.iconUrl = iconUrl;
    if (description !== undefined) service.description = description;

    await ashram.save();

    res.json({
      success: true,
      message: 'Add-On Service updated successfully',
      data: ashram.addOnServices,
    });
  } catch (error) {
    console.error('updateAddOn error:', error);
    res.status(500).json({ success: false, message: 'Failed to update add-on service' });
  }
};

// @desc    Delete an Add-On Service
// @route   DELETE /api/ashrams/:id/add-ons/:serviceId
// @access  Private (Owner / Super Admin)
export const deleteAddOn = async (req, res) => {
  try {
    const ashram = await Ashram.findById(req.params.id);
    if (!ashram) {
      return res.status(404).json({ success: false, message: 'Ashram not found' });
    }

    if (!canManageAshram(req.user, ashram)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this ashram' });
    }

    ashram.addOnServices.pull(req.params.serviceId);
    await ashram.save();

    res.json({
      success: true,
      message: 'Add-On Service deleted successfully',
      data: ashram.addOnServices,
    });
  } catch (error) {
    console.error('deleteAddOn error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete add-on service' });
  }
};
