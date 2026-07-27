import { Router } from 'express';
import { getSettings } from './controller.js';

const router = Router();
router.get('/', getSettings);
export default router;
