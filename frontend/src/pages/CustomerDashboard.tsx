import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  MapPin, 
  Calendar, 
  Key, 
  Compass, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review states
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewError, setReviewError] = useState('');

  // Cancellation states
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Personal reasons / plan changed');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setBookings(res.data.data);
      }
    } catch (err) {
      console.error('History load error:', err);
      // Failover fallback mock stay
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    if (!reviewBookingId) return;

    try {
      const targetBooking = bookings.find((b) => b._id === reviewBookingId);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reviews`,
        {
          ashramId: targetBooking.ashramId._id || 'ashram-1',
          bookingId: reviewBookingId,
          rating: {
            overall: reviewRating,
            cleanliness: 5,
            service: 4,
            location: 5,
            valueForMoney: 4,
          },
          comment: reviewComment,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setReviewBookingId(null);
        setReviewComment('');
        addNotification('Review Submitted', 'Thank you for reviewing your spiritual stay!', 'success');
        fetchHistory();
      }
    } catch (err: any) {
      setReviewError(err.response?.data?.message || 'Error saving review');
    }
  };

  const handleCancelBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelBookingId) return;
    
    setCancelling(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/${cancelBookingId}/cancel`,
        { reason: cancelReason },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setCancelBookingId(null);
        addNotification('Stay Cancelled', 'Your reservation was successfully cancelled. Refund initiated.', 'success');
        fetchHistory();
      }
    } catch (err: any) {
      addNotification('Cancellation Error', err.response?.data?.message || 'Failed to cancel booking', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-card border border-border p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-[#0c1a30] dark:text-white">Welcome back, {user?.name}!</h2>
          <p className="text-xs text-gray-500 font-medium">View upcoming stays, present digital check-in passes, and review completed stays.</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-[#ff9933] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1 cursor-pointer">
          <Compass size={14} /> Book Another Stay
        </Link>
      </div>

      {loading ? (
        /* Loading skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(n => (
            <div key={n} className="h-44 bg-card border border-border rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-card border border-border rounded-3xl space-y-4">
          <Compass className="mx-auto text-gray-300 animate-spin" size={48} />
          <h4 className="font-extrabold text-base">No bookings yet</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            You do not have any active or past spiritual stays registered on the national database. Visit the search console to book a stay.
          </p>
          <Link to="/" className="inline-block px-5 py-2.5 bg-[#ff9933] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#e68a00] transition-colors">
            Find Stays
          </Link>
        </div>
      ) : (
        /* Bookings grid list */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookings.map((b) => {
            const isConfirmed = b.status === 'confirmed';
            const isPending = b.status === 'pending';
            const isCancelled = b.status === 'cancelled';
            const isCheckedOut = b.status === 'checked_out';
            const isRefunded = b.paymentStatus === 'refunded';

            return (
              <div key={b._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between transform hover:scale-[1.01] transition-transform duration-150">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white leading-snug">{b.ashramId?.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5 uppercase"><MapPin size={10} className="text-[#ff9933]" /> {b.ashramId?.address?.city}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold capitalize border ${
                    b.status === 'confirmed' ? 'bg-success/15 text-success border-success/30' :
                    b.status === 'checked_in' ? 'bg-primary/15 text-primary border-primary/30' :
                    b.status === 'checked_out' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                    b.status === 'cancelled' ? 'bg-danger/10 text-danger border-danger/20' :
                    'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {b.status}
                  </span>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Check In</span>
                    <span className="font-semibold flex items-center gap-1.5"><Calendar size={13} className="text-[#ff9933]" /> {new Date(b.checkInDate).toLocaleDateString()}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Check Out</span>
                    <span className="font-semibold flex items-center gap-1.5"><Calendar size={13} className="text-[#ff9933]" /> {new Date(b.checkOutDate).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Counter Pass Details */}
                {isConfirmed && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/15 border border-yellow-200/50 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-yellow-700 dark:text-yellow-400 font-extrabold block uppercase tracking-wider">Digital Check-in Pass</span>
                      <span className="text-[10px] text-gray-500 leading-normal">Present to receptionist on arrival</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-xl shadow-sm">
                      <Key size={14} className="text-accent" />
                      <span className="text-xs font-extrabold tracking-widest text-secondary dark:text-white">{b.checkInCode}</span>
                    </div>
                  </div>
                )}

                {/* Refund message if cancelled */}
                {isCancelled && isRefunded && (
                  <div className="p-3 bg-danger/5 border border-danger/15 rounded-2xl flex items-center gap-2 text-[10px] text-danger font-semibold">
                    <CheckCircle size={14} /> Refund of stay total cost processed back to source.
                  </div>
                )}

                {/* Footer price & actions */}
                <div className="pt-3 border-t border-border flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10 px-3 py-2.5 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Total Paid</span>
                    <span className="text-xs font-extrabold text-[#0c1a30] dark:text-accent">₹{b.pricing?.totalAmount}</span>
                  </div>
                  
                  {isCheckedOut && (
                    <button
                      onClick={() => setReviewBookingId(b._id)}
                      className="px-3.5 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-bold cursor-pointer"
                    >
                      Write Review
                    </button>
                  )}

                  {(isConfirmed || isPending) && (
                    <button
                      onClick={() => setCancelBookingId(b._id)}
                      className="px-3.5 py-1.5 bg-danger/10 text-danger border border-danger/20 rounded-xl text-[10px] font-bold cursor-pointer flex items-center gap-1 hover:bg-danger/15 transition-all"
                    >
                      <Trash2 size={12} /> Cancel Stay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dialog modal overlay */}
      {reviewBookingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleReviewSubmit} className="bg-card border border-border max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white border-b border-border pb-2">Review your Ashram stay</h3>
            
            {reviewError && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/25 text-xs rounded-xl font-bold">
                {reviewError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Overall Rating (1 - 5)</label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(parseInt(e.target.value))}
                className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value={5}>5 Stars (Excellent Stay)</option>
                <option value={4}>4 Stars (Very Good)</option>
                <option value={3}>3 Stars (Satisfactory)</option>
                <option value={2}>2 Stars (Needs Improvement)</option>
                <option value={1}>1 Star (Poor Experience)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Comments</label>
              <textarea
                required
                rows={3}
                placeholder="Share your spiritual stay feedback..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewBookingId(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#ff9933] hover:bg-[#e68a00] text-white rounded-xl text-xs font-bold cursor-pointer shadow"
              >
                Submit Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancellation Dialog modal overlay */}
      {cancelBookingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCancelBookingSubmit} className="bg-card border border-border max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border pb-2 text-danger">
              <AlertTriangle size={20} />
              <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white">Confirm Booking Cancellation</h3>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Are you sure you want to cancel your spiritual stay? A 100% refund of the paid stay total cost will be credited back to your original source account within 3-5 working days.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Reason for Cancellation</label>
              <textarea
                required
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full p-3 bg-background border border-border rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelBookingId(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                disabled={cancelling}
              >
                Go Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-danger text-white hover:bg-danger-hover rounded-xl text-xs font-bold cursor-pointer shadow"
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default CustomerDashboard;
