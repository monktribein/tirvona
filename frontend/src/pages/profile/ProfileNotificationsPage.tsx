import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ArrowLeft, CheckCircle2, Tag, Calendar } from 'lucide-react';

export const ProfileNotificationsPage: React.FC = () => {
  const notificationsList = [
    { title: 'Booking Confirmed!', desc: 'Swarg Ashram Divine Residency booking TVN-BK-88219 confirmed for Aug 10.', time: '2 hours ago', icon: <Calendar className="text-blue-500" size={16} /> },
    { title: 'Special Festival Coupon', desc: 'Use code YATRA20 to get 20% OFF on all Rishikesh spiritual stays.', time: '1 day ago', icon: <Tag className="text-amber-500" size={16} /> },
    { title: 'System Security Notice', desc: 'Your Tirvona Yatri Profile login was verified from a new device.', time: '3 days ago', icon: <CheckCircle2 className="text-emerald-500" size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <section className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-3 relative z-10">
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-white font-bold mb-2">
            <ArrowLeft size={14} /> Back to Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            Notification <span className="text-[#E58C28]">Center</span>
          </h1>
          <p className="text-xs text-blue-100/80 font-medium">Booking alerts, festival announcements, and security updates.</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white uppercase tracking-wider">All Notifications</h3>
            <button className="text-xs font-bold text-[#0A4DA6] hover:underline cursor-pointer">Mark All as Read</button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {notificationsList.map((n, idx) => (
              <div key={idx} className="py-4 flex items-start gap-4 text-xs">
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 rounded-2xl shrink-0">
                  {n.icon}
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-[#0B192C] dark:text-white">{n.title}</h4>
                  <p className="text-gray-500 font-medium">{n.desc}</p>
                  <span className="text-[10px] text-gray-400 font-bold block pt-1">{n.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileNotificationsPage;
