import { Router } from 'express';
import { getAshrams } from './controller.js';

const router = Router();
router.get('/', getAshrams);
export default router;
