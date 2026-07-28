import express from 'express';
import {
  getServices,
  getServiceById,
  createBooking,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController.js';

const router = express.Router();

// Public API Routes
router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/book', createBooking);

// Admin Management Routes
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;
