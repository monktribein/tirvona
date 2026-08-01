import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  BedDouble,
  KeyRound,
  Phone,
  Mail,
  ShieldCheck,
  Download,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Utensils,
  Ticket,
  HelpCircle,
} from 'lucide-react';
import { EnterpriseButton, EnterpriseStatusBadge } from '../../admin/shared';
import { bookingService } from '../../services';
import { getErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateIN, formatDateTimeIN } from '../../utils/format';

interface BookingDetailsData {
  _id: string;
  bookingId: string;
  reservationNumber?: string;
  status: string;
  paymentStatus: string;
  paymentMode?: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  roomsBookedCount: number;
  assignedRoomNumber?: string;
  checkInCode?: string;
  specialRequests?: string;
  ashramId?: {
    _id: string;
    name: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
    rules?: string[];
    images?: string[];
    contactPhone?: string;
    contactEmail?: string;
  };
  roomId?: {
    _id: string;
    name: string;
    acType?: string;
    type?: string;
  };
  customerId?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  pricing?: {
    basePrice?: number;
    servicesPrice?: number;
    donationAmount?: number;
    gstAmount?: number;
    platformFee?: number;
    totalAmount?: number;
    amountPaid?: number;
    totalSavings?: number;
  };
  services?: {
    selectedAddOns?: Array<{
      serviceId?: string;
      name: string;
      price: number;
      quantity: number;
      totalPrice: number;
    }>;
  };
  history?: Array<{
    status: string;
    updatedBy?: string;
    timestamp?: string;
  }>;
  cancellation?: {
    reason?: string;
    date?: string;
    refundAmount?: number;
    refundTransactionId?: string;
  };
}

export const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>('');

  const fetchBookingDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await bookingService.getById(id);
      if (res.data?.success && res.data?.data) {
        setBooking(res.data.data);
      } else {
        setError(res.data?.message || 'Booking details not found');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load booking details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const handleCancelBooking = async () => {
    if (!booking || cancelling) return;
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel booking ${booking.bookingId}?\n\nInventory will be released back to the ashram.`,
    );
    if (!confirmCancel) return;

    setCancelling(true);
    setCancelError('');
    try {
      const res = await bookingService.cancel(booking._id, 'Cancelled from Guest Booking Details');
      if (res.data?.success) {
        await fetchBookingDetails();
      } else {
        setCancelError(res.data?.message || 'Could not cancel booking.');
      }
    } catch (err) {
      setCancelError(getErrorMessage(err, 'Error cancelling booking.'));
    } finally {
      setCancelling(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="animate-spin text-[#0A4DA6] mb-3" size={36} />
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Loading reservation details...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] flex items-center justify-center p-6 text-left">
        <div className="max-w-md w-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-4 text-center">
          <AlertCircle size={44} className="text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-[#0B192C] dark:text-white">Booking Not Found</h2>
          <p className="text-xs text-gray-400 font-medium">{error || 'The requested booking could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/profile/bookings')}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> Return to My Bookings
          </button>
        </div>
      </div>
    );
  }

  const ashram = booking.ashramId;
  const room = booking.roomId;
  const pricing = booking.pricing;
  const ashramImage =
    ashram?.images && ashram.images.length > 0
      ? ashram.images[0]
      : 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=600&q=80';

  const isCancellable = booking.status === 'confirmed' || booking.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#0B192C] border-b border-gray-100 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile/bookings')}
              className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-[#0B192C] dark:hover:text-white transition-colors cursor-pointer"
              title="Back to My Bookings"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#0B192C] dark:text-white">
                  Booking #{booking.bookingId}
                </h1>
                <EnterpriseStatusBadge status={booking.status} />
              </div>
              <p className="text-xs text-gray-400 font-semibold">
                Ref: {booking.reservationNumber || booking._id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[#0B192C] dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Download size={14} /> Receipt
            </button>

            {isCancellable && (
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel Stay
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {cancelError && (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{cancelError}</span>
          </div>
        )}

        {/* ── Top Overview Banner: Ashram & Room ── */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-md flex flex-col md:flex-row gap-6 items-start">
          <img
            src={ashramImage}
            alt={ashram?.name || 'Ashram'}
            className="w-full md:w-56 h-44 rounded-2xl object-cover shrink-0 border border-gray-100 dark:border-slate-800 shadow-sm"
          />

          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full">
                Ashram Reservation
              </span>
              <span className="text-xs font-bold text-gray-400">
                Payment: <strong className="text-[#0B192C] dark:text-white capitalize">{booking.paymentStatus || 'Pending'}</strong>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white leading-tight">
              {ashram?.name || 'Ashram Stay'}
            </h2>

            {ashram?.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-start gap-1.5">
                <MapPin size={15} className="text-[#E58C28] shrink-0 mt-0.5" />
                <span>
                  {[ashram.address.street, ashram.address.city, ashram.address.state, ashram.address.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold">
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <BedDouble size={15} className="text-[#0A4DA6]" />
                <span>
                  <strong>Category:</strong> {room?.name || room?.type || 'Standard Room'}
                </span>
              </div>

              {booking.assignedRoomNumber ? (
                <div className="bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-extrabold">
                  <BedDouble size={15} />
                  <span>Assigned Room: {booking.assignedRoomNumber}</span>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                  <Clock size={14} />
                  <span>Room Number: Assigned at Front Desk</span>
                </div>
              )}

              {booking.checkInCode && (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-black">
                  <KeyRound size={15} />
                  <span>Check-in Code: {booking.checkInCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Grid: Stay Details & Pricing Breakdown ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Card: Dates, Guests & Add-Ons */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-5">
            <h3 className="font-black text-sm text-[#0B192C] dark:text-white uppercase tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
              Stay Schedule & Guests
            </h3>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Check-In</span>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white block mt-0.5">
                  {formatDateIN(booking.checkInDate)}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">Standard 12:00 PM</span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Check-Out</span>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white block mt-0.5">
                  {formatDateIN(booking.checkOutDate)}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">Standard 11:00 AM</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">Total Guests:</span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">{booking.guestsCount} Guest(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">Rooms Reserved:</span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">{booking.roomsBookedCount} Room(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">Payment Mode:</span>
                <span className="font-extrabold text-[#0B192C] dark:text-white uppercase">{booking.paymentMode || 'Pay at Ashram'}</span>
              </div>
              {booking.specialRequests && (
                <div className="pt-2">
                  <span className="text-gray-400 font-medium block mb-1">Special Requests / Notes:</span>
                  <p className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-900 dark:text-amber-200 font-medium italic">
                    "{booking.specialRequests}"
                  </p>
                </div>
              )}
            </div>

            {/* Add-on Services */}
            {booking.services?.selectedAddOns && booking.services.selectedAddOns.length > 0 && (
              <div className="pt-2 space-y-2">
                <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white flex items-center gap-1.5">
                  <Utensils size={14} className="text-[#0A4DA6]" /> Booked Add-On Services
                </h4>
                <div className="space-y-1.5">
                  {booking.services.selectedAddOns.map((addon, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-gray-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs font-semibold border border-gray-100 dark:border-slate-800"
                    >
                      <span>
                        {addon.name} x{addon.quantity}
                      </span>
                      <span className="font-black text-[#0A4DA6] dark:text-blue-300">
                        {formatCurrency(addon.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Card: Pricing Breakdown & Payment */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-black text-sm text-[#0B192C] dark:text-white uppercase tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
                Tariff & Payment Summary
              </h3>

              <div className="space-y-2.5 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Room Charges:</span>
                  <span className="text-[#0B192C] dark:text-white">{formatCurrency(pricing?.basePrice || 0)}</span>
                </div>
                {Boolean(pricing?.servicesPrice) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Add-On Services:</span>
                    <span className="text-[#0B192C] dark:text-white">{formatCurrency(pricing?.servicesPrice || 0)}</span>
                  </div>
                )}
                {Boolean(pricing?.donationAmount) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Seva / Ashram Donation:</span>
                    <span className="text-[#0B192C] dark:text-white">{formatCurrency(pricing?.donationAmount || 0)}</span>
                  </div>
                )}
                {Boolean(pricing?.totalSavings) && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                    <span>Discount / Offer Savings:</span>
                    <span>-{formatCurrency(pricing?.totalSavings || 0)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-400 font-bold block">Total Amount</span>
                  <span className="text-xl font-black text-[#0A4DA6] dark:text-blue-400">
                    {formatCurrency(pricing?.totalAmount || 0)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-bold block">Amount Paid</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(pricing?.amountPaid || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Ashram Contact & Emergency Box */}
            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-4 rounded-2xl space-y-2 text-xs">
              <h4 className="font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-[#0A4DA6]" /> Ashram Support & Emergency Contact
              </h4>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Phone: <strong className="text-[#0B192C] dark:text-white">{ashram?.contactPhone || '+91 98765 43210'}</strong>
              </p>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                24x7 Pilgrim Helpline: <strong className="text-[#0B192C] dark:text-white">1800-11-1363 / 112</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Booking Lifecycle Timeline ── */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-[#0B192C] dark:text-white uppercase tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
            Reservation Timeline & History
          </h3>

          <div className="relative pl-6 space-y-4 border-l-2 border-gray-100 dark:border-slate-800">
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0B192C]" />
              <p className="text-xs font-black text-[#0B192C] dark:text-white">Reservation Confirmed</p>
              <p className="text-[10px] text-gray-400 font-medium">Booking ID #{booking.bookingId} generated with status: {booking.status}</p>
            </div>

            {booking.history?.map((h, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-[#0A4DA6] border-2 border-white dark:border-[#0B192C]" />
                <p className="text-xs font-black text-[#0B192C] dark:text-white capitalize">{h.status.replace('_', ' ')}</p>
                <p className="text-[10px] text-gray-400 font-medium">
                  {h.timestamp ? formatDateTimeIN(h.timestamp) : 'Recorded'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailPage;
