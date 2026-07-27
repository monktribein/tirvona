import { Router } from 'express';
import { getBookings } from './controller.js';

const router = Router();
router.get('/', getBookings);
export default router;
