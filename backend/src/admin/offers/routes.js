import { Router } from 'express';
import { getOffers } from './controller.js';

const router = Router();
router.get('/', getOffers);
export default router;
