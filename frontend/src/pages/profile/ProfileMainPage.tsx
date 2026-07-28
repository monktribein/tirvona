import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Calendar,
  Heart,
  Tag,
  CreditCard,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Edit3,
  Phone,
  Mail,
  Award,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { EnterpriseButton, EnterpriseModal } from '../../admin/shared';

export const ProfileMainPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { addNotification } = useNotifications();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || 'Sacred Pilgrim');
  const [editPhone, setEditPhone] = useState(user?.phone || '+91 98765 43210');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    addNotification('Profile Updated', 'Your profile details have been saved successfully!', 'success');
    setIsEditModalOpen(false);
  };

  const quickStats = [
    { label: 'Upcoming Stays', count: '2', to: '/profile/bookings', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { label: 'Completed Stays', count: '8', to: '/profile/bookings', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: 'Wishlist Ashrams', count: '5', to: '/profile/wishlist', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    { label: 'Active Coupons', count: '3', to: '/profile/coupons', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ];

  const recentActivity = [
    { title: 'Booking Confirmed at Swarg Ashram', location: 'Rishikesh', date: 'Jul 26, 2026', icon: <CheckCircle2 className="text-emerald-500" size={16} /> },
    { title: 'Added Parmarth Niketan to Wishlist', location: 'Rishikesh', date: 'Jul 24, 2026', icon: <Heart className="text-rose-500" size={16} /> },
    { title: 'Claimed Monks Special Promo Coupon (20% OFF)', location: 'System', date: 'Jul 20, 2026', icon: <Tag className="text-amber-500" size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      {/* Top Banner Header */}
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#E58C28]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto space-y-4 relative z-10">
          <span className="px-3.5 py-1 bg-[#E58C28]/20 text-[#E58C28] border border-[#E58C28]/35 rounded-full text-[10px] font-black uppercase tracking-wider">
            Enterprise Traveler Profile
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            My <span className="text-[#E58C28]">Spiritual Journey</span>
          </h1>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20 space-y-8">
        
        {/* User Hero Card */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0A4DA6] to-[#E58C28] p-1 shadow-lg shrink-0">
              <div className="w-full h-full rounded-full bg-white dark:bg-[#0B192C] flex items-center justify-center text-2xl font-black text-[#0A4DA6] uppercase">
                {user?.name?.[0] || 'P'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white leading-none">
                  {user?.name || 'Sacred Pilgrim'}
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Yatri
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Mail size={13} className="text-[#0A4DA6]" /> {user?.email || 'pilgrim@tirvona.com'}</span>
                <span className="flex items-center gap-1"><Phone size={13} className="text-[#0A4DA6]" /> {user?.phone || '+91 98765 43210'}</span>
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider pt-0.5">
                Member Since 2026 • Tirvona Spiritual Traveler
              </p>
            </div>
          </div>

          <EnterpriseButton
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="gap-2 shrink-0"
          >
            <Edit3 size={14} /> Edit Profile
          </EnterpriseButton>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickStats.map((stat, idx) => (
            <Link
              key={idx}
              to={stat.to}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all group"
            >
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black mb-2 ${stat.color}`}>
                {stat.count}
              </span>
              <div className="flex justify-between items-center text-xs font-extrabold text-[#0B192C] dark:text-white">
                <span>{stat.label}</span>
                <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        {/* Two-Column Grid: Quick Nav Links & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Profile Nav Sections (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-extrabold text-[#0B192C] dark:text-white uppercase tracking-wider">
              Profile Management & Quick Access
            </h3>

            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-lg divide-y divide-gray-100 dark:divide-slate-800 text-xs font-extrabold">
              <Link to="/profile/bookings" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] rounded-xl"><Calendar size={18} /></div>
                  <div>
                    <span className="text-[#0B192C] dark:text-white block">My Bookings & Stays</span>
                    <span className="text-[10px] text-gray-400 font-normal">View upcoming, completed, and cancelled reservations</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>

              <Link to="/profile/wishlist" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl"><Heart size={18} /></div>
                  <div>
                    <span className="text-[#0B192C] dark:text-white block">Wishlist & Saved Ashrams</span>
                    <span className="text-[10px] text-gray-400 font-normal">Saved spiritual stays and favorite temples</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>

              <Link to="/profile/coupons" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl"><Tag size={18} /></div>
                  <div>
                    <span className="text-[#0B192C] dark:text-white block">Coupons & Special Deals</span>
                    <span className="text-[10px] text-gray-400 font-normal">Active promo codes and seasonal discounts</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>

              <Link to="/profile/payments" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl"><CreditCard size={18} /></div>
                  <div>
                    <span className="text-[#0B192C] dark:text-white block">Payment History & Invoices</span>
                    <span className="text-[10px] text-gray-400 font-normal">Transaction receipts, GST invoices, & refunds</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>

              <Link to="/profile/settings" className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl"><Settings size={18} /></div>
                  <div>
                    <span className="text-[#0B192C] dark:text-white block">Account Settings</span>
                    <span className="text-[10px] text-gray-400 font-normal">Password, security options, and preferences</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>

              <button
                onClick={logout}
                className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl"><LogOut size={18} /></div>
                  <div>
                    <span className="block">Sign Out of Tirvona</span>
                    <span className="text-[10px] text-red-400 font-normal">Safely end your current session</span>
                  </div>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Right Column: Recent Activity & Support Callout (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-sm font-extrabold text-[#0B192C] dark:text-white uppercase tracking-wider">
              Recent Yatra Activity
            </h3>

            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-lg space-y-4">
              {recentActivity.map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0">
                  <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded-xl shrink-0">
                    {act.icon}
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <h4 className="font-extrabold text-[#0B192C] dark:text-white">{act.title}</h4>
                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                      <span>📍 {act.location}</span>
                      <span>• {act.date}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Need Yatra Assistance Card */}
            <div className="bg-gradient-to-r from-[#0A4DA6] to-[#0B192C] rounded-[28px] p-6 text-white space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-[#E58C28] text-xs font-black uppercase tracking-wider">
                <HelpCircle size={16} /> Need Yatra Assistance?
              </div>
              <h4 className="text-base font-black leading-tight">
                24x7 Sacred Yatra Support Team
              </h4>
              <p className="text-xs text-blue-100/80 leading-relaxed font-medium">
                Our support executives are available 24x7 to assist with your ashram bookings, special pujas, and transport.
              </p>
              <Link to="/support" className="inline-block px-4 py-2 bg-[#E58C28] text-white rounded-full text-xs font-extrabold hover:bg-[#d67e1f] transition-colors shadow-md">
                Contact Support Desk
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Profile Modal */}
      <EnterpriseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Yatri Profile"
        subtitle="Update your name and primary mobile number"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-bold">
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Full Name *</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-gray-300">Phone Number *</label>
            <input
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <EnterpriseButton variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" variant="primary">
              Save Changes
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  );
};

export default ProfileMainPage;
