import React, { useState, useEffect } from 'react';
import { analyticsService, bookingService } from '../services';
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
  Check
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-danger/10 text-danger border border-danger/20 text-xs font-bold rounded-2xl">
          {error}
        </div>
      )}
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Gross Revenue */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Gross Revenue</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">₹{analytics?.revenue || '0'}</h3>
            <span className="text-[9px] text-success font-semibold flex items-center gap-0.5"><TrendingUp size={10} /> +12% this month</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Today's Revenue</span>
            <h3 className="text-2xl font-extrabold text-[#0A4DA6]">₹{analytics?.todayRevenue || '0'}</h3>
            <span className="text-[9px] text-gray-500 font-semibold">Immediate collection</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Bed Occupancy */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bed Occupancy</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">{analytics?.occupancyRate || '0'}%</h3>
            <span className="text-[9px] text-gray-500 font-medium">Of active physical rooms</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Bed size={20} />
          </div>
        </div>

        {/* Available Rooms */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Available Rooms</span>
            <h3 className="text-2xl font-extrabold text-success">{analytics?.availableRooms || '0'}</h3>
            <span className="text-[9px] text-gray-500 font-medium">Vacant clean rooms</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <Check size={20} />
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Bookings</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">{analytics?.totalBookings || '0'}</h3>
            <span className="text-[9px] text-gray-500 font-medium">Reservations logged</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
        </div>

        {/* Cancelled Bookings */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cancelled Bookings</span>
            <h3 className="text-2xl font-extrabold text-danger">{analytics?.cancelledBookings || '0'}</h3>
            <span className="text-[9px] text-gray-500 font-medium">Released back to inventory</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Average Rating</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1">
              <Star className="fill-[#D4AF37] text-[#D4AF37]" size={20} /> {analytics?.averageRating || '4.5'}
            </h3>
            <span className="text-[9px] text-gray-500 font-medium">From guest reviews</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-[#D4AF37] flex items-center justify-center">
            <Star size={20} />
          </div>
        </div>

        {/* Counter Unpaid */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Counter Unpaid</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">₹{analytics?.pendingPayments || '0'}</h3>
            <span className="text-[9px] text-danger font-medium">Awaiting cash/online pay</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

      </div>

      {/* Bookings ledger table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-55 dark:border-slate-800 pb-3">
          <CheckCircle size={16} className="text-success" /> Recent Bookings Ledger
        </h3>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Room Type</th>
                <th className="py-3 px-4">Bill Total</th>
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
