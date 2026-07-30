import mongoose from 'mongoose';

const blogCommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    comment: { type: String, required: true },
    rating: { type: Number, default: 5 },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
  },
  { timestamps: true }
);

// Comment thread for a post: { postId, status: 'approved' } sorted newest-first.
blogCommentSchema.index({ postId: 1, status: 1, createdAt: -1 });

const BlogComment = mongoose.model('BlogComment', blogCommentSchema);
export default BlogComment;
