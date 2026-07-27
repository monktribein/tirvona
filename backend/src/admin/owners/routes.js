import { Router } from 'express';
import { getOwners } from './controller.js';

const router = Router();
router.get('/', getOwners);
export default router;
