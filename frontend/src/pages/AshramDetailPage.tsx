import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
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
  Flame,
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
  AlertTriangle,
  Award
} from 'lucide-react';

export const AshramDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ashram, setAshram] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow parameters
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [guestsCount, setGuestsCount] = useState(1);
  const [roomsCount, setRoomsCount] = useState(1);

  // Optional Services
  const [meals, setMeals] = useState(false);
  const [parking, setParking] = useState(false);
  const [locker, setLocker] = useState(false);
  const [donation, setDonation] = useState('');

  // Live Availability Calendar
  const [availabilityCalendar, setAvailabilityCalendar] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);

  // Related stays
  const [relatedStays, setRelatedStays] = useState<any[]>([]);

  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (selectedRoom) {
      fetchAvailability();
    }
  }, [selectedRoom]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/${id}`);
      if (res.data.success) {
        setAshram(res.data.data.ashram);
        setRooms(res.data.data.rooms);
        if (res.data.data.rooms.length > 0) {
          setSelectedRoom(res.data.data.rooms[0]);
        }
        
        // Fetch reviews and related stays if id is defined
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
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reviews/ashram/${ashramId}`);
      if (res.data.success) {
        setReviews(res.data.data);
      }
    } catch (err) {
      console.error('Reviews load error:', err);
    }
  };

  const fetchRelated = async (city: string, currentId: string) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams?verified=true&destination=${encodeURIComponent(city)}`);
      if (res.data.success) {
        setRelatedStays(res.data.data.filter((a: any) => a._id !== currentId).slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom || !localStorage.getItem('ab_token')) return;
    setLoadingCalendar(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/${selectedRoom._id}/calendar?startDate=${today}&endDate=${end}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setAvailabilityCalendar(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching calendar overrides:', err);
      // Generate simulated visual calendar if guest or error
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
      navigate('/login');
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
        meals: { ordered: meals },
        parking: { ordered: parking },
        locker: { ordered: locker },
        donation: { amount: parseFloat(donation) || 0 },
      },
    };

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/create`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setBookingSuccess(res.data.data);
      }
    } catch (err: any) {
      setBookingError(err.response?.data?.message || 'Error occurred completing booking lock');
    }
  };

  const handleConfirmMockPayment = async () => {
    if (!bookingSuccess) return;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/${bookingSuccess._id}/payment`,
        { method: 'upi', transactionId: `TXN-DEMO-${Date.now()}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      navigate('/dashboard');
    } catch (err) {
      console.error('Payment error:', err);
      navigate('/dashboard');
    }
  };

  const getAmenityIcon = (amName: string) => {
    const name = amName.toLowerCase();
    if (name.includes('wifi')) return <span className="font-bold text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded">WiFi</span>;
    if (name.includes('food') || name.includes('meal')) return <span className="font-bold text-[9px] bg-success/10 text-success px-2 py-0.5 rounded">Satvik Food</span>;
    if (name.includes('meditation')) return <span className="font-bold text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded">Dhyan Hall</span>;
    if (name.includes('yoga')) return <span className="font-bold text-[9px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded">Yoga</span>;
    if (name.includes('cow') || name.includes('shelter')) return <span className="font-bold text-[9px] bg-yellow-500/10 text-yellow-700 px-2 py-0.5 rounded">Goshala</span>;
    if (name.includes('river') || name.includes('view')) return <span className="font-bold text-[9px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">Ganga View</span>;
    return <span className="font-bold text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{amName}</span>;
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse bg-card rounded-3xl h-80 border border-border" />;
  }

  const galleryImages = ashram?.images || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#ff9933] text-white text-[9px] font-bold rounded-lg flex items-center gap-1 shadow">
              <ShieldCheck size={12} /> Government Verified
            </span>
            <span className="text-xs text-gray-500 font-extrabold tracking-widest uppercase">
              {ashram.address?.city}, {ashram.address?.state}
            </span>
          </div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-[#0c1a30] dark:text-white leading-tight">
            {ashram.name}
          </h2>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={12} className="text-[#ff9933]" /> {ashram.address?.street}, Pin: {ashram.address?.pincode}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-2.5 border border-yellow-200/50 rounded-2xl shadow-inner shrink-0">
          <Star className="text-accent fill-accent" size={20} />
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-[#0c1a30] dark:text-white">{ashram.rating?.average} / 5</span>
            <span className="text-[9px] text-gray-400 font-bold uppercase">{ashram.rating?.count} reviews</span>
          </div>
        </div>
      </div>

      {/* Mosaic Collage Photo Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[350px]">
        {/* Main large image */}
        <div className="lg:col-span-2 rounded-3xl overflow-hidden relative shadow-sm">
          <img 
            src={galleryImages[activeImageIndex] || galleryImages[0]} 
            alt="Hero Ashram View" 
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80'; }}
          />
        </div>
        
        {/* Smaller grid images */}
        <div className="lg:col-span-2 grid grid-cols-3 gap-2 overflow-y-auto pr-1">
          {galleryImages.map((img: string, idx: number) => (
            <div 
              key={idx} 
              onClick={() => setActiveImageIndex(idx)}
              className={`h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${idx === activeImageIndex ? 'border-[#ff9933] shadow-md' : 'border-transparent opacity-85 hover:opacity-100'}`}
            >
              <img 
                src={img} 
                alt={`Gallery index ${idx}`} 
                className="w-full h-full object-cover" 
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80'; }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Ashram Details */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* About description & History */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Compass size={18} className="text-[#ff9933]" /> About the Retreat
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">{ashram.description}</p>
            
            {ashram.history && (
              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-xs font-bold text-[#ff9933] flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles size={14} /> Historical Significance
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed italic bg-gray-50/50 dark:bg-slate-900/10 p-3 rounded-2xl border border-dashed border-border">
                  "{ashram.history}"
                </p>
              </div>
            )}
          </div>

          {/* Amenities & Facilities */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Award size={18} className="text-[#ff9933]" /> Facilities & Spiritual Activities
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
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Bed size={18} className="text-[#ff9933]" /> Available Room Categories
            </h3>
            <div className="space-y-4">
              {rooms.map((r) => (
                <div 
                  key={r._id} 
                  onClick={() => setSelectedRoom(r)}
                  className={`p-4 border rounded-2xl cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${selectedRoom?._id === r._id ? 'border-[#ff9933] bg-[#ff9933]/5 shadow-sm' : 'border-border hover:bg-gray-50/50 dark:hover:bg-slate-800/10'}`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-secondary dark:text-white">{r.name}</span>
                    <span className="text-[10px] text-gray-400 block font-bold capitalize tracking-wide">{r.type.replace('_', ' ')} • {r.acType} • Capacity: {r.capacity} Guests</span>
                    <p className="text-[10px] text-gray-500 max-w-md">{r.description || 'Simple clean room with standard Vedic facilities.'}</p>
                  </div>
                  <div className="flex flex-col sm:items-end text-left sm:text-right shrink-0">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bed Rate</span>
                    <span className="text-sm font-extrabold text-[#0c1a30] dark:text-accent">₹{r.basePrice} / night</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Availability Calendar */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <CalendarIcon size={18} className="text-[#ff9933]" /> 30-Day Room Availability Grid
            </h3>
            
            <p className="text-[10px] text-gray-400 font-semibold uppercase">
              Showing Availability for: <span className="text-secondary dark:text-white font-extrabold">{selectedRoom?.name || 'Selected Room'}</span>
            </p>

            {loadingCalendar ? (
              <div className="h-20 bg-gray-50 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
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
                          status === 'almost_full' ? 'bg-[#ff9933]/10 border-[#ff9933]/20 text-[#ff9933]' :
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

                <div className="flex flex-wrap gap-4 pt-2 justify-center border-t border-border text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-success/20 border border-success/30 rounded" /> Available</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded" /> Limited</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#ff9933]/20 border border-[#ff9933]/30 rounded" /> Almost Full</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-danger/20 border border-danger/30 rounded" /> Sold Out</span>
                </div>
              </div>
            )}
          </div>

          {/* Rules & Policies */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Info size={18} className="text-[#ff9933]" /> Rules & Policies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-[#ff9933] uppercase tracking-wider text-[10px]">Guidelines for Guests</h4>
                <ul className="text-gray-500 space-y-2 list-disc pl-5">
                  {ashram.rules?.map((rule: string, i: number) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-[#ff9933] uppercase tracking-wider text-[10px]">Check-in Policies</h4>
                <div className="space-y-1.5 text-gray-500">
                  <p><strong>Check-in Time:</strong> 12:00 PM</p>
                  <p><strong>Check-out Time:</strong> 11:00 AM</p>
                  <p><strong>Nearby Attractions:</strong> {ashram.nearbyAttractions?.join(', ') || 'Temples & Ghats'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0c1a30] dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Star size={18} className="text-[#ff9933]" /> Guest Reviews ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No reviews posted yet for this ashram stay.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div key={rev._id} className="p-4 bg-gray-50/50 dark:bg-slate-900/10 border border-border rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-secondary dark:text-white">{rev.customerId?.name}</span>
                      <span className="flex items-center gap-0.5 px-2 py-0.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 rounded-lg text-[10px] font-bold">
                        <Star size={10} className="fill-accent text-accent" /> {rev.rating?.overall} / 5
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">"{rev.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Booking Stepper Engine & Map Widget */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ff9933] to-[#0c1a30]" />
            <h3 className="font-extrabold text-sm text-[#0c1a30] dark:text-white flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#ff9933]" /> Stay Booking Engine
            </h3>

            {bookingError && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/25 text-xs rounded-xl font-bold">
                {bookingError}
              </div>
            )}

            {!bookingSuccess ? (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Dates selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Check In</label>
                    <input
                      type="date"
                      required
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Check Out</label>
                    <input
                      type="date"
                      required
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Selected Room Details */}
                <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border border-border rounded-2xl space-y-1 select-none">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Active Category</span>
                  <span className="text-xs font-extrabold text-secondary dark:text-white block leading-tight">{selectedRoom?.name}</span>
                  <span className="text-[10px] font-bold text-[#ff9933]">₹{selectedRoom?.basePrice} / bed per night</span>
                </div>

                {/* Stepper counts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Guests Count</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(parseInt(e.target.value) || 1)}
                      className="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-center font-bold"
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
                      className="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-center font-bold"
                    />
                  </div>
                </div>

                {/* Add ons */}
                <div className="pt-3 border-t border-border space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Add-on Services</span>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Coffee size={14} className="text-[#ff9933]" />
                        <span>Vegetarian Prasad Meals</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={meals}
                        onChange={() => setMeals(!meals)}
                        className="rounded border-border text-[#ff9933] w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ParkingCircle size={14} className="text-[#ff9933]" />
                        <span>Reserved Parking Slot</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={parking}
                        onChange={() => setParking(!parking)}
                        className="rounded border-border text-[#ff9933] w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-[#ff9933]" />
                        <span>Safe Locker Access</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={locker}
                        onChange={() => setLocker(!locker)}
                        className="rounded border-border text-[#ff9933] w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

                {/* Donation */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    Voluntary Ashram Donation (₹) <Heart size={10} className="text-danger" />
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={donation}
                    onChange={(e) => setDonation(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-[#ff9933] to-[#0c1a30] text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 transition-all"
                >
                  Book Sacred Stay <ArrowRight size={14} />
                </button>
              </form>
            ) : (
              /* Invoice Break & Mock Payment */
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="p-3 bg-success/15 border border-success/30 rounded-xl text-success text-center">
                  <span className="text-xs font-bold block">Stay Locked Successfully!</span>
                  <span className="text-[10px]">Booking Reference: {bookingSuccess.bookingId}</span>
                </div>

                <div className="bg-background border border-border rounded-2xl p-4 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block border-b border-border pb-1">Billing Invoice Breakdown</span>
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>Base Room Stay:</span>
                    <span>₹{bookingSuccess.pricing?.basePrice}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>Add-on Services:</span>
                    <span>₹{bookingSuccess.pricing?.servicesPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>Voluntary Donation:</span>
                    <span>₹{bookingSuccess.pricing?.donationAmount}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#0c1a30] dark:text-white pt-2 border-t border-dashed border-border">
                    <span>Total Bill:</span>
                    <span>₹{bookingSuccess.pricing?.totalAmount}</span>
                  </div>
                </div>

                <button
                  onClick={handleConfirmMockPayment}
                  className="w-full py-3 bg-[#ff9933] hover:bg-[#e68a00] text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Pay ₹{bookingSuccess.pricing?.totalAmount} via Gateway
                </button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3">
            <h4 className="font-bold text-xs text-secondary dark:text-white">Contact Ashram Trust</h4>
            <div className="space-y-2 text-[11px] text-gray-500">
              <p className="flex items-center gap-1.5"><Phone size={12} className="text-[#ff9933]" /> {ashram.ownerId?.phone || '+91 135 244 0001'}</p>
              <p className="flex items-center gap-1.5"><Mail size={12} className="text-[#ff9933]" /> {ashram.email || 'stay@trust.in'}</p>
              {ashram.website && (
                <p className="flex items-center gap-1.5"><Globe size={12} className="text-[#ff9933]" /> {ashram.website}</p>
              )}
            </div>
          </div>

          {/* Simulation Map Card */}
          <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-3 text-center relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <Map className="text-[#ff9933]" size={24} />
            <h4 className="text-xs font-bold">Retreat Location coordinates</h4>
            <p className="text-[9px] text-gray-400">Lat: {ashram.address?.coordinates?.coordinates?.[1]} , Lon: {ashram.address?.coordinates?.coordinates?.[0]}</p>
            <button className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-bold">
              View Google Maps
            </button>
          </div>
        </div>

      </div>

      {/* Related stays */}
      {relatedStays.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-border">
          <div className="space-y-1">
            <span className="text-xs uppercase font-extrabold text-[#ff9933] tracking-widest">More Places</span>
            <h3 className="text-lg md:text-2xl font-extrabold text-[#0c1a30] dark:text-white">Related Stays in {ashram.address?.city}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedStays.map((rel) => (
              <Link 
                key={rel._id} 
                to={`/ashram/${rel._id}`}
                className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1"
              >
                <div className="h-40 overflow-hidden relative bg-gray-100 dark:bg-slate-800">
                  <img 
                    src={rel.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'} 
                    alt={rel.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80'; }}
                  />
                  <span className="absolute bottom-3 right-3 bg-white/95 text-secondary px-2 py-0.5 rounded shadow text-[9px] font-extrabold flex items-center gap-0.5">
                    <Star className="text-accent fill-accent" size={10} /> {rel.rating?.average}
                  </span>
                </div>
                <div className="p-4 flex-grow">
                  <h4 className="font-extrabold text-xs text-[#0c1a30] dark:text-white line-clamp-1">{rel.name}</h4>
                  <span className="text-[9px] text-[#ff9933] font-bold block uppercase">{rel.address?.city}</span>
                </div>
                <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10">
                  <span className="text-[10px] font-extrabold text-[#0c1a30] dark:text-accent">₹{rel.lowestNightPrice || 150} / night</span>
                  <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">View <ChevronRight size={10} /></span>
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
