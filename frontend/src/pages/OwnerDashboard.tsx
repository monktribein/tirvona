import React, { useState, useEffect } from 'react';
import { analyticsService, bookingService, approvalService } from '../services';
import api, { getErrorMessage } from '../lib/api';
import { useNotifications } from '../contexts/NotificationContext';
import {
  TrendingUp,
  Bed,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  Star,
  Check,
  Sparkles,
  XCircle,
  Eye,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Plus,
  Send,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface CmsRequest {
  _id: string;
  page: string;
  section: string;
  title: string;
  oldValue: any;
  newValue: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  userId?: { name: string; email: string; phone: string; role: string };
}

export const OwnerDashboard: React.FC = () => {
  const { addNotification } = useNotifications();

  const [analytics, setAnalytics] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [pendingCmsRequests, setPendingCmsRequests] = useState<CmsRequest[]>([]);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Approval Workflow State ──
  const [categoryRequests, setCategoryRequests] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    maxGuests: 2,
    defaultAmenities: 'WiFi, Hot Water, Daily Prayers',
    suggestedBasePrice: 800,
    reasonForRequest: '',
    notes: '',
  });

  useEffect(() => {
    fetchDashboardData();
    fetchPendingCmsRequests();
    fetchCategoryRequests();
  }, []);

  const fetchCategoryRequests = async () => {
    try {
      const res = await approvalService.getRoomCategoryRequests();
      if (res.success) {
        setCategoryRequests(res.data);
      }
    } catch (err) {
      console.error('Error loading category requests:', err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    setSubmittingCategory(true);
    try {
      const res = await approvalService.submitRoomCategoryRequest({
        name: categoryForm.name.trim(),
        description: categoryForm.description,
        maxGuests: Number(categoryForm.maxGuests),
        defaultAmenities: categoryForm.defaultAmenities.split(',').map((s) => s.trim()).filter(Boolean),
        suggestedBasePrice: Number(categoryForm.suggestedBasePrice),
        reasonForRequest: categoryForm.reasonForRequest,
        notes: categoryForm.notes,
      });

      if (res.success) {
        addNotification(
          'Approval Request Submitted',
          `Request for room category "${categoryForm.name}" has been sent to Super Admin for approval.`,
          'success'
        );
        setIsCategoryModalOpen(false);
        setCategoryForm({
          name: '',
          description: '',
          maxGuests: 2,
          defaultAmenities: 'WiFi, Hot Water, Daily Prayers',
          suggestedBasePrice: 800,
          reasonForRequest: '',
          notes: '',
        });
        fetchCategoryRequests();
      }
    } catch (err) {
      console.error('Error submitting category request:', err);
      addNotification(
        'Submission Failed',
        getErrorMessage(err, 'Failed to submit room category request.'),
        'error'
      );
    } finally {
      setSubmittingCategory(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyticsService.dashboard();
      if (res.data.success) {
        setAnalytics(res.data.data);
      }

      const bookingsRes = await bookingService.dashboard();
      if (bookingsRes.data.success) {
        setRecentBookings(bookingsRes.data.data.slice(0, 8));
      }
    } catch (err) {
      console.error('Owner dashboard load error:', err);
      setError('Unable to load dashboard data. Please try again.');
      setAnalytics(null);
      setRecentBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCmsRequests = async () => {
    try {
      const res = await api.get('/cms/pending-approvals');
      if (res.data?.success) {
        setPendingCmsRequests(res.data.data);
      }
    } catch (err) {
      console.error('Fetch CMS pending error:', err);
    }
  };

  const handleApproveCms = async (id: string) => {
    try {
      const res = await api.post(`/cms/approve/${id}`, {});
      if (res.data?.success) {
        addNotification('CMS Content Approved', 'The proposed banner/content is now published live!', 'success');
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification('Action Failed', getErrorMessage(err, 'Could not approve CMS content edit.'), 'error');
    }
  };

  const handleRejectCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionModalId) return;

    try {
      const res = await api.post(`/cms/reject/${rejectionModalId}`, { reason: rejectionReason });
      if (res.data?.success) {
        addNotification('Request Rejected', 'Feedback has been sent back to BannerBoy.', 'warning');
        setRejectionModalId(null);
        setRejectionReason('');
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification('Action Failed', getErrorMessage(err, 'Could not reject CMS request.'), 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Enterprise Page Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center shrink-0 border border-[#0A4DA6]/15">
            <Bed size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white tracking-tight">
              Ashram Stay Admin Portal
            </h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Live telemetry, room occupancy, guest reservations, and pending CMS change approvals.
            </p>
          </div>
        </div>

        <span className="px-3.5 py-1.5 bg-[#E58C28]/15 text-[#E58C28] border border-[#E58C28]/30 rounded-full text-xs font-black uppercase tracking-wider">
          Verified Trust Portal
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-2xl">
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-3">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
              +12% MO.
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Gross Revenue</span>
            <h3 className="text-2xl font-black text-[#0B192C] dark:text-white mt-0.5">₹{analytics?.revenue || '0'}</h3>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-3">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[10px] font-black uppercase">
              TODAY
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Today's Revenue</span>
            <h3 className="text-2xl font-black text-[#0A4DA6] mt-0.5">₹{analytics?.todayRevenue || '0'}</h3>
          </div>
        </div>

        {/* Bed Occupancy */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-3">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Bed size={20} />
            </div>
            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase">
              OCCUPANCY
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Bed Occupancy Rate</span>
            <h3 className="text-2xl font-black text-[#0B192C] dark:text-white mt-0.5">{analytics?.occupancyRate || '0'}%</h3>
          </div>
        </div>

        {/* Available Rooms */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-3">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Check size={20} />
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
              VACANT
            </span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Available Rooms</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{analytics?.availableRooms || '0'} Rooms</h3>
          </div>
        </div>
      </div>

      {/* ── Pending Content Approvals (BannerBoy Workflow Console) ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-amber-200 dark:border-amber-900/50 p-6 rounded-[24px] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              Pending Content Approvals (CMS Workflow)
            </h3>
            <p className="text-xs text-gray-400">Review proposed banner & homepage changes submitted by BannerBoy.</p>
          </div>

          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black">
            {pendingCmsRequests.length} Pending Approval{pendingCmsRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        {pendingCmsRequests.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 font-medium">
            No pending CMS content approval requests.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingCmsRequests.map((req) => (
              <div
                key={req._id}
                className="p-4 bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/60 dark:border-slate-800 rounded-2xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{req.title}</span>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2">
                      <span>Submitted by: <strong>{req.userId?.name || 'BannerBoy'}</strong> ({req.userId?.email})</span>
                      <span>•</span>
                      <span>Section: <code className="font-bold text-amber-700 dark:text-amber-300">{req.section}</code></span>
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(req.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Old vs New Side-by-Side Diff Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Old Value */}
                  <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                      Current Live Version (Old)
                    </span>
                    <pre className="text-[11px] text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                      {JSON.stringify(req.oldValue || { note: 'Default system content' }, null, 2)}
                    </pre>
                  </div>

                  {/* New Proposed Value */}
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                        Proposed BannerBoy Version (New)
                      </span>
                      {req.newValue?.bannerWidth && (
                        <span className="px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 rounded text-[9px] font-mono font-bold">
                          {req.newValue.bannerWidth} × {req.newValue.bannerHeight} px ({req.newValue.bannerSizePreset || 'Custom'})
                        </span>
                      )}
                    </div>

                    {req.newValue?.bannerImage && (
                      <div className="w-full h-24 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-gray-100 dark:bg-slate-900">
                        <img
                          src={req.newValue.bannerImage}
                          alt="Proposed Banner"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <pre className="text-[11px] text-emerald-900 dark:text-emerald-200 font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                      {JSON.stringify(req.newValue, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Owner Actions */}
                <div className="flex justify-end items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setRejectionModalId(req._id);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XCircle size={14} /> Reject & Request Changes
                  </button>

                  <button
                    onClick={() => handleApproveCms(req._id)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <ShieldCheck size={14} /> Approve & Publish Live
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectionModalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectCms}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
              <XCircle size={18} /> Reject Proposed Content Change
            </h3>
            <div className="space-y-1 text-xs">
              <label className="font-bold text-gray-700 dark:text-gray-300">Feedback / Reason for Rejection *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Please update hero image resolution and revise discount details..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalId(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white rounded-full font-extrabold text-xs shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Room Category Approval Request Workflow (Stay Admin Console) ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
              <Bed size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                Room Category Approval Workflow
              </h3>
              <p className="text-xs text-gray-400">Request additional custom room categories for Super Admin review & approval.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-4 py-2 bg-[#0A4DA6] hover:bg-opacity-95 text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            <Plus size={14} /> Request New Room Category
          </button>
        </div>

        {/* Requests History List */}
        {categoryRequests.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400 font-semibold bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
            No room category requests submitted yet. Click "+ Request New Room Category" to initiate a request.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Request ID</th>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3">Max Guests</th>
                  <th className="py-2.5 px-3">Suggested Base Price</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Review Comment</th>
                </tr>
              </thead>
              <tbody>
                {categoryRequests.map((req) => (
                  <tr key={req._id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-bold text-[#0A4DA6]">{req.requestId}</td>
                    <td className="py-3 px-3 font-bold text-[#0B192C] dark:text-white">{req.categoryData?.name}</td>
                    <td className="py-3 px-3 font-semibold">{req.categoryData?.maxGuests} Guests</td>
                    <td className="py-3 px-3 font-bold">₹{req.categoryData?.suggestedBasePrice}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        req.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                        req.status === 'needs_modification' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      }`}>
                        {req.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400 max-w-xs truncate">{req.reviewComment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Request New Room Category Modal ── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                <Bed size={20} className="text-[#0A4DA6]" /> Request New Room Category
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe VIP Suite, Satsang Family Hall"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Max Guest Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={categoryForm.maxGuests}
                    onChange={(e) => setCategoryForm({ ...categoryForm, maxGuests: Number(e.target.value) })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Suggested Base Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={categoryForm.suggestedBasePrice}
                    onChange={(e) => setCategoryForm({ ...categoryForm, suggestedBasePrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Default Amenities (comma separated)
                </label>
                <input
                  type="text"
                  value={categoryForm.defaultAmenities}
                  onChange={(e) => setCategoryForm({ ...categoryForm, defaultAmenities: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Reason for Request *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this category is required for pilgrim lodging..."
                  value={categoryForm.reasonForRequest}
                  onChange={(e) => setCategoryForm({ ...categoryForm, reasonForRequest: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-5 py-2 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md hover:bg-opacity-95 disabled:opacity-50"
                >
                  {submittingCategory ? 'Submitting...' : 'Submit Request for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Bookings Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">Recent Ashram Stay Bookings</h3>
            <p className="text-xs text-gray-400">Live reservation traffic from pilgrims across ashrams.</p>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Pilgrim Name</th>
                <th className="py-3 px-4">Room Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((bk) => (
                <tr key={bk._id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-900/40">
                  <td className="py-3.5 px-4 font-bold text-[#0B192C] dark:text-white">{bk.bookingId}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold">{bk.customerId?.name}</span>
                      <span className="text-[10px] text-gray-400">{bk.customerId?.phone}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500">{bk.roomId?.name}</td>
                  <td className="py-3.5 px-4 font-extrabold text-[#0B192C] dark:text-white">₹{bk.pricing?.totalAmount}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold capitalize ${
                      bk.paymentStatus === 'fully_paid' ? 'bg-success/10 text-success' : 
                      bk.paymentStatus === 'refunded' ? 'bg-danger/10 text-danger' : 
                      'bg-yellow-50 text-yellow-750'
                    }`}>
                      {bk.paymentStatus?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold capitalize border ${
                      bk.status === 'confirmed' ? 'bg-primary/10 text-primary border-primary/20' : 
                      bk.status === 'checked_in' ? 'bg-success/10 text-success border-success/20' : 
                      bk.status === 'checked_out' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                      bk.status === 'cancelled' ? 'bg-danger/10 text-danger border-danger/20' : 
                      'bg-gray-100 text-gray-505 border-gray-200'
                    }`}>
                      {bk.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
          {recentBookings.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">No recent bookings.</div>
          ) : (
            recentBookings.map((bk) => (
              <div key={bk._id} className="py-4.5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-[#0B192C] dark:text-white">{bk.bookingId}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold capitalize border ${
                    bk.status === 'confirmed' ? 'bg-primary/10 text-primary border-primary/20' : 
                    bk.status === 'checked_in' ? 'bg-success/10 text-success border-success/20' : 
                    bk.status === 'checked_out' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                    bk.status === 'cancelled' ? 'bg-danger/10 text-danger border-danger/20' : 
                    'bg-gray-100 text-gray-550 border-gray-200'
                  }`}>
                    {bk.status}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Guest:</span>
                    <span className="font-semibold text-secondary dark:text-white">{bk.customerId?.name} ({bk.customerId?.phone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Room:</span>
                    <span className="text-gray-500 truncate max-w-[200px]">{bk.roomId?.name}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-50 dark:border-slate-850 items-center">
                    <span className="font-bold text-[#0B192C] dark:text-white">₹{bk.pricing?.totalAmount}</span>
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold capitalize ${
                      bk.paymentStatus === 'fully_paid' ? 'bg-success/10 text-success' : 
                      bk.paymentStatus === 'refunded' ? 'bg-danger/10 text-danger' : 
                      'bg-yellow-50 text-yellow-750'
                    }`}>
                      {bk.paymentStatus?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
