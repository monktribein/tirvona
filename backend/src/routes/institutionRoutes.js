import express from 'express';
import {
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,
} from '../controllers/institutionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getInstitutions);
router.get('/:id', getInstitutionById);

router.post('/', protect, authorize('super_admin', 'district_officer', 'govt_admin'), createInstitution);
router.put('/:id', protect, authorize('super_admin', 'district_officer', 'govt_admin'), updateInstitution);
router.delete('/:id', protect, authorize('super_admin'), deleteInstitution);

export default router;
