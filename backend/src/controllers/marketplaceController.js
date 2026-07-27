import MarketplaceCategory from '../models/MarketplaceCategory.js';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import Offer from '../models/Offer.js';

// @desc    Get all active marketplace categories (with item counts and search)
// @route   GET /api/marketplace/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const { search, featured } = req.query;
    const query = { status: 'active' };

    if (featured === 'true') {
      query.featured = true;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { templeName: { $regex: search, $options: 'i' } },
        { originCity: { $regex: search, $options: 'i' } },
      ];
    }

    const categories = await MarketplaceCategory.find(query).sort({ displayOrder: 1, createdAt: -1 });

    // Populate dynamic item count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await MarketplaceProduct.countDocuments({ categoryId: cat._id, status: 'active' });
        const catObj = cat.toObject();
        catObj.itemCount = count > 0 ? count : cat.itemCount || 8;
        return catObj;
      })
    );

    res.json({
      success: true,
      data: categoriesWithCount,
    });
  } catch (error) {
    console.error('Get marketplace categories error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching categories' });
  }
};

// @desc    Get single marketplace category landing page by slug
// @route   GET /api/marketplace/category/:slug
// @access  Public
export const getCategoryBySlug = async (req, res) => {
  try {
    const category = await MarketplaceCategory.findOne({
      slug: req.params.slug.toLowerCase(),
      status: 'active',
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Marketplace category not found' });
    }

    // Fetch products belonging to this category
    const products = await MarketplaceProduct.find({
      categoryId: category._id,
      status: 'active',
    }).sort({ featured: -1, rating: -1 });

    // Related categories
    const relatedCategories = await MarketplaceCategory.find({
      _id: { $ne: category._id },
      status: 'active',
    })
      .limit(4)
      .select('name slug thumbnail templeName originCity rating itemCount');

    // Active offers related to marketplace
    const featuredOffers = await Offer.find({ status: 'active', validTill: { $gte: new Date() } })
      .limit(2)
      .select('offerTitle shortTitle promoCode discountType discountValue bannerImage');

    // Trusted Sellers mock data based on temple association
    const trustedSellers = [
      {
        id: 's1',
        name: `Shri ${category.templeName} Trust Sweets`,
        templeAssociation: category.templeName,
        yearsOfService: 45,
        rating: 4.9,
        verified: true,
        photo: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 's2',
        name: `Heritage ${category.originCity} Prashad Bhandar`,
        templeAssociation: `${category.originCity} Sacred Vendors`,
        yearsOfService: 28,
        rating: 4.8,
        verified: true,
        photo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
      },
    ];

    // Reviews mock data
    const reviews = [
      {
        id: 'r1',
        userName: 'Pandit Ramesh Sharma',
        location: 'Delhi NCR',
        rating: 5,
        date: '2 days ago',
        comment: `Authentic ${category.name} packed directly from ${category.templeName}! Pure desi ghee aroma and fresh delivery within 48 hours.`,
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      },
      {
        id: 'r2',
        userName: 'Sunita Agarwal',
        location: 'Mumbai',
        rating: 5,
        date: '1 week ago',
        comment: `We ordered this sacred prasad for our family puja. Received completely intact with tamper-proof seal and temple prasad certificate. Highly recommended!`,
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      },
    ];

    // Frequently Asked Questions
    const faqs = [
      {
        q: `Is this ${category.name} prepared at ${category.templeName}?`,
        a: `Yes! All ${category.name} offerings are prepared by hereditary sweet artisans associated with ${category.templeName} following traditional Vedic recipes with 100% Pure Desi Ghee.`,
      },
      {
        q: `How long does delivery take to my city?`,
        a: `Average delivery time is ${category.deliveryDays || 2} business days. We use express temperature-controlled packaging to maintain 100% freshness.`,
      },
      {
        q: `What is the shelf life of ${category.name}?`,
        a: `Due to pure ghee and traditional slow-cooking methods, it remains fresh for 15 to 30 days when stored in a cool, dry place.`,
      },
    ];

    res.json({
      success: true,
      data: {
        category,
        products,
        trustedSellers,
        reviews,
        faqs,
        relatedCategories,
        featuredOffers,
      },
    });
  } catch (error) {
    console.error('Get category landing error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching category details' });
  }
};

// @desc    Get filterable marketplace products directory
// @route   GET /api/marketplace/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const { categoryId, temple, search, minPrice, maxPrice, organic, vegetarian, festivalSpecial, page = 1, limit = 12 } = req.query;

    const query = { status: 'active' };

    if (categoryId) query.categoryId = categoryId;
    if (temple) query.templeName = { $regex: temple, $options: 'i' };
    if (organic === 'true') query.organic = true;
    if (vegetarian === 'true') query.vegetarian = true;
    if (festivalSpecial === 'true') query.festivalSpecial = true;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { templeName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await MarketplaceProduct.countDocuments(query);
    const products = await MarketplaceProduct.find(query)
      .populate('categoryId', 'name slug templeName originCity')
      .sort({ featured: -1, rating: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching marketplace products' });
  }
};

// @desc    Get single product by slug
// @route   GET /api/marketplace/products/:slug
// @access  Public
export const getProductBySlug = async (req, res) => {
  try {
    const product = await MarketplaceProduct.findOne({
      slug: req.params.slug.toLowerCase(),
      status: 'active',
    }).populate('categoryId', 'name slug templeName originCity history');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Related products from same category
    const relatedProducts = await MarketplaceProduct.find({
      categoryId: product.categoryId?._id || product.categoryId,
      _id: { $ne: product._id },
      status: 'active',
    })
      .limit(4)
      .select('productName slug price discountPrice weight images rating templeName');

    res.json({
      success: true,
      data: product,
      relatedProducts,
    });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching product details' });
  }
};

// @desc    Create new category (Admin)
// @route   POST /api/marketplace/categories
// @access  Private (Admin / Super Admin)
export const createCategory = async (req, res) => {
  try {
    const { name, originState, originCity, templeName, description } = req.body;
    if (!name || !originState || !originCity || !templeName || !description) {
      return res.status(400).json({ success: false, message: 'Name, state, city, temple name and description are required.' });
    }

    const slug = req.body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const category = await MarketplaceCategory.create({
      ...req.body,
      name,
      slug,
    });

    res.status(201).json({
      success: true,
      message: 'Marketplace category created successfully!',
      data: category,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating category' });
  }
};
