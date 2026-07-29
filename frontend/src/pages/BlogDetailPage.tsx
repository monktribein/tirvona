import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Clock,
  Eye,
  Heart,
  Share2,
  Bookmark,
  Printer,
  ArrowLeft,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  Play,
  BookOpen,
  MapPin,
  Sparkles,
  ArrowUpRight,
  ThumbsUp,
} from 'lucide-react';

export const BlogDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // New comment state
  const [userName, setUserName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchPostDetail();
  }, [slug]);

  const fetchPostDetail = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/blog/posts/${slug}`
      );
      if (res.data.success) {
        setData(res.data.data);
        setLikes(res.data.data.post.likes || 0);
      }
    } catch (err) {
      console.error('Error fetching blog detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (hasLiked) return;
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/blog/posts/${slug}/like`
      );
      if (res.data.success) {
        setLikes(res.data.likes);
        setHasLiked(true);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data?.post?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Article link copied to clipboard!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/blog/posts/${slug}/comments`,
        { userName: userName || 'Devotee Pilgrim', comment: commentText }
      );
      if (res.data.success) {
        setCommentText('');
        fetchPostDetail();
      }
    } catch (err) {
      console.error('Add comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">Loading Sacred Article...</p>
      </div>
    );
  }

  if (!data?.post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <h2 className="text-xl font-black text-gray-700 dark:text-gray-200 mb-4">Article Not Found</h2>
        <button
          onClick={() => navigate('/blog')}
          className="px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-bold text-xs shadow-md hover:bg-blue-900 transition-colors"
        >
          Back to Spiritual Knowledge Hub
        </button>
      </div>
    );
  }

  const { post, comments, relatedPosts } = data;
  const author = post.authorId || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-8">

        {/* 2. Tirvona Hero Section */}
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl min-h-[400px] sm:min-h-[480px] flex items-end p-6 sm:p-12 border border-gray-100 dark:border-slate-800 group">
          <img
            src={post.coverImage}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C] via-[#0B192C]/70 to-transparent" />

          <div className="relative z-10 space-y-4 max-w-4xl text-white">
            
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-4 py-1 rounded-full bg-[#0A4DA6] text-white text-xs font-black uppercase tracking-wider shadow-md">
                  {post.category}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-400" />
                  {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-400" />
                  {post.readingTime}
                </span>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
                  title="Share Article"
                >
                  <Share2 size={15} />
                </button>
                <button
                  onClick={() => setIsBookmarked(!isBookmarked)}
                  className={`p-2.5 rounded-full backdrop-blur-md transition-colors ${
                    isBookmarked ? 'bg-amber-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Bookmark"
                >
                  <Bookmark size={15} className={isBookmarked ? 'fill-white' : ''} />
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors hidden sm:block"
                  title="Print Article"
                >
                  <Printer size={15} />
                </button>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight drop-shadow-sm">
              {post.title}
            </h1>

            {post.subtitle && (
              <p className="text-sm sm:text-base text-blue-100 font-medium leading-relaxed max-w-3xl">
                {post.subtitle}
              </p>
            )}

            {/* Author Profile Strip */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-3">
                <img
                  src={author.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80'}
                  alt={author.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#E58C28] shadow-md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-sm text-white">{author.name || 'Verified Scholar'}</h4>
                    {author.verified && (
                      <CheckCircle2 size={15} className="text-emerald-400 fill-emerald-400/20" />
                    )}
                  </div>
                  <p className="text-[11px] text-blue-200 font-semibold">{author.designation || 'Spiritual Research Writer'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                  <Eye size={14} className="text-amber-400" />
                  <span>{post.views} Views</span>
                </span>
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-md ${
                    hasLiked ? 'bg-red-600 text-white' : 'bg-white text-[#0B192C] hover:bg-amber-400'
                  }`}
                >
                  <Heart size={14} className={hasLiked ? 'fill-white text-white' : 'text-red-500'} />
                  <span>{likes}</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 3. Main 2-Column Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Main Content Area (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Main Article Container */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-10 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
              
              {/* Formatted Text Content */}
              <div className="prose dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed text-slate-700 dark:text-gray-200 space-y-4 whitespace-pre-line font-medium">
                {post.content}
              </div>

              {/* Sample Pull Quote */}
              <div className="my-8 p-6 rounded-2xl bg-blue-50/70 dark:bg-slate-900/80 border-l-4 border-[#0A4DA6] space-y-2">
                <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#0A4DA6] dark:text-amber-400">
                  "Every pilgrimage is a sacred inward journey towards peace, self-realization, and divine grace."
                </p>
                <span className="text-xs font-extrabold text-gray-500 uppercase block">— Tirvona Spiritual Guidelines</span>
              </div>

              {/* Image Gallery */}
              {post.gallery?.length > 0 && (
                <div className="space-y-3 pt-4">
                  <h4 className="font-black text-base text-[#0B192C] dark:text-white">Sacred Photo Gallery</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {post.gallery.map((img: string, i: number) => (
                      <div key={i} className="rounded-2xl overflow-hidden h-44 shadow-sm border border-gray-100 dark:border-slate-800">
                        <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-black text-gray-400 uppercase mr-2">Tags:</span>
                  {post.tags.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="px-3.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-bold text-[#0A4DA6] dark:text-amber-400 hover:bg-[#0A4DA6] hover:text-white transition-colors cursor-pointer"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Author Profile Card (Matching Homepage Style) */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <img
                src={author.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80'}
                alt={author.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-[#0A4DA6] shadow-md shrink-0"
              />
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="font-black text-lg text-[#0B192C] dark:text-white">{author.name}</h4>
                  <span className="px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 size={12} /> VERIFIED AUTHOR
                  </span>
                </div>
                <p className="text-xs font-bold text-[#0A4DA6] dark:text-amber-400">
                  {author.designation} • {author.organization}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {author.bio}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold text-gray-500">
                  <span>Experience: <strong className="text-gray-800 dark:text-gray-200">{author.experience || '10+ Years'}</strong></span>
                  <span>Articles: <strong className="text-gray-800 dark:text-gray-200">{author.articlesCount || 12} Published</strong></span>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-[#0A4DA6]" />
                <span>Pilgrim Discussion & Comments ({comments?.length || 0})</span>
              </h3>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="space-y-3 p-5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <h5 className="font-bold text-xs text-[#0B192C] dark:text-white">Leave a Devotional Comment</h5>
                <input
                  type="text"
                  placeholder="Your Name (e.g. Ramesh Devotee)..."
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 text-xs font-bold focus:outline-none"
                />
                <textarea
                  rows={3}
                  placeholder="Share your spiritual thoughts or feedback on this article..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 text-xs font-medium focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Submit Comment
                </button>
              </form>

              {/* Comments List */}
              <div className="space-y-4">
                {comments?.map((c: any) => (
                  <div key={c._id} className="p-4 rounded-2xl bg-gray-50/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white font-extrabold text-xs flex items-center justify-center">
                          {c.userName.charAt(0)}
                        </div>
                        <h5 className="font-bold text-xs text-[#0B192C] dark:text-white">{c.userName}</h5>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[9px] font-black">
                          VERIFIED PILGRIM
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium pl-9">{c.comment}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Static Sidebar (Desktop Only - 1 Col) */}
          <div className="space-y-6">

            {/* Sidebar Author Card */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="text-center space-y-2">
                <img
                  src={author.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80'}
                  alt={author.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#0A4DA6] shadow-md mx-auto"
                />
                <h4 className="font-black text-base text-[#0B192C] dark:text-white flex items-center justify-center gap-1">
                  <span>{author.name}</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </h4>
                <p className="text-xs font-bold text-[#0A4DA6] dark:text-amber-400">{author.designation}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 font-medium">{author.bio}</p>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-3">
                <h5 className="font-black text-xs text-gray-400 uppercase tracking-wider">Related Articles</h5>
                <div className="space-y-3">
                  {relatedPosts?.map((item: any) => (
                    <div
                      key={item._id}
                      onClick={() => navigate(`/blog/${item.slug}`)}
                      className="flex gap-3 items-center group cursor-pointer"
                    >
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="space-y-0.5">
                        <h6 className="font-extrabold text-xs text-[#0B192C] dark:text-white line-clamp-2 group-hover:text-[#0A4DA6] transition-colors">
                          {item.title}
                        </h6>
                        <span className="text-[10px] text-gray-400 font-bold">{item.readingTime || '5 min read'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Book Ashram CTA Box */}
              <div className="bg-gradient-to-br from-[#0B192C] to-[#0A4DA6] text-white p-6 rounded-2xl space-y-3 text-center shadow-lg">
                <Sparkles size={24} className="text-amber-400 mx-auto" />
                <h5 className="font-black text-sm">Planning a Pilgrimage?</h5>
                <p className="text-xs text-blue-100 font-medium">Book verified ashram stays, satvik rooms & temple darshan online.</p>
                <button
                  onClick={() => navigate('/search')}
                  className="w-full py-2.5 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Explore Ashram Stays →
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* 4. Pre-Footer CTA Banner */}
        <div className="mt-12 bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white rounded-[32px] p-8 sm:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
          <div className="space-y-2 text-center md:text-left max-w-2xl">
            <span className="px-3.5 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-wider">
              Continue Your Sacred Journey
            </span>
            <h3 className="text-2xl sm:text-3xl font-black">
              Explore Verified Ashrams & Temple Circuits
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              Over 500+ verified ashrams, Char Dham circuits, and satvik bhojnalayas across Rishikesh, Varanasi, Haridwar & Vrindavan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-xl transition-all"
            >
              Book Ashram Stay
            </button>
            <button
              onClick={() => navigate('/blog')}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-black text-xs border border-white/20 backdrop-blur-md transition-all"
            >
              Explore More Articles
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
