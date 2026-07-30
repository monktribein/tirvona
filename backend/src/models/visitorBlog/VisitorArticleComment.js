import mongoose from 'mongoose';

const visitorArticleCommentSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorArticle',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      default: 'Pilgrim',
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorArticleComment',
      default: null,
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const VisitorArticleComment = mongoose.model('VisitorArticleComment', visitorArticleCommentSchema);
export default VisitorArticleComment;
