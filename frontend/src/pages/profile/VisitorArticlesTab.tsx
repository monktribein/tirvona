import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Edit3,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Sparkles,
  Eye,
  Heart,
  Loader2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Tag,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { EnterpriseButton, EnterpriseModal } from '../../admin/shared';
import { visitorArticleService, type EligibleBooking, type VisitorArticle } from '../../services/visitorArticleService';
import { useNotifications } from '../../contexts/NotificationContext';
import { getErrorMessage } from '../../lib/api';

const CATEGORIES = [
  'Experience',
  'Travel Guide',
  'Temple History',
  'Food',
  'Festivals',
  'Photography',
  'Videos',
];

const LANGUAGES = ['English', 'Hindi', 'Sanskrit', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati'];

export const VisitorArticlesTab: React.FC = () => {
  const { addNotification } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'all' | 'draft' | 'pending' | 'approved' | 'rejected'>('all');
  const [articles, setArticles] = useState<VisitorArticle[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Article Creation Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleBooking[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<EligibleBooking | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Experience');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [featuredImage, setFeaturedImage] = useState('https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80');
  const [galleryImagesStr, setGalleryImagesStr] = useState('');
  const [tagsStr, setTagsStr] = useState('Rishikesh, AshramStay, SatvikLiving');
  const [language, setLanguage] = useState('English');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyArticles();
  }, [activeSubTab]);

  const fetchMyArticles = async () => {
    setLoading(true);
    try {
      const res = await visitorArticleService.getMyArticles(activeSubTab === 'all' ? undefined : activeSubTab);
      if (res.data.success) {
        setArticles(res.data.data);
        setCounts(res.data.counts || {});
      }
    } catch (err) {
      console.error('Error loading articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWizard = async () => {
    setIsWizardOpen(true);
    setStep(1);
    setSelectedBooking(null);
    setLoadingEligible(true);

    try {
      const res = await visitorArticleService.getEligibleBookings();
      if (res.data.success) {
        setEligibleBookings(res.data.data);
      }
    } catch (err) {
      addNotification('Error', getErrorMessage(err, 'Failed to fetch completed bookings.'), 'error');
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleSelectBooking = (booking: EligibleBooking) => {
    if (booking.hasSubmittedArticle) {
      addNotification('Notice', 'You have already submitted an article for this completed stay.', 'info');
      return;
    }
    setSelectedBooking(booking);
    setStep(2);
  };

  const handleSubmitArticle = async (asDraft = false) => {
    if (!selectedBooking) return;
    if (!title.trim() || !shortDescription.trim() || !content.trim()) {
      addNotification('Missing Information', 'Please fill in Title, Description, and Content.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const galleryImages = galleryImagesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = tagsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await visitorArticleService.createArticle({
        bookingId: selectedBooking._id,
        title: title.trim(),
        category,
        shortDescription: shortDescription.trim(),
        content: content.trim(),
        featuredImage: featuredImage.trim(),
        galleryImages,
        tags,
        language,
        status: asDraft ? 'draft' : 'pending',
      });

      if (res.data.success) {
        addNotification('Success', res.data.message, 'success');
        setIsWizardOpen(false);
        resetForm();
        fetchMyArticles();
      }
    } catch (err) {
      addNotification('Submission Error', getErrorMessage(err, 'Could not save article.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('Experience');
    setShortDescription('');
    setContent('');
    setSelectedBooking(null);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
            <BookOpen className="text-[#0A4DA6]" size={22} />
            <span>My Articles & Blogs</span>
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            Share your verified ashram stay experience with the spiritual yatri community.
          </p>
        </div>

        <button
          onClick={handleOpenWizard}
          className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          <span>Write New Article</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-md flex items-center gap-1.5 overflow-x-auto text-xs font-extrabold scrollbar-none">
        {(['all', 'draft', 'pending', 'approved', 'rejected'] as const).map((st) => {
          const isActive = activeSubTab === st;
          const count = st === 'all' ? counts.total || 0 : counts[st] || 0;
          return (
            <button
              key={st}
              onClick={() => setActiveSubTab(st)}
              className={`px-4 py-2 rounded-xl capitalize transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#0A4DA6] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{st}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Articles Grid / List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-md">
          <FileText size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">No articles found in {activeSubTab}</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            After completing an Ashram stay, write an article to share your experience with fellow yatris!
          </p>
          <button
            onClick={handleOpenWizard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all shadow-md mt-2 cursor-pointer"
          >
            <Plus size={14} /> Write First Article
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((art) => (
            <div
              key={art._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800">
                  <img src={art.featuredImage} alt={art.title} className="w-full h-full object-cover" />
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40 dark:text-blue-300 rounded-full text-[10px] font-black uppercase">
                      {art.category}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                      art.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : art.status === 'pending'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        : art.status === 'rejected'
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
                    }`}>
                      {art.status === 'approved' && <CheckCircle2 size={11} />}
                      {art.status === 'pending' && <Clock size={11} />}
                      {art.status === 'rejected' && <XCircle size={11} />}
                      <span className="capitalize">{art.status === 'approved' ? 'Published' : art.status === 'pending' ? 'Pending Owner Approval' : art.status}</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white line-clamp-1">
                    {art.title}
                  </h3>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 font-medium">
                    {art.shortDescription}
                  </p>

                  <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1"><MapPin size={11} className="text-[#E58C28]" /> {art.ashramId?.name || 'Ashram Stay'}</span>
                    <span>• {new Date(art.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </p>

                  {art.status === 'rejected' && art.rejectionReason && (
                    <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-lg text-[11px] font-semibold border border-rose-100 dark:border-rose-900">
                      <strong>Rejection Reason:</strong> {art.rejectionReason}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                  <span className="flex items-center gap-1"><Eye size={13} className="text-emerald-500" /> {art.viewsCount || 0}</span>
                  <span className="flex items-center gap-1"><Heart size={13} className="text-rose-500" /> {art.likesCount || 0}</span>
                </div>

                {art.status === 'approved' && (
                  <a
                    href={`/blog/${art.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-black rounded-full transition-all flex items-center gap-1 shadow-xs"
                  >
                    <span>View Published</span>
                    <ArrowRight size={12} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2-Step Article Creation Modal */}
      <EnterpriseModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title={step === 1 ? 'Step 1: Select Verified Ashram Stay' : 'Step 2: Write Experience Article'}
        subtitle={step === 1 ? 'Choose from your completed stay bookings to link your article' : `Writing article for ${selectedBooking?.ashram?.name || 'Ashram Stay'}`}
      >
        {step === 1 ? (
          <div className="space-y-4">
            {loadingEligible ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 size={24} className="animate-spin text-[#0A4DA6] mx-auto" />
                <p className="text-xs font-bold text-gray-400">Checking completed stays...</p>
              </div>
            ) : eligibleBookings.length === 0 ? (
              <div className="p-6 text-center space-y-2 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                <AlertCircle size={24} className="mx-auto text-amber-600" />
                <h4 className="font-extrabold text-sm">No Completed Stays Found</h4>
                <p className="text-xs font-medium">
                  Articles can only be written for completed ashram stays. Once your stay booking status becomes completed, you can write an article here!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {eligibleBookings.map((b) => (
                  <div
                    key={b._id}
                    onClick={() => handleSelectBooking(b)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      b.hasSubmittedArticle
                        ? 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6] hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#0B192C] dark:text-white text-sm">{b.ashram?.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-[10px] font-black flex items-center gap-1">
                          <ShieldCheck size={11} /> Verified Stay
                        </span>
                      </div>
                      <p className="text-gray-400 font-semibold">
                        Booking ID: {b.bookingId} • Check-in: {new Date(b.checkInDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div>
                      {b.hasSubmittedArticle ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-extrabold rounded-full">
                          Article {b.existingArticleStatus}
                        </span>
                      ) : (
                        <span className="px-4 py-1.5 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-full">
                          Select Stay →
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitArticle(false); }} className="space-y-4 text-xs font-bold max-h-[75vh] overflow-y-auto pr-1">
            {/* Auto-filled Verified Stay Banner */}
            <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0A4DA6]" />
                <div>
                  <span className="font-extrabold text-[#0B192C] dark:text-white block">{selectedBooking?.ashram?.name}</span>
                  <span className="text-[10px] text-gray-400 font-semibold">Visit Date: {selectedBooking?.checkInDate ? new Date(selectedBooking.checkInDate).toLocaleDateString('en-IN') : 'Completed Stay'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[10px] text-[#0A4DA6] hover:underline font-extrabold"
              >
                Change Stay
              </button>
            </div>

            {/* Article Title */}
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">Article Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Essential Guide To Planning Your First Sacred Ashram Stay in Rishikesh"
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-extrabold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* Category & Language Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:border-[#0A4DA6]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:border-[#0A4DA6]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Short Description */}
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">Short Summary / Description *</label>
              <textarea
                rows={2}
                required
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A brief summary of your stay experience, etiquette tips, or daily schedule..."
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* Cover Image URL */}
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">Featured Cover Image URL *</label>
              <input
                type="url"
                required
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* Rich Text / Article Content */}
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">Article Content (Rich Text / Markdown Supported) *</label>
              <textarea
                rows={8}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article experience here... Support headings (###), bold, italic, quotes (>), and lists."
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium leading-relaxed focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            {/* Gallery Images & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">Gallery Images (Comma-separated URLs)</label>
                <input
                  type="text"
                  value={galleryImagesStr}
                  onChange={(e) => setGalleryImagesStr(e.target.value)}
                  placeholder="https://img1.jpg, https://img2.jpg"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="AshramStay, Rishikesh, SatvikLiving"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSubmitArticle(true)}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-black rounded-full cursor-pointer transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{submitting ? 'Submitting...' : 'Submit for Approval'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </EnterpriseModal>
    </div>
  );
};

export default VisitorArticlesTab;
