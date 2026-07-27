import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ashramService, reviewService, roomService, bookingService, offerService } from '../services';
import { getErrorMessage } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';
import { saveBookingDraft, getBookingDraft, clearBookingDraft, type BookingDraftPayload } from '../utils/bookingDraft';
import { 
  ShieldCheck, 
  MapPin, 
  Star, 
  Calendar as CalendarIcon, 
  Coffee, 
  ParkingCircle, 
  Lock, 
  Heart,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Info,
  Map,
  Sparkles,
  Phone,
  Mail,
  Globe,
  Compass,
  Bed,
  CheckCircle,
  Award,
  X,
  Maximize2,
  Trash2,
  Edit3
} from 'lucide-react';

export const AshramDetailPage: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const initialCheckIn = searchParams.get('checkIn') || '';
  const initialCheckOut = searchParams.get('checkOut') || '';
  const initialGuests = parseInt(searchParams.get('guests') || '1') || 1;

  const [ashram, setAshram] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow parameters
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [guestsCount, setGuestsCount] = useState(initialGuests);
  const [roomsCount, setRoomsCount] = useState(1);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  useEffect(() => {
    const qCheckIn = searchParams.get('checkIn');
    const qCheckOut = searchParams.get('checkOut');
    const qGuests = searchParams.get('guests');
    const qPromo = searchParams.get('promoCode');
    if (qCheckIn) setCheckIn(qCheckIn);
    if (qCheckOut) setCheckOut(qCheckOut);
    if (qGuests) setGuestsCount(parseInt(qGuests) || 1);
    if (qPromo) {
      setCouponCode(qPromo);
      handleValidatePromo(qPromo);
    }
  }, [searchParams]);

  const [appliedOfferData, setAppliedOfferData] = useState<any>(null);

  const handleValidatePromo = async (codeToTest?: string) => {
    const code = (codeToTest || couponCode).trim().toUpperCase();
    if (!code) return;
    try {
      const currentBookingAmount = (selectedRoom?.basePrice || 350) * Math.max(1, roomsCount) * calculateDays();
      const res = await offerService.validatePromo({
        promoCode: code,
        bookingAmount: currentBookingAmount,
        ashramId: id,
      });
      if (res.data?.success && res.data?.valid) {
        const offerData = res.data.data;
        setAppliedOfferData(offerData);
        setAppliedDiscount(offerData.discountAmount);
        setCouponMsg(res.data.message || `Promo code ${code} applied! Saved ₹${offerData.discountAmount}`);
      } else {
        setAppliedOfferData(null);
        setAppliedDiscount(0);
        setCouponMsg(res.data?.message || 'Invalid promo code');
      }
    } catch (err: any) {
      console.error('Validate promo error:', err);
      setAppliedOfferData(null);
      setAppliedDiscount(0);
      setCouponMsg(err.response?.data?.message || 'Invalid or expired promo code');
    }
  };

  // Optional Services
  const [prasad, setPrasad] = useState(false);
  const [meals, setMeals] = useState(false);
  const [parking, setParking] = useState(false);
  const [locker, setLocker] = useState(false);
  const [donation, setDonation] = useState('');

  // Extended Booking Fields
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [restoredNotice, setRestoredNotice] = useState(false);

  // Live Availability Calendar
  const [availabilityCalendar, setAvailabilityCalendar] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Related stays
  const [relatedStays, setRelatedStays] = useState<any[]>([]);

  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(0);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (selectedRoom) {
      fetchAvailability();
    }
  }, [selectedRoom]);

  useEffect(() => {
    const draft = getBookingDraft();
    const pendingRaw = localStorage.getItem('pending_booking');
    let pb: any = draft;
    if (!pb && pendingRaw) {
      try { pb = JSON.parse(pendingRaw); } catch (e) {}
    }

    if (pb && id && (pb.ashramId === id || !pb.ashramId)) {
      try {
        if (pb.checkIn || pb.checkInDate) setCheckIn(pb.checkIn || pb.checkInDate);
        if (pb.checkOut || pb.checkOutDate) setCheckOut(pb.checkOut || pb.checkOutDate);
        if (pb.guestsCount) setGuestsCount(pb.guestsCount);
        if (pb.adults !== undefined) setAdults(pb.adults);
        if (pb.children !== undefined) setChildren(pb.children);
        if (pb.roomsBookedCount) setRoomsCount(pb.roomsBookedCount);

        const s = pb.services || {};
        if (s.prasad || s.prasad?.ordered) setPrasad(true);
        if (s.meals || s.meals?.ordered) setMeals(true);
        if (s.parking || s.parking?.ordered) setParking(true);
        if (s.locker || s.locker?.ordered) setLocker(true);
        if (s.donation) {
          const donVal = typeof s.donation === 'object' ? s.donation.amount : s.donation;
          setDonation(donVal ? donVal.toString() : '');
        }

        if (pb.couponCode) {
          setCouponCode(pb.couponCode);
          handleValidatePromo(pb.couponCode);
        }
        if (pb.appliedDiscount) setAppliedDiscount(pb.appliedDiscount);
        if (pb.specialRequests) setSpecialRequests(pb.specialRequests);

        if (rooms.length > 0 && pb.roomId) {
          const match = rooms.find((r) => r._id === pb.roomId);
          if (match) setSelectedRoom(match);
        }

        setRestoredNotice(true);
      } catch (e) {
        console.error('Error restoring pending booking:', e);
      }
    }
  }, [id, rooms]);

  const handleClearDraft = () => {
    localStorage.removeItem('pending_booking');
    setRestoredNotice(false);
    setPrasad(false);
    setMeals(false);
    setParking(false);
    setLocker(false);
    setDonation('');
    setCouponCode('');
    setAppliedDiscount(0);
    setSpecialRequests('');
  };

  const handleAdultsChange = (val: number) => {
    const a = Math.max(1, val);
    setAdults(a);
    setGuestsCount(a + children);
  };

  const handleChildrenChange = (val: number) => {
    const c = Math.max(0, val);
    setChildren(c);
    setGuestsCount(adults + c);
  };

  const { addNotification } = useNotifications();

  const handleApplyCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      handleValidatePromo(couponCode);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedOfferData(null);
    setAppliedDiscount(0);
    setCouponCode('');
    setCouponMsg('');
    setTimerActive(false);
    setReservationSeconds(600);
    addNotification('Coupon Removed', 'Coupon removed successfully. Original stay amount restored.', 'info');
  };

  const handleChangeCoupon = () => {
    setAppliedOfferData(null);
    setAppliedDiscount(0);
    setCouponMsg('');
    setTimerActive(false);
  };

  const nextImage = () => {
    const n = (ashram?.images || []).length;
    if (n > 0) setActiveImageIndex((i) => (i + 1) % n);
  };
  const prevImage = () => {
    const n = (ashram?.images || []).length;
    if (n > 0) setActiveImageIndex((i) => (i - 1 + n) % n);
  };
  const onHeroTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? nextImage() : prevImage());
  };

  // Keyboard navigation while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowRight') nextImage();
      else if (e.key === 'ArrowLeft') prevImage();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, ashram]);

  const calculateDays = () => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diff = Math.ceil((end - start) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  };

  const daysCount = calculateDays();
  const basePriceCalc = (selectedRoom?.basePrice || 0) * roomsCount * daysCount;
  const prasadCalc = prasad ? 100 * (adults + children) : 0;
  const mealsCalc = meals ? 150 * (adults + children) * daysCount : 0;
  const parkingCalc = parking ? 100 * daysCount : 0;
  const lockerCalc = locker ? 50 * daysCount : 0;
  const servicesCalc = prasadCalc + mealsCalc + parkingCalc + lockerCalc;
  const donationCalc = parseFloat(donation) || 0;
  const subtotalCalc = basePriceCalc + servicesCalc + donationCalc;
  const discountCalc = appliedDiscount > 0 ? (appliedDiscount <= 100 ? (subtotalCalc * appliedDiscount) / 100 : appliedDiscount) : 0;
  const totalCalc = Math.max(0, subtotalCalc - discountCalc);

  // Reservation Timer (10 Minutes) & Loyalty Rewards State
  const [reservationSeconds, setReservationSeconds] = useState<number>(600);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [useLoyalty, setUseLoyalty] = useState<boolean>(false);

  useEffect(() => {
    if (appliedDiscount > 0 && !timerActive) {
      setReservationSeconds(600);
      setTimerActive(true);
    } else if (appliedDiscount === 0) {
      setTimerActive(false);
    }
  }, [appliedDiscount]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setReservationSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          setAppliedDiscount(0);
          setAppliedOfferData(null);
          setCouponMsg('Reservation Expired. Your offer has expired. Please reapply the coupon.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const extraGuestCalc = adults > 2 ? (adults - 2) * 200 * daysCount : 0;
  const loyaltyCalc = useLoyalty ? 100 : 0;
  const gstCalc = Math.round(subtotalCalc * 0.05);
  const platformFeeCalc = 0;
  const totalSavingsCalc = Math.round(discountCalc + loyaltyCalc);
  const finalPayableCalc = Math.max(0, Math.round(subtotalCalc - discountCalc - loyaltyCalc + gstCalc + platformFeeCalc));

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await ashramService.getById(id!);
      if (res.data.success) {
        setAshram(res.data.data.ashram);
        setRooms(res.data.data.rooms);
        if (res.data.data.rooms.length > 0) {
          setSelectedRoom(res.data.data.rooms[0]);
        }
        
        if (id) {
          fetchReviews(id);
          fetchRelated(res.data.data.ashram.address?.city, id);
        }
      }
    } catch (err) {
      console.error('Fetch details error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (ashramId: string) => {
    try {
      const res = await reviewService.forAshram(ashramId);
      if (res.data.success) {
        setReviews(res.data.data);
      }
    } catch (err) {
      console.error('Reviews load error:', err);
    }
  };

  const fetchRelated = async (city: string, currentId: string) => {
    try {
      const res = await ashramService.search({ verified: 'true', destination: city });
      if (res.data.success) {
        setRelatedStays(res.data.data.filter((a: any) => a._id !== currentId).slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom || !localStorage.getItem('ab_token')) {
      generateSimulatedCalendar();
      return;
    }
    setLoadingCalendar(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const res = await roomService.calendar(selectedRoom._id, today, end);
      if (res.data.success) {
        setAvailabilityCalendar(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching calendar overrides:', err);
      generateSimulatedCalendar();
    } finally {
      setLoadingCalendar(false);
    }
  };

  const generateSimulatedCalendar = () => {
    const simulated = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const rand = Math.random();
      let available = selectedRoom ? Math.floor(selectedRoom.totalInventory * 0.4) : 10;
      if (rand > 0.8) available = 0;
      else if (rand > 0.6) available = 2;
      simulated.push({
        date: d.toISOString().split('T')[0],
        price: selectedRoom?.basePrice || 150,
        available
      });
    }
    setAvailabilityCalendar(simulated);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess(null);

    if (!user) {
      const currentUrl = window.location.pathname + window.location.search;
      const draftPayload: BookingDraftPayload = {
        ashramId: ashram._id,
        roomId: selectedRoom?._id,
        roomType: selectedRoom?.name,
        checkIn,
        checkOut,
        guestsCount: adults + children,
        adults,
        children,
        services: {
          prasad,
          meals,
          parking,
          locker,
          donation: parseFloat(donation) || 0,
        },
        couponCode,
        appliedDiscount,
        specialRequests,
        returnUrl: currentUrl,
        timestamp: Date.now(),
      };
      saveBookingDraft(draftPayload);
      navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (user.role !== 'customer') {
      setBookingError('Only registered Guests can book rooms. Please log in with a Customer profile.');
      return;
    }

    if (!checkIn || !checkOut) {
      setBookingError('Please choose check-in and check-out dates.');
      return;
    }

    const payload = {
      ashramId: ashram._id,
      roomId: selectedRoom._id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestsCount,
      roomsBookedCount: roomsCount,
      services: {
        prasad: { ordered: prasad },
        meals: { ordered: meals },
        parking: { ordered: parking },
        locker: { ordered: locker },
        donation: { amount: parseFloat(donation) || 0 },
      },
      promoCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
      appliedOfferId: appliedOfferData?.offerId || undefined,
    };

    try {
      const res = await bookingService.create(payload);
      if (res.data.success) {
        clearBookingDraft();
        setBookingSuccess(res.data.data);
      }
    } catch (err) {
      setBookingError(getErrorMessage(err, 'Error occurred completing booking lock'));
    }
  };

  const [paying, setPaying] = useState(false);

  const handleConfirmPayment = async () => {
    if (!bookingSuccess) return;
    setBookingError('');
    setPaying(true);
    try {
      // 1. Ask the backend to create a payment order (or signal demo mode).
      const orderRes = await bookingService.createPaymentOrder(bookingSuccess._id);

      if (orderRes.data.demo) {
        // No gateway configured → demo confirmation path.
        await bookingService.pay(bookingSuccess._id, { method: 'upi', transactionId: `TXN-DEMO-${Date.now()}` });
        navigate('/dashboard');
        return;
      }

      // 2. Open Razorpay checkout with the real order.
      const result = await openRazorpayCheckout(orderRes.data.data, {
        name: user?.name,
        email: user?.email,
        contact: user?.phone,
      });

      // 3. Verify the signature server-side and confirm the booking.
      await bookingService.pay(bookingSuccess._id, result);
      navigate('/dashboard');
    } catch (err) {
      setBookingError(getErrorMessage(err, 'Payment could not be completed. Please try again.'));
    } finally {
      setPaying(false);
    }
  };

  const getAmenityIcon = (amName: string) => {
    const name = amName.toLowerCase();
    if (name.includes('wifi')) return <span className="font-bold text-[9px] bg-primary/10 text-primary px-2.5 py-1 rounded-full">WiFi</span>;
    if (name.includes('food') || name.includes('meal')) return <span className="font-bold text-[9px] bg-success/10 text-success px-2.5 py-1 rounded-full">Satvik Food</span>;
    if (name.includes('meditation')) return <span className="font-bold text-[9px] bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-full">Dhyan Hall</span>;
    if (name.includes('yoga')) return <span className="font-bold text-[9px] bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-full">Yoga</span>;
    if (name.includes('cow') || name.includes('shelter')) return <span className="font-bold text-[9px] bg-yellow-500/10 text-yellow-700 px-2.5 py-1 rounded-full">Goshala</span>;
    if (name.includes('river') || name.includes('view')) return <span className="font-bold text-[9px] bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full">Ganga View</span>;
    return <span className="font-bold text-[9px] bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">{amName}</span>;
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse bg-white rounded-[28px] h-80 border border-gray-100" />;
  }

  const galleryImages = ashram?.images || [];

  return (
    <div className="max-w-7xl mx-auto px-6 pt-2 pb-16 space-y-10">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wider">
            <ShieldCheck size={12} /> Verified Stay
          </span>
          <span className="text-xs text-gray-400 font-extrabold tracking-wider uppercase">
            {ashram.address?.city}, {ashram.address?.state}
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {ashram.name}
        </h2>
        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <MapPin size={12} className="text-[#0A4DA6]" /> {ashram.address?.street}, Pin: {ashram.address?.pincode}
        </p>
      </div>

      {/* Premium Hero + Thumbnail Gallery */}
      <div className="space-y-3 -mt-4">
        {/* Hero image (16:9) — click to open lightbox, swipe to change on mobile */}
        <div
          className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm cursor-zoom-in group bg-gray-100 dark:bg-slate-900"
          onClick={() => galleryImages.length > 0 && setLightboxOpen(true)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={onHeroTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeImageIndex}
              src={galleryImages[activeImageIndex] || galleryImages[0]}
              alt="Ashram view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80'; }}
            />
          </AnimatePresence>

          {galleryImages.length > 1 && (
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-bold backdrop-blur-sm">
              {activeImageIndex + 1} / {galleryImages.length}
            </div>
          )}
          <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={13} /> View Gallery
          </div>
        </div>

        {/* Thumbnail carousel — swipeable, hover zoom, active highlight */}
        {galleryImages.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x" style={{ scrollbarWidth: 'none' }}>
            {galleryImages.map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                aria-label={`Show image ${idx + 1}`}
                className={`relative shrink-0 w-24 h-16 sm:w-28 sm:h-20 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all snap-start group ${
                  idx === activeImageIndex
                    ? 'border-[#0A4DA6] ring-2 ring-[#0A4DA6]/20'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 sm:left-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 sm:right-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.img
              key={activeImageIndex}
              src={galleryImages[activeImageIndex]}
              alt="Ashram full view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </AnimatePresence>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
            {activeImageIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}


      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Ashram Details */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* About description & History */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-slate-850 pb-3">
              <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Compass size={18} className="text-[#0A4DA6]" /> About the Retreat
              </h3>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 px-3 py-1 border border-gray-150 dark:border-slate-800 rounded-full shrink-0">
                <Star className="text-[#D4AF37] fill-[#D4AF37]" size={12} />
                <span className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">{ashram.rating?.average} / 5</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">{ashram.description}</p>
            
            {ashram.history && (
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-[#0A4DA6] flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={14} /> Historical Significance
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed italic bg-gray-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border border-dashed border-gray-100 dark:border-slate-850">
                  "{ashram.history}"
                </p>
              </div>
            )}
          </div>

          {/* Amenities & Facilities */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Award size={18} className="text-[#0A4DA6]" /> Facilities & Spiritual Activities
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {ashram.amenities?.map((am: string, i: number) => (
                <div key={i} className="flex items-center gap-1">
                  {getAmenityIcon(am)}
                </div>
              ))}
            </div>
          </div>

          {/* Rooms Categories List */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Bed size={18} className="text-[#0A4DA6]" /> Available Room Categories
            </h3>
            <div className="space-y-4">
              {rooms.map((r) => (
                <div 
                  key={r._id} 
                  onClick={() => setSelectedRoom(r)}
                  className={`p-4 border rounded-[20px] cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${selectedRoom?._id === r._id ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-sm' : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/10'}`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">{r.name}</span>
                    <span className="text-[10px] text-gray-400 block font-bold capitalize tracking-wide">{r.type.replace('_', ' ')} • {r.acType} • Capacity: {r.capacity} Guests</span>
                    <p className="text-[10px] text-gray-500 max-w-md">{r.description || 'Simple clean room with standard Vedic facilities.'}</p>
                  </div>
                  <div className="flex flex-col sm:items-end text-left sm:text-right shrink-0">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bed Rate</span>
                    <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">₹{r.basePrice} / night</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room Availability Grid */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <CalendarIcon size={18} className="text-[#0A4DA6]" /> 30-Day Room Availability Grid
            </h3>
            
            <p className="text-[10px] text-gray-400 font-bold uppercase">
              Room Category: <span className="text-[#0B192C] dark:text-white font-extrabold">{selectedRoom?.name || 'Selected Room'}</span>
            </p>

            {loadingCalendar ? (
              <div className="h-20 bg-gray-50 dark:bg-slate-900 rounded-2xl animate-pulse" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
                  {availabilityCalendar.map((day, i) => {
                    const status = day.available <= 0 ? 'sold_out' :
                                   day.available <= 2 ? 'almost_full' :
                                   day.available <= 5 ? 'limited' : 'available';
                    
                    const dateObj = new Date(day.date);
                    const formattedDay = dateObj.getDate();
                    const formattedMonth = dateObj.toLocaleString('en-US', { month: 'short' });

                    return (
                      <div 
                        key={i} 
                        className={`p-2 rounded-xl text-center border text-[9px] flex flex-col justify-between h-14 select-none ${
                          status === 'sold_out' ? 'bg-danger/10 border-danger/20 text-danger' :
                          status === 'almost_full' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700' :
                          status === 'limited' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600' :
                          'bg-success/10 border-success/20 text-success'
                        }`}
                      >
                        <span className="font-extrabold">{formattedDay} {formattedMonth}</span>
                        <span className="text-[8px] font-semibold block">₹{day.price}</span>
                        <span className="text-[8px] font-extrabold block">
                          {status === 'sold_out' ? 'Sold Out' : `${day.available} left`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 pt-2 justify-center border-t border-gray-150 dark:border-slate-800 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-success/20 border border-success/30 rounded" /> Available</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded" /> Limited</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500/20 border border-amber-500/30 rounded" /> Almost Full</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-danger/20 border border-danger/30 rounded" /> Sold Out</span>
                </div>
              </div>
            )}
          </div>

          {/* Rules & Policies */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Info size={18} className="text-[#0A4DA6]" /> Rules & Policies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-[#0A4DA6] uppercase tracking-wider text-[10px]">Guidelines for Guests</h4>
                <ul className="text-gray-500 space-y-2 list-disc pl-5">
                  {ashram.rules?.map((rule: string, i: number) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-[#0A4DA6] uppercase tracking-wider text-[10px]">Check-in Policies</h4>
                <div className="space-y-1.5 text-gray-500">
                  <p><strong>Check-in Time:</strong> 12:00 PM</p>
                  <p><strong>Check-out Time:</strong> 11:00 AM</p>
                  <p><strong>Nearby Attractions:</strong> {ashram.nearbyAttractions?.join(', ') || 'Temples & Ghats'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Star size={18} className="text-[#0A4DA6]" /> Guest Reviews ({reviews.length})
            </h3>
             {reviews.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No reviews posted yet for this ashram stay.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4">
                  {reviews.slice(0, showAllReviews ? reviews.length : 3).map((rev) => (
                    <div key={rev._id} className="p-4 bg-gray-50/50 dark:bg-slate-900/10 border border-gray-100 dark:border-slate-800 rounded-[20px] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-secondary dark:text-white">{rev.customerId?.name}</span>
                        <span className="flex items-center gap-0.5 px-2.5 py-0.5 bg-gray-50 dark:bg-slate-900 border border-gray-150 rounded-full text-[10px] font-bold">
                          <Star size={10} className="fill-[#D4AF37] text-[#D4AF37]" /> {rev.rating?.overall} / 5
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed">"{rev.comment}"</p>
                    </div>
                  ))}
                </div>

                {reviews.length > 3 && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-full text-[10px] font-bold transition-all cursor-pointer"
                    >
                      {showAllReviews ? 'View Less' : `View More (${reviews.length - 3} reviews)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Booking Sidecard & Contact Trust */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#0A4DA6]" />
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#0A4DA6]" /> Stay Booking Engine
            </h3>

            {restoredNotice && (
              <div className="p-3 bg-[#0A4DA6]/10 border border-[#0A4DA6]/20 rounded-xl flex items-center justify-between text-xs font-semibold text-[#0A4DA6] space-x-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#0A4DA6] shrink-0" />
                  <span>Your previous booking selections have been restored.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-[10px] font-bold text-gray-500 hover:text-danger underline cursor-pointer shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {bookingError && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-bold">
                {bookingError}
              </div>
            )}

            {!bookingSuccess ? (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Check In</label>
                    <input
                      type="date"
                      required
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Check Out</label>
                    <input
                      type="date"
                      required
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-[20px] space-y-1 select-none">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Active Category</span>
                  <span className="text-xs font-extrabold text-secondary dark:text-white block leading-tight">{selectedRoom?.name}</span>
                  <span className="text-[10px] font-bold text-[#0A4DA6]">₹{selectedRoom?.basePrice} / bed per night</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Adults (12+ yrs)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={adults}
                      onChange={(e) => handleAdultsChange(parseInt(e.target.value) || 1)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Children (0-11 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={children}
                      onChange={(e) => handleChildrenChange(parseInt(e.target.value) || 0)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Total Guests</label>
                    <input
                      type="number"
                      readOnly
                      value={guestsCount}
                      className="w-full p-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Rooms Count</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={roomsCount}
                      onChange={(e) => setRoomsCount(parseInt(e.target.value) || 1)}
                      className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold"
                    />
                  </div>
                </div>

                {/* Add ons - 4 distinct options */}
                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Add-on Services</span>
                  <div className="space-y-2">
                    {/* 1. Prasad */}
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#0A4DA6]" />
                        <span>Sacred Prasad Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prasad}
                        onChange={() => setPrasad(!prasad)}
                        className="rounded border-gray-200 text-[#0A4DA6] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* 2. Meals */}
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <Coffee size={14} className="text-[#0A4DA6]" />
                        <span>Satvik Meals</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={meals}
                        onChange={() => setMeals(!meals)}
                        className="rounded border-gray-200 text-[#0A4DA6] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* 3. Parking */}
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <ParkingCircle size={14} className="text-[#0A4DA6]" />
                        <span>Parking Slot</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={parking}
                        onChange={() => setParking(!parking)}
                        className="rounded border-gray-200 text-[#0A4DA6] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* 4. Locker Access */}
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-[#0A4DA6]" />
                        <span>Locker Access</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={locker}
                        onChange={() => setLocker(!locker)}
                        className="rounded border-gray-200 text-[#0A4DA6] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Donation */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    Ashram Donation (₹) <Heart size={10} className="text-danger fill-danger" />
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={donation}
                    onChange={(e) => setDonation(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold"
                  />
                </div>

                {/* SECTION 1: Premium Savings Card (Framer Motion) */}
                {appliedOfferData && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-[22px] space-y-3 text-left relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-500 text-white rounded-full shadow-md text-xs">🎉</span>
                        <div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider block">
                            Offer Applied Successfully
                          </span>
                          <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                            {appliedOfferData.offerName || 'Exclusive Pilgrim Discount'}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase shadow-sm">
                        {appliedOfferData.promoCode}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <span>{appliedOfferData.offerCategory || 'Festival Special'}</span>
                      <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                        You Saved ₹{appliedOfferData.discountAmount}
                      </span>
                    </div>

                    {/* Action Triggers: [ Change Coupon ] [ Remove Coupon ] */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleChangeCoupon}
                        className="flex-1 py-1.5 px-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white text-[10px] font-black rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                      >
                        <Edit3 size={12} /> Change Coupon
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-[10px] font-black rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove Coupon
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* SECTION 4: 10-Minute Reservation Timer */}
                {timerActive && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏳</span>
                      <span>This discounted price has been reserved for you.</span>
                    </div>
                    <span className="font-mono font-black text-sm bg-amber-200 dark:bg-amber-900 px-2.5 py-0.5 rounded-lg">
                      {formatTimer(reservationSeconds)}
                    </span>
                  </div>
                )}

                {/* Promo Coupon Code Entry */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Promo / Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. KUMBH2026"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 py-2.5 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-xl cursor-pointer hover:bg-[#083b80] transition-all shadow-sm"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMsg && (
                    <p className={`text-[10px] font-bold ${appliedDiscount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{couponMsg}</p>
                  )}
                </div>

                {/* SECTION 5: Loyalty Rewards System */}
                <div className="p-3.5 bg-blue-50/70 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-[#E58C28]" />
                    <div>
                      <span className="font-extrabold text-[#0B192C] dark:text-white block">Tirvona Loyalty Rewards</span>
                      <span className="text-[10px] text-gray-500">
                        {useLoyalty ? 'Applied 100 points (-₹100)' : `Earn ${Math.round(subtotalCalc * 0.05)} reward points after stay`}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useLoyalty}
                    onChange={() => setUseLoyalty(!useLoyalty)}
                    className="w-4 h-4 text-[#0A4DA6] rounded border-gray-300 cursor-pointer"
                  />
                </div>

                {/* SECTION 7: Offer Information & Scarcity */}
                {appliedOfferData && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-150 dark:border-slate-800 text-[10px] space-y-1 text-gray-500">
                    <div className="flex justify-between font-bold text-gray-700 dark:text-gray-300">
                      <span>🔥 Scarcity Alert:</span>
                      <span className="text-rose-600 font-extrabold">Only {appliedOfferData.remainingRedemptions || 12} offers left today</span>
                    </div>
                    <p>• {appliedOfferData.description || 'Valid on direct website bookings only.'}</p>
                  </div>
                )}

                {/* Special Requests / Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Special Requests / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ground floor room preferred..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none resize-none"
                  />
                </div>

                {/* SECTION 2: Detailed Enterprise Savings Breakdown */}
                <div className="p-4 bg-gray-50 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-[24px] space-y-2.5 text-xs font-semibold shadow-inner">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Original Stay Cost ({daysCount} night{daysCount > 1 ? 's' : ''}):</span>
                    <span>₹{basePriceCalc}</span>
                  </div>

                  {extraGuestCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Extra Guest Charges:</span>
                      <span>₹{extraGuestCalc}</span>
                    </div>
                  )}

                  {servicesCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Add-on Services:</span>
                      <span>₹{servicesCalc}</span>
                    </div>
                  )}

                  {donationCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Ashram Donation:</span>
                      <span>₹{donationCalc}</span>
                    </div>
                  )}

                  {discountCalc > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <span>Coupon Offer Discount ({couponCode}):</span>
                      <span>-₹{discountCalc}</span>
                    </div>
                  )}

                  {useLoyalty && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <span>Loyalty Reward Discount:</span>
                      <span>-₹100</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Govt GST (5%):</span>
                    <span>₹{gstCalc}</span>
                  </div>

                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Digital India Platform Fee:</span>
                    <span className="text-emerald-600 font-bold">FREE</span>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-slate-800 flex justify-between text-base font-black text-[#0B192C] dark:text-white">
                    <span>Final Payable Amount:</span>
                    <span className="text-[#0A4DA6] dark:text-blue-400">₹{finalPayableCalc}</span>
                  </div>
                </div>

                {/* SECTION 3 & 6: Savings Highlight & Circular Badge */}
                {totalSavingsCalc > 0 && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-700 dark:text-emerald-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      <div>
                        <span>Total Savings ₹{totalSavingsCalc}</span>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          You saved ₹{totalSavingsCalc} on this booking stay.
                        </p>
                      </div>
                    </div>
                    {/* SECTION 6: Circular Savings Badge */}
                    <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex flex-col items-center justify-center font-black text-[9px] shadow-md shrink-0">
                      <span>SAVED</span>
                      <span className="text-[10px]">₹{totalSavingsCalc}</span>
                    </div>
                  </motion.div>
                )}

                {/* SECTION 8: Payment Confidence Badges */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 pt-1">
                  <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Govt Verified</span>
                  <span className="flex items-center gap-1"><Lock size={12} className="text-blue-500" /> Secure Payment</span>
                  <span className="flex items-center gap-1"><CheckCircle size={12} className="text-teal-500" /> Free Cancellation</span>
                  <span className="flex items-center gap-1"><Sparkles size={12} className="text-purple-500" /> Instant Confirm</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-black rounded-full text-xs shadow-lg shadow-[#0A4DA6]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  Book Stay <ArrowRight size={14} />
                </button>
              </form>
            ) : (
              /* Invoice Break & Mock Payment */
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="p-3.5 bg-success/10 border border-success/20 rounded-xl text-success text-center">
                  <span className="text-xs font-bold block">Booking Locked Successfully!</span>
                  <span className="text-[10px]">Reference: {bookingSuccess.bookingId}</span>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[20px] p-4.5 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block border-b border-gray-150 dark:border-slate-800 pb-1.5">Billing Summary</span>
                  <div className="flex justify-between text-xs font-semibold text-gray-500">
                    <span>Base Room Stay:</span>
                    <span>₹{bookingSuccess.pricing?.basePrice}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-500">
                    <span>Add-on Services:</span>
                    <span>₹{bookingSuccess.pricing?.servicesPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-500">
                    <span>Donation:</span>
                    <span>₹{bookingSuccess.pricing?.donationAmount}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#0B192C] dark:text-white pt-2.5 border-t border-dashed border-gray-200 dark:border-slate-800">
                    <span>Total Bill:</span>
                    <span>₹{bookingSuccess.pricing?.totalAmount}</span>
                  </div>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={paying}
                  className="w-full py-3 bg-[#0A4DA6] hover:bg-opacity-95 text-white font-bold rounded-full text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paying ? 'Processing…' : `Pay ₹${bookingSuccess.pricing?.totalAmount}`}
                </button>
              </div>
            )}
          </div>

          {/* Contact Trust Info */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-4">
            <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white uppercase tracking-wider">Contact Ashram Trust</h4>
            <div className="space-y-3 text-[11px] text-gray-500">
              <p className="flex items-center gap-2"><Phone size={12} className="text-[#0A4DA6]" /> {ashram.ownerId?.phone || '+91 135 244 0001'}</p>
              <p className="flex items-center gap-2"><Mail size={12} className="text-[#0A4DA6]" /> {ashram.email || 'stay@trust.in'}</p>
              {ashram.website && (
                <p className="flex items-center gap-2"><Globe size={12} className="text-[#0A4DA6]" /> {ashram.website}</p>
              )}
            </div>
          </div>

          {/* Location Coordinates Widget */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-4 text-center relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-[#0A4DA6]/5 pointer-events-none" />
            <Map className="text-[#0A4DA6]" size={24} />
            <h4 className="text-xs font-extrabold text-[#0B192C] dark:text-white">Retreat Coordinates</h4>
            <p className="text-[9px] text-gray-400">Lat: {ashram.address?.coordinates?.coordinates?.[1]} , Lon: {ashram.address?.coordinates?.coordinates?.[0]}</p>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${ashram?.address?.coordinates?.coordinates?.[1]},${ashram?.address?.coordinates?.coordinates?.[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[9px] font-bold hover:bg-[#0A4DA6]/15 transition-all text-center inline-block cursor-pointer"
            >
              View Google Maps
            </a>
          </div>
        </div>

      </div>

      {/* Related stays */}
      {relatedStays.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-gray-100 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-xs uppercase font-extrabold text-[#0A4DA6] tracking-widest">More Places</span>
            <h3 className="text-lg md:text-2xl font-extrabold text-[#0B192C] dark:text-white">Related Stays in {ashram.address?.city}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedStays.map((rel) => (
              <Link 
                key={rel._id} 
                to={`/ashram/${rel._id}`}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-sm premium-card-hover flex flex-col justify-between"
              >
                <div className="h-40 overflow-hidden relative bg-gray-50 dark:bg-slate-900">
                  <img 
                    src={rel.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'} 
                    alt={rel.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                  />
                  <span className="absolute bottom-3 right-3 bg-white/95 text-secondary px-2 py-0.5 rounded shadow text-[9px] font-extrabold flex items-center gap-0.5">
                    <Star className="text-[#D4AF37] fill-[#D4AF37]" size={10} /> {rel.rating?.average}
                  </span>
                </div>
                <div className="p-4 flex-grow">
                  <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white line-clamp-1">{rel.name}</h4>
                  <span className="text-[9px] text-[#0A4DA6] font-bold block uppercase">{rel.address?.city}</span>
                </div>
                <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10">
                  <span className="text-[10px] font-extrabold text-[#0B192C] dark:text-white">₹{rel.lowestNightPrice ?? 150} / night</span>
                  <span className="text-[9px] font-bold text-[#0A4DA6] flex items-center gap-0.5">View <ChevronRight size={10} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default AshramDetailPage;
