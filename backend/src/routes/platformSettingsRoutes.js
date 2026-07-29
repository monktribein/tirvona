import express from 'express';
import { getSettings, updateSettings } from '../controllers/platformSettingsController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, restrictTo('super_admin', 'manager'), updateSettings);

export default router;
