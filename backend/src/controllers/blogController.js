import BlogPost from '../models/BlogPost.js';
import BlogAuthor from '../models/BlogAuthor.js';
import BlogComment from '../models/BlogComment.js';
import { escapeRegex } from '../utils/sanitize.js';

// Helper to extract YouTube Video ID
const extractYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// GET /api/blog/posts - Get blog posts with category, contentType & search filtering
export const getBlogPosts = async (req, res) => {
  try {
    const { category, contentType, search } = req.query;
    const filter = { status: 'published' };

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (contentType && contentType !== 'All') {
      filter.contentType = contentType;
    }
    if (search) {
      const safe = escapeRegex(search); // literal match, no regex injection / ReDoS
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { excerpt: { $regex: safe, $options: 'i' } },
        { tags: { $in: [new RegExp(safe, 'i')] } },
      ];
    }

    const posts = await BlogPost.find(filter)
      .populate('authorId', 'name photo designation organization verified bio')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching blog posts' });
  }
};

// GET /api/blog/posts/:slug - Get single post payload with author, comments, and related posts
export const getBlogPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
      .populate('authorId');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Article or video not found' });
    }

    // Increment views asynchronously
    post.views = (post.views || 0) + 1;
    await post.save();

    // Fetch comments
    const comments = await BlogComment.find({ postId: post._id, status: 'approved' }).sort({ createdAt: -1 });

    // Fetch related posts
    const relatedPosts = await BlogPost.find({
      _id: { $ne: post._id },
      category: post.category,
      status: 'published',
    })
      .populate('authorId', 'name photo designation verified')
      .limit(3);

    return res.status(200).json({
      success: true,
      data: {
        post,
        comments,
        relatedPosts,
      },
    });
  } catch (error) {
    console.error('Error fetching post detail by slug:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching post detail' });
  }
};

// POST /api/blog/posts/:slug/comments - Add comment to blog post
export const addBlogComment = async (req, res) => {
  try {
    const { userName, userEmail, comment, rating } = req.body;
    // Validate & bound the public (unauthenticated) input to curb spam / oversized payloads.
    if (typeof comment !== 'string' || !comment.trim() || comment.length > 2000) {
      return res.status(400).json({ success: false, message: 'Comment is required and must be under 2000 characters' });
    }
    const post = await BlogPost.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const newComment = await BlogComment.create({
      postId: post._id,
      userName: (typeof userName === 'string' ? userName.trim().slice(0, 80) : '') || 'Devotee Pilgrim',
      userEmail: (typeof userEmail === 'string' ? userEmail.trim().slice(0, 120) : '') || 'pilgrim@tirvona.com',
      comment: comment.trim().slice(0, 2000),
      rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
    });

    return res.status(201).json({ success: true, message: 'Comment submitted successfully!', data: newComment });
  } catch (error) {
    console.error('Error adding blog comment:', error);
    return res.status(500).json({ success: false, message: 'Server error adding comment' });
  }
};

// POST /api/blog/posts/:slug/like - Increment likes
export const likeBlogPost = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    post.likes = (post.likes || 0) + 1;
    await post.save();
    return res.status(200).json({ success: true, likes: post.likes });
  } catch (error) {
    console.error('Error liking post:', error);
    return res.status(500).json({ success: false, message: 'Server error liking post' });
  }
};
