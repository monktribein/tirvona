import express from 'express';
import {
  createTicket,
  getTickets,
  addMessageToTicket,
  resolveTicket,
} from '../controllers/supportController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, restrictTo('customer', 'owner', 'manager'), createTicket);
router.get('/', protect, getTickets);
router.post('/:id/message', protect, addMessageToTicket);
router.post('/:id/resolve', protect, resolveTicket);

export default router;
