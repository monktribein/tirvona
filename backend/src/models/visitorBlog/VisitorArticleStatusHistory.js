import mongoose from 'mongoose';

const visitorArticleStatusHistorySchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorArticle',
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const VisitorArticleStatusHistory = mongoose.model(
  'VisitorArticleStatusHistory',
  visitorArticleStatusHistorySchema
);
export default VisitorArticleStatusHistory;
