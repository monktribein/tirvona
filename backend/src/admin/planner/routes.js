import { Router } from 'express';
import { getPlanner } from './controller.js';

const router = Router();
router.get('/', getPlanner);
export default router;
