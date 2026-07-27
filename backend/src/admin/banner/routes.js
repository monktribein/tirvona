import { Router } from 'express';
import { getBanner } from './controller.js';

const router = Router();
router.get('/', getBanner);
export default router;
