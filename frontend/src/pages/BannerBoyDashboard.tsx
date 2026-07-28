import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  Bell,
  Clock,
  History,
  User,
  Sparkles,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface ChangeRequest {
  _id: string;
  page: string;
  section: string;
  title: string;
  oldValue: any;
  newValue: any;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  reason?: string;
  createdAt: string;
  approvedBy?: { name: string; email: string };
  rejectedBy?: { name: string; email: string };
}

export const BannerBoyDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'banners' | 'homepage' | 'media' | 'announcements' | 'pending' | 'activity' | 'profile'
  >('dashboard');

  const [myRequests, setMyRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Editor Form State
  const [selectedSection, setSelectedSection] = useState('hero_banner');
  const [editTitle, setEditTitle] = useState('Homepage Hero Banner Upgrade');
  const [heroHeading, setHeroHeading] = useState('Experience Divine Peace & Serenity at Sacred Ashrams');
  const [heroSubtitle, setHeroSubtitle] = useState('Book verified ashram stays, Mahakumbh 2026 packages, and Satvik dining across Haridwar, Rishikesh & Vrindavan.');
  const [bannerImageUrl, setBannerImageUrl] = useState('https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1600&q=80');
  const [ctaText, setCtaText] = useState('Explore Sacred Ashrams');
  const [announcementText, setAnnouncementText] = useState('🎉 Special 20% OFF on Mahakumbh 2026 Bookings — Use Code KUMBH2026');

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cms/my-requests');
      if (res.data?.success) {
        setMyRequests(res.data.data);
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        page: 'homepage',
        section: selectedSection,
        title: editTitle,
        oldValue: {
          heading: 'Default Tirvona Hero',
          bannerImage: '/banner/ashram_rishikesh.png',
        },
        newValue: {
          heading: heroHeading,
          subtitle: heroSubtitle,
          bannerImage: bannerImageUrl,
          ctaText,
          announcement: announcementText,
          updatedAt: new Date().toISOString(),
        },
      };

      const res = await api.post('/cms/request-change', payload);
      if (res.data?.success) {
        addNotification(
          'Change Submitted for Approval',
          'Your proposed edit has been routed to the Ashram Owner for review.',
          'info'
        );
        fetchMyRequests();
        setActiveTab('activity');
      }
    } catch (err) {
      addNotification('Submission Failed', getErrorMessage(err, 'Could not submit change request.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = myRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = myRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = myRequests.filter((r) => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* ── Sub-navigation Tab Bar ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-2 rounded-2xl flex flex-wrap gap-2 text-xs font-bold shadow-sm">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard size={14} /> Overview
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'banners'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <ImageIcon size={14} /> Banner Management
        </button>
        <button
          onClick={() => setActiveTab('homepage')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'homepage'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText size={14} /> Homepage CMS
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'media'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <FolderOpen size={14} /> Media Library
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'announcements'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell size={14} /> Announcements
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock size={14} /> Pending Approvals ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={14} /> My Activity
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-[#0A4DA6] text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <User size={14} /> CMS Profile
        </button>
      </div>

      {/* ── Top Welcome Card ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h1 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
            Welcome, {user?.name || 'BannerBoy'} 👋
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Enterprise CMS Portal — Manage website banners, hero titles, imagery, and announcements.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-gray-200 cursor-pointer"
        >
          Preview Live Website <ExternalLink size={14} />
        </a>
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards (Unified Enterprise Styling) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Submissions</span>
              <h3 className="text-2xl font-black text-[#0B192C] dark:text-white mt-1">{myRequests.length}</h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending Approvals</span>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Approved & Live</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Rejected Changes</span>
              <h3 className="text-2xl font-black text-rose-600 mt-1">{rejectedCount}</h3>
            </div>
          </div>

          {/* Quick Editor Form */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Enterprise CMS Content Editor
            </h3>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Target Page Section *</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-bold"
                  >
                    <option value="hero_banner">Homepage Hero Banner</option>
                    <option value="slider">Homepage Slider</option>
                    <option value="festival_banner">Festival Special Banner</option>
                    <option value="offer_banner">Offer Directory Banner</option>
                    <option value="announcement">Top Bar Announcement</option>
                    <option value="footer_text">Footer & Social Info</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Request Title *</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Hero Heading</label>
                <input
                  type="text"
                  value={heroHeading}
                  onChange={(e) => setHeroHeading(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Hero Subtitle</label>
                <textarea
                  rows={2}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Banner Image URL</label>
                  <input
                    type="text"
                    value={bannerImageUrl}
                    onChange={(e) => setBannerImageUrl(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">CTA Button Text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-[#0A4DA6] hover:bg-blue-700 text-white rounded-full font-black text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} /> Submit Change Request for Owner Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Banner Management / Homepage CMS / Announcements ── */}
      {(activeTab === 'banners' || activeTab === 'homepage' || activeTab === 'announcements' || activeTab === 'media') && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-5">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white capitalize">
                {activeTab.replace('_', ' ')} Studio
              </h3>
              <p className="text-xs text-gray-400">Propose new banners, image media, text, and promo announcements.</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-2xl text-xs space-y-2">
            <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={16} /> Content Change Workflow Active
            </span>
            <p className="text-gray-600 dark:text-gray-300">
              Any changes submitted from this section are saved as <strong>Pending Approval</strong> and forwarded to the Ashram Owner console. Once approved by the Owner, changes instantly publish to the live site.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-5 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer"
          >
            Open Editor in Overview Tab
          </button>
        </div>
      )}

      {/* ── Tab: Pending & Activity History ── */}
      {(activeTab === 'pending' || activeTab === 'activity') && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <History size={18} className="text-[#0A4DA6]" />
                {activeTab === 'pending' ? 'Pending Change Approvals' : 'My Submission Activity History'}
              </h3>
              <p className="text-xs text-gray-400">Track real-time status of your proposed homepage & banner edits.</p>
            </div>
            <button
              onClick={fetchMyRequests}
              className="p-2 text-gray-400 hover:text-[#0A4DA6] rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-bold">Loading submission history...</div>
          ) : myRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">No submission requests found.</div>
          ) : (
            <div className="space-y-3">
              {myRequests
                .filter((r) => (activeTab === 'pending' ? r.status === 'pending' : true))
                .map((req) => (
                  <div
                    key={req._id}
                    className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{req.title}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-200 dark:bg-slate-800 font-bold">
                          {req.section}
                        </span>
                      </div>
                      <p className="text-gray-500 font-mono text-[11px]">
                        Submitted: {new Date(req.createdAt).toLocaleString()}
                      </p>
                      {req.reason && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                          Owner Rejection Note: "{req.reason}"
                        </p>
                      )}
                    </div>

                    <div>
                      {req.status === 'pending' && (
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <Clock size={12} /> Pending Owner Review
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle size={12} /> Approved & Published
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <XCircle size={12} /> Rejected by Owner
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Profile ── */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4 max-w-md">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">BannerBoy CMS Profile</h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-400 block font-bold">Name:</span>
              <span className="font-extrabold text-sm">{user?.name}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-bold">Email:</span>
              <span className="font-mono text-sm">{user?.email}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-bold">Role:</span>
              <span className="font-bold text-amber-500 uppercase">{user?.role}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerBoyDashboard;
