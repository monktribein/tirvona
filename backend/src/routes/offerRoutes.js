import express from 'express';
import {
  createOffer,
  getMyOffers,
  getActiveOffers,
  updateOffer,
  deleteOffer,
} from '../controllers/offerController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes (for Landing Page Banner)
router.get('/public/active', getActiveOffers);

// Protected routes (Owner, Super Admin)
router.post('/', protect, restrictTo('owner', 'super_admin'), createOffer);
router.get('/my-offers', protect, restrictTo('owner', 'super_admin'), getMyOffers);
router.put('/:id', protect, restrictTo('owner', 'super_admin'), updateOffer);
router.delete('/:id', protect, restrictTo('owner', 'super_admin'), deleteOffer);

export default router;
