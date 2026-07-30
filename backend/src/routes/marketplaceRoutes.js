import express from 'express';
import {
  getProducts,
  getProductBySlug,
  getCategories,
  createOrder,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/marketplaceController.js';

const router = express.Router();

// Public API Routes
router.get('/categories', getCategories);
router.get('/products', getProducts);
router.get('/products/:idOrSlug', getProductBySlug);
router.post('/order', createOrder);

// Admin Management Routes
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

export default router;
