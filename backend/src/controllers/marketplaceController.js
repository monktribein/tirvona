import MarketplaceProduct from '../models/MarketplaceProduct.js';
import MarketplaceOrder from '../models/MarketplaceOrder.js';
import { buildEnterpriseQuery, buildSortOptions, buildPagination } from '../utils/queryBuilder.js';

// GET /api/marketplace/products
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      search,
      templeSource,
      minPrice,
      maxPrice,
      featured,
      sortBy = 'rating',
      page = 1,
      limit = 20,
    } = req.query;

    const customFilters = {};
    if (templeSource) customFilters.templeSource = new RegExp(templeSource, 'i');
    if (featured === 'true') customFilters.isFeatured = true;

    const query = buildEnterpriseQuery({
      search,
      searchFields: ['name', 'description', 'templeSource', 'category'],
      category,
      status: 'active',
      minPrice,
      maxPrice,
      customFilters,
    });

    const sort = buildSortOptions(sortBy);
    const { skip, limit: limitParsed } = buildPagination(page, limit);

    const [products, total] = await Promise.all([
      MarketplaceProduct.find(query).sort(sort).skip(skip).limit(limitParsed),
      MarketplaceProduct.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      data: products,
    });
  } catch (error) {
    console.error('getProducts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
};

// GET /api/marketplace/products/:idOrSlug
export const getProductBySlug = async (req, res) => {
  try {
    const product = await MarketplaceProduct.findOne({
      $or: [{ slug: req.params.idOrSlug }, { _id: req.params.idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? req.params.idOrSlug : null }],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Spiritual product not found.' });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching product details.' });
  }
};

// POST /api/marketplace/order - Checkout / Place Order
export const createOrder = async (req, res) => {
  try {
    const { items, customerName, customerPhone, shippingAddress, totalAmount, paymentMethod } = req.body;

    const orderNumber = `TVN-ORD-${Date.now().toString().slice(-6)}`;

    const order = await MarketplaceOrder.create({
      orderNumber,
      customerId: req.user?._id || '650000000000000000000001',
      customerName: customerName || 'Sacred Pilgrim',
      customerPhone: customerPhone || '9876543210',
      shippingAddress: shippingAddress || {
        street: 'Main Temple Road',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        pincode: '221001',
      },
      items: items || [],
      totalAmount: Number(totalAmount) || 499,
      paymentMethod: paymentMethod || 'upi',
      paymentStatus: 'paid',
      orderStatus: 'processing',
    });

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: order,
    });
  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to place marketplace order.' });
  }
};

// Admin Product Management
export const createProduct = async (req, res) => {
  try {
    const product = await MarketplaceProduct.create(req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await MarketplaceProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await MarketplaceProduct.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
