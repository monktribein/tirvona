import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { ashramService, reviewService } from '../services';
import { Reveal } from '../components/Reveal';
import { DatePicker } from '../components/DatePicker';
import heroBg from '../assets/rishikesh-tera-manzil-temple.jpg';
import heroPng from '../assets/hero.png';
import {
  Search,
  MapPin,
  Map as MapIcon,
  Calendar,
  Users,
  ShieldCheck,
  Star,
  CheckCircle,
  Compass,
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Heart,
  LayoutGrid,
  Shield,
  Activity,
  Bed,
  ChevronDown,
  Headphones,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [stayType, setStayType] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');

  const [ashrams, setAshrams] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'top_rated' | 'most_booked' | 'recent' | 'govt_recom'>('top_rated');
  const [searchTab, setSearchTab] = useState<'destinations' | 'stay' | 'darshan' | 'experiences'>('destinations');
  const [activeService, setActiveService] = useState<number>(0);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const guestsRef = useRef<HTMLDivElement>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const guestOptions = [
    { value: '1', label: '1 Person' },
    { value: '2', label: '1 - 2 People' },
    { value: '3', label: '3 - 4 People' },
    { value: '5', label: '5+ People' },
  ];

  const activityOptions = [
    { value: '', label: 'Trip Type' },
    { value: 'ashram', label: 'Ashram Stay' },
    { value: 'dharamshala', label: 'Dharamshala' },
    { value: 'temple', label: 'Temple Guest House' },
  ];

  const carouselRef = useRef<HTMLDivElement>(null);
  const prashadRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStays();
    fetchOffers();
    fetchFeedbacks();
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (guestsRef.current && !guestsRef.current.contains(event.target as Node)) {
        setGuestsOpen(false);
      }
      if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
        setActivityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOffers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/offers/public/active`);
      if (res.data.success) {
        setOffers(res.data.data);
      }
    } catch (err) {
      console.error('Fetch active offers error:', err);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const res = await reviewService.recent();
      if (res.data.success) setFeedbacks(res.data.data);
    } catch (err) {
      console.error('Fetch recent reviews error:', err);
    }
  };

  // Continuous silky smooth 60 FPS auto-scroll for all carousels (Destinations, Prasad, Accommodations, Feedback)
  useEffect(() => {
    // Infinite auto-scrolling marquee for every horizontal card row.
    // - seamless loop (items are duplicated; we wrap by one copy's width)
    // - pauses on hover
    // - manual mouse drag / native touch swipe while paused
    // - resumes smoothly from wherever the user left it
    const rows = [carouselRef.current, prashadRef.current, featuredRef.current, feedbackRef.current]
      .filter(Boolean) as HTMLDivElement[];
    if (rows.length === 0) return;

    const SPEED = 0.6; // px per frame (~36px/sec at 60fps)

    type RowState = {
      pos: number; hovered: boolean; dragging: boolean; touching: boolean;
      didDrag: boolean; startX: number; startScroll: number;
    };
    const st = new Map<HTMLDivElement, RowState>();
    const disposers: Array<() => void> = [];

    rows.forEach((c) => {
      const s: RowState = {
        pos: c.scrollLeft, hovered: false, dragging: false, touching: false,
        didDrag: false, startX: 0, startScroll: 0,
      };
      st.set(c, s);

      const onEnter = () => { s.hovered = true; };
      const onLeave = () => { s.hovered = false; };

      // Mouse drag-to-scroll (touch uses native scrolling)
      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        s.dragging = true;
        s.didDrag = false;
        s.startX = e.pageX;
        s.startScroll = c.scrollLeft;
        c.style.userSelect = 'none';
        const onMove = (ev: PointerEvent) => {
          const dx = ev.pageX - s.startX;
          if (Math.abs(dx) > 5) s.didDrag = true;
          c.scrollLeft = s.startScroll - dx;
          s.pos = c.scrollLeft;
          ev.preventDefault();
        };
        const onUp = () => {
          s.dragging = false;
          s.pos = c.scrollLeft;
          c.style.userSelect = '';
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };

      // Swallow the click that follows a real drag so a card doesn't navigate.
      const onClickCapture = (e: MouseEvent) => {
        if (s.didDrag) { e.preventDefault(); e.stopPropagation(); s.didDrag = false; }
      };

      const onTouchStart = () => { s.touching = true; };
      const onTouchEnd = () => { s.touching = false; s.pos = c.scrollLeft; };

      c.addEventListener('mouseenter', onEnter);
      c.addEventListener('mouseleave', onLeave);
      c.addEventListener('pointerdown', onPointerDown as EventListener);
      c.addEventListener('click', onClickCapture as EventListener, true);
      c.addEventListener('touchstart', onTouchStart, { passive: true });
      c.addEventListener('touchend', onTouchEnd, { passive: true });
      c.addEventListener('touchcancel', onTouchEnd, { passive: true });

      disposers.push(() => {
        c.removeEventListener('mouseenter', onEnter);
        c.removeEventListener('mouseleave', onLeave);
        c.removeEventListener('pointerdown', onPointerDown as EventListener);
        c.removeEventListener('click', onClickCapture as EventListener, true);
        c.removeEventListener('touchstart', onTouchStart);
        c.removeEventListener('touchend', onTouchEnd);
        c.removeEventListener('touchcancel', onTouchEnd);
      });
    });

    let animationFrameId: number;
    const step = () => {
      rows.forEach((c) => {
        const s = st.get(c);
        if (!s) return;
        const half = c.scrollWidth / 2; // width of one copy of the duplicated items
        if (half <= 0) return;
        if (s.hovered || s.dragging || s.touching) {
          // Paused — mirror any manual scroll so we resume from here (no jump).
          s.pos = c.scrollLeft;
          return;
        }
        let pos = s.pos + SPEED;
        while (pos >= half) pos -= half; // wrap onto the identical 2nd copy → seamless
        while (pos < 0) pos += half;
        s.pos = pos;
        c.scrollLeft = pos;
      });
      animationFrameId = requestAnimationFrame(step);
    };
    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
      disposers.forEach((d) => d());
    };
  }, [loading]);

  const fetchStays = async () => {
    try {
      const res = await ashramService.search({ verified: 'true' });
      if (res.data.success) setAshrams(res.data.data);
    } catch (err) {
      console.error('Error fetching stays:', err);
      setAshrams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (stayType) params.set('type', stayType);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', guests);
    if (searchTab && searchTab !== 'destinations') params.set('tab', searchTab);
    navigate(`/search?${params.toString()}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const valueLower = val.toLowerCase();
    const matches: Set<string> = new Set();
    ['Haridwar', 'Rishikesh', 'Vrindavan'].forEach(city => {
      if (city.toLowerCase().startsWith(valueLower)) matches.add(city);
    });
    ashrams.forEach(ashram => {
      if (ashram.name.toLowerCase().includes(valueLower)) matches.add(ashram.name);
    });
    ['Meditation Hall', 'River View', 'Cow Shelter', 'Yoga', 'Pure Vegetarian Food'].forEach(am => {
      if (am.toLowerCase().includes(valueLower)) matches.add(am);
    });
    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };

  const selectSuggestion = (sug: string) => {
    setDestination(sug);
    setShowSuggestions(false);
  };

  const getTabbedAshrams = () => {
    if (activeTab === 'top_rated') return [...ashrams].sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)).slice(0, 6);
    if (activeTab === 'most_booked') return [...ashrams].sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0)).slice(0, 6);
    if (activeTab === 'recent') return [...ashrams].slice(-6).reverse();
    if (activeTab === 'govt_recom') return ashrams.filter(a => (a.rating?.average || 0) >= 4.6).slice(0, 6);
    return ashrams.slice(0, 6);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  // Destinations for carousel
  const sacredDestinations = [
    { name: 'Rishikesh', state: 'Uttarakhand', rating: '4.9', tours: '12 Stays', img: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=500&q=80' },
    { name: 'Vrindavan', state: 'Uttar Pradesh', rating: '4.8', tours: '18 Ashrams', img: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1608958416801-9c60e3a6a908?auto=format&fit=crop&w=500&q=80' },
    { name: 'Haridwar', state: 'Uttarakhand', rating: '4.8', tours: '15 Stays', img: 'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=500&q=80' },
    { name: 'Kedarnath', state: 'Uttarakhand', rating: '4.8', tours: '08 Circuits', img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80' },
    { name: 'Varanasi', state: 'Uttar Pradesh', rating: '4.7', tours: '20 Stays', img: 'https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80' },
    { name: 'Tirupati', state: 'Andhra Pradesh', rating: '4.8', tours: '14 Stays', img: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=500&q=85' },
    { name: 'Rameswaram', state: 'Tamil Nadu', rating: '4.7', tours: '10 Stays', img: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80' },
    { name: 'Shirdi', state: 'Maharashtra', rating: '4.6', tours: '16 Stays', img: 'https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=500&q=80' },
    { name: 'Ayodhya', state: 'Uttar Pradesh', rating: '4.7', tours: '25 Stays', img: 'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=500&q=80' },
  ];

  // Popular Prashad from Ashrams & Temples for carousel
  const popularPrashad = [
    { name: 'Puri Mahaprasad', img: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80' },
    { name: 'Tirupati Laddu', img: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80' },
    { name: 'Mathura Peda', img: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80' },
    { name: 'Varanasi Peda', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80' },
    { name: 'Ayodhya Prashad', img: 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80' },
    { name: 'Shirdi Sai Halwa', img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80', fallback: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=500&q=80' },
  ];

  // Customer feedback derived from real approved reviews.
  const customerFeedbacks = feedbacks.map((r) => ({
    name: r.ashramId?.name || 'Verified Stay',
    location: r.ashramId?.address
      ? [r.ashramId.address.city, r.ashramId.address.state].filter(Boolean).join(', ')
      : '',
    reviewer: r.customerId?.name || 'Verified Guest',
    rating: Math.max(1, Math.round(r.rating?.overall || 5)),
    ratingValue: (r.rating?.overall || 5).toFixed(1),
    comment: r.comment,
    img: r.ashramId?.images?.[0] || '/banner/ashram_rishikesh.png',
  }));

  // 12-icon service strip aligned with Tirvona Theme & Routing
  const serviceIcons = [
    { id: 'circuits', label: 'Pilgrimage\nCircuits', icon: MapPin, category: 'circuits', target: '/search' },
    { id: 'temples', label: 'Temple\nDetails', icon: Compass, category: 'temples', target: '/search' },
    { id: 'guides', label: 'Travel\nGuides', icon: BookOpen, category: 'guides', target: '/faq' },
    { id: 'events', label: 'Events &\nFestivals', icon: Sparkles, category: 'events', target: '/search' },
    { id: 'local_guides', label: 'Local\nGuides', icon: Users, category: 'local_guides', target: '/search' },
    { id: 'cabs', label: 'Transport &\nCabs', icon: MapIcon, category: 'cabs', target: '/search' },
    { id: 'prasad', label: 'Restaurants\n& Prasad', icon: Activity, category: 'prasad', target: '#prashad-section' },
    { id: 'shops', label: 'Shops &\nServices', icon: LayoutGrid, category: 'shops', target: '/search' },
    { id: 'puja', label: 'Puja\nItems', icon: Heart, category: 'puja', target: '/search' },
    { id: 'products', label: 'Religious\nProducts', icon: Award, category: 'products', target: '/search' },
    { id: 'books', label: 'Books &\nMedia', icon: BookOpen, category: 'books', target: '/search' },
    { id: 'handicrafts', label: 'Handicrafts\n& Gifts', icon: Sparkles, category: 'handicrafts', target: '/search' },
  ];

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">

      {/* ══════════════════════ HERO SECTION (Full Width with Rounded Bottom Corners) ══════════════════════ */}
      <section className="relative pt-28 sm:pt-36 lg:pt-40 pb-40 sm:pb-52 lg:pb-60 min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] flex items-center overflow-hidden rounded-b-[36px] sm:rounded-b-[48px] shadow-xl">

        {/* Background Image Container */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Rishikesh Tera Manzil Temple"
            className="w-full h-full object-cover object-[center_25%]"
            loading="eager"
          />
          {/* Subtle gradient overlay to enhance temple colors while ensuring sharp text contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/85 via-[#0B192C]/40 to-black/15 dark:from-[#070F1B]/95 dark:via-[#070F1B]/60 dark:to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex justify-center">
          <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-6 text-center flex flex-col items-center">

            {/* Simple text label hero eyebrow aligned with main heading */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-4 sm:mb-5 block"
            >
              <span
                className="text-lg sm:text-xl block leading-tight"
                style={{
                  fontFamily: "Kalam, cursive, sans-serif",
                  fontWeight: 700,
                  color: '#E58C28',
                }}
              >
                Welcome to Sacred Destinations
              </span>
            </motion.div>

            {/* Main Display Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] xl:text-[58px] font-black text-white drop-shadow-md leading-[1.15]"
              style={{
                fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif",
                letterSpacing: '-0.03em',
              }}
            >
              <span className="block whitespace-nowrap">Connecting Sacred Destinations,</span>
              <span className="block whitespace-nowrap text-[#D4AF37] mt-1 sm:mt-1.5">Empowering Communities.</span>
            </motion.h1>

            {/* Body paragraph per requested specs: Satoshi 500 #6B6B6B / text-slate-200 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[#E2E8F0] dark:text-[#6B6B6B] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto text-center drop-shadow-xs"
              style={{
                fontFamily: "Satoshi, 'General Sans', Manrope, Inter, sans-serif",
                fontWeight: 500,
              }}
            >
              Plan your pilgrimage, book stays, explore holy places, shop spiritual products and contribute to a greater cause.
            </motion.p>

            {/* Hero Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-4 pt-2"
            >
              {/* Primary Pill Button */}
              <button
                onClick={() => navigate('/search')}
                className="bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs sm:text-sm font-bold pl-5 pr-1.5 py-2 rounded-full flex items-center gap-3 shadow-md hover:shadow-lg transition-all cursor-pointer group border border-white/20"
              >
                <span>Explore Sacred Stays</span>
                <div className="w-7 h-7 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-1 shadow-xs">
                  <ArrowRight size={14} className="stroke-[2.5]" />
                </div>
              </button>

              {/* Secondary Pill Button */}
              <button
                onClick={() => navigate('/search')}
                className="bg-white/90 backdrop-blur-md hover:bg-white text-[#0B192C] text-xs sm:text-sm font-bold pl-5 pr-1.5 py-2 rounded-full flex items-center gap-3 shadow-md hover:shadow-lg transition-all cursor-pointer group"
              >
                <span>Popular Destinations</span>
                <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center transition-transform group-hover:translate-x-1 shadow-xs">
                  <ArrowRight size={14} className="stroke-[2.5]" />
                </div>
              </button>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════ FLOATING BOOKING & SEARCH CARD (Overlapping Hero 50%) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-24 sm:-mt-32 lg:-mt-36 z-30 relative mb-12 sm:mb-16 lg:mb-20">

        {/* Category Tabs Floating Bar (Centered Pill Container) */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 shadow-lg shadow-[#0B192C]/10">
            {[
              { id: 'destinations', icon: <Compass size={14} />, label: 'Destinations' },
              { id: 'stay', icon: <Bed size={14} />, label: 'Stay' },
              { id: 'darshan', icon: <Heart size={14} />, label: 'Darshan & Seva' },
              { id: 'experiences', icon: <Sparkles size={14} />, label: 'Experiences' },
            ].map(tab => {
              const active = searchTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setSearchTab(tab.id as any)}
                  whileTap={{ scale: 0.94 }}
                  className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-colors duration-200 ${active
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] dark:hover:text-white'
                    }`}
                >
                  {active && (
                    <motion.span
                      layoutId="searchTabPill"
                      className="absolute inset-0 rounded-full bg-[#0A4DA6] shadow-md shadow-[#0A4DA6]/30"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <motion.span layout className="relative z-10 flex items-center gap-2">
                    {tab.icon} {tab.label}
                  </motion.span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Main Search Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[28px] sm:rounded-[36px] shadow-2xl shadow-[#0B192C]/15 border border-gray-100 dark:border-slate-800/80 p-4 sm:p-5 lg:p-6">
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-0 items-center">

            {/* Field 1: DESTINATIONS */}
            <div className="lg:col-span-3 relative lg:pr-4 lg:border-r border-gray-200 dark:border-slate-800" ref={autocompleteRef}>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">Destinations</label>
              <div className="relative flex items-center">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2.5">
                  <MapPin size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Where to next..."
                  value={destination}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-transparent border-none p-0 text-xs sm:text-sm font-bold focus:outline-none text-[#0B192C] dark:text-white placeholder:text-gray-400"
                />
                <ChevronDown size={14} className="text-gray-400 pointer-events-none ml-1 shrink-0" />
              </div>
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs"
                  >
                    {suggestions.map((sug, i) => (
                      <button key={i} type="button" onClick={() => selectSuggestion(sug)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 last:border-b-0 cursor-pointer">
                        <Compass size={13} className="text-[#0A4DA6]" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Field 2: ALL ACTIVITY */}
            <div className="lg:col-span-2 relative lg:px-4 lg:border-r border-gray-200 dark:border-slate-800">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">All Activity</label>
              <div className="relative flex items-center" ref={activityRef}>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2">
                  <Bed size={15} />
                </div>
                <button
                  type="button"
                  onClick={() => setActivityOpen(o => !o)}
                  className="w-full text-left bg-transparent p-0 pr-5 text-xs sm:text-sm font-bold focus:outline-none cursor-pointer text-[#0B192C] dark:text-white truncate"
                >
                  {activityOptions.find(o => o.value === stayType)?.label || 'Trip Type'}
                </button>
                <ChevronDown size={14} className={`absolute right-0 text-gray-400 pointer-events-none transition-transform duration-200 ${activityOpen ? 'rotate-180' : ''}`} />

                <AnimatePresence>
                  {activityOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 top-full mt-3 w-full min-w-[176px] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-[#0B192C]/10 overflow-hidden z-50 p-1.5"
                    >
                      {activityOptions.map(opt => {
                        const active = stayType === opt.value;
                        return (
                          <button
                            key={opt.value || 'any'}
                            type="button"
                            onClick={() => { setStayType(opt.value); setActivityOpen(false); }}
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors ${active
                              ? 'bg-[#0A4DA6] text-white'
                              : 'text-[#0B192C] dark:text-gray-200 hover:bg-[#0A4DA6]/10 hover:text-[#0A4DA6] dark:hover:text-white'
                              }`}
                          >
                            <span>{opt.label}</span>
                            {active && <CheckCircle size={13} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Field 3: CHECK IN */}
            <div className="lg:col-span-2 relative lg:px-4 lg:border-r border-gray-200 dark:border-slate-800">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">Check In</label>
              <div className="relative flex items-center">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2">
                  <Calendar size={15} />
                </div>
                <DatePicker value={checkIn} onChange={setCheckIn} />
              </div>
            </div>

            {/* Field 4: CHECK OUT */}
            <div className="lg:col-span-2 relative lg:px-4 lg:border-r border-gray-200 dark:border-slate-800">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">Check Out</label>
              <div className="relative flex items-center">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2">
                  <Calendar size={15} />
                </div>
                <DatePicker value={checkOut} onChange={setCheckOut} min={checkIn} />
              </div>
            </div>

            {/* Field 4: GUESTS & SEARCH */}
            <div className="lg:col-span-3 relative lg:pl-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">Guests</label>
                <div className="relative flex items-center" ref={guestsRef}>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2.5">
                    <Users size={16} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestsOpen(o => !o)}
                    className="w-full text-left bg-transparent p-0 pr-5 text-xs sm:text-sm font-bold focus:outline-none cursor-pointer text-[#0B192C] dark:text-white truncate"
                  >
                    {guestOptions.find(o => o.value === guests)?.label || '1 Person'}
                  </button>
                  <ChevronDown size={14} className={`absolute right-0 text-gray-400 pointer-events-none transition-transform duration-200 ${guestsOpen ? 'rotate-180' : ''}`} />

                  <AnimatePresence>
                    {guestsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute right-0 top-full mt-3 w-full min-w-[160px] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-[#0B192C]/10 overflow-hidden z-50 p-1.5"
                      >
                        {guestOptions.map(opt => {
                          const active = guests === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => { setGuests(opt.value); setGuestsOpen(false); }}
                              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors ${active
                                ? 'bg-[#0A4DA6] text-white'
                                : 'text-[#0B192C] dark:text-gray-200 hover:bg-[#0A4DA6]/10 hover:text-[#0A4DA6] dark:hover:text-white'
                                }`}
                            >
                              <span>{opt.label}</span>
                              {active && <CheckCircle size={13} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Search Button */}
              <button
                type="submit"
                className="bg-[#0A4DA6] hover:bg-[#083D85] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-none transition-all cursor-pointer shrink-0 active:scale-95 self-end"
              >
                <span>Search</span>
                <Search size={15} className="stroke-[2.5]" />
              </button>
            </div>

          </form>
        </div>

        {/* 12-icon service strip placed directly below booking system */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] mt-4 sm:mt-5 p-2 sm:p-2.5 shadow-lg shadow-[#0B192C]/5">
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-1.5">
            {serviceIcons.map((item, i) => {
              const IconComponent = item.icon;
              const isActive = activeService === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveService(i);
                    if (item.target.startsWith('#')) {
                      const el = document.querySelector(item.target);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      navigate(`${item.target}?category=${item.category}`);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 py-2.5 sm:py-3 px-1 text-center rounded-2xl transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/25 scale-[1.02]'
                      : 'hover:bg-blue-50/80 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] group-hover:bg-[#0A4DA6] group-hover:text-white'
                  }`}>
                    <IconComponent size={16} className="stroke-[2.5]" />
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-bold whitespace-pre-line text-center leading-tight ${
                    isActive ? 'text-white font-extrabold' : 'text-slate-700 dark:text-gray-300'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </section>

      {/* ══════════════════════ FEATURED OFFERS & FESTIVAL SPECIALS BANNER ══════════════════════ */}
      {offers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 lg:mb-20 mt-6">
          {/* Section Header matching Popular Destinations */}
          <div className="text-center space-y-2 mb-8 lg:mb-10">
            <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#E58C28]">
              Live Kumbh & Festival Specials
            </p>
            <h2 className="font-black text-[#0B192C] dark:text-white leading-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.25rem)' }}>
              Featured Pilgrimage Deals &amp;
              <span className="bg-[#0A4DA6] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-sm">Special</span>
              Offers
            </h2>
            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#0A4DA6] dark:text-amber-300 hover:text-[#E58C28] transition-all pt-1"
            >
              <span>Explore All Ashrams</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
            {offers.slice(0, 3).map((offer) => (
              <div
                key={offer._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E58C28] text-white text-[10px] font-black uppercase tracking-wider">
                      {offer.offerType}
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                      {offer.discountPercentage}% {offer.isRateUpgrade ? 'Rate Upgrade' : 'OFF'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] dark:group-hover:text-amber-300 transition-colors">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {offer.bannerText}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                  <div className="text-[10px] font-mono font-bold text-gray-400">
                    PROMO: <span className="bg-gray-100 dark:bg-white/10 text-[#0B192C] dark:text-amber-200 px-1.5 py-0.5 rounded font-black">{offer.promoCode}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/search?destination=${encodeURIComponent(offer.ashramId?.address?.city || '')}`)}
                    className="px-3.5 py-1.5 rounded-full bg-[#0A4DA6] text-white hover:bg-[#083b80] font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    <span>Book Now</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════ EVERYTHING YOU NEED ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-10 lg:mb-20 mt-6 lg:mt-0">
        {/* Section Header matching Popular Destinations */}
        <Reveal className="text-center space-y-2 mb-8 lg:mb-10">
          <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#E58C28]">
            What We Offer
          </p>
          <h2 className="font-black text-[#0B192C] dark:text-white leading-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.25rem)' }}>
            Everything You Need For A Blessed Journey<br />
            Explore <span className="bg-[#0A4DA6] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-sm">100+</span> Sacred Services
          </h2>
        </Reveal>

        {/* Service Cards: 1 col mobile, 2 col tablet, 3 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {/* Card 1 — Destinations (blue) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/search')}
          >
            <img
              src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=700&q=80"
              alt="Kedarnath Temple"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A4DA6]/95 via-[#0A4DA6]/75 to-[#0A4DA6]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Destinations <ArrowRight size={15} /></h3>
                <p className="text-xs text-blue-100/90 leading-relaxed">Explore sacred places, plan your trip and discover spiritual experiences.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#0A4DA6] font-extrabold text-xs rounded-full hover:bg-blue-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/search'); }}
              >
                Explore Destinations
              </button>
            </div>
          </div>

          {/* Card 2 — Local (logo blue) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=700&q=80"
              alt="Rishikesh Local Street"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A4DA6]/95 via-[#0A4DA6]/75 to-[#0A4DA6]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Local <ArrowRight size={15} /></h3>
                <p className="text-xs text-blue-100/90 leading-relaxed">Find local services, guided tours, transport, food and more near you.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#0A4DA6] font-extrabold text-xs rounded-full hover:bg-blue-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/faq'); }}
              >
                Explore Local
              </button>
            </div>
          </div>

          {/* Card 3 — Marketplace (purple) */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer sm:col-span-2 lg:col-span-1"
            style={{ height: 'clamp(200px, 50vw, 260px)' }}
            onClick={() => navigate('/faq')}
          >
            <img
              src="https://images.unsplash.com/photo-1600618528240-fb9fc964b853?auto=format&fit=crop&w=700&q=80"
              alt="Spiritual Marketplace"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=700&q=80'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#6B21A8]/95 via-[#6B21A8]/75 to-[#6B21A8]/10" />
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div className="space-y-2 max-w-[70%]">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-200">Tirvona</p>
                <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 leading-tight">Marketplace <ArrowRight size={15} /></h3>
                <p className="text-xs text-purple-100/90 leading-relaxed">Shop spiritual products, puja items, books, handicrafts and more.</p>
              </div>
              <button
                className="self-start px-5 py-2.5 min-h-[40px] bg-white text-[#6B21A8] font-extrabold text-xs rounded-full hover:bg-purple-50 transition-all cursor-pointer shadow"
                onClick={e => { e.stopPropagation(); navigate('/faq'); }}
              >
                Visit Marketplace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ POPULAR SACRED DESTINATIONS (Matching Reference Image 2) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">

        {/* Banner with Image Background and Overlay Title */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl p-6 sm:p-10 lg:p-12 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[260px] border border-white/10">
          <img
            src="/banner/popular.png"
            alt="Popular Sacred Destinations Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle gradient overlay to ensure text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

          {/* Title and Eyebrow Content Overlay */}
          <div className="relative z-10 space-y-2 max-w-3xl">
            <p className="font-['Kalam'] text-base sm:text-xl font-bold text-[#E58C28] drop-shadow-md">
              Popular Destinations
            </p>
            <h2 className="font-black text-white leading-tight drop-shadow-lg" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.35rem)' }}>
              Discover The Amazing Sacred Places<br />
              Around India, <span className="bg-[#0A4DA6] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-md">50+</span> Cities
            </h2>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#0A4DA6] hover:bg-gray-100 text-xs font-extrabold shadow-lg transition-all cursor-pointer"
            >
              Explore All Destinations <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Modern Rounded Rectangle Cards Grid/Carousel */}
        <div
          ref={carouselRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: 'none' }}
        >
          {[...sacredDestinations, ...sacredDestinations].map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(`/search?destination=${encodeURIComponent(item.name)}${checkIn ? `&checkIn=${checkIn}` : ''}${checkOut ? `&checkOut=${checkOut}` : ''}${guests ? `&guests=${guests}` : ''}`)}
              className="flex-shrink-0 relative group cursor-pointer"
              style={{ width: 'clamp(200px, 48vw, 220px)' }}
            >
              {/* Modern Rounded Rectangle Card */}
              <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">

                {/* Image Container */}
                <div className="relative overflow-hidden bg-gray-100 dark:bg-slate-900" style={{ height: 'clamp(170px, 40vw, 190px)' }}>
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = item.fallback; }}
                  />
                </div>

                {/* Centered Bottom Info Area */}
                <div className="p-4 text-center flex flex-col items-center justify-center min-h-[72px]">
                  <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 font-bold mt-1 text-center">
                    {item.state}
                  </p>
                </div>

              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ══════════════════════ UPCOMING ARDH KUMBH FESTIVAL BANNER (100% Full Width Edge-to-Edge Hero Banner) ══════════════════════ */}
      <section className="relative w-full py-28 sm:py-36 lg:py-44 min-h-[540px] sm:min-h-[620px] lg:min-h-[700px] flex items-center justify-center overflow-hidden rounded-none shadow-2xl mb-14 lg:mb-24 group border-y border-white/10">
        <img
          src="/banner/upcominglogo.png"
          alt="Upcoming Ardh Kumbh Festival"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1600&q=80'; }}
        />
        {/* Subtle gradient overlay for high contrast text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/90 via-[#0B192C]/65 to-black/40 dark:from-[#070F1B]/95 dark:via-[#070F1B]/70 dark:to-transparent" />

        {/* Centered Hero Frame Banner Content Details */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center flex flex-col items-center">
          <div className="max-w-3xl space-y-5 text-center flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span
                className="text-lg sm:text-2xl block font-bold leading-tight"
                style={{
                  fontFamily: "Kalam, cursive, sans-serif",
                  color: '#E58C28',
                }}
              >
                Upcoming Sacred Event
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-black text-white drop-shadow-lg leading-tight"
            >
              Upcoming Ardh Kumbh Festival
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[#E2E8F0] text-sm sm:text-base leading-relaxed max-w-2xl font-medium drop-shadow-md"
            >
              Experience the divine spiritual gathering on the sacred banks of Ganga in Haridwar. Secure your holy ashram stay today for peace and divine blessings.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="pt-3"
            >
              <button
                onClick={() => navigate('/search?destination=Haridwar')}
                className="bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold text-xs sm:text-sm pl-7 pr-2 py-3 rounded-full flex items-center gap-3 shadow-2xl hover:shadow-primary/40 transition-all cursor-pointer group/btn border border-white/20"
              >
                <span>Book Now</span>
                <div className="w-8 h-8 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover/btn:translate-x-1 shadow-md">
                  <ArrowRight size={15} className="stroke-[2.5]" />
                </div>
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ POPULAR PRASHAD FROM ASHRAMS ══════════════════════ */}
      <section id="prashad-section" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">

        {/* Banner with Image Background and Overlay Title */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl p-6 sm:p-10 lg:p-12 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[260px] border border-white/10">
          <img
            src="/banner/prashadbanner.png"
            alt="Sacred Prasad Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle gradient overlay to ensure text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

          {/* Title and Eyebrow Content Overlay */}
          <div className="relative z-10 space-y-2 max-w-3xl">
            <p className="font-['Kalam'] text-base sm:text-xl font-bold text-[#E58C28] drop-shadow-md">
              Popular Prasad
            </p>
            <h2 className="font-black text-white leading-tight drop-shadow-lg" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.35rem)' }}>
              Sacred Mahaprasad From Holy Ashrams<br />
              Explore <span className="bg-[#0A4DA6] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-md">50+</span> Blessed Prasad Items
            </h2>
            <button
              type="button"
              onClick={() => navigate('/search?query=Prasad')}
              className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#0A4DA6] hover:bg-gray-100 text-xs font-extrabold shadow-lg transition-all cursor-pointer"
            >
              Explore All Prasad <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Modern Rounded Rectangle Cards Carousel showing ONLY title */}
        <div
          ref={prashadRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: 'none' }}
        >
          {[...popularPrashad, ...popularPrashad].map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(`/search?query=${encodeURIComponent(item.name)}`)}
              className="flex-shrink-0 relative group cursor-pointer"
              style={{ width: 'clamp(200px, 48vw, 220px)' }}
            >
              {/* Modern Rounded Rectangle Card */}
              <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">

                {/* Image Container */}
                <div className="relative overflow-hidden bg-gray-100 dark:bg-slate-900" style={{ height: 'clamp(170px, 40vw, 190px)' }}>
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = item.fallback; }}
                  />
                </div>

                {/* Centered Bottom Title Area */}
                <div className="p-4 text-center flex flex-col items-center justify-center min-h-[72px]">
                  <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center">
                    {item.name}
                  </h4>
                </div>

              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ══════════════════════ FEATURED RETREATS (Matching Codebase Design) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">

        {/* Banner with Image Background and Overlay Title */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl p-6 sm:p-10 lg:p-12 text-center flex flex-col items-center justify-center min-h-[200px] sm:min-h-[260px] border border-white/10">
          <img
            src="/banner/accomendation.png"
            alt="Featured Accommodations Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle gradient overlay to ensure text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />

          {/* Title and Eyebrow Content Overlay */}
          <div className="relative z-10 space-y-2 max-w-4xl">
            <p className="font-['Kalam'] text-base sm:text-xl font-bold text-[#E58C28] drop-shadow-md">
              Featured Accommodations
            </p>
            <h2 className="font-black text-white leading-tight drop-shadow-lg" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2.25rem)' }}>
              <span className="block">Discover Blessed Stays & Sacred Ashrams</span>
              <span className="block mt-1">
                Across India, <span className="bg-[#0A4DA6] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-md">100+</span> Verified Stays
              </span>
            </h2>
            <p className="text-[11px] text-gray-200 font-extrabold uppercase tracking-wider pt-1 drop-shadow-md">
              Govt Verified accommodations with daily prayer and vegetarian food
            </p>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-[#0A4DA6] hover:bg-gray-100 text-xs font-extrabold shadow-lg transition-all cursor-pointer"
            >
              Explore All Ashrams <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Centered Category Tabs */}
        <div className="flex justify-center border-b border-gray-100 dark:border-slate-800 gap-5 lg:gap-8 text-xs font-extrabold pb-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'top_rated', label: 'Top Rated' },
            { id: 'most_booked', label: 'Most Booked' },
            { id: 'recent', label: 'Recently Verified' },
            { id: 'govt_recom', label: 'Govt Recommended' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 flex items-center px-1 shrink-0 relative cursor-pointer transition-all ${activeTab === tab.id ? 'text-[#0A4DA6]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0A4DA6]" />}
            </button>
          ))}
        </div>

        {/* Modern Rounded Rectangle Cards Carousel */}
        {loading ? (
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="shrink-0 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" style={{ width: '220px', height: '260px' }} />
            ))}
          </div>
        ) : (
          <div ref={featuredRef} className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start" style={{ scrollbarWidth: 'none' }}>
            {[...getTabbedAshrams(), ...getTabbedAshrams()].map((ashram, idx) => (
              <motion.div
                key={`${ashram._id}-${idx}`}
                layout
                onClick={() => navigate(`/ashram/${ashram._id}${checkIn || checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}` : ''}`)}
                className="flex-shrink-0 relative group cursor-pointer"
                style={{ width: 'clamp(200px, 48vw, 220px)' }}
              >
                {/* Modern Rounded Rectangle Card */}
                <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">

                  {/* Image Container */}
                  <div className="relative overflow-hidden bg-gray-100 dark:bg-slate-900" style={{ height: 'clamp(170px, 40vw, 190px)' }}>
                    <img
                      src={ashram.images?.[0] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80'}
                      alt={ashram.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80'; }}
                    />
                    {/* Royal Navy Blue Price Badge */}
                    <span className="absolute top-3 left-3 bg-[#0A4DA6] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm">
                      ₹{ashram.lowestNightPrice ?? 150} / night
                    </span>
                    {/* Rating Badge — only when the ashram has real reviews */}
                    {ashram.rating?.count > 0 && (
                      <span className="absolute top-3 right-3 bg-white/95 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white text-[10px] font-extrabold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm">
                        <Star size={11} className="text-[#D4AF37] fill-[#D4AF37]" /> {ashram.rating.average}
                      </span>
                    )}
                  </div>

                  {/* Centered Bottom Title Area */}
                  <div className="p-4 text-center flex flex-col items-center justify-center min-h-[72px]">
                    <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center">
                      {ashram.name}
                    </h4>
                    <p className="text-[11px] text-gray-400 font-bold mt-1 text-center">
                      {ashram.address?.city}, {ashram.address?.state}
                    </p>
                    {ashram.rating?.count > 0 ? (
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        <Star size={11} className="text-[#D4AF37] fill-[#D4AF37]" />
                        <span className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">{ashram.rating.average}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">({ashram.rating.count} reviews)</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-semibold mt-1.5">No reviews yet</span>
                    )}
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}

      </section>



      {/* ══════════════════════ LATEST BLOG & NEWS SECTION (Matching Reference Image 1) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 lg:mb-20">
        <div className="bg-[#F4F8FC] dark:bg-[#071322]/60 rounded-[32px] py-10 sm:py-14 px-4 sm:px-8 border border-blue-100/60 dark:border-blue-900/30 shadow-sm relative overflow-hidden">

          {/* Section Header */}
          <Reveal className="text-center space-y-2 max-w-2xl mx-auto relative z-10">
            <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#E58C28]">
              Latest Blog & News
            </p>
            <h2 className="font-black text-[#0B192C] dark:text-white leading-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.25rem)' }}>
              Latest News & Spiritual Articles from<br />Our Blog Posts
            </h2>
          </Reveal>

          {/* 3 Blog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-8 sm:mt-10 relative z-10">

            {/* Blog Card 1 */}
            <div className="bg-white dark:bg-[#0B192C] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between border border-gray-100 dark:border-slate-800 group hover:-translate-y-1">
              <div>
                <div className="h-48 sm:h-52 overflow-hidden bg-gray-100 dark:bg-slate-900 relative">
                  <img
                    src="https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80"
                    alt="Ashram Stay Guide"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#0A4DA6]" /> 20 March 2025</span>
                    <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-[#0A4DA6]" /> Comments (5)</span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-snug line-clamp-2 group-hover:text-[#0A4DA6] transition-colors">
                    Essential Guide To Planning Your First Ashram Stay
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    We believe that every pilgrimage should be an unforgettable, peaceful, and spiritually rewarding experience.
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/60 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white font-extrabold text-xs flex items-center justify-center">
                    G
                  </div>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Gordon V.</span>
                </div>
                <button
                  onClick={() => navigate('/faq')}
                  className="px-3.5 py-1.5 bg-[#F0F5FC] dark:bg-blue-950/40 text-gray-700 dark:text-blue-300 hover:bg-[#0A4DA6] hover:text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Read More</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Blog Card 2 */}
            <div className="bg-white dark:bg-[#0B192C] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between border border-gray-100 dark:border-slate-800 group hover:-translate-y-1">
              <div>
                <div className="h-48 sm:h-52 overflow-hidden bg-gray-100 dark:bg-slate-900 relative">
                  <img
                    src="https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80"
                    alt="Temple Mahaprasad"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#0A4DA6]" /> 20 March 2025</span>
                    <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-[#0A4DA6]" /> Comments (5)</span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-snug line-clamp-2 group-hover:text-[#0A4DA6] transition-colors">
                    Sacred Mahaprasad: Traditions & History Across Holy Shrines
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    Discover the deep spiritual significance and traditional preparation of temple offerings across India.
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/60 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white font-extrabold text-xs flex items-center justify-center">
                    R
                  </div>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Richard K.</span>
                </div>
                <button
                  onClick={() => navigate('/faq')}
                  className="px-3.5 py-1.5 bg-[#F0F5FC] dark:bg-blue-950/40 text-gray-700 dark:text-blue-300 hover:bg-[#0A4DA6] hover:text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Read More</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Blog Card 3 */}
            <div className="bg-white dark:bg-[#0B192C] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between border border-gray-100 dark:border-slate-800 group hover:-translate-y-1">
              <div>
                <div className="h-48 sm:h-52 overflow-hidden bg-gray-100 dark:bg-slate-900 relative">
                  <img
                    src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80"
                    alt="Kedarnath Circuit"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#0A4DA6]" /> 20 March 2025</span>
                    <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-[#0A4DA6]" /> Comments (5)</span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-snug line-clamp-2 group-hover:text-[#0A4DA6] transition-colors">
                    Top 10 Sacred Destinations To Visit In Uttarakhand
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    Explore Himalayan pilgrimage circuits, holy rivers, ancient temples and serene meditation retreats.
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/60 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white font-extrabold text-xs flex items-center justify-center">
                    M
                  </div>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">M. Robinson</span>
                </div>
                <button
                  onClick={() => navigate('/faq')}
                  className="px-3.5 py-1.5 bg-[#F0F5FC] dark:bg-blue-950/40 text-gray-700 dark:text-blue-300 hover:bg-[#0A4DA6] hover:text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Read More</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ══════════════════════ CUSTOMER FEEDBACK & EXPERIENCES SLIDER ══════════════════════ */}
      {customerFeedbacks.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 lg:mb-20 space-y-8">

        {/* Section Header */}
        <Reveal className="text-center space-y-2">
          <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#E58C28]">
            Customer Feedback & Stories
          </p>
          <h2 className="font-black text-[#0B192C] dark:text-white leading-tight" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.25rem)' }}>
            Loved By Thousands Of Pilgrims<br />
            Explore <span className="bg-[#E58C28] text-white px-3 py-0.5 rounded-xl text-base sm:text-xl font-black inline-block align-middle mx-1 shadow-sm">4.9/5 ★</span> Real Experiences
          </h2>
        </Reveal>

        {/* Smooth 60FPS Sliding Gallery Carousel (Matching Reference Screenshot) */}
        <div
          ref={feedbackRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: 'none' }}
        >
          {[...customerFeedbacks, ...customerFeedbacks].map((fb, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 relative group cursor-pointer"
              style={{ width: 'clamp(240px, 50vw, 280px)' }}
            >
              {/* Rounded Image Card Container (Matching Reference Screenshot Aspect & Border Radius) */}
              <div className="w-full bg-white dark:bg-[#0B192C] rounded-[28px] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col hover:-translate-y-1.5 h-[340px] sm:h-[380px] relative">

                {/* Full Height Background Image */}
                <img
                  src={fb.img}
                  alt={fb.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />

                {/* Dark Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Overlay Card Content — fixed layout: rating top, review middle, user bottom */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between text-white z-10">
                  {/* Top: Star Rating Badge */}
                  <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full w-fit text-[#FFD700] text-xs font-bold border border-white/20 shadow-xs">
                    {[...Array(fb.rating)].map((_, i) => (
                      <Star key={i} size={11} className="fill-[#FFD700] text-[#FFD700]" />
                    ))}
                    <span className="text-white text-[10px] ml-1 font-extrabold">{fb.ratingValue}</span>
                  </div>

                  {/* Bottom: review text (fixed height) + user info */}
                  <div className="space-y-3">
                    <p className="text-xs text-gray-100 font-medium leading-relaxed italic line-clamp-4 min-h-[4.5rem] drop-shadow-xs">
                      "{fb.comment}"
                    </p>

                    <div className="pt-3 border-t border-white/20 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-white leading-none truncate">{fb.reviewer}</h4>
                        <p className="text-[10px] text-gray-300 font-semibold mt-1 truncate">{fb.name}{fb.location ? ` · ${fb.location}` : ''}</p>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center shadow-xs shrink-0">
                        <CheckCircle size={14} className="stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

      </section>
      )}







    </div>
  );
};
export default HomePage;
