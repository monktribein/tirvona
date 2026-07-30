import mongoose from 'mongoose';

const visitorArticleLikeSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorArticle',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

visitorArticleLikeSchema.index({ articleId: 1, userId: 1 }, { unique: true });

const VisitorArticleLike = mongoose.model('VisitorArticleLike', visitorArticleLikeSchema);
export default VisitorArticleLike;
