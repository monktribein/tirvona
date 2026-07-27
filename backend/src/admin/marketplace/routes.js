import { Router } from 'express';
import { getMarketplace } from './controller.js';

const router = Router();
router.get('/', getMarketplace);
export default router;
