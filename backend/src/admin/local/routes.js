import { Router } from 'express';
import { getLocal } from './controller.js';

const router = Router();
router.get('/', getLocal);
export default router;
