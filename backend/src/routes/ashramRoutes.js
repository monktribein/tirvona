import express from 'express';
import {
  createAshram,
  uploadDocuments,
  updateAshram,
  getMyAshrams,
  searchAshrams,
  getAshramById,
} from '../controllers/ashramController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', searchAshrams);
router.get('/:id', getAshramById);

// Protected routes (Owner, Manager, Super Admin)
router.post('/', protect, restrictTo('owner', 'super_admin'), createAshram);
router.get('/my-listings/all', protect, restrictTo('owner', 'manager', 'super_admin'), getMyAshrams);
router.put('/:id', protect, restrictTo('owner', 'manager', 'super_admin'), updateAshram);
router.post('/:id/documents', protect, restrictTo('owner', 'super_admin'), uploadDocuments);

export default router;
