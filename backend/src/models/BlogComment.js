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

const BlogComment = mongoose.model('BlogComment', blogCommentSchema);
export default BlogComment;
