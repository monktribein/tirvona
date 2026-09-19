import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  KeyRound,
  LogIn,
  LogOut,
  IndianRupee,
  BedDouble,
  Users,
  ShieldCheck,
  X,
  CreditCard,
  Building,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  FileText,
  Filter,
  Check,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  Copy,
  CheckCheck,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  bookingService,
  ashramService,
  roomService,
  selfBookingService,
} from '../services';

type Booking = any;
type Room = any;

interface FrontdeskSummary {
  arrivalsToday: number;
  departuresToday: number;
  inHouseGuests: number;
  availableRooms: number;
  occupiedRooms: number;
  cleaningRooms: number;
  maintenanceRooms?: number;
  pendingCheckins: number;
  pendingCheckouts: number;
  todayRevenue: number;
  pendingPayments: number;
}

export interface ReceptionCheckinPageProps {
  initialTab?: string;
}

export const ReceptionCheckinPage: React.FC<ReceptionCheckinPageProps> = ({ initialTab }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state derived from URL or initialTab prop
  const currentTab = searchParams.get('tab') || initialTab || 'overview';
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Property & summary
  const [assignedAshram, setAssignedAshram] = useState<any>(null);
  const [summary, setSummary] = useState<FrontdeskSummary>({
    arrivalsToday: 0,
    departuresToday: 0,
    inHouseGuests: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    cleaningRooms: 0,
    maintenanceRooms: 0,
    pendingCheckins: 0,
    pendingCheckouts: 0,
    todayRevenue: 0,
    pendingPayments: 0
  });

  // Operational Lists
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals / Action States
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Check-In Modal State
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinBooking, setCheckinBooking] = useState<Booking | null>(null);
  const [checkinCode, setCheckinCode] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [guestAadhaar, setGuestAadhaar] = useState('');
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

  // Check-Out Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutAdditionalCharges, setCheckoutAdditionalCharges] = useState<number>(0);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // Collect Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Success / Alert toasts
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Walk-in Booking State
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingConfirmationData, setBookingConfirmationData] = useState<any | null>(null);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [newBookingSubmitting, setNewBookingSubmitting] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [newBookingForm, setNewBookingForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestIdType: 'aadhaar',
    guestIdNumber: '',
    guestAddress: '',
    checkInDate: todayStr,
    checkOutDate: tomorrowStr,
    guestsCount: 1,
    roomsBookedCount: 1,
    roomId: '',
    selectedRoomNumber: '',
    paymentMethod: 'cash',
    amountCollected: 0,
    paymentReference: '',
    specialRequests: ''
  });

  // Load frontdesk data
  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // 1. Fetch Property Details for reception
      const propertyId = String(user?.employerAshramId || (user?.scopedAshramIds && user.scopedAshramIds[0]) || '');
      let ashramData: any = user?.employerAshram;

      if (!ashramData && propertyId) {
        try {
          const res = await ashramService.getById(propertyId);
          ashramData = res?.data?.data || res?.data;
        } catch {
          // If public/manage fetch fails, proceed with available info
        }
      }
      setAssignedAshram(ashramData || { _id: propertyId, name: 'Hotel Krishna Anandam' });

      // 2. Fetch Frontdesk Summary Metrics
      try {
        const sumRes = await bookingService.frontdeskSummary(propertyId);
        const sumData = sumRes?.data?.data || sumRes?.data;
        if (sumData) {
          setSummary({
            arrivalsToday: sumData.todayArrivals ?? sumData.arrivalsToday ?? 0,
            departuresToday: sumData.todayDepartures ?? sumData.departuresToday ?? 0,
            inHouseGuests: sumData.currentInHouseGuests ?? sumData.inHouseGuests ?? 0,
            availableRooms: sumData.availableRooms ?? 0,
            occupiedRooms: sumData.occupiedRooms ?? 0,
            cleaningRooms: sumData.cleaningRooms ?? 0,
            maintenanceRooms: sumData.maintenanceRooms ?? 0,
            pendingCheckins: sumData.pendingCheckins ?? 0,
            pendingCheckouts: sumData.pendingCheckouts ?? 0,
            todayRevenue: sumData.todayExpectedRevenue ?? sumData.todayCollected ?? sumData.todayRevenue ?? 0,
            pendingPayments: sumData.pendingPaymentsAmount ?? sumData.pendingPayments ?? 0,
          });
        }
      } catch (sumErr) {
        console.warn('Could not fetch frontdesk summary:', sumErr);
      }

      // 3. Fetch Bookings for this property
      const queryParams: Record<string, string> = { limit: '100' };
      if (propertyId) queryParams.ashramId = propertyId;
      if (statusFilter !== 'all') queryParams.status = statusFilter;
      if (searchQuery.trim()) queryParams.search = searchQuery.trim();

      const bookingsRes = await bookingService.dashboard(queryParams);
      const list = bookingsRes?.data?.data || bookingsRes?.data || [];
      setBookings(Array.isArray(list) ? list : []);

      // 4. Fetch Rooms for room inventory & check-in assignment
      if (propertyId) {
        try {
          const managedRes = await ashramService.getManagedById(propertyId);
          const roomsList = managedRes?.data?.data?.rooms || managedRes?.data?.rooms || [];
          setRooms(roomsList);
        } catch (roomErr) {
          console.warn('Could not load rooms:', roomErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to load front desk data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load front desk operational records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getGuestName = (b: any): string => {
    if (!b) return 'Guest';
    return (
      b.customerName ||
      b.customerId?.name ||
      b.walkInGuest?.name ||
      b.user?.name ||
      b.customer?.name ||
      'Guest'
    );
  };

  const getGuestPhone = (b: any): string => {
    if (!b) return 'N/A';
    return (
      b.customerPhone ||
      b.customerId?.phone ||
      b.walkInGuest?.phone ||
      b.user?.phoneNumber ||
      b.customer?.phone ||
      'N/A'
    );
  };

  useEffect(() => {
    loadData();
  }, [user?.employerAshramId, statusFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Operational lists derived from bookings
  const availableRoomNumbersList = useMemo(() => {
    return rooms.filter(r => r.status === 'available' || !r.status);
  }, [rooms]);

  const arrivalsList = useMemo(() => {
    return bookings.filter(b => {
      const checkinDate = b.checkInDate ? new Date(b.checkInDate).toISOString().split('T')[0] : '';
      return (
        checkinDate === todayStr ||
        b.status === 'confirmed' ||
        b.status === 'payment_pending'
      );
    });
  }, [bookings, todayStr]);

  const departuresList = useMemo(() => {
    return bookings.filter(b => {
      const checkoutDate = b.checkOutDate ? new Date(b.checkOutDate).toISOString().split('T')[0] : '';
      return (
        (checkoutDate === todayStr && b.status === 'checked_in') ||
        (b.status === 'checked_in' && checkoutDate <= todayStr)
      );
    });
  }, [bookings, todayStr]);

  const inHouseList = useMemo(() => {
    return bookings.filter(b => b.status === 'checked_in');
  }, [bookings]);

  // Handlers for New Walk-In Booking
  const fetchAvailableCategories = async (checkIn: string, checkOut: string) => {
    const propertyId = String(user?.employerAshramId || (user?.scopedAshramIds && user.scopedAshramIds[0]) || '');
    if (!propertyId || !checkIn || !checkOut) return;
    try {
      setLoadingCategories(true);
      const res = await selfBookingService.availability({
        ashramId: propertyId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      const data = res?.data?.data || res?.data || [];
      const cats = Array.isArray(data) ? data : [];
      setAvailableCategories(cats);

      setNewBookingForm(prev => {
        const currentValid = cats.find(c => String(c.roomId) === String(prev.roomId));
        const selected = currentValid || cats.find(c => (c.availableCount || 0) > 0) || cats[0];
        if (selected) {
          const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
          const estTotal = (selected.sellingPrice || selected.basePrice || 0) * nights * prev.roomsBookedCount;
          return {
            ...prev,
            roomId: String(selected.roomId),
            amountCollected: estTotal,
          };
        }
        return prev;
      });
    } catch (err) {
      console.warn('Could not load available categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const openNewBookingModal = () => {
    setNewBookingForm({
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      guestIdType: 'aadhaar',
      guestIdNumber: '',
      guestAddress: '',
      checkInDate: todayStr,
      checkOutDate: tomorrowStr,
      guestsCount: 1,
      roomsBookedCount: 1,
      roomId: '',
      selectedRoomNumber: '',
      paymentMethod: 'cash',
      amountCollected: 0,
      paymentReference: '',
      specialRequests: '',
    });
    fetchAvailableCategories(todayStr, tomorrowStr);
    setShowNewBookingModal(true);
  };

  const handleNewBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = String(user?.employerAshramId || (user?.scopedAshramIds && user.scopedAshramIds[0]) || '');
    if (!propertyId) {
      alert('No property assigned to your reception user account.');
      return;
    }
    if (!newBookingForm.guestName.trim()) {
      alert('Guest Full Name is required.');
      return;
    }
    if (!newBookingForm.guestPhone.trim()) {
      alert('Guest Phone Number is required.');
      return;
    }
    if (!newBookingForm.roomId) {
      alert('Please select an available room category.');
      return;
    }

    try {
      setNewBookingSubmitting(true);
      const res = await selfBookingService.create({
        bookingType: 'self',
        ashramId: propertyId,
        roomId: newBookingForm.roomId,
        guestName: newBookingForm.guestName.trim(),
        guestPhone: newBookingForm.guestPhone.trim(),
        guestEmail: newBookingForm.guestEmail.trim() || undefined,
        guestIdType: newBookingForm.guestIdType,
        guestIdNumber: newBookingForm.guestIdNumber.trim() || undefined,
        guestAddress: newBookingForm.guestAddress.trim() || undefined,
        checkInDate: newBookingForm.checkInDate,
        checkOutDate: newBookingForm.checkOutDate,
        guestsCount: Number(newBookingForm.guestsCount || 1),
        roomsBookedCount: Number(newBookingForm.roomsBookedCount || 1),
        paymentMethod: newBookingForm.paymentMethod,
        amountCollected: Number(newBookingForm.amountCollected || 0),
        paymentReference: newBookingForm.paymentReference.trim() || undefined,
        specialRequests: newBookingForm.specialRequests.trim() || undefined,
      });

      const data = res?.data?.data;
      const bookingId = data?.id;

      // If reception pre-selected a specific room number, allocate it
      if (bookingId && newBookingForm.selectedRoomNumber.trim()) {
        try {
          await bookingService.assignRoomNumber(bookingId, [newBookingForm.selectedRoomNumber.trim()]);
        } catch (assignErr) {
          console.warn('Could not pre-allocate room number:', assignErr);
        }
      }

      const selectedCat = availableCategories.find(c => String(c.roomId) === String(newBookingForm.roomId));
      const nights = Math.max(1, Math.round((new Date(newBookingForm.checkOutDate).getTime() - new Date(newBookingForm.checkInDate).getTime()) / 86400000));
      const totalEstimated = (selectedCat?.sellingPrice || selectedCat?.basePrice || 0) * nights * newBookingForm.roomsBookedCount;

      setBookingConfirmationData({
        id: bookingId,
        bookingId: data?.bookingId || data?.reservationNumber || 'TRV-NEW',
        checkInCode: data?.checkInCode || '0000',
        guestName: newBookingForm.guestName.trim(),
        guestPhone: newBookingForm.guestPhone.trim(),
        checkInDate: newBookingForm.checkInDate,
        checkOutDate: newBookingForm.checkOutDate,
        guestsCount: newBookingForm.guestsCount,
        roomCategory: selectedCat?.name || 'Standard',
        assignedRoomNumber: newBookingForm.selectedRoomNumber.trim() || 'Not Assigned',
        status: data?.status || 'confirmed',
        amountPaid: Number(newBookingForm.amountCollected || 0),
        totalAmount: totalEstimated,
        paymentStatus: Number(newBookingForm.amountCollected || 0) >= totalEstimated && totalEstimated > 0 ? 'fully_paid' : Number(newBookingForm.amountCollected || 0) > 0 ? 'partially_paid' : 'pending',
        rawBooking: data?.booking || {
          _id: bookingId,
          bookingId: data?.bookingId,
          checkInCode: data?.checkInCode,
          customerName: newBookingForm.guestName.trim(),
          customerPhone: newBookingForm.guestPhone.trim(),
          checkInDate: newBookingForm.checkInDate,
          checkOutDate: newBookingForm.checkOutDate,
          status: 'confirmed',
          totalAmount: totalEstimated,
          paidAmount: Number(newBookingForm.amountCollected || 0),
          assignedRoomNumbers: newBookingForm.selectedRoomNumber.trim() ? [newBookingForm.selectedRoomNumber.trim()] : []
        }
      });

      setShowNewBookingModal(false);
      setShowConfirmationModal(true);
      setActionSuccess(`New Walk-In Booking created for ${newBookingForm.guestName}! Code: ${data?.checkInCode}`);
      await loadData(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to create booking.');
    } finally {
      setNewBookingSubmitting(false);
    }
  };

  const handleImmediateCheckinFromConfirmation = () => {
    if (!bookingConfirmationData) return;
    const targetBooking = bookingConfirmationData.rawBooking || {
      _id: bookingConfirmationData.id,
      bookingId: bookingConfirmationData.bookingId,
      customerName: bookingConfirmationData.guestName,
      customerPhone: bookingConfirmationData.guestPhone,
      checkInDate: bookingConfirmationData.checkInDate,
      checkOutDate: bookingConfirmationData.checkOutDate,
      checkInCode: bookingConfirmationData.checkInCode,
      status: 'confirmed',
      assignedRoomNumbers: bookingConfirmationData.assignedRoomNumber !== 'Not Assigned' ? [bookingConfirmationData.assignedRoomNumber] : []
    };

    setShowConfirmationModal(false);
    // Open checkin modal with code and room pre-filled
    setCheckinBooking(targetBooking);
    setCheckinCode(bookingConfirmationData.checkInCode || '');
    setSelectedRoomNumber(bookingConfirmationData.assignedRoomNumber !== 'Not Assigned' ? bookingConfirmationData.assignedRoomNumber : '');
    setCheckinNotes('Walk-in immediate check-in');
    setGuestAadhaar('');
    setShowCheckinModal(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handlers for Check-in
  const openCheckin = (booking: Booking) => {
    setCheckinBooking(booking);
    setCheckinCode(booking.checkInCode || '');
    setCheckinNotes('');
    setGuestAadhaar('');
    setSelectedRoomNumber(booking.assignedRoomNumbers?.[0] || '');
    setShowCheckinModal(true);
  };

  const handleConfirmCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinBooking) return;

    try {
      setCheckinSubmitting(true);
      await bookingService.checkin(checkinBooking._id, {
        checkInCode: checkinCode.trim() || checkinBooking.checkInCode || '0000',
        roomNumbers: selectedRoomNumber.trim() ? [selectedRoomNumber.trim()] : undefined,
        notes: [checkinNotes.trim(), guestAadhaar ? `Aadhaar/ID: ${guestAadhaar.trim()}` : '']
          .filter(Boolean)
          .join(' | ') || undefined
      });

      setActionSuccess(`Guest ${getGuestName(checkinBooking)} successfully checked in!`);
      setShowCheckinModal(false);
      setCheckinBooking(null);
      await loadData(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Check-in failed. Please verify the code/room.');
    } finally {
      setCheckinSubmitting(false);
    }
  };

  // Handlers for Check-out
  const openCheckout = (booking: Booking) => {
    setCheckoutBooking(booking);
    setCheckoutNotes('');
    setCheckoutAdditionalCharges(0);
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutBooking) return;

    try {
      setCheckoutSubmitting(true);
      await bookingService.checkout(checkoutBooking._id, {
        notes: checkoutNotes.trim() || undefined,
        additionalCharges: checkoutAdditionalCharges > 0 ? checkoutAdditionalCharges : undefined
      });

      setActionSuccess(`Check-out completed for ${getGuestName(checkoutBooking)}. Room marked for cleaning.`);
      setShowCheckoutModal(false);
      setCheckoutBooking(null);
      await loadData(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Check-out failed.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Handlers for Payment Collection at desk
  const openPaymentModal = (booking: Booking) => {
    setPaymentBooking(booking);
    const balance = (booking.totalAmount || 0) - (booking.paidAmount || 0);
    setPaymentAmount(Math.max(balance, 0));
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBooking) return;

    try {
      setPaymentSubmitting(true);
      try {
        await bookingService.pay(paymentBooking._id, {
          amount: paymentAmount,
          method: paymentMethod,
          paymentMode: paymentMethod,
          transactionId: `DESK-${Date.now()}`
        });
        setActionSuccess(`Recorded payment of ₹${paymentAmount.toLocaleString()} via ${paymentMethod.toUpperCase()}`);
      } catch {
        await bookingService.manualConfirm(paymentBooking._id, {
          amount: paymentAmount,
          notes: `Desk collection via ${paymentMethod}`
        });
        setActionSuccess(`Booking confirmed with desk payment of ₹${paymentAmount.toLocaleString()}`);
      }
      setShowPaymentModal(false);
      setPaymentBooking(null);
      await loadData(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to record desk payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header / Property Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl shadow-inner">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Front Desk Operations</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Duty
              </span>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Assigned Property:</span>
              <strong className="text-slate-800 font-semibold">
                {assignedAshram?.name || 'Hotel Krishna Anandam'}
              </strong>
              {assignedAshram?.city && (
                <span className="text-slate-400">({assignedAshram.city})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition shadow-sm active:scale-95 disabled:opacity-60"
            title="Sync latest front desk records"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Data'}</span>
          </button>

          <button
            onClick={openNewBookingModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold shadow-md shadow-indigo-500/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Booking</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          CIRCLE STYLE METRIC CARDS (Matches Image 3 Aesthetic with Circular Badges)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* 1. Collected / Today's Revenue */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 shadow-lg shadow-blue-600/15 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100/90">Collected Revenue</p>
              <h3 className="text-2xl lg:text-3xl font-black mt-2 tracking-tight">₹{summary.todayRevenue.toLocaleString()}</h3>
            </div>
            {/* Circle Badge */}
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-100">
            <span>Pending: ₹{summary.pendingPayments.toLocaleString()}</span>
            <span className="font-medium bg-white/20 px-2 py-0.5 rounded-full text-[10px]">Desk Total</span>
          </div>
          {/* Subtle Background Decorative Circle */}
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* 2. Today's Arrivals */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 shadow-lg shadow-emerald-600/15 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/90">Today's Arrivals</p>
              <h3 className="text-2xl lg:text-3xl font-black mt-2 tracking-tight">{summary.arrivalsToday}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
              <LogIn className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100">
            <span>Pending Check-in: {summary.pendingCheckins}</span>
            <button onClick={() => setTab('arrivals')} className="hover:underline flex items-center font-medium">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* 3. Today's Departures */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white p-5 shadow-lg shadow-rose-600/15 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-100/90">Departures Today</p>
              <h3 className="text-2xl lg:text-3xl font-black mt-2 tracking-tight">{summary.departuresToday}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
              <LogOut className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-rose-100">
            <span>Pending Check-out: {summary.pendingCheckouts}</span>
            <button onClick={() => setTab('departures')} className="hover:underline flex items-center font-medium">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* 4. Current In-House Guests */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 text-white p-5 shadow-lg shadow-purple-600/15 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-100/90">In-House Guests</p>
              <h3 className="text-2xl lg:text-3xl font-black mt-2 tracking-tight">{summary.inHouseGuests}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-purple-100">
            <span>Occupied Rooms: {summary.occupiedRooms}</span>
            <button onClick={() => setTab('in-house')} className="hover:underline flex items-center font-medium">
              Manage <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* 5. Free / Available Rooms */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 shadow-lg shadow-amber-600/15 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-100/90">Available Rooms</p>
              <h3 className="text-2xl lg:text-3xl font-black mt-2 tracking-tight">{summary.availableRooms}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">
              <BedDouble className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-amber-100">
            <span>Cleaning / Maint: {summary.cleaningRooms + (summary.maintenanceRooms || 0)}</span>
            <button onClick={() => setTab('rooms')} className="hover:underline flex items-center font-medium">
              Inventory <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
        </div>
      </div>

      {/* =========================================================================
          NAV TABS & SEARCH BAR
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/80 px-4 pt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: 'Front Desk Overview', icon: Sparkles },
              { id: 'arrivals', label: `Arrivals (${arrivalsList.length})`, icon: LogIn },
              { id: 'departures', label: `Departures (${departuresList.length})`, icon: LogOut },
              { id: 'in-house', label: `In-House (${inHouseList.length})`, icon: Users },
              { id: 'bookings', label: `All Bookings (${bookings.length})`, icon: Calendar },
              { id: 'rooms', label: `Room Status (${rooms.length})`, icon: BedDouble }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pb-3">
            {/* Search Input */}
            <div className="relative w-64 md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ref, guest, phone, room..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            {currentTab === 'bookings' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="payment_pending">Payment Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}
          </div>
        </div>

        {/* Content Body Based on Tab */}
        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <h4 className="text-base font-semibold text-slate-700">Loading operational records...</h4>
              <p className="text-sm text-slate-400 mt-1">Connecting to front desk repository</p>
            </div>
          ) : currentTab === 'rooms' ? (
            // ================= ROOM INVENTORY TAB =================
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Room Status & Live Inventory</h3>
                <span className="text-xs text-slate-500">Total Rooms: {rooms.length}</span>
              </div>
              {rooms.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold">No room inventory registered for this stay</p>
                  <p className="text-xs text-slate-400 mt-1">Contact Stay Owner to configure rooms.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {rooms.map(room => {
                    const isAvailable = room.status === 'available';
                    const isOccupied = room.status === 'occupied';
                    const isCleaning = room.status === 'cleaning' || room.status === 'maintenance';

                    return (
                      <div
                        key={room._id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isAvailable
                            ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300'
                            : isOccupied
                            ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                            : 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-black text-slate-800">
                            Room {room.roomNumber || room.name}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : isOccupied
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {room.status || 'Available'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{room.roomType || 'Standard'} • Capacity: {room.capacity || 2}</p>
                        <p className="text-xs font-bold text-slate-700 mt-2">₹{room.pricePerNight || room.basePrice || 0} / night</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // ================= BOOKINGS / ARRIVALS / DEPARTURES TABLE =================
            <div className="overflow-x-auto">
              {(() => {
                const targetList =
                  currentTab === 'arrivals'
                    ? arrivalsList
                    : currentTab === 'departures'
                    ? departuresList
                    : currentTab === 'in-house'
                    ? inHouseList
                    : bookings;

                if (targetList.length === 0) {
                  return (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-700 font-semibold text-base">
                        {currentTab === 'arrivals'
                          ? "No arrivals expected for today's filter"
                          : currentTab === 'departures'
                          ? "No guests scheduled for departure today"
                          : currentTab === 'in-house'
                          ? 'No guests currently checked-in in-house'
                          : 'No bookings found matching your search or filters'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Real-time bookings from the property will appear here automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                        <th className="py-3 px-4">Booking Ref</th>
                        <th className="py-3 px-4">Guest Details</th>
                        <th className="py-3 px-4">Dates</th>
                        <th className="py-3 px-4">Room & Guests</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Desk Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targetList.map(booking => {
                        const isCheckedIn = booking.status === 'checked_in';
                        const isCheckedOut = booking.status === 'checked_out';
                        const guestName = getGuestName(booking);
                        const guestPhone = getGuestPhone(booking);
                        const totalAmt =
                          (booking as any).pricing?.totalAmount ??
                          booking.totalAmount ??
                          0;
                        const paidAmt =
                          (booking as any).pricing?.amountPaid ??
                          booking.paidAmount ??
                          0;
                        const pendingAmount = Math.max(totalAmt - paidAmt, 0);
                        const roomName =
                          booking.assignedRoomNumbers?.length
                            ? `Room ${booking.assignedRoomNumbers.join(', ')}`
                            : (booking as any).rooms?.[0]?.roomId?.name ||
                              booking.roomType ||
                              'Standard';
                        const isConfirmed = booking.status === 'confirmed';

                        return (
                          <tr key={booking._id} className="hover:bg-indigo-50/30 transition-colors group">
                            {/* Booking Ref */}
                            <td className="py-4 px-4">
                              <span className="font-mono font-bold text-indigo-600 block">
                                {booking.bookingId || booking.reservationNumber || booking._id.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(booking.createdAt || Date.now()).toLocaleDateString()}
                              </span>
                            </td>

                            {/* Guest Details */}
                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-800">
                                {guestName}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{guestPhone}</span>
                              </div>
                            </td>

                            {/* Dates */}
                            <td className="py-4 px-4">
                              <div className="text-xs text-slate-700 font-medium">
                                In: {new Date(booking.checkInDate).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-slate-500">
                                Out: {new Date(booking.checkOutDate).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Room & Guests */}
                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <BedDouble className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{roomName}</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {booking.numberOfGuests || (booking as any).guestsCount || 1} Guest(s) • {(booking as any).roomsBookedCount || 1} Room(s)
                              </div>
                            </td>

                            {/* Payment */}
                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-800">
                                ₹{totalAmt.toLocaleString()}
                              </div>
                              <div className="text-xs mt-0.5">
                                {pendingAmount <= 0 ? (
                                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Paid
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium">
                                    Due: ₹{pendingAmount.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </td>


                            {/* Status */}
                            <td className="py-4 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                  isCheckedIn
                                    ? 'bg-purple-100 text-purple-800'
                                    : isCheckedOut
                                    ? 'bg-slate-100 text-slate-700'
                                    : isConfirmed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isCheckedIn
                                      ? 'bg-purple-500'
                                      : isCheckedOut
                                      ? 'bg-slate-400'
                                      : isConfirmed
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                {booking.status?.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Desk Actions */}
                            <td className="py-4 px-4 text-right space-x-2">
                              {/* Check-In Button if Confirmed */}
                              {!isCheckedIn && !isCheckedOut && (
                                <button
                                  onClick={() => openCheckin(booking)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition active:scale-95 inline-flex items-center gap-1"
                                >
                                  <LogIn className="w-3.5 h-3.5" />
                                  <span>Check In</span>
                                </button>
                              )}

                              {/* Check-Out Button if Checked In */}
                              {isCheckedIn && (
                                <button
                                  onClick={() => openCheckout(booking)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/20 transition active:scale-95 inline-flex items-center gap-1"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                  <span>Check Out</span>
                                </button>
                              )}

                              {/* Collect Payment Button if pending */}
                              {pendingAmount > 0 && (
                                <button
                                  onClick={() => openPaymentModal(booking)}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium transition active:scale-95 inline-flex items-center gap-1"
                                  title="Collect counter payment"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay</span>
                                </button>
                              )}

                              {/* View Details */}
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setShowDetailModal(true);
                                }}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                title="View full booking dossier"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CHECK-IN MODAL (Aadhaar / Room Assignment / Digital Pass validation)
          ========================================================================= */}
      {showCheckinModal && checkinBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Front Desk Check-In</h3>
                  <p className="text-xs text-emerald-100">Verify guest credentials and assign room</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckinModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckin} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Reference:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {checkinBooking.bookingId || checkinBooking._id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Guest:</span>
                  <span className="font-semibold text-slate-800">{getGuestName(checkinBooking)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="text-slate-700">{getGuestPhone(checkinBooking)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stay Duration:</span>
                  <span className="text-slate-700">
                    {new Date(checkinBooking.checkInDate).toLocaleDateString()} to {new Date(checkinBooking.checkOutDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* 4-Digit Check-in Pass / OTP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4-Digit Check-In Code / OTP *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={checkinCode}
                    onChange={e => setCheckinCode(e.target.value)}
                    placeholder="e.g. 4-digit verification OTP (e.g. 2639)"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the 4-digit code generated during booking creation
                </p>
              </div>

              {/* Room Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assign Room Number *
                </label>
                {availableRoomNumbersList.length > 0 ? (
                  <select
                    value={selectedRoomNumber}
                    onChange={e => setSelectedRoomNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">-- Select Available Room --</option>
                    {availableRoomNumbersList.map(r => (
                      <option key={r._id} value={r.roomNumber || r.name}>
                        Room {r.roomNumber || r.name} ({r.roomType || 'Standard'}) - Available
                      </option>
                    ))}
                  </select>
                ) : rooms.length > 0 ? (
                  <select
                    value={selectedRoomNumber}
                    onChange={e => setSelectedRoomNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">-- Select Room --</option>
                    {rooms.map(r => (
                      <option key={r._id} value={r.roomNumber || r.name}>
                        Room {r.roomNumber || r.name} ({r.roomType || 'Standard'}) - {r.status || 'Available'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedRoomNumber}
                    onChange={e => setSelectedRoomNumber(e.target.value)}
                    placeholder="e.g. 101, 102"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Aadhaar / ID Verification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Aadhaar / Govt ID Reference
                </label>
                <input
                  type="text"
                  value={guestAadhaar}
                  onChange={e => setGuestAadhaar(e.target.value)}
                  placeholder="Last 4 digits or ID number verified at desk"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Front Desk Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Front Desk Remarks / Notes
                </label>
                <input
                  type="text"
                  value={checkinNotes}
                  onChange={e => setCheckinNotes(e.target.value)}
                  placeholder="e.g. Early check-in approved, key issued"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCheckinModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkinSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {checkinSubmitting ? 'Checking In...' : 'Confirm & Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHECK-OUT MODAL (Pending settlement / Housekeeping release)
          ========================================================================= */}
      {showCheckoutModal && checkoutBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <LogOut className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Front Desk Check-Out</h3>
                  <p className="text-xs text-rose-100">Final bill review and room release for cleaning</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckout} className="p-6 space-y-4">
              {(() => {
                const total = (checkoutBooking as any).pricing?.totalAmount ?? checkoutBooking.totalAmount ?? 0;
                const paid = (checkoutBooking as any).pricing?.amountPaid ?? checkoutBooking.paidAmount ?? 0;
                const balance = Math.max(total - paid, 0);
                const guest = getGuestName(checkoutBooking);
                const roomStr =
                  checkoutBooking.assignedRoomNumbers?.length
                    ? `Room ${checkoutBooking.assignedRoomNumbers.join(', ')}`
                    : (checkoutBooking as any).rooms?.[0]?.roomId?.name ||
                      checkoutBooking.roomType ||
                      'Standard';

                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Guest:</span>
                      <span className="font-semibold text-slate-800">{guest}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room(s):</span>
                      <span className="font-bold text-slate-800">{roomStr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Bill Amount:</span>
                      <span className="font-semibold text-slate-800">₹{total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid:</span>
                      <span className="font-semibold text-emerald-600">₹{paid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-700 font-bold">Pending Balance:</span>
                      <span className="font-black text-rose-600">₹{balance.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Additional Incidentals / Charges */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Additional Food / Damage / Late Checkout Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={checkoutAdditionalCharges}
                  onChange={e => setCheckoutAdditionalCharges(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Checkout Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Check-out Remarks / Feedback
                </label>
                <input
                  type="text"
                  value={checkoutNotes}
                  onChange={e => setCheckoutNotes(e.target.value)}
                  placeholder="e.g. Keys returned, minibar cleared, satisfied stay"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {checkoutSubmitting ? 'Processing...' : 'Complete Check-Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAYMENT COLLECTION MODAL
          ========================================================================= */}
      {showPaymentModal && paymentBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Collect Desk Payment</h3>
                  <p className="text-xs text-amber-100">Record cash / UPI payment at counter</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="cash">Cash Counter</option>
                  <option value="upi">Desk UPI / QR Code</option>
                  <option value="card">Card POS Terminal</option>
                  <option value="netbanking">Direct Bank Transfer</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
                >
                  {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          BOOKING DETAILS MODAL / DOSSIER
          ========================================================================= */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Stay Booking Record</span>
                <h3 className="text-xl font-bold font-mono">
                  {selectedBooking.bookingId || selectedBooking.reservationNumber || selectedBooking._id}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const guestName = getGuestName(selectedBooking);
                const guestPhone = getGuestPhone(selectedBooking);
                const totalAmt =
                  (selectedBooking as any).pricing?.totalAmount ??
                  selectedBooking.totalAmount ??
                  0;
                const paidAmt =
                  (selectedBooking as any).pricing?.amountPaid ??
                  selectedBooking.paidAmount ??
                  0;
                const roomStr =
                  selectedBooking.assignedRoomNumbers?.length
                    ? `Room ${selectedBooking.assignedRoomNumbers.join(', ')}`
                    : (selectedBooking as any).rooms?.[0]?.roomId?.name ||
                      selectedBooking.roomType ||
                      'Standard';

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Guest Full Name</label>
                      <p className="text-sm font-bold text-slate-800">{guestName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Contact Phone</label>
                      <p className="text-sm font-bold text-slate-800">{guestPhone}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Check-In Date</label>
                      <p className="text-sm font-semibold text-slate-700">
                        {new Date(selectedBooking.checkInDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Check-Out Date</label>
                      <p className="text-sm font-semibold text-slate-700">
                        {new Date(selectedBooking.checkOutDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Assigned Room</label>
                      <p className="text-sm font-semibold text-slate-700">{roomStr}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Total Guests</label>
                      <p className="text-sm font-semibold text-slate-700">
                        {selectedBooking.numberOfGuests || (selectedBooking as any).guestsCount || 1} Person(s)
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Total Amount</label>
                      <p className="text-sm font-bold text-slate-800">₹{totalAmt.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold uppercase">Paid Amount</label>
                      <p className="text-sm font-bold text-emerald-600">₹{paidAmt.toLocaleString()}</p>
                    </div>
                    {selectedBooking.checkInCode && (
                      <div className="col-span-2 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Check-In Verification Code / OTP</span>
                          <span className="text-lg font-mono font-black text-amber-900 tracking-widest">{selectedBooking.checkInCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyCode(selectedBooking.checkInCode)}
                          className="px-2.5 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                        >
                          {copiedCode ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedBooking.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Front Desk / Guest Remarks</label>
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedBooking.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {selectedBooking.status === 'confirmed' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openCheckin(selectedBooking);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Check In Guest</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          NEW WALK-IN BOOKING MODAL
          ========================================================================= */}
      {showNewBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="p-6 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">New Walk-In Booking</h3>
                  <p className="text-xs text-indigo-100">
                    Front desk reservation for <strong>{assignedAshram?.name || 'Hotel Krishna Anandam'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewBookingModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleNewBookingSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Step 1: Dates & Occupancy */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> 1. Stay Schedule & Occupancy
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Check-In Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={newBookingForm.checkInDate}
                      onChange={e => {
                        const val = e.target.value;
                        setNewBookingForm(prev => ({ ...prev, checkInDate: val }));
                        fetchAvailableCategories(val, newBookingForm.checkOutDate);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Check-Out Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={newBookingForm.checkInDate || todayStr}
                      value={newBookingForm.checkOutDate}
                      onChange={e => {
                        const val = e.target.value;
                        setNewBookingForm(prev => ({ ...prev, checkOutDate: val }));
                        fetchAvailableCategories(newBookingForm.checkInDate, val);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Number of Guests *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="30"
                      value={newBookingForm.guestsCount}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestsCount: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Rooms Count *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10"
                      value={newBookingForm.roomsBookedCount}
                      onChange={e => {
                        const count = Number(e.target.value);
                        setNewBookingForm(prev => {
                          const cat = availableCategories.find(c => String(c.roomId) === String(prev.roomId));
                          const nights = Math.max(1, Math.round((new Date(prev.checkOutDate).getTime() - new Date(prev.checkInDate).getTime()) / 86400000));
                          const estTotal = (cat?.sellingPrice || cat?.basePrice || 0) * nights * count;
                          return { ...prev, roomsBookedCount: count, amountCollected: estTotal };
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Live Room Availability Categories */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5" /> 2. Real-Time Room Availability & Tariff
                  </h4>
                  {loadingCategories && (
                    <span className="text-xs text-indigo-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Checking live inventory...
                    </span>
                  )}
                </div>

                {availableCategories.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-500">No room categories found for selected stay dates.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableCategories.map(cat => {
                      const isSelected = String(newBookingForm.roomId) === String(cat.roomId);
                      const isAvailable = (cat.availableCount || 0) > 0;
                      const price = cat.sellingPrice || cat.basePrice || 0;
                      return (
                        <div
                          key={cat.roomId}
                          onClick={() => {
                            if (!isAvailable) return;
                            const nights = Math.max(1, Math.round((new Date(newBookingForm.checkOutDate).getTime() - new Date(newBookingForm.checkInDate).getTime()) / 86400000));
                            const estTotal = price * nights * newBookingForm.roomsBookedCount;
                            setNewBookingForm(prev => ({
                              ...prev,
                              roomId: String(cat.roomId),
                              amountCollected: estTotal
                            }));
                          }}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                              : isAvailable
                              ? 'bg-white border-slate-200 hover:border-indigo-300'
                              : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-bold text-sm text-slate-800 block">{cat.name}</span>
                              <span className="text-[11px] text-slate-500 font-medium capitalize">
                                {cat.type?.replace('_', ' ') || 'Standard'} • Capacity: {cat.capacity || 2}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isAvailable ? `${cat.availableCount} Available` : 'Sold Out'}
                            </span>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">Tariff per night:</span>
                            <span className="text-sm font-black text-slate-800">₹{price.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Optional Room Number Pre-Allocation */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Pre-Allocate Room Number (Optional - can also be assigned at Check-In)
                  </label>
                  <select
                    value={newBookingForm.selectedRoomNumber}
                    onChange={e => setNewBookingForm(prev => ({ ...prev, selectedRoomNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Assign Later at Check-In --</option>
                    {availableRoomNumbersList.map(r => (
                      <option key={r._id} value={r.roomNumber || r.name}>
                        Room {r.roomNumber || r.name} ({r.roomType || 'Standard'}) - Available
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 3: Guest Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 3. Guest Primary Identification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Guest Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Sharma"
                      value={newBookingForm.guestName}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestName: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={newBookingForm.guestPhone}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="guest@example.com"
                      value={newBookingForm.guestEmail}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Government ID Type
                    </label>
                    <select
                      value={newBookingForm.guestIdType}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestIdType: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="aadhaar">Aadhaar Card</option>
                      <option value="passport">Passport</option>
                      <option value="driving_license">Driving License</option>
                      <option value="voter_id">Voter ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      ID / Aadhaar Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Last 4 digits or full ID number"
                      value={newBookingForm.guestIdNumber}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestIdNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      City / Home Address (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. New Delhi, India"
                      value={newBookingForm.guestAddress}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, guestAddress: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Payment Collection */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> 4. Counter Payment Collection
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={newBookingForm.paymentMethod}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="cash">Cash Counter</option>
                      <option value="upi">Desk UPI / QR Code</option>
                      <option value="card">Card POS Terminal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Amount Collected (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newBookingForm.amountCollected}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, amountCollected: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Reference / Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Receipt #104, Cash Paid"
                      value={newBookingForm.paymentReference}
                      onChange={e => setNewBookingForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Special Requests / Front Desk Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ground floor preferred, early check-in requested"
                    value={newBookingForm.specialRequests}
                    onChange={e => setNewBookingForm(prev => ({ ...prev, specialRequests: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewBookingModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newBookingSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {newBookingSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Booking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Booking & Generate Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          BOOKING CONFIRMATION MODAL (4-DIGIT CODE + IMMEDIATE CHECK-IN SHORTCUT)
          ========================================================================= */}
      {showConfirmationModal && bookingConfirmationData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-center relative">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black">Walk-In Booking Confirmed!</h3>
              <p className="text-xs text-emerald-100 mt-0.5">Booking successfully persisted in the property inventory</p>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 4-DIGIT OTP / CHECK-IN CODE DISPLAY (Prominently Highlighted) */}
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300/80 text-center shadow-inner">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  4-Digit Check-In Verification Code
                </span>
                <div className="flex items-center justify-center gap-2 my-2.5">
                  {bookingConfirmationData.checkInCode.split('').map((digit: string, idx: number) => (
                    <div
                      key={idx}
                      className="w-12 h-14 rounded-xl bg-white border-2 border-amber-400 flex items-center justify-center text-2xl font-black font-mono text-slate-800 shadow-sm"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyCode(bookingConfirmationData.checkInCode)}
                    className="px-3 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                  >
                    {copiedCode ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Code Copied!' : 'Copy 4-Digit Code'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-amber-700/80 mt-2">
                  Guest provides this 4-digit code to reception for secure verification during Check-In
                </p>
              </div>

              {/* Booking Dossier Summary */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Reference:</span>
                  <span className="font-mono font-bold text-indigo-600 text-sm">
                    {bookingConfirmationData.bookingId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Guest Name:</span>
                  <span className="font-semibold text-slate-800">{bookingConfirmationData.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="text-slate-700">{bookingConfirmationData.guestPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stay Duration:</span>
                  <span className="text-slate-700">
                    {new Date(bookingConfirmationData.checkInDate).toLocaleDateString()} to {new Date(bookingConfirmationData.checkOutDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room Category:</span>
                  <span className="font-semibold text-slate-800">{bookingConfirmationData.roomCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room Allocated:</span>
                  <span className="font-bold text-slate-800">{bookingConfirmationData.assignedRoomNumber}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Total Tariff:</span>
                  <span className="font-bold text-slate-800">₹{bookingConfirmationData.totalAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-emerald-600">₹{bookingConfirmationData.amountPaid?.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirmationModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                >
                  Done
                </button>
                {/* Immediate Check-In Shortcut if checkInDate is today */}
                {bookingConfirmationData.checkInDate === todayStr && (
                  <button
                    type="button"
                    onClick={handleImmediateCheckinFromConfirmation}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Check In Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionCheckinPage;

