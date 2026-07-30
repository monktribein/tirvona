import mongoose from 'mongoose';
import VisitorArticle from '../models/visitorBlog/VisitorArticle.js';
import VisitorArticleComment from '../models/visitorBlog/VisitorArticleComment.js';
import VisitorArticleLike from '../models/visitorBlog/VisitorArticleLike.js';
import VisitorArticleStatusHistory from '../models/visitorBlog/VisitorArticleStatusHistory.js';
import Booking from '../models/Booking.js';
import Ashram from '../models/Ashram.js';
import Notification from '../models/Notification.js';

/** Helper to generate url-friendly slug */
const createSlug = (title) => {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-') +
    '-' +
    Math.random().toString(36).substring(2, 7)
  );
};

// 1. Visitor: Get Completed Bookings Eligible for Writing an Article
export const getEligibleBookings = async (req, res) => {
  try {
    const visitorId = req.user._id;

    // Fetch all completed bookings belonging to this customer
    const bookings = await Booking.find({
      customerId: visitorId,
      status: 'completed',
    })
      .populate('ashramId', 'name address tagline images')
      .sort({ checkOutDate: -1 });

    // Fetch existing articles for this visitor to mark submitted bookings
    const existingArticles = await VisitorArticle.find({ visitorId }).select('bookingId status');
    const submittedBookingMap = new Map();
    existingArticles.forEach((art) => {
      submittedBookingMap.set(art.bookingId.toString(), art.status);
    });

    const eligibleList = bookings.map((b) => {
      const bId = b._id.toString();
      const existingStatus = submittedBookingMap.get(bId) || null;
      return {
        _id: b._id,
        bookingId: b.bookingId,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        ashram: b.ashramId,
        hasSubmittedArticle: Boolean(existingStatus && existingStatus !== 'rejected'),
        existingArticleStatus: existingStatus,
      };
    });

    return res.json({
      success: true,
      count: eligibleList.length,
      data: eligibleList,
    });
  } catch (error) {
    console.error('Error fetching eligible bookings:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching eligible bookings.' });
  }
};

// 2. Visitor: Create Article (Draft or Submit for Approval)
export const createArticle = async (req, res) => {
  try {
    const visitorId = req.user._id;
    const {
      bookingId,
      title,
      category,
      shortDescription,
      content,
      featuredImage,
      galleryImages = [],
      tags = [],
      language = 'English',
      status = 'pending', // 'draft' or 'pending'
    } = req.body;

    if (!bookingId || !title || !shortDescription || !content || !featuredImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (bookingId, title, description, content, featured image).',
      });
    }

    // Verify booking ownership and completed status
    const booking = await Booking.findById(bookingId).populate('ashramId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking record not found.' });
    }

    if (booking.customerId.toString() !== visitorId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Booking does not belong to you.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed ashram stays are eligible for writing verified articles.',
      });
    }

    // Check for duplicate submission on same booking
    const existingArticle = await VisitorArticle.findOne({
      bookingId,
      status: { $in: ['pending', 'approved'] },
    });

    if (existingArticle) {
      return res.status(400).json({
        success: false,
        message: 'An article has already been submitted for this completed stay.',
      });
    }

    const ashram = booking.ashramId;
    if (!ashram || !ashram.ownerId) {
      return res.status(400).json({ success: false, message: 'Associated Ashram or Owner information missing.' });
    }

    const slug = createSlug(title);
    const visitDate = booking.checkInDate || booking.createdAt;
    const visitMonth = new Date(visitDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const article = new VisitorArticle({
      visitorId,
      bookingId,
      ashramId: ashram._id,
      ownerId: ashram.ownerId,
      title,
      slug,
      category,
      shortDescription,
      content,
      featuredImage,
      galleryImages,
      tags: Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()),
      language,
      status: status === 'draft' ? 'draft' : 'pending',
      isVerifiedStay: true,
      visitDate,
      visitMonth,
    });

    await article.save();

    // Record status history
    await VisitorArticleStatusHistory.create({
      articleId: article._id,
      previousStatus: 'new',
      newStatus: article.status,
      actionBy: visitorId,
    });

    // Send notification to Ashram Owner if submitted for approval
    if (article.status === 'pending') {
      await Notification.create({
        recipientId: ashram.ownerId,
        title: 'New Visitor Article Submitted',
        message: `A new verified visitor article "${title}" was submitted for ${ashram.name}.`,
        type: 'visitor_article',
        data: { articleId: article._id, ashramId: ashram._id },
      });
    }

    return res.status(201).json({
      success: true,
      message: article.status === 'draft' ? 'Article saved as draft.' : 'Article submitted for Owner approval.',
      data: article,
    });
  } catch (error) {
    console.error('Error creating visitor article:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create article.' });
  }
};

// 3. Visitor: Update / Resubmit Article
export const updateArticle = async (req, res) => {
  try {
    const visitorId = req.user._id;
    const { id } = req.params;
    const {
      title,
      category,
      shortDescription,
      content,
      featuredImage,
      galleryImages,
      tags,
      language,
      status, // 'draft' or 'pending'
    } = req.body;

    const article = await VisitorArticle.findById(id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    if (article.visitorId.toString() !== visitorId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this article.' });
    }

    const previousStatus = article.status;

    if (title) article.title = title;
    if (category) article.category = category;
    if (shortDescription) article.shortDescription = shortDescription;
    if (content) article.content = content;
    if (featuredImage) article.featuredImage = featuredImage;
    if (galleryImages) article.galleryImages = galleryImages;
    if (tags) article.tags = Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim());
    if (language) article.language = language;

    if (status && ['draft', 'pending'].includes(status)) {
      article.status = status;
      if (status === 'pending') {
        article.rejectionReason = ''; // Clear prior rejection on resubmit
      }
    }

    await article.save();

    if (previousStatus !== article.status) {
      await VisitorArticleStatusHistory.create({
        articleId: article._id,
        previousStatus,
        newStatus: article.status,
        actionBy: visitorId,
      });

      if (article.status === 'pending') {
        await Notification.create({
          recipientId: article.ownerId,
          title: 'Resubmitted Visitor Article',
          message: `Visitor resubmitted article "${article.title}" for review.`,
          type: 'visitor_article',
          data: { articleId: article._id },
        });
      }
    }

    return res.json({
      success: true,
      message: 'Article updated successfully.',
      data: article,
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return res.status(500).json({ success: false, message: 'Failed to update article.' });
  }
};

// 4. Visitor: Get My Articles (Categorized by status)
export const getMyArticles = async (req, res) => {
  try {
    const visitorId = req.user._id;
    const { status } = req.query;

    const filter = { visitorId };
    if (status && ['draft', 'pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const articles = await VisitorArticle.find(filter)
      .populate('ashramId', 'name address images')
      .populate('bookingId', 'bookingId checkInDate checkOutDate')
      .sort({ updatedAt: -1 });

    const counts = {
      draft: await VisitorArticle.countDocuments({ visitorId, status: 'draft' }),
      pending: await VisitorArticle.countDocuments({ visitorId, status: 'pending' }),
      approved: await VisitorArticle.countDocuments({ visitorId, status: 'approved' }),
      rejected: await VisitorArticle.countDocuments({ visitorId, status: 'rejected' }),
      total: await VisitorArticle.countDocuments({ visitorId }),
    };

    return res.json({
      success: true,
      counts,
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching visitor articles:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching your articles.' });
  }
};

// 5. Owner: Get Articles Submitted for Owner's Ashrams
export const getOwnerArticles = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status = 'pending' } = req.query;

    // Find all ashrams owned by this user
    const ownedAshrams = await Ashram.find({ ownerId }).select('_id');
    const ashramIds = ownedAshrams.map((a) => a._id);

    const filter = { ashramId: { $in: ashramIds } };
    if (status && ['pending', 'approved', 'rejected', 'all'].includes(status) && status !== 'all') {
      filter.status = status;
    }

    const articles = await VisitorArticle.find(filter)
      .populate('visitorId', 'name email phone avatar')
      .populate('ashramId', 'name address images')
      .populate('bookingId', 'bookingId checkInDate checkOutDate status guestsCount totalAmount')
      .sort({ createdAt: -1 });

    const counts = {
      pending: await VisitorArticle.countDocuments({ ashramId: { $in: ashramIds }, status: 'pending' }),
      approved: await VisitorArticle.countDocuments({ ashramId: { $in: ashramIds }, status: 'approved' }),
      rejected: await VisitorArticle.countDocuments({ ashramId: { $in: ashramIds }, status: 'rejected' }),
    };

    return res.json({
      success: true,
      counts,
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching owner visitor articles:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching owner articles.' });
  }
};

// 6. Owner: Review Article (Approve or Reject with Reason)
export const reviewArticle = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
    }

    if (action === 'reject' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is mandatory when rejecting an article.',
      });
    }

    const article = await VisitorArticle.findById(id).populate('ashramId');
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    // Verify ownership of the ashram
    if (article.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this Ashram.' });
    }

    const previousStatus = article.status;

    if (action === 'approve') {
      article.status = 'approved';
      article.publishedAt = new Date();
      article.rejectionReason = '';
    } else {
      article.status = 'rejected';
      article.rejectionReason = rejectionReason.trim();
    }

    await article.save();

    await VisitorArticleStatusHistory.create({
      articleId: article._id,
      previousStatus,
      newStatus: article.status,
      actionBy: ownerId,
      reason: rejectionReason || '',
    });

    // Notify Visitor
    const notificationTitle = action === 'approve' ? 'Article Approved & Published!' : 'Article Status Updated';
    const notificationMsg =
      action === 'approve'
        ? `Your article "${article.title}" was approved by ${article.ashramId?.name || 'Ashram'} and is now published!`
        : `Your article "${article.title}" was rejected. Reason: ${rejectionReason}`;

    await Notification.create({
      recipientId: article.visitorId,
      title: notificationTitle,
      message: notificationMsg,
      type: 'visitor_article',
      data: { articleId: article._id, status: article.status },
    });

    return res.json({
      success: true,
      message: action === 'approve' ? 'Article approved and published.' : 'Article rejected.',
      data: article,
    });
  } catch (error) {
    console.error('Error reviewing article:', error);
    return res.status(500).json({ success: false, message: 'Failed to process article review.' });
  }
};

// 7. Public: Get Published Visitor Articles with Filters & Search
export const getPublicArticles = async (req, res) => {
  try {
    const {
      category,
      ashramId,
      search,
      sort = 'latest',
      page = 1,
      limit = 12,
    } = req.query;

    const filter = { status: 'approved' };

    if (category && category !== 'all') filter.category = category;
    if (ashramId) filter.ashramId = ashramId;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOption = sort === 'popular' ? { viewsCount: -1, likesCount: -1 } : { publishedAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const articles = await VisitorArticle.find(filter)
      .populate('visitorId', 'name avatar')
      .populate('ashramId', 'name address images')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await VisitorArticle.countDocuments(filter);

    return res.json({
      success: true,
      count: articles.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: articles,
    });
  } catch (error) {
    console.error('Error fetching public visitor articles:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch visitor articles.' });
  }
};

// 8. Public: Get Single Article Detail by Slug or ID
export const getPublicArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(slug);
    const filter = isObjectId ? { $or: [{ slug }, { _id: slug }] } : { slug };

    const article = await VisitorArticle.findOne(filter)
      .populate('visitorId', 'name avatar email')
      .populate('ashramId', 'name tagline address images rating')
      .populate('bookingId', 'bookingId checkInDate checkOutDate status');

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    // Increment view count
    article.viewsCount += 1;
    await article.save();

    // Fetch comments
    const comments = await VisitorArticleComment.find({ articleId: article._id }).sort({ createdAt: -1 });

    // Fetch related articles from same category or ashram
    const relatedArticles = await VisitorArticle.find({
      status: 'approved',
      _id: { $ne: article._id },
      $or: [{ category: article.category }, { ashramId: article.ashramId }],
    })
      .limit(4)
      .populate('visitorId', 'name');

    return res.json({
      success: true,
      data: {
        article,
        comments,
        relatedArticles,
      },
    });
  } catch (error) {
    console.error('Error fetching article detail:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch article detail.' });
  }
};

// 9. Public / User: Toggle Like
export const toggleLikeArticle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const existingLike = await VisitorArticleLike.findOne({ articleId: id, userId });
    const article = await VisitorArticle.findById(id);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    if (existingLike) {
      await VisitorArticleLike.deleteOne({ _id: existingLike._id });
      article.likesCount = Math.max(0, article.likesCount - 1);
      await article.save();
      return res.json({ success: true, liked: false, likesCount: article.likesCount });
    } else {
      await VisitorArticleLike.create({ articleId: id, userId });
      article.likesCount += 1;
      await article.save();
      return res.json({ success: true, liked: true, likesCount: article.likesCount });
    }
  } catch (error) {
    console.error('Error toggling article like:', error);
    return res.status(500).json({ success: false, message: 'Failed to process like.' });
  }
};

// 10. Public / User: Add Comment
export const addArticleComment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const newComment = await VisitorArticleComment.create({
      articleId: id,
      userId,
      userName: req.user.name || 'Verified Pilgrim',
      comment: comment.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added.',
      data: newComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, message: 'Failed to add comment.' });
  }
};
