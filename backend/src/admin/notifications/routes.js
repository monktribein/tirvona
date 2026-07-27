import { Router } from 'express';
import { getNotifications } from './controller.js';

const router = Router();
router.get('/', getNotifications);
export default router;
