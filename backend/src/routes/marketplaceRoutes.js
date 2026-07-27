import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  getProducts,
  getProductBySlug,
  createCategory,
} from '../controllers/marketplaceController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/categories', getCategories);
router.get('/category/:slug', getCategoryBySlug);
router.get('/products', getProducts);
router.get('/products/:slug', getProductBySlug);

// Admin protected routes
router.post('/categories', protect, authorize('super_admin', 'govt_admin'), createCategory);

export default router;
