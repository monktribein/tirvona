import { Router } from 'express';
import { getBlogs } from './controller.js';

const router = Router();
router.get('/', getBlogs);
export default router;
