import express from 'express';
import { uploadSingle } from '../controllers/uploadController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

// Any authenticated user can upload (owners: docs/images, customers: none needed).
router.post('/', protect, upload.single('file'), uploadSingle);

export default router;
