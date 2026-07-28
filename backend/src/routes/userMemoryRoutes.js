import express from 'express';
import {
  getUserMemory,
  saveUserMemory,
  clearUserMemoryCategory,
} from '../controllers/userMemoryController.js';

const router = express.Router();

router.get('/', getUserMemory);
router.post('/', saveUserMemory);
router.delete('/:category', clearUserMemoryCategory);

export default router;
