import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsService, approvalService } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import api, { getErrorMessage } from '../../../lib/api';
import {
  Building2,
  MapPin,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Award,
  Calendar as CalendarIcon,
  CheckCircle,
  Users,
  CreditCard,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sun,
  Server,
  Bell,
  Clock,
  Search,
  Plus,
  FileSpreadsheet,
  Layers as LayersIcon,
  ShieldAlert,
  HardDrive,
  Cpu,
  Database,
  Radio,
  FileText,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  Sparkles,
  Zap,
  Globe,
  Compass,
  Check,
  X,
  Tag,
  Star,
  Shield,
  ArrowRight,
  Building,
  Bus,
  Utensils,
  ShoppingBag,
  Camera
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [approvalStats, setApprovalStats] = useState<any>(null);
  const [pendingCmsRequests, setPendingCmsRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Interactive Tab States
  const [approvalTab, setApprovalTab] = useState<'ashrams' | 'owners' | 'banners' | 'blogs' | 'offers'>('banners');
  const [selectedHub, setSelectedHub] = useState<string>('Rishikesh');

  // Time State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchSystemStats();
    fetchPendingCmsRequests();
    fetchApprovalStats();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchApprovalStats = async () => {
    try {
      const res = await approvalService.getStats();
      if (res.success) {
        setApprovalStats(res.data);
      }
    } catch (err) {
      console.warn('Error fetching approval stats:', err);
    }
  };

  const fetchPendingCmsRequests = async () => {
    try {
      const res = await api.get('/cms/pending-approvals');
      if (res.data?.success) {
        setPendingCmsRequests(res.data.data);
      }
    } catch (err) {
      console.warn('Fetch CMS pending error:', err);
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

  const handleRejectCms = async (id: string) => {
    try {
      const res = await api.post(`/cms/reject/${id}`, { reason: 'Does not align with trust guidelines' });
      if (res.data?.success) {
        addNotification('Request Rejected', 'Feedback sent back to BannerBoy.', 'warning');
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification('Action Failed', getErrorMessage(err, 'Could not reject CMS request.'), 'error');
    }
  };

  const fetchSystemStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyticsService.system();
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('System stats load error:', err);
      setError('Unable to load real-time system statistics.');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hrs = currentTime.getHours();
    if (hrs < 12) return 'Good Morning';
    if (hrs < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Spiritual Hub Locations matching Landing Page Category Bar Pills
  const spiritualHubs = [
    { name: 'Rishikesh', district: 'Dehradun', state: 'Uttarakhand', verified: 142, pending: 8, rejected: 2, icon: <Compass size={18} /> },
    { name: 'Haridwar', district: 'Haridwar', state: 'Uttarakhand', verified: 186, pending: 12, rejected: 3, icon: <Building size={18} /> },
    { name: 'Vrindavan', district: 'Mathura', state: 'Uttar Pradesh', verified: 128, pending: 6, rejected: 1, icon: <Sparkles size={18} /> },
    { name: 'Mathura', district: 'Mathura', state: 'Uttar Pradesh', verified: 94, pending: 4, rejected: 0, icon: <MapPin size={18} /> },
    { name: 'Ayodhya', district: 'Ayodhya', state: 'Uttar Pradesh', verified: 215, pending: 15, rejected: 4, icon: <Award size={18} /> },
    { name: 'Kedarnath', district: 'Rudraprayag', state: 'Uttarakhand', verified: 48, pending: 3, rejected: 1, icon: <Globe size={18} /> },
    { name: 'Badrinath', district: 'Chamoli', state: 'Uttarakhand', verified: 52, pending: 2, rejected: 0, icon: <ShieldCheck size={18} /> },
  ];

  const activeHubDetails = spiritualHubs.find((h) => h.name === selectedHub) || spiritualHubs[0];

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto pb-12">
      {/* ── 1. HEADER BANNER (Matching Landing Page Hero Banner & Gradient Aesthetics) ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] rounded-[32px] p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-white/10"
      >
        <div className="absolute -right-10 -top-10 w-96 h-96 bg-[#E58C28]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1 bg-[#E58C28]/20 text-[#E58C28] rounded-full text-[10px] font-black uppercase tracking-wider border border-[#E58C28]/35 flex items-center gap-1.5 shadow-sm">
                <Radio size={12} className="animate-pulse text-emerald-400" /> Digital India Spiritual Engine
              </span>
              <span className="px-3.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                Live National Console
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {getGreeting()}, National Administrator <span className="align-middle">🙏</span>
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 font-medium max-w-xl leading-relaxed">
              Welcome back, <strong className="text-[#E58C28] font-bold">{user?.name || 'Administrator'}</strong> ({user?.role?.replace('_', ' ').toUpperCase()}). Overview of national ashram onboarding, verification queues, and live pilgrim telemetry.
            </p>
          </div>

          {/* Header Metadata Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/10 backdrop-blur-xl p-4 rounded-[22px] border border-white/15 shrink-0 text-xs shadow-inner">
            <div>
              <span className="text-[10px] text-blue-200 block font-bold uppercase tracking-wider">Date & Time</span>
              <span className="font-extrabold font-mono text-[#E58C28]">
                {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-blue-200 block font-bold uppercase tracking-wider">HQ Weather</span>
              <span className="font-bold flex items-center gap-1">
                <Sun size={14} className="text-[#E58C28]" /> 24°C Sunny
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-blue-200 block font-bold uppercase tracking-wider">System Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Server size={12} /> 99.98% Healthy
                </span>
              </div>
              <button
                onClick={() => navigate('/admin/users')}
                className="mt-2 px-3.5 py-1.5 bg-[#E58C28] hover:bg-amber-600 text-white font-black rounded-full text-[11px] flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all transform active:scale-95"
              >
                <Plus size={14} /> Create Account
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger border border-danger/20 text-xs font-bold rounded-2xl">
          {error}
        </div>
      )}

      {/* ── 2. KPI TELEMETRY CARDS (Styled Matching Featured Deal Cards in Landing Page Image 2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Verified Ashrams', value: stats?.ashrams?.approved || '1,248', tag: 'ACTIVE RETREATS', change: '+12.4%', isPos: true, icon: <ShieldCheck size={20} className="text-emerald-500" />, bg: 'bg-emerald-500/10' },
          { label: 'Pending Verification', value: stats?.ashrams?.pending || '34', tag: 'AUDIT QUEUE', change: '-5.2%', isPos: true, icon: <FileCheck size={20} className="text-[#0A4DA6]" />, bg: 'bg-[#0A4DA6]/10' },
          { label: 'Rejected Listings', value: stats?.ashrams?.rejected || '12', tag: 'NON-COMPLIANT', change: '-2.1%', isPos: false, icon: <AlertTriangle size={20} className="text-rose-500" />, bg: 'bg-rose-500/10' },
          { label: 'Bookings Today', value: '482', tag: 'YATRA STAYS', change: '+18.7%', isPos: true, icon: <CalendarIcon size={20} className="text-[#E58C28]" />, bg: 'bg-[#E58C28]/10' },
          { label: 'Revenue Today', value: '₹4,85,200', tag: 'DAILY REVENUE', change: '+22.1%', isPos: true, icon: <CreditCard size={20} className="text-purple-500" />, bg: 'bg-purple-500/10' },
          { label: 'New Registered Users', value: '1,890', tag: 'PILGRIM GROWTH', change: '+14.3%', isPos: true, icon: <Users size={20} className="text-blue-500" />, bg: 'bg-blue-500/10' },
          { label: 'Open Complaints', value: '8', tag: 'SUPPORT TICKETS', change: '-40.0%', isPos: true, icon: <MessageSquare size={20} className="text-teal-500" />, bg: 'bg-teal-500/10' },
          { label: 'Active Ashram Owners', value: '310', tag: 'TRUST OWNERS', change: '+8.5%', isPos: true, icon: <Building2 size={20} className="text-indigo-500" />, bg: 'bg-indigo-500/10' },
        ].map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-2xl transition-all relative overflow-hidden space-y-3"
          >
            {/* Top Tag Bar Matching Landing Page Deal Cards in Image 2 */}
            <div className="flex justify-between items-center">
              <span className="px-3 py-1 bg-[#E58C28] text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm">
                {card.tag}
              </span>
              <span
                className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${
                  card.isPos
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}
              >
                {card.change}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">{card.label}</span>
                <h3 className="text-2xl font-black text-[#0B192C] dark:text-white mt-0.5">{card.value}</h3>
              </div>
              <div className={`p-3 rounded-2xl ${card.bg}`}>{card.icon}</div>
            </div>

            {/* Mini SVG Trend Line Graph */}
            <div className="h-4 w-full pt-1 opacity-80">
              <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path
                  d="M0 15 Q25 5 50 12 T100 2"
                  fill="none"
                  stroke={card.isPos ? '#10B981' : '#F43F5E'}
                  strokeWidth="2.5"
                />
              </svg>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── CENTRAL APPROVAL CENTER HIGHLIGHT WIDGET ── */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] border border-[#0A4DA6]/40 p-6 rounded-[32px] text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-[#E58C28] border border-white/20 shrink-0">
            <FileCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 bg-[#E58C28] text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                APPROVAL CENTER
              </span>
              <span className="text-xs text-amber-300 font-bold">
                {approvalStats?.totalPending ?? 127} Requests Pending Review
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Central Platform Approval Queue
            </h3>
            <p className="text-xs text-blue-100/80 mt-0.5 max-w-xl">
              All structural ashram, room category, pricing, gallery, offer, and marketplace approval requests are centralized in a single workflow console.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/admin/approvals/all')}
          className="px-6 py-3 bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs rounded-full flex items-center gap-2 shadow-lg cursor-pointer transition-all transform active:scale-95 shrink-0"
        >
          View Approval Center <ArrowRight size={16} />
        </button>
      </div>

      {/* ── 3. CATEGORY PILL BAR SELECTOR (Matching Category Bar in Landing Page Image 2) ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-4 text-center">
        <div className="space-y-1">
          <span className="text-[#E58C28] font-bold text-xs uppercase tracking-wider block">Spiritual Circuits & Coverage</span>
          <h2 className="text-2xl font-black text-[#0B192C] dark:text-white tracking-tight">
            Explore Sacred <span className="bg-[#0A4DA6] text-white px-3.5 py-0.5 rounded-full inline-block font-black text-lg mx-1">Destinations</span> Telemetry
          </h2>
        </div>

        {/* Category Pill Buttons matching Image 2 Category Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {spiritualHubs.map((hub) => (
            <button
              key={hub.name}
              onClick={() => setSelectedHub(hub.name)}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                selectedHub === hub.name
                  ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25 font-black scale-105'
                  : 'bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100'
              }`}
            >
              <div className={`p-2 rounded-xl ${selectedHub === hub.name ? 'bg-white/20 text-white' : 'bg-gray-200/60 dark:bg-slate-800 text-[#0A4DA6]'}`}>
                {hub.icon}
              </div>
              <span className="text-xs">{hub.name}</span>
            </button>
          ))}
        </div>

        {/* Selected Hub Live Telemetry */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50/40 dark:from-slate-900 dark:to-slate-850 p-5 rounded-2xl border border-gray-150 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-left mt-4">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Selected Hub</span>
            <p className="font-extrabold text-[#0B192C] dark:text-white text-sm">{activeHubDetails.name}</p>
            <span className="text-gray-400 text-[10px]">{activeHubDetails.district}, {activeHubDetails.state}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-600 font-bold uppercase">Verified Ashrams</span>
            <p className="text-2xl font-black text-emerald-600">{activeHubDetails.verified}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-[#0A4DA6] font-bold uppercase">Pending Audits</span>
            <p className="text-2xl font-black text-[#0A4DA6]">{activeHubDetails.pending}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-rose-600 font-bold uppercase">Rejected Listings</span>
            <p className="text-2xl font-black text-rose-600">{activeHubDetails.rejected}</p>
          </div>
        </div>
      </div>

      {/* ── 4. MAIN ERP CONTENT GRID (Analytics Charts & System Health) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── Left 2 Columns: Analytics Charts & Performance ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Analytics Visual Panel */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#0A4DA6]" /> National Pilgrim Booking & Revenue Telemetry
                </h3>
                <p className="text-xs text-gray-400 font-semibold">Monthly Yatra booking density vs verified stay compliance</p>
              </div>
              <span className="px-3 py-1 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                FY 2026-27 Active
              </span>
            </div>

            {/* Custom Visual Bar Metrics */}
            <div className="space-y-4">
              {[
                { month: 'Apr (Chaitra Yatra)', bookings: 840, revenue: '₹84.2 Lakh', pct: 85 },
                { month: 'May (Char Dham Open)', bookings: 980, revenue: '₹98.5 Lakh', pct: 98 },
                { month: 'Jun (Hemkund Sahib Peak)', bookings: 760, revenue: '₹76.0 Lakh', pct: 76 },
                { month: 'Jul (Current Sravan Yatra)', bookings: 920, revenue: '₹92.4 Lakh', pct: 92 },
              ].map((m, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#0B192C] dark:text-gray-200">
                    <span>{m.month}</span>
                    <span className="font-black text-[#0A4DA6]">{m.bookings} Bookings ({m.revenue})</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-850 rounded-full h-3 overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-[#0A4DA6] via-[#E58C28] to-[#0A4DA6] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sub Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-slate-800 text-xs">
              <div className="p-3.5 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Weekly Traffic</span>
                <p className="font-extrabold text-[#0B192C] dark:text-white">142,500 Unique Visits</p>
              </div>
              <div className="p-3.5 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Approval Velocity</span>
                <p className="font-extrabold text-emerald-600 dark:text-emerald-400">96.4% Within 5 Days</p>
              </div>
              <div className="p-3.5 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Role Distribution</span>
                <p className="font-extrabold text-[#E58C28]">82% Pilgrims • 18% Trusts</p>
              </div>
            </div>
          </div>

          {/* ── 5. PENDING APPROVAL PANEL ── */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <LayersIcon size={18} className="text-[#0A4DA6]" /> Central Approval & Audit Queue
              </h3>
              <div className="flex gap-1.5">
                {[
                  { id: 'banners', label: `Banners (${pendingCmsRequests.length})` },
                  { id: 'ashrams', label: 'Ashrams (34)' },
                  { id: 'owners', label: 'Owners (12)' },
                  { id: 'blogs', label: 'Blogs (8)' },
                  { id: 'offers', label: 'Offers (4)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setApprovalTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                      approvalTab === t.id
                        ? 'bg-[#0A4DA6] text-white shadow-sm'
                        : 'bg-gray-50 dark:bg-slate-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pending List Items */}
            <div className="space-y-3">
            {approvalTab === 'banners' ? (
              pendingCmsRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-bold">
                  No pending banner change requests found.
                </div>
              ) : (
                pendingCmsRequests.map((req) => (
                  <div
                    key={req._id}
                    className="p-4 bg-amber-50/40 dark:bg-slate-900/60 rounded-2xl border border-amber-200/60 dark:border-slate-800 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{req.title}</span>
                        <p className="text-[11px] text-gray-500">
                          Submitted by <strong>{req.userId?.name || 'BannerBoy'}</strong> ({req.userId?.email}) • Section: <code className="font-bold text-amber-700">{req.section}</code>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.newValue?.bannerWidth && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-mono font-bold">
                            {req.newValue.bannerWidth} × {req.newValue.bannerHeight} px
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-gray-400">
                          {new Date(req.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {req.newValue?.bannerImage && (
                      <div className="w-full h-24 rounded-lg overflow-hidden border border-amber-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-900">
                        <img src={req.newValue.bannerImage} alt="Proposed Banner" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        onClick={() => handleRejectCms(req._id)}
                        className="px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <X size={12} /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveCms(req._id)}
                        className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-md"
                      >
                        <Check size={12} /> Approve & Publish Live
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              [
                { name: 'Parmarth Niketan Branch #2 (Rishikesh)', owner: 'Nakul Jain', submitted: '2 hours ago', code: 'ASH-8812' },
                { name: 'Ganga Kripa Dharamshala (Haridwar)', owner: 'Swami Vidyanand', submitted: '4 hours ago', code: 'ASH-8814' },
                { name: 'Shree Krishna Retreat (Vrindavan)', owner: 'Radha Trust Board', submitted: '6 hours ago', code: 'ASH-8819' },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#0B192C] dark:text-white">{item.name}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">{item.code}</span>
                    </div>
                    <p className="text-gray-400">Applicant: {item.owner} • Submitted {item.submitted}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addNotification('Preview Requested', `Opening preview for ${item.name}`, 'info')}
                      className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-bold text-[10px] cursor-pointer hover:bg-gray-50"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => addNotification('Listing Rejected', `Rejected ${item.name}`, 'warning')}
                      className="px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <X size={12} /> Reject
                    </button>
                    <button
                      onClick={() => addNotification('Listing Approved', `Approved ${item.name}`, 'success')}
                      className="px-5 py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-md shadow-[#0A4DA6]/20"
                    >
                      <Check size={12} /> Approve →
                    </button>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>

        </div>

        {/* ── Right Column (Sidebar Telemetry, Health & Activity) ── */}
        <div className="space-y-6">
          
          {/* ── 6. SYSTEM HEALTH PANEL ── */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" /> Infrastructure System Health
              </h3>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase">
                All Operational
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { name: 'Database (MongoDB Cluster)', status: 'Healthy', ping: '12ms', icon: <Database size={14} className="text-emerald-500" /> },
                { name: 'Redis Cache Layer', status: 'Healthy', ping: '2ms', icon: <Server size={14} className="text-emerald-500" /> },
                { name: 'Cloudinary CDN', status: 'Healthy', ping: '45ms', icon: <HardDrive size={14} className="text-emerald-500" /> },
                { name: 'SMS Gateway (NIC India)', status: 'Healthy', ping: '110ms', icon: <Radio size={14} className="text-emerald-500" /> },
                { name: 'CPU Load (Cloud Server)', status: '18% Utilized', ping: 'Healthy', icon: <Cpu size={14} className="text-blue-500" /> },
                { name: 'RAM Utilization', status: '34% Utilized', ping: 'Healthy', icon: <HardDrive size={14} className="text-blue-500" /> },
              ].map((sys, i) => (
                <div key={i} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-850">
                  <div className="flex items-center gap-2">
                    {sys.icon}
                    <span className="font-bold text-[#0B192C] dark:text-gray-200">{sys.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                    {sys.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 7. SECURITY CENTER ── */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-4">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <ShieldAlert size={16} className="text-rose-500" /> Security & Threat Monitor
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                <span className="text-[10px] text-rose-600 font-bold uppercase">Failed Login Attempts</span>
                <p className="text-lg font-black text-rose-700 dark:text-rose-300">2 (Past 1h)</p>
              </div>
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] text-[#E58C28] font-bold uppercase">Suspended Accounts</span>
                <p className="text-lg font-black text-amber-700 dark:text-amber-300">14 Active</p>
              </div>
            </div>
          </div>

          {/* ── 8. RECENT AUDIT TIMELINE ── */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg shadow-gray-200/40 space-y-4">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <Clock size={16} className="text-[#0A4DA6]" /> Live Audit Stream Timeline
            </h3>
            <div className="space-y-3.5 text-xs">
              {[
                { time: '10:14 AM', user: 'Nakul Jain', role: 'Owner', desc: 'Registered Parmarth Ashram #2 (Rishikesh)' },
                { time: '09:50 AM', user: 'District Magistrate', role: 'Govt Admin', desc: 'Approved Ganga Kripa inspection' },
                { time: '09:12 AM', user: 'Super Admin', role: 'Super Admin', desc: 'Updated Sravan Yatra Banner Slider' },
                { time: '08:45 AM', user: 'System Bot', role: 'Automated', desc: 'Reactivated 2 expired temp suspended users' },
              ].map((act, i) => (
                <div key={i} className="flex gap-3 items-start border-l-2 border-[#0A4DA6] pl-3 py-1">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#0B192C] dark:text-white">{act.user}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 font-bold rounded">
                        {act.role}
                      </span>
                    </div>
                    <p className="text-gray-400 text-[11px]">{act.desc}</p>
                    <span className="text-[10px] text-gray-400 font-mono block">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default AdminDashboard;
