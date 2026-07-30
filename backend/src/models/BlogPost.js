import mongoose from 'mongoose';

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    subtitle: { type: String },
    content: { type: String, required: true }, // min 500 chars
    excerpt: { type: String, required: true },
    contentType: { type: String, enum: ['article', 'video'], default: 'article' },
    coverImage: { type: String, required: true },
    gallery: [{ type: String }],
    youtubeUrl: { type: String },
    youtubeVideoId: { type: String },
    youtubeDuration: { type: String, default: '14:20' },
    youtubeViews: { type: String, default: '45.2K Views' },
    youtubeChannel: { type: String, default: 'Tirvona Sacred Media' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogAuthor', required: true },
    category: {
      type: String,
      required: true,
      enum: [
        'Temple History',
        'Travel Guide',
        'Festival',
        'Ashram News',
        'Pilgrim Story',
        'Government Update',
        'Spiritual Knowledge',
        'Meditation',
        'Yoga',
        'Ayurveda',
        'Prasad',
        'Marketplace',
        'Videos',
        'General',
      ],
      default: 'Temple History',
    },
    tags: [{ type: String }],
    status: { type: String, enum: ['draft', 'pending', 'published', 'archived'], default: 'published' },
    featured: { type: Boolean, default: true },
    views: { type: Number, default: 1420 },
    likes: { type: Number, default: 380 },
    readingTime: { type: String, default: '6 min read' },
    seoTitle: { type: String },
    seoDescription: { type: String },
  },
  { timestamps: true }
);

// Public blog listing always pins status: 'published' and sorts newest-first,
// optionally faceted by category or contentType. (`slug` is already indexed by
// its unique: true.)
blogPostSchema.index({ status: 1, createdAt: -1 });
blogPostSchema.index({ status: 1, category: 1, createdAt: -1 });
blogPostSchema.index({ status: 1, contentType: 1, createdAt: -1 });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
export default BlogPost;
