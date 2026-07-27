import express from 'express';
import {
  getBlogPosts,
  getBlogPostBySlug,
  addBlogComment,
  likeBlogPost,
} from '../controllers/blogController.js';

const router = express.Router();

router.get('/posts', getBlogPosts);
router.get('/posts/:slug', getBlogPostBySlug);
router.post('/posts/:slug/comments', addBlogComment);
router.post('/posts/:slug/like', likeBlogPost);

export default router;
