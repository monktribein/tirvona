import { Router } from 'express';
import { getRooms } from './controller.js';

const router = Router();
router.get('/', getRooms);
export default router;
