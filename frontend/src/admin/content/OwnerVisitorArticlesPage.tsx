import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Calendar,
  MapPin,
  Eye,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { EnterpriseButton, EnterpriseModal, EnterpriseStatusBadge } from '../shared';
import { visitorArticleService, type VisitorArticle } from '../../services/visitorArticleService';
import { useNotifications } from '../../contexts/NotificationContext';
import { getErrorMessage } from '../../lib/api';

export const OwnerVisitorArticlesPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [articles, setArticles] = useState<VisitorArticle[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  // Selected Article Detail Modal / Review Drawer State
  const [selectedArticle, setSelectedArticle] = useState<VisitorArticle | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchOwnerArticles();
  }, [activeTab]);

  const fetchOwnerArticles = async () => {
    setLoading(true);
    try {
      const res = await visitorArticleService.getOwnerArticles(activeTab);
      if (res.data.success) {
        setArticles(res.data.data);
        setCounts(res.data.counts || {});
      }
    } catch (err) {
      console.error('Error loading owner visitor articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (article: VisitorArticle) => {
    setProcessing(true);
    try {
      const res = await visitorArticleService.reviewArticle(article._id, 'approve');
      if (res.data.success) {
        addNotification('Article Approved', `Article "${article.title}" is now published!`, 'success');
        setSelectedArticle(null);
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification('Error', getErrorMessage(err, 'Failed to approve article.'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle) return;
    if (!rejectionReason.trim()) {
      addNotification('Mandatory Field', 'Please provide a reason for rejecting this article.', 'error');
      return;
    }

    setProcessing(true);
    try {
      const res = await visitorArticleService.reviewArticle(selectedArticle._id, 'reject', rejectionReason.trim());
      if (res.data.success) {
        addNotification('Article Rejected', `Article status updated to rejected.`, 'info');
        setIsRejectModalOpen(false);
        setSelectedArticle(null);
        setRejectionReason('');
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification('Error', getErrorMessage(err, 'Failed to reject article.'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6 text-left">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
            <FileText className="text-[#0A4DA6]" size={24} />
            <span>Visitor Articles & Stories</span>
          </h1>
          <p className="text-xs text-gray-400 font-semibold">
            Review and manage experience articles submitted by verified ashram visitors.
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-sm flex items-center gap-2 overflow-x-auto text-xs font-extrabold">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === 'all' ? (counts.pending || 0) + (counts.approved || 0) + (counts.rejected || 0) : counts[tab] || 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl capitalize transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#0A4DA6] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab === 'all' ? 'All Submissions' : tab}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-sm">
          <FileText size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">No articles in {activeTab}</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            Visitor experience articles submitted for your Ashram will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((art) => (
            <div
              key={art._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800">
                  <img src={art.featuredImage} alt={art.title} className="w-full h-full object-cover" />
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-[10px] font-black flex items-center gap-1">
                      <ShieldCheck size={11} /> Verified Visitor Stay
                    </span>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40 dark:text-blue-300 rounded-full text-[10px] font-black uppercase">
                      {art.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                      art.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : art.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {art.status}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white line-clamp-1">
                    {art.title}
                  </h3>

                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-3">
                    <span>By: <strong className="text-[#0B192C] dark:text-white">{art.visitorId?.name || 'Visitor'}</strong></span>
                    <span>• Ashram: <strong className="text-[#0B192C] dark:text-white">{art.ashramId?.name}</strong></span>
                    <span>• Submitted: {new Date(art.createdAt).toLocaleDateString('en-IN')}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 border-gray-100 dark:border-slate-800 pt-3 md:pt-0">
                <button
                  onClick={() => setSelectedArticle(art)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-extrabold rounded-full transition-colors cursor-pointer"
                >
                  Inspect &amp; Review
                </button>

                {art.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(art)}
                      disabled={processing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-full transition-all cursor-pointer shadow-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setSelectedArticle(art); setIsRejectModalOpen(true); }}
                      disabled={processing}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-full transition-all cursor-pointer shadow-xs"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Article Detail Modal */}
      {selectedArticle && !isRejectModalOpen && (
        <EnterpriseModal
          isOpen={Boolean(selectedArticle)}
          onClose={() => setSelectedArticle(null)}
          title="Review Visitor Experience Article"
          subtitle={`Submitted for ${selectedArticle.ashramId?.name}`}
        >
          <div className="space-y-5 text-xs font-bold max-h-[75vh] overflow-y-auto pr-1 text-left">
            {/* Verified Booking Banner */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 dark:text-emerald-400 font-black uppercase text-[11px] flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Verified Stay Record
                </span>
                <span className="text-[10px] text-gray-500 font-mono">Booking ID: {selectedArticle.bookingId?.bookingId || 'Verified'}</span>
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Visitor: <strong>{selectedArticle.visitorId?.name}</strong> ({selectedArticle.visitorId?.email || 'Registered User'})
              </p>
            </div>

            {/* Title & Cover */}
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[#0B192C] dark:text-white leading-tight">
                {selectedArticle.title}
              </h2>
              <div className="h-48 w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800">
                <img src={selectedArticle.featuredImage} alt={selectedArticle.title} className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Short Description */}
            <div className="space-y-1">
              <span className="text-gray-400 uppercase text-[10px]">Short Description</span>
              <p className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-medium text-gray-700 dark:text-gray-200">
                {selectedArticle.shortDescription}
              </p>
            </div>

            {/* Full Content */}
            <div className="space-y-1">
              <span className="text-gray-400 uppercase text-[10px]">Article Body Content</span>
              <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl font-medium text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                {selectedArticle.content}
              </div>
            </div>

            {/* Gallery Images */}
            {selectedArticle.galleryImages?.length > 0 && (
              <div className="space-y-1">
                <span className="text-gray-400 uppercase text-[10px]">Uploaded Gallery Photos ({selectedArticle.galleryImages.length})</span>
                <div className="grid grid-cols-3 gap-2">
                  {selectedArticle.galleryImages.map((img, i) => (
                    <div key={i} className="h-24 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800">
                      <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 text-gray-500 font-bold"
              >
                Close Preview
              </button>

              {selectedArticle.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={processing}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-black cursor-pointer shadow-xs"
                  >
                    Reject Article
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(selectedArticle)}
                    disabled={processing}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>Approve &amp; Publish</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </EnterpriseModal>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedArticle && (
        <EnterpriseModal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title="Reject Visitor Article"
          subtitle="A mandatory reason is required to notify the visitor"
        >
          <form onSubmit={handleConfirmReject} className="space-y-4 text-xs font-bold text-left">
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">Rejection Reason *</label>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this article cannot be published (e.g. offensive content, incorrect details, low photo quality)..."
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-black shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default OwnerVisitorArticlesPage;
