import mongoose from 'mongoose';

const blogAuthorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    photo: { type: String, required: true }, // Passport size photo URL
    designation: { type: String, required: true }, // e.g. Senior Temple Researcher
    organization: { type: String, default: 'Tirvona Sacred Research Cell' },
    bio: { type: String, required: true },
    experience: { type: String, default: '10+ Years Spiritual Travel Writing' },
    email: { type: String, required: true, lowercase: true, trim: true },
    socialLinks: {
      twitter: { type: String },
      youtube: { type: String },
      linkedin: { type: String },
    },
    verified: { type: Boolean, default: true },
    articlesCount: { type: Number, default: 12 },
  },
  { timestamps: true }
);

const BlogAuthor = mongoose.model('BlogAuthor', blogAuthorSchema);
export default BlogAuthor;
