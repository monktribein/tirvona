import express from 'express';
import { createReview, getAshramReviews, getRecentReviews } from '../controllers/reviewController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createReview);
router.get('/recent', getRecentReviews);
router.get('/ashram/:ashramId', getAshramReviews);

export default router;
