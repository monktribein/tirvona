import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import {
  getEligibleBookings,
  createArticle,
  updateArticle,
  getMyArticles,
  getOwnerArticles,
  reviewArticle,
  getPublicArticles,
  getPublicArticleBySlug,
  toggleLikeArticle,
  addArticleComment,
} from '../controllers/visitorArticleController.js';

const router = express.Router();

// Public discovery routes
router.get('/public', getPublicArticles);
router.get('/public/:slug', getPublicArticleBySlug);

// Visitor authenticated routes
router.get('/visitor/eligible-bookings', protect, getEligibleBookings);
router.get('/visitor/my-articles', protect, getMyArticles);
router.post('/', protect, createArticle);
router.put('/:id', protect, updateArticle);
router.post('/:id/like', protect, toggleLikeArticle);
router.post('/:id/comments', protect, addArticleComment);

// Owner review routes
router.get('/owner/list', protect, authorize('owner', 'manager', 'super_admin'), getOwnerArticles);
router.post('/:id/review', protect, authorize('owner', 'manager', 'super_admin'), reviewArticle);

export default router;
