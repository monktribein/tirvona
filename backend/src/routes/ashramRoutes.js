import express from 'express';
import {
  createAshram,
  uploadDocuments,
  updateAshram,
  getMyAshrams,
  searchAshrams,
  getAshramById,
  getAddOns,
  createAddOn,
  updateAddOn,
  deleteAddOn,
} from '../controllers/ashramController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Static & User-Specific Routes (MUST come before /:id)
router.get('/', searchAshrams);
router.get('/my-listings/all', protect, restrictTo('owner', 'manager', 'super_admin'), getMyAshrams);

// Add-On Services Routes
router.get('/:id/add-ons', getAddOns);
router.post('/:id/add-ons', protect, restrictTo('owner', 'manager', 'super_admin'), createAddOn);
router.put('/:id/add-ons/:serviceId', protect, restrictTo('owner', 'manager', 'super_admin'), updateAddOn);
router.delete('/:id/add-ons/:serviceId', protect, restrictTo('owner', 'manager', 'super_admin'), deleteAddOn);

router.get('/:id', getAshramById);

// Protected mutation routes (Owner, Manager, Super Admin)
router.post('/', protect, restrictTo('owner', 'super_admin'), createAshram);
router.put('/:id', protect, restrictTo('owner', 'manager', 'super_admin'), updateAshram);
router.post('/:id/documents', protect, restrictTo('owner', 'super_admin'), uploadDocuments);

export default router;
