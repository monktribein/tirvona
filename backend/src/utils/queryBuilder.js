/**
 * Enterprise MongoDB Query Builder Utility
 * Provides standardized query generation for text search, multi-field filtering, price ranges,
 * sorting, and pagination across all Tirvona backend controllers.
 */

export const buildTextSearch = (search, searchFields = ['name', 'description', 'city', 'tags']) => {
  if (!search || typeof search !== 'string' || !search.trim()) return {};

  const cleanSearch = search.trim();
  const regex = new RegExp(cleanSearch, 'i');

  return {
    $or: searchFields.map((field) => ({ [field]: regex })),
  };
};

export const buildRangeQuery = (field, minVal, maxVal) => {
  const query = {};
  if (minVal !== undefined && minVal !== null && minVal !== '') {
    query.$gte = Number(minVal);
  }
  if (maxVal !== undefined && maxVal !== null && maxVal !== '') {
    query.$lte = Number(maxVal);
  }
  return Object.keys(query).length > 0 ? { [field]: query } : {};
};

export const buildEnumQuery = (field, val) => {
  if (!val || val === 'all') return {};
  if (Array.isArray(val)) {
    return { [field]: { $in: val } };
  }
  return { [field]: new RegExp(`^${val}$`, 'i') };
};

export const buildSortOptions = (sortBy = 'newest') => {
  switch (sortBy) {
    case 'price_low':
      return { price: 1, 'pricing.amount': 1, createdAt: -1 };
    case 'price_high':
      return { price: -1, 'pricing.amount': -1, createdAt: -1 };
    case 'rating':
      return { rating: -1, reviewCount: -1, createdAt: -1 };
    case 'popularity':
      return { reviewCount: -1, rating: -1, createdAt: -1 };
    case 'oldest':
      return { createdAt: 1 };
    case 'alphabetical':
      return { name: 1 };
    case 'newest':
    default:
      return { isFeatured: -1, createdAt: -1 };
  }
};

export const buildPagination = (queryPage = 1, queryLimit = 20) => {
  const page = Math.max(1, parseInt(queryPage, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryLimit, 10) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildEnterpriseQuery = ({
  search,
  searchFields,
  category,
  city,
  status = 'active',
  minPrice,
  maxPrice,
  customFilters = {},
}) => {
  const textQuery = buildTextSearch(search, searchFields);
  const categoryQuery = buildEnumQuery('category', category);
  const cityQuery = buildEnumQuery('city', city);
  const statusQuery = status ? buildEnumQuery('status', status) : {};
  const priceQuery = buildRangeQuery('price', minPrice, maxPrice);

  return {
    ...statusQuery,
    ...textQuery,
    ...categoryQuery,
    ...cityQuery,
    ...priceQuery,
    ...customFilters,
  };
};

export default {
  buildTextSearch,
  buildRangeQuery,
  buildEnumQuery,
  buildSortOptions,
  buildPagination,
  buildEnterpriseQuery,
};
