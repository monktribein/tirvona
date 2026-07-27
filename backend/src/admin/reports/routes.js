import { Router } from 'express';
import { getReports } from './controller.js';

const router = Router();
router.get('/', getReports);
export default router;
