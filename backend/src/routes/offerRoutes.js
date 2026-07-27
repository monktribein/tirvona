import express from 'express';
import {
  createOffer,
  getActiveOffers,
  getMyOffers,
  getOfferById,
  updateOffer,
  deleteOffer,
  duplicateOffer,
  validatePromoCode,
} from '../controllers/offerController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getActiveOffers);
router.post('/validate-promo', validatePromoCode);
router.get('/my-offers', protect, authorize('owner', 'super_admin', 'manager'), getMyOffers);
router.get('/:id', getOfferById);

// Owner / Manager / Admin protected routes
router.post('/', protect, authorize('owner', 'super_admin', 'manager'), createOffer);
router.put('/:id', protect, authorize('owner', 'super_admin', 'manager'), updateOffer);
router.delete('/:id', protect, authorize('owner', 'super_admin', 'manager'), deleteOffer);
router.post('/:id/duplicate', protect, authorize('owner', 'super_admin', 'manager'), duplicateOffer);

export default router;
