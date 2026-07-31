import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CircleParking,
  BedDouble,
  KeyRound,
  RefreshCw,
  XCircle,
  ArrowRight,
  Ticket,
} from 'lucide-react';
import { EnterpriseButton, EnterpriseStatusBadge } from '../../admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { bookingService } from '../../services';
import { parkingBookingService } from '../../modules/parking/services/parking.service';
import { getErrorMessage } from '../../lib/api';
import useMyBookings, { type BookingCategory, type UnifiedBooking } from '../../hooks/useMyBookings';

const TABS: { key: BookingCategory; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const FALLBACK_IMAGE: Record<string, string> = {
  stay: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=400&q=80',
  parking: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=400&q=80',
};

/**
 * The visitor's bookings across every engine on the platform.
 *
 * Replaces the previous hardcoded sample list: stays and parking are now both
 * fetched live, merged, and split across the three tabs by real status.
 */
export const ProfileBookingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { bookings, loading, error, partialFailures, counts, refresh } = useMyBookings(Boolean(user));

  const [activeTab, setActiveTab] = useState<BookingCategory>('upcoming');
  const [kindFilter, setKindFilter] = useState<'all' | 'stay' | 'parking'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<UnifiedBooking | null>(null);

  const visible = useMemo(
    () =>
      bookings.filter(
        (b) => b.category === activeTab && (kindFilter === 'all' || b.kind === kindFilter),
      ),
    [bookings, activeTab, kindFilter],
  );

  /** Cancel through whichever engine owns the booking. */
  const handleCancel = async (booking: UnifiedBooking) => {
    if (cancellingId) return;
    const ok = window.confirm(
      `Cancel ${booking.reference}?\n\nAny refund due will follow the cancellation policy for this booking.`,
    );
    if (!ok) return;

    setCancellingId(booking.id);
    setActionError('');
    try {
      const res =
        booking.kind === 'parking'
          ? await parkingBookingService.cancel(booking.id, 'Cancelled from profile')
          : await bookingService.cancel(booking.id, 'Cancelled from profile');

      if (res.data?.success) await refresh();
      else setActionError(res.data?.message || 'Could not cancel this booking.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not cancel this booking.'));
    } finally {
      setCancellingId(null);
    }
  };

  // Signed out — the list is per-account, so there is nothing to show.
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <Calendar size={40} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h1 className="font-extrabold text-lg text-[#0B192C] dark:text-white">Sign in to see your bookings</h1>
          <p className="text-xs text-gray-400 font-medium">
            Your stays and parking reservations are tied to your Tirvona account.
          </p>
          <button
            onClick={() => navigate('/login?redirect=/profile/bookings')}
            className="bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-6 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-5">
        {/* Tabs — counts are live */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-full p-2 shadow-lg flex items-center justify-center gap-1 sm:gap-2 max-w-lg mx-auto text-[11px] sm:text-xs font-extrabold">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 sm:px-5 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#0A4DA6] text-white shadow-md'
                  : 'text-gray-500 hover:text-[#0B192C] dark:hover:text-white'
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {/* Type filter — only worth showing once both kinds exist */}
        {counts.stays > 0 && counts.parking > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {(
              [
                { key: 'all', label: `All (${counts.total})`, icon: Ticket },
                { key: 'stay', label: `Stays (${counts.stays})`, icon: BedDouble },
                { key: 'parking', label: `Parking (${counts.parking})`, icon: CircleParking },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setKindFilter(key)}
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  kindFilter === key
                    ? 'bg-[#0A4DA6] border-[#0A4DA6] text-white'
                    : 'bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]'
                }`}
              >
                <Icon size={12} className="stroke-[2.5]" />
                {label}
              </button>
            ))}
          </div>
        )}

        {(error || actionError) && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs font-semibold">{error || actionError}</p>
          </div>
        )}

        {/* One engine down — say so rather than silently under-reporting. */}
        {partialFailures.length > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs font-semibold">
              Your {partialFailures.join(' and ')} bookings could not be loaded, so this list may be incomplete.{' '}
              <button onClick={refresh} className="underline font-extrabold cursor-pointer">
                Retry
              </button>
            </p>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[28px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3">
            <Calendar className="mx-auto text-gray-300 dark:text-slate-700" size={40} />
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              No {activeTab} bookings
            </h3>
            <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
              {activeTab === 'upcoming'
                ? 'When you book an ashram stay or reserve parking, it will appear here.'
                : `You have no ${activeTab} bookings yet.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#083D85] transition-colors"
              >
                <BedDouble size={13} /> Find a Stay
              </Link>
              <Link
                to="/parking"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-[#0A4DA6] dark:text-blue-300 rounded-full text-xs font-bold hover:border-[#0A4DA6] transition-colors"
              >
                <CircleParking size={13} /> Book Parking
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((b) => (
              <article
                key={`${b.kind}-${b.id}`}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 sm:p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <img
                    src={b.image || FALLBACK_IMAGE[b.kind]}
                    alt={b.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_IMAGE[b.kind];
                    }}
                    className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-gray-100 dark:border-slate-800"
                  />

                  <div className="space-y-1 text-xs min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{b.reference}</span>
                      <EnterpriseStatusBadge status={b.status} />
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          b.kind === 'parking'
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-[#0A4DA6] dark:text-blue-300'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {b.kind === 'parking' ? <CircleParking size={10} /> : <BedDouble size={10} />}
                        {b.kind === 'parking' ? 'Parking' : 'Stay'}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-[#0B192C] dark:text-white leading-tight">{b.title}</h3>

                    {b.location && (
                      <p className="text-gray-500 font-medium flex items-center gap-1">
                        <MapPin size={12} className="text-[#E58C28] shrink-0" /> {b.location}
                      </p>
                    )}

                    <p className="text-gray-400 font-bold pt-1">
                      {b.kind === 'parking'
                        ? `${formatDateTime(b.start)} → ${formatDateTime(b.end)}`
                        : `${formatDate(b.start)} → ${formatDate(b.end)}`}
                      {b.meta ? ` • ${b.meta}` : ''}
                    </p>

                    {/* The desk code & assigned room number */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {b.checkInCode && (
                        <p className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black">
                          <KeyRound size={11} /> Check-in code: {b.checkInCode}
                        </p>
                      )}

                      {b.assignedRoomNumber && (
                        <p className="inline-flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-[10px] font-black">
                          <BedDouble size={11} /> Assigned: {b.assignedRoomNumber}
                        </p>
                      )}

                      {b.kind === 'stay' && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          Pay at Ashram ({b.paymentStatus || 'Pending'})
                        </span>
                      )}
                    </div>

                    {b.slotNumber && (
                      <p className="inline-flex items-center gap-1.5 mt-1.5 bg-blue-50 dark:bg-blue-950/50 text-[#0A4DA6] dark:text-blue-300 px-2.5 py-1 rounded-full text-[10px] font-black">
                        <CircleParking size={11} /> Bay {b.slotNumber}
                      </p>
                    )}

                    {b.specialRequests && (
                      <p className="text-[11px] text-gray-500 italic mt-1">
                        Note: {b.specialRequests}
                      </p>
                    )}

                    {b.category === 'cancelled' && (b.refundAmount ?? 0) > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                        ₹{b.refundAmount?.toLocaleString('en-IN')} refunded
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col justify-between items-end gap-3 w-full md:w-auto pt-3 md:pt-0 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">
                      {b.amountPaid > 0 ? 'Paid' : 'Payable at Ashram'}
                    </span>
                    <span className="text-lg font-black text-[#0A4DA6] dark:text-white">
                      ₹{(b.amountPaid > 0 ? b.amountPaid : b.amount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {b.kind === 'stay' && (
                      <>
                        <Link to={`/booking/${b.id}`}>
                          <EnterpriseButton
                            variant="primary"
                            size="sm"
                            className="gap-1.5 text-xs"
                          >
                            <ArrowRight size={14} /> Details
                          </EnterpriseButton>
                        </Link>
                        <EnterpriseButton
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setSelectedReceipt(b)}
                        >
                          <Ticket size={14} /> Receipt
                        </EnterpriseButton>
                      </>
                    )}

                    {b.kind === 'parking' && b.category !== 'cancelled' && (
                      <Link to={`/parking/booking/${b.id}`}>
                        <EnterpriseButton variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Ticket size={14} /> QR Pass
                        </EnterpriseButton>
                      </Link>
                    )}

                    {b.cancellable && (
                      <EnterpriseButton
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs !text-rose-600 !border-rose-200"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancel(b)}
                      >
                        {cancellingId === b.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Cancel
                      </EnterpriseButton>
                    )}

                    {b.category === 'completed' && b.detailHref && (
                      <Link to={b.detailHref}>
                        <EnterpriseButton variant="primary" size="sm" className="gap-1.5 text-xs">
                          <RefreshCw size={14} /> Book Again
                        </EnterpriseButton>
                      </Link>
                    )}

                    {b.category !== 'completed' && b.detailHref && b.kind === 'stay' && (
                      <Link to={b.detailHref}>
                        <EnterpriseButton variant="primary" size="sm" className="gap-1.5 text-xs">
                          View <ArrowRight size={13} />
                        </EnterpriseButton>
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Printable Booking Receipt Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-4 shadow-2xl relative text-left">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 cursor-pointer"
              >
                ✕
              </button>

              <div className="text-center pb-3 border-b border-gray-100 dark:border-slate-800 space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-[#0A4DA6]">Tirvona Sacred Stays</span>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">Reservation Summary & Receipt</h3>
                <p className="text-[10px] text-gray-400 font-bold">Payable upon arrival at Ashram</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">Booking ID:</span>
                  <span className="font-mono font-extrabold text-[#0B192C] dark:text-white">{selectedReceipt.reference}</span>
                </div>

                {selectedReceipt.reservationNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-bold">Reservation No:</span>
                    <span className="font-mono font-bold text-[#0A4DA6]">{selectedReceipt.reservationNumber}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">Ashram:</span>
                  <span className="font-extrabold text-[#0B192C] dark:text-white">{selectedReceipt.title}</span>
                </div>

                {selectedReceipt.assignedRoomNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-bold">Assigned Room:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">{selectedReceipt.assignedRoomNumber}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">Check-In / Out:</span>
                  <span className="font-semibold">{formatDate(selectedReceipt.start)} → {formatDate(selectedReceipt.end)}</span>
                </div>

                {selectedReceipt.checkInCode && (
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-bold">Check-In Code:</span>
                    <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{selectedReceipt.checkInCode}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">Payment Status:</span>
                  <span className="font-bold text-amber-600">Pending (Pay at Ashram)</span>
                </div>

                <div className="flex justify-between pt-2 border-t border-dashed border-gray-200 dark:border-slate-800 text-sm font-black">
                  <span>Total Amount:</span>
                  <span className="text-[#0A4DA6]">₹{selectedReceipt.amount?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold text-xs rounded-full cursor-pointer transition-all"
                >
                  Print Receipt
                </button>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-full cursor-pointer hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileBookingsPage;
