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
  Plus,
  Bell,
  Send,
  MessageSquare,
  Trash2
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
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // Property scope: '' means every property the user can manage.
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const urlPropertyId = searchParams.get('property') || '';
  const selectedPropertyId =
    properties.length === 1
      ? String(properties[0]._id)
      : properties.some(p => String(p._id) === urlPropertyId)
      ? urlPropertyId
      : '';
  const setSelectedPropertyId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('property', id);
    else next.delete('property');
    setSearchParams(next);
  };

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Property & summary
  const assignedAshram = useMemo(
    () => properties.find(p => String(p._id) === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );
  const propertyLabel = (p: any) => (p ? `${p.name}${p.address?.city ? ` (${p.address.city})` : ''}` : '');
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
  const [dateFilter, setDateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

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
  const [newBookingPropertyId, setNewBookingPropertyId] = useState('');
  const [newBookingRooms, setNewBookingRooms] = useState<Room[]>([]);

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

  // =========================================================================
  // NOTICES & ALERTS STATE
  // =========================================================================
  interface FrontDeskNotice {
    id: string;
    title: string;
    category: 'handover' | 'notice' | 'maintenance' | 'guest';
    priority: 'normal' | 'high' | 'urgent';
    message: string;
    author: string;
    createdAt: string;
    acknowledged: boolean;
  }

  const [notices, setNotices] = useState<FrontDeskNotice[]>(() => {
    try {
      const saved = localStorage.getItem('tirvona_reception_notices');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'n-1',
        title: 'Shift Handover: Early Morning Darshan Arrivals',
        category: 'handover',
        priority: 'high',
        message: 'Expected VIP pilgrim arrivals tomorrow morning at 7:00 AM. Ensure Deluxe rooms on 1st floor are cleaned, inspected, and key tags are kept ready at the desk.',
        author: 'Reception Shift Lead',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        acknowledged: false,
      },
      {
        id: 'n-2',
        title: 'Mandatory Aadhaar & Govt Photo ID Verification',
        category: 'notice',
        priority: 'urgent',
        message: 'All guests checking in must provide Aadhaar or Govt ID. Record the last 4 digits in the Check-in verification modal before issuing physical keys.',
        author: 'Stay Management',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        acknowledged: false,
      },
      {
        id: 'n-3',
        title: 'Water Geyser & AC Maintenance Completed',
        category: 'maintenance',
        priority: 'normal',
        message: 'Facility maintenance has inspected and certified hot water geysers and AC units across all floors. All active rooms are fully ready for guest check-in.',
        author: 'Maintenance Desk',
        createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
        acknowledged: true,
      },
      {
        id: 'n-4',
        title: 'Late Checkout Policy Reminder',
        category: 'guest',
        priority: 'normal',
        message: 'Standard checkout time is 11:00 AM. In-house guests requesting checkout past 1:00 PM must be approved and billed under incidental charges.',
        author: 'Front Office Manager',
        createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
        acknowledged: true,
      }
    ];
  });

  const [showNewNoticeModal, setShowNewNoticeModal] = useState(false);
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<'all' | 'urgent' | 'handover' | 'notice' | 'maintenance'>('all');
  const [newNoticeForm, setNewNoticeForm] = useState({
    title: '',
    category: 'handover' as 'handover' | 'notice' | 'maintenance' | 'guest',
    priority: 'normal' as 'normal' | 'high' | 'urgent',
    message: '',
    author: user?.name || 'Reception Desk'
  });

  // Persist notices
  useEffect(() => {
    try {
      localStorage.setItem('tirvona_reception_notices', JSON.stringify(notices));
    } catch {
      // ignore
    }
  }, [notices]);

  const toggleAcknowledgeNotice = (id: string) => {
    setNotices(prev =>
      prev.map(n => (n.id === id ? { ...n, acknowledged: !n.acknowledged } : n))
    );
  };

  const deleteNotice = (id: string) => {
    setNotices(prev => prev.filter(n => n.id !== id));
  };

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeForm.title.trim() || !newNoticeForm.message.trim()) return;

    const newNotice: FrontDeskNotice = {
      id: `n-${Date.now()}`,
      title: newNoticeForm.title.trim(),
      category: newNoticeForm.category,
      priority: newNoticeForm.priority,
      message: newNoticeForm.message.trim(),
      author: newNoticeForm.author.trim() || user?.name || 'Reception Staff',
      createdAt: new Date().toISOString(),
      acknowledged: false,
    };

    setNotices(prev => [newNotice, ...prev]);
    setShowNewNoticeModal(false);
    setNewNoticeForm({
      title: '',
      category: 'handover',
      priority: 'normal',
      message: '',
      author: user?.name || 'Reception Desk'
    });
    setActionSuccess('Front desk notice posted successfully.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Load frontdesk data
  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // 1. Scope to the selected property, or to every property in the user's scope.
      const propertyId = selectedPropertyId;

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
      if (sourceFilter !== 'all') queryParams.source = sourceFilter;
      if (dateFilter) queryParams.date = dateFilter;
      if (searchQuery.trim()) queryParams.search = searchQuery.trim();

      const bookingsRes = await bookingService.dashboard(queryParams);
      const list = bookingsRes?.data?.data || bookingsRes?.data || [];
      // Newest bookings first, so a fresh walk-in shows at the top.
      const sorted = (Array.isArray(list) ? [...list] : []).sort(
        (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setBookings(sorted);

      // 4. Fetch Rooms for room inventory & check-in assignment (single property only)
      if (propertyId) {
        try {
          const managedRes = await ashramService.getManagedById(propertyId);
          const roomsList = managedRes?.data?.data?.rooms || managedRes?.data?.rooms || [];
          setRooms(roomsList);
        } catch (roomErr) {
          setRooms([]);
          console.warn('Could not load rooms:', roomErr);
        }
      } else {
        setRooms([]);
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

  // Load the properties this user may operate. Owners and super admins can
  // have several; a single-property user is pinned to that property.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: any[] = [];
      try {
        const res = await selfBookingService.ashrams();
        const data = res?.data?.data || res?.data || [];
        list = Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('Could not load properties:', err);
      }
      if (cancelled) return;
      setProperties(list);
      setPropertiesLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!propertiesLoaded) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertiesLoaded, selectedPropertyId, statusFilter, sourceFilter, dateFilter]);

  // Debounced search trigger
  useEffect(() => {
    if (!propertiesLoaded) return;
    const timer = setTimeout(() => {
      loadData(true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Operational lists derived from bookings
  const availableRoomNumbersList = useMemo(() => {
    return newBookingRooms.filter(r => r.status === 'available' || !r.status);
  }, [newBookingRooms]);

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

  // Operational system alerts
  const unpaidArrivalsList = useMemo(() => {
    return bookings.filter(b => {
      const total = b.pricing?.totalAmount ?? b.totalAmount ?? 0;
      const paid = b.pricing?.amountPaid ?? b.paidAmount ?? 0;
      return (total - paid) > 0 && (b.status === 'confirmed' || b.status === 'payment_pending');
    });
  }, [bookings]);

  const activeNoticesList = useMemo(() => {
    return notices.filter(n => {
      if (noticeCategoryFilter === 'all') return true;
      if (noticeCategoryFilter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
      return n.category === noticeCategoryFilter;
    });
  }, [notices, noticeCategoryFilter]);

  const unacknowledgedCount = useMemo(() => {
    return notices.filter(n => !n.acknowledged).length;
  }, [notices]);

  // Handlers for New Walk-In Booking
  const fetchAvailableCategories = async (checkIn: string, checkOut: string, propertyId: string = newBookingPropertyId) => {
    if (!propertyId || !checkIn || !checkOut) {
      setAvailableCategories([]);
      return;
    }
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
    const defaultProperty = selectedPropertyId || (properties.length === 1 ? String(properties[0]._id) : '');
    setAvailableCategories([]);
    changeNewBookingProperty(defaultProperty, todayStr, tomorrowStr);
    setShowNewBookingModal(true);
  };

  const changeNewBookingProperty = async (propertyId: string, checkIn: string, checkOut: string) => {
    setNewBookingPropertyId(propertyId);
    setNewBookingForm(prev => ({ ...prev, roomId: '', selectedRoomNumber: '', amountCollected: 0 }));
    setNewBookingRooms([]);
    fetchAvailableCategories(checkIn, checkOut, propertyId);
    if (!propertyId) return;
    if (propertyId === selectedPropertyId) {
      setNewBookingRooms(rooms);
      return;
    }
    try {
      const managedRes = await ashramService.getManagedById(propertyId);
      setNewBookingRooms(managedRes?.data?.data?.rooms || managedRes?.data?.rooms || []);
    } catch (roomErr) {
      console.warn('Could not load rooms for property:', roomErr);
    }
  };

  const handleNewBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = newBookingPropertyId;
    if (!propertyId) {
      alert('Please select the property for this booking.');
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
            <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-1">
              <span>Property:</span>
              {properties.length > 1 ? (
                <select
                  value={selectedPropertyId}
                  onChange={e => setSelectedPropertyId(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-xs"
                >
                  <option value="">All properties ({properties.length})</option>
                  {properties.map(p => (
                    <option key={p._id} value={String(p._id)}>
                      {propertyLabel(p)}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="text-slate-800 font-semibold">
                  {assignedAshram
                    ? propertyLabel(assignedAshram)
                    : propertiesLoaded
                    ? 'No property assigned'
                    : 'Loading...'}
                </strong>
              )}
            </div>
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
            <span>New Booking</span>
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
          ELEGANT FRONT DESK METRIC CARDS (Clean, High-Readability Tirvona Design)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* 1. Collected / Today's Revenue */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600 absolute top-0 left-0" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Collected Revenue</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">₹{summary.todayRevenue.toLocaleString()}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Pending: <strong className="text-rose-600">₹{summary.pendingPayments.toLocaleString()}</strong></span>
            <span className="font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">Desk Total</span>
          </div>
        </div>

        {/* 2. Today's Arrivals */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Arrivals</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">{summary.arrivalsToday}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <LogIn className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Pending Check-in: <strong className="text-slate-800">{summary.pendingCheckins}</strong></span>
            <button onClick={() => setTab('arrivals')} className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center font-bold">
              View <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* 3. Today's Departures */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Departures Today</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">{summary.departuresToday}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <LogOut className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Pending Check-out: <strong className="text-slate-800">{summary.pendingCheckouts}</strong></span>
            <button onClick={() => setTab('departures')} className="text-rose-600 hover:text-rose-700 hover:underline flex items-center font-bold">
              View <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* 4. Current In-House Guests */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 to-purple-600 absolute top-0 left-0" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">In-House Guests</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">{summary.inHouseGuests}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100/80 flex items-center justify-center text-purple-600 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Occupied Rooms: <strong className="text-slate-800">{summary.occupiedRooms}</strong></span>
            <button onClick={() => setTab('in-house')} className="text-purple-600 hover:text-purple-700 hover:underline flex items-center font-bold">
              Manage <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* 5. Free / Available Rooms */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Rooms</p>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tracking-tight">{summary.availableRooms}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Cleaning / Maint: <strong className="text-slate-800">{summary.cleaningRooms + (summary.maintenanceRooms || 0)}</strong></span>
            <button onClick={() => setTab('rooms')} className="text-amber-600 hover:text-amber-700 hover:underline flex items-center font-bold">
              Inventory <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
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
              { id: 'rooms', label: `Room Status (${rooms.length})`, icon: BedDouble },
              { id: 'notifications', label: 'Notices & Alerts', icon: Bell, count: unacknowledgedCount + unpaidArrivalsList.length }
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
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-indigo-600 text-white' : 'bg-rose-500 text-white animate-pulse'
                    }`}>
                      {tab.count}
                    </span>
                  )}
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

            {currentTab !== 'rooms' && currentTab !== 'notifications' && (
              <>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  title="Show bookings staying on this date"
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Sources</option>
                  <option value="tirvona">Online (Tirvona)</option>
                  <option value="self">Walk-in / Desk</option>
                </select>
                {(dateFilter || sourceFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setDateFilter('');
                      setSourceFilter('all');
                      setStatusFilter('all');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear filters
                  </button>
                )}
              </>
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
          ) : currentTab === 'notifications' ? (
            // ================= NOTICES & ALERTS CENTER =================
            <div className="space-y-6">
              {/* Notices Header & Quick Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-md">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-xl font-black tracking-tight">Front Desk Notices & Shift Alerts</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Internal shift handover notes, management circulars, and live operational alerts for front office staff.
                  </p>
                </div>

                <button
                  onClick={() => setShowNewNoticeModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition active:scale-95 self-start sm:self-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Post Desk Notice</span>
                </button>
              </div>

              {/* Notice Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'all', label: 'All Notices' },
                  { id: 'urgent', label: '🚨 Urgent / High Priority' },
                  { id: 'handover', label: '📋 Shift Handover' },
                  { id: 'notice', label: '📢 Management Circulars' },
                  { id: 'maintenance', label: '🛠️ Housekeeping & Maintenance' }
                ].map(fTab => (
                  <button
                    key={fTab.id}
                    onClick={() => setNoticeCategoryFilter(fTab.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                      noticeCategoryFilter === fTab.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {fTab.label}
                  </button>
                ))}
              </div>

              {/* Live System Operational Alerts */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Live Operational Duty Alerts ({unpaidArrivalsList.length + departuresList.length})</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Unpaid arrivals alert */}
                  {unpaidArrivalsList.length > 0 ? (
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 font-bold">
                        ₹
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-slate-900">Pending Payment Arrivals</h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 uppercase">
                            {unpaidArrivalsList.length} Guests
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {unpaidArrivalsList.length} incoming guest(s) have unpaid balances due for counter collection upon arrival.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => setTab('arrivals')}
                            className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-1"
                          >
                            <span>Review Pending Arrivals</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-3 text-emerald-800 text-xs font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span>All arrival bookings have completed advance settlements. No overdue check-in payments.</span>
                    </div>
                  )}

                  {/* Today's Departures Alert */}
                  {departuresList.length > 0 ? (
                    <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/90 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-slate-900">Check-Outs Due Today</h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-200 text-blue-900 uppercase">
                            {departuresList.length} Pending
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {departuresList.length} in-house guest(s) scheduled for departure today. Settle final bills and collect keys.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => setTab('departures')}
                            className="text-xs font-bold text-blue-800 hover:underline flex items-center gap-1"
                          >
                            <span>Process Check-Outs</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-slate-600 text-xs font-medium">
                      <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <span>No pending departures scheduled for remainder of today's duty shift.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notices List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Shift Log & Notice Board ({activeNoticesList.length})
                  </h4>
                  <span className="text-xs text-slate-400">
                    Unread / Pending: <strong className="text-slate-700">{unacknowledgedCount}</strong>
                  </span>
                </div>

                {activeNoticesList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No notices in this category</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click "+ Post Desk Notice" to add an update for your team.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {activeNoticesList.map(notice => {
                      const isUrgent = notice.priority === 'urgent' || notice.priority === 'high';
                      return (
                        <div
                          key={notice.id}
                          className={`p-5 rounded-2xl border transition-all ${
                            notice.acknowledged
                              ? 'bg-slate-50/60 border-slate-200/80 opacity-75'
                              : isUrgent
                              ? 'bg-rose-50/40 border-rose-200/90 shadow-sm'
                              : 'bg-white border-slate-200/90 shadow-sm'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  notice.priority === 'urgent'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : notice.priority === 'high'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {notice.priority}
                              </span>

                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                                {notice.category === 'handover' ? 'Shift Handover' : notice.category}
                              </span>

                              <h4 className={`text-base font-bold ${notice.acknowledged ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                {notice.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleAcknowledgeNotice(notice.id)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                                  notice.acknowledged
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{notice.acknowledged ? 'Acknowledged' : 'Mark as Read'}</span>
                              </button>

                              <button
                                onClick={() => deleteNotice(notice.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Remove notice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                            {notice.message}
                          </p>

                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <span>Posted by: <strong className="text-slate-600 font-semibold">{notice.author}</strong></span>
                            <span>{new Date(notice.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : currentTab === 'rooms' ? (
            // ================= ROOM INVENTORY TAB =================
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <h3 className="text-base font-black text-slate-800">Stay Room Categories & Live Inventory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {assignedAshram
                      ? `Physical rooms and category breakdown configured for ${assignedAshram.name}`
                      : 'Select a property above to view its room inventory'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                    {rooms.length} Categories
                  </span>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-bold text-indigo-700">
                    {rooms.reduce((acc, r) => acc + (Number(r.totalInventory) || 1), 0)} Total Rooms
                  </span>
                </div>
              </div>

              {rooms.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold">
                    {assignedAshram ? 'No room inventory registered for this stay' : 'No property selected'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {assignedAshram ? 'Contact Stay Owner to configure rooms.' : 'Room status is shown one property at a time.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {rooms.map(room => {
                    const roomName = room.name || room.roomNumber || 'Room Category';
                    const categoryType = room.type?.replace('_', ' ') || 'Private Room';
                    const inventoryCount = Number(room.totalInventory ?? 1);
                    const price = room.sellingPrice || room.basePrice || room.pricePerNight || 0;
                    const capacity = room.capacity || 2;
                    const amenities = Array.isArray(room.amenities) ? room.amenities : [];

                    return (
                      <div
                        key={room._id}
                        className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-base font-black text-slate-900 tracking-tight">
                              {roomName}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Active & Live
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-medium space-y-1 mb-3">
                            <p className="capitalize text-indigo-600 font-semibold">{categoryType} {room.acType ? `• ${room.acType}` : ''}</p>
                            <p>Max Capacity: <strong className="text-slate-700">{capacity} Guests</strong></p>
                            <p>Total Inventory: <strong className="text-slate-800 font-bold">{inventoryCount} Rooms</strong></p>
                          </div>

                          {amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {amenities.slice(0, 3).map((am: string, i: number) => (
                                <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                  {am}
                                </span>
                              ))}
                              {amenities.length > 3 && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                                  +{amenities.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
                          <span className="text-sm font-black text-slate-900">₹{price.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">/ night</span></span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Ready
                          </span>
                        </div>
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
                              {!selectedPropertyId && booking.ashramId?.name && (
                                <span className="text-[11px] text-slate-500 font-medium block truncate max-w-[160px]">
                                  {booking.ashramId.name}
                                </span>
                              )}
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
              {/* Pre-Booked Room Category Information */}
              {(() => {
                const bookedCategory =
                  checkinBooking.rooms?.[0]?.roomId?.name ||
                  checkinBooking.rooms?.[0]?.name ||
                  checkinBooking.roomType ||
                  checkinBooking.roomName ||
                  'Deluxe';
                const bookedRooms = checkinBooking.roomsBookedCount || checkinBooking.rooms?.length || 1;
                const totalGuests = checkinBooking.numberOfGuests || checkinBooking.adults || 1;

                return (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Guest Pre-Booked Room Category
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-2">
                        <span>{bookedCategory} Room</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {bookedRooms} Room{bookedRooms > 1 ? 's' : ''} • {totalGuests} Guest{totalGuests > 1 ? 's' : ''}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Category confirmed during reservation. Assign the physical room number below.</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-700 flex-shrink-0">
                      <BedDouble className="w-5 h-5" />
                    </div>
                  </div>
                );
              })()}

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

              {/* Physical Room Number Assignment */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assign Physical Room Number *
                  </label>
                  <span className="text-[11px] text-slate-400">e.g. 101, 102, 204</span>
                </div>
                <input
                  type="text"
                  required
                  value={selectedRoomNumber}
                  onChange={e => setSelectedRoomNumber(e.target.value)}
                  placeholder="Enter physical room number (e.g. 101, 102, 204)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                {/* Quick Select Suggestion Pills */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">Quick Suggestions:</span>
                  {['101', '102', '103', '104', '105', '201', '202', '203', '204', '205'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedRoomNumber(num)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition active:scale-95 ${
                        selectedRoomNumber === num
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                      }`}
                    >
                      Room {num}
                    </button>
                  ))}
                </div>
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
                    {newBookingPropertyId ? (
                      <>
                        Front desk reservation for{' '}
                        <strong>{properties.find(p => String(p._id) === newBookingPropertyId)?.name || 'selected property'}</strong>
                      </>
                    ) : (
                      'Choose a property to start the reservation'
                    )}
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
              {/* Property */}
              {properties.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Property *
                  </label>
                  <select
                    required
                    value={newBookingPropertyId}
                    onChange={e => changeNewBookingProperty(e.target.value, newBookingForm.checkInDate, newBookingForm.checkOutDate)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Select property --</option>
                    {properties.map(p => (
                      <option key={p._id} value={String(p._id)}>
                        {propertyLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                        fetchAvailableCategories(val, newBookingForm.checkOutDate, newBookingPropertyId);
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
                        fetchAvailableCategories(newBookingForm.checkInDate, val, newBookingPropertyId);
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
                    <p className="text-xs text-slate-500">
                      {newBookingPropertyId
                        ? 'No room categories found for selected stay dates.'
                        : 'Select a property to see live room availability.'}
                    </p>
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

      {/* =========================================================================
          POST NEW NOTICE / SHIFT HANDOVER MODAL
          ========================================================================= */}
      {showNewNoticeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Post Front Desk Notice</h3>
                  <p className="text-xs text-indigo-200">Broadcast shift handover or operational advisory</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewNoticeModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  required
                  value={newNoticeForm.title}
                  onChange={e => setNewNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. VIP Morning Arrival / Room 102 Handover"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newNoticeForm.category}
                    onChange={e => setNewNoticeForm(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                  >
                    <option value="handover">Shift Handover</option>
                    <option value="notice">Management Notice</option>
                    <option value="maintenance">Maintenance / Cleaning</option>
                    <option value="guest">Guest Special Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={newNoticeForm.priority}
                    onChange={e => setNewNoticeForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notice / Handover Details *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newNoticeForm.message}
                  onChange={e => setNewNoticeForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Write clear instructions, room handover details, or alerts for other front desk team members..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Author / Reception Staff Name
                </label>
                <input
                  type="text"
                  value={newNoticeForm.author}
                  onChange={e => setNewNoticeForm(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="e.g. Reception Staff"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewNoticeModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25 transition active:scale-95 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Post Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionCheckinPage;

