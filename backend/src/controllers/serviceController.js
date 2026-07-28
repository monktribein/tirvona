import ServiceProvider from '../models/ServiceProvider.js';
import ServiceBooking from '../models/ServiceBooking.js';
import { buildEnterpriseQuery, buildSortOptions, buildPagination } from '../utils/queryBuilder.js';

// GET /api/services - Filter & List Service Providers
export const getServices = async (req, res) => {
  try {
    const {
      category,
      city,
      subcategory,
      search,
      pureVeg,
      govtVerified,
      minPrice,
      maxPrice,
      sortBy = 'rating',
      page = 1,
      limit = 20,
    } = req.query;

    const customFilters = {};
    if (subcategory) customFilters.subcategory = new RegExp(subcategory, 'i');
    if (pureVeg === 'true') customFilters['specifications.pureVeg'] = true;
    if (govtVerified === 'true') customFilters['specifications.govtVerified'] = true;

    const query = buildEnterpriseQuery({
      search,
      searchFields: ['name', 'description', 'subcategory', 'city', 'tagline'],
      category,
      city,
      status: 'active',
      minPrice,
      maxPrice,
      customFilters,
    });

    const sort = buildSortOptions(sortBy);
    const { skip, limit: limitParsed } = buildPagination(page, limit);

    const [services, total] = await Promise.all([
      ServiceProvider.find(query).sort(sort).skip(skip).limit(limitParsed),
      ServiceProvider.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: services.length,
      total,
      data: services,
    });
  } catch (error) {
    console.error('getServices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch services.',
      error: error.message,
    });
  }
};

// GET /api/services/:id
export const getServiceById = async (req, res) => {
  try {
    const service = await ServiceProvider.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service provider not found.' });
    }
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching service details.' });
  }
};

// POST /api/services/book - Book a service
export const createBooking = async (req, res) => {
  try {
    const { serviceId, customerName, customerPhone, bookingDate, bookingTime, guestsCount, totalAmount, specialNotes } = req.body;

    const booking = await ServiceBooking.create({
      serviceId,
      customerId: req.user?._id || '650000000000000000000001',
      customerName,
      customerPhone,
      bookingDate: bookingDate || new Date(),
      bookingTime: bookingTime || '10:00 AM',
      guestsCount: Number(guestsCount) || 1,
      totalAmount: Number(totalAmount) || 500,
      specialNotes: specialNotes || '',
      status: 'confirmed',
      paymentStatus: 'paid',
    });

    return res.status(201).json({
      success: true,
      message: 'Service booked successfully!',
      data: booking,
    });
  } catch (error) {
    console.error('createBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create booking.' });
  }
};

// Admin CRUD Endpoints
export const createService = async (req, res) => {
  try {
    const service = await ServiceProvider.create(req.body);
    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateService = async (req, res) => {
  try {
    const service = await ServiceProvider.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteService = async (req, res) => {
  try {
    await ServiceProvider.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Service provider deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
