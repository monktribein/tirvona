import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { ashramService, reviewService, marketplaceService } from "../services";
import { visitorArticleService } from "../services/visitorArticleService";
import { CouponVoucherCard } from "../components/CouponVoucherCard";
import { DatePicker } from "../components/DatePicker";
import { GuestRoomSelector } from "../components/shared/GuestRoomSelector";
import { useBookingSearch } from "../contexts/BookingSearchContext";
import { useAutoScroll } from "../hooks/useAutoScroll";
import heroBg from "../assets/rishikesh-tera-manzil-temple.jpg";
import {
  Search,
  MapPin,
  CircleParking,
  Calendar,
  ShieldCheck,
  Star,
  CheckCircle,
  Compass,
  ArrowRight,
  Sparkles,
  BookOpen,
  Play,
  ChevronLeft,
  Heart,
  LayoutGrid,
  Activity,
  Utensils,
  Bed,
  ChevronDown,
  Tag,
  HeartHandshake,
} from "lucide-react";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { searchState, updateBookingSearch, totalGuests } = useBookingSearch();
  const [destination, setDestination] = useState(searchState.destination || "");
  const [stayType, setStayType] = useState("");
  const [checkIn, setCheckIn] = useState(searchState.checkIn || "");
  const [checkOut, setCheckOut] = useState(searchState.checkOut || "");

  useEffect(() => {
    setDestination(searchState.destination || "");
    setCheckIn(searchState.checkIn || "");
    setCheckOut(searchState.checkOut || "");
  }, [searchState.destination, searchState.checkIn, searchState.checkOut]);

  const [ashrams, setAshrams] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "top_rated" | "most_booked" | "recent" | "govt_recom"
  >("top_rated");
  const [searchTab, setSearchTab] = useState<
    "destinations" | "stay" | "experiences"
  >("stay");
  const [activeService, setActiveService] = useState<number>(0);
  const [offerSlideIndex, setOfferSlideIndex] = useState<number>(0);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const activityOptions = [
    { value: "", label: "Trip Type" },
    { value: "ashram", label: "Ashram Stay" },
    { value: "dharamshala", label: "Dharamshala" },
    { value: "temple", label: "Temple Guest House" },
  ];

  const carouselRef = useRef<HTMLDivElement>(null);
  const prashadRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const offersRef = useRef<HTMLDivElement>(null);
  const blogRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const serviceStripRef = useRef<HTMLDivElement>(null);
  const setServiceStrip = useAutoScroll<HTMLDivElement>({
    forwardTo: serviceStripRef,
  });

  const [publishedCms, setPublishedCms] = useState<any>({});

  useEffect(() => {
    fetchStays();
    fetchOffers();
    fetchFeedbacks();
    fetchPublishedCms();
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
      if (
        activityRef.current &&
        !activityRef.current.contains(event.target as Node)
      ) {
        setActivityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPublishedCms = async () => {
    try {
      const res = await api.get("/cms/published");
      if (res.data?.success) {
        setPublishedCms(res.data.data);
      }
    } catch (err) {
      console.warn("Published CMS load:", err);
    }
  };

  const fetchOffers = async () => {
    try {
      const res = await api.get("/offers?status=active");
      if (res.data.success) {
        setOffers(res.data.data);
      }
    } catch (err) {
      console.error("Fetch active offers error:", err);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const res = await reviewService.recent();
      if (res.data.success) setFeedbacks(res.data.data);
    } catch (err) {
      console.error("Fetch recent reviews error:", err);
    }
  };

  // Continuous silky smooth 60 FPS auto-scroll for all carousels (Destinations, Prasad, Accommodations, Feedback)
  useEffect(() => {
    // Infinite auto-scrolling marquee for every horizontal card row.
    // - seamless loop (items are duplicated; we wrap by one copy's width)
    // - pauses on hover
    // - manual mouse drag / native touch swipe while paused
    // - resumes smoothly from wherever the user left it
    const rows = [
      carouselRef.current,
      prashadRef.current,
      featuredRef.current,
      feedbackRef.current,
      blogRef.current,
    ].filter(Boolean) as HTMLDivElement[];
    if (rows.length === 0) return;

    // Pixels per SECOND, not per frame. The old constant was per-frame, so the
    // marquee ran at double speed on a 120Hz display and visibly hitched
    // whenever a frame came late — the motion was tied to how often rAF fired
    // rather than to elapsed time.
    const SPEED = 36;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    type RowState = {
      pos: number;
      /**
       * Width of ONE copy of the duplicated items, including the gap that
       * follows the last card.
       *
       * Not `scrollWidth / 2`: with `gap-6` between N doubled cards the track
       * holds 2N-1 gaps, so half the scroll width lands half a gap short of the
       * seam and every wrap jumped ~12px sideways. Measuring to the offset of
       * the first card of the second copy is exact, whatever the gap.
       */
      period: number;
      visible: boolean;
      hovered: boolean;
      dragging: boolean;
      touching: boolean;
      didDrag: boolean;
      startX: number;
      startScroll: number;
    };
    const st = new Map<HTMLDivElement, RowState>();
    const disposers: Array<() => void> = [];

    rows.forEach((c) => {
      // index.css applies `scroll-behavior: smooth` to `*`. Under that rule the
      // `c.scrollLeft = pos` write at the bottom of step() does not move the box
      // directly — it starts an ANIMATED scroll towards `pos`. Doing that ~60
      // times a second means each new animation pre-empts the one before it, so
      // they cancel out and the row sits almost still. This is why these
      // carousels looked like the marquee simply was not running.
      // Force instant scrolling for the lifetime of the effect, and restore
      // whatever was there on cleanup. The arrow buttons keep animating because
      // scrollBy({ behavior: 'smooth' }) passes it explicitly, and the argument
      // beats the CSS property.
      const previousScrollBehavior = c.style.scrollBehavior;
      c.style.scrollBehavior = "auto";
      disposers.push(() => {
        c.style.scrollBehavior = previousScrollBehavior;
      });

      const s: RowState = {
        pos: c.scrollLeft,
        period: 0,
        visible: true,
        hovered: false,
        dragging: false,
        touching: false,
        didDrag: false,
        startX: 0,
        startScroll: 0,
      };
      st.set(c, s);

      // Measured on resize and on content change only — never inside the frame
      // loop. Reading scrollWidth/offsetLeft forces synchronous layout, and
      // doing that for five rows on every frame interleaves reads with the
      // scrollLeft writes below into classic layout thrash, which is what made
      // the motion judder.
      const measure = () => {
        const kids = c.children;
        s.period =
          kids.length >= 2 && kids.length % 2 === 0
            ? (kids[kids.length / 2] as HTMLElement).offsetLeft -
              (kids[0] as HTMLElement).offsetLeft
            : 0;
      };

      const resizeObserver = new ResizeObserver(measure);
      const observeAll = () => {
        resizeObserver.disconnect();
        resizeObserver.observe(c);
        for (const child of Array.from(c.children)) resizeObserver.observe(child);
        measure();
      };
      observeAll();

      // Cards arrive after fetch, and adding children never changes the
      // container's own border box, so ResizeObserver alone would not re-fire.
      const mutationObserver = new MutationObserver(observeAll);
      mutationObserver.observe(c, { childList: true });

      // An off-screen marquee burns battery and would have drifted somewhere
      // arbitrary by the time the visitor scrolls down to it.
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          s.visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      visibilityObserver.observe(c);

      disposers.push(() => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        visibilityObserver.disconnect();
      });

      const onEnter = () => {
        s.hovered = true;
      };
      const onLeave = () => {
        s.hovered = false;
      };

      // Mouse drag-to-scroll (touch uses native scrolling)
      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        s.dragging = true;
        s.didDrag = false;
        s.startX = e.pageX;
        s.startScroll = c.scrollLeft;
        c.style.userSelect = "none";
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
          c.style.userSelect = "";
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      };

      // Swallow the click that follows a real drag so a card doesn't navigate.
      const onClickCapture = (e: MouseEvent) => {
        if (s.didDrag) {
          e.preventDefault();
          e.stopPropagation();
          s.didDrag = false;
        }
      };

      const onTouchStart = () => {
        s.touching = true;
      };
      const onTouchEnd = () => {
        s.touching = false;
        s.pos = c.scrollLeft;
      };

      c.addEventListener("mouseenter", onEnter);
      c.addEventListener("mouseleave", onLeave);
      c.addEventListener("pointerdown", onPointerDown as EventListener);
      c.addEventListener("click", onClickCapture as EventListener, true);
      c.addEventListener("touchstart", onTouchStart, { passive: true });
      c.addEventListener("touchend", onTouchEnd, { passive: true });
      c.addEventListener("touchcancel", onTouchEnd, { passive: true });

      disposers.push(() => {
        c.removeEventListener("mouseenter", onEnter);
        c.removeEventListener("mouseleave", onLeave);
        c.removeEventListener("pointerdown", onPointerDown as EventListener);
        c.removeEventListener("click", onClickCapture as EventListener, true);
        c.removeEventListener("touchstart", onTouchStart);
        c.removeEventListener("touchend", onTouchEnd);
        c.removeEventListener("touchcancel", onTouchEnd);
      });
    });

    let animationFrameId: number;
    let lastTime = 0;
    const step = (now: number) => {
      animationFrameId = requestAnimationFrame(step);
      // Clamped so returning to a backgrounded tab does not apply one enormous
      // delta and teleport every row.
      const delta = lastTime ? Math.min(now - lastTime, 50) : 0;
      lastTime = now;
      if (reduceMotion.matches) return;

      rows.forEach((c) => {
        const s = st.get(c);
        if (!s || s.period <= 0 || !s.visible) return;
        if (s.hovered || s.dragging || s.touching) {
          // Paused — mirror any manual scroll so we resume from here (no jump).
          s.pos = c.scrollLeft;
          return;
        }
        let pos = s.pos + (SPEED * delta) / 1000;
        // Wrap onto the identical second copy → seamless.
        while (pos >= s.period) pos -= s.period;
        while (pos < 0) pos += s.period;
        s.pos = pos;
        c.scrollLeft = pos;
      });
    };
    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
      disposers.forEach((d) => d());
    };
  }, [loading, feedbacks.length]);

  const [homePosts, setHomePosts] = useState<any[]>([]);
  const [marketplaceCategories, setMarketplaceCategories] = useState<any[]>([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState<any[]>([]);

  // Products when they exist, category tiles as the stand-in until they do.
  const prasadItems =
    marketplaceProducts.length > 0 ? marketplaceProducts : marketplaceCategories;

  useEffect(() => {
    fetchStays();
    fetchOffers();
    fetchMarketplaceCategories();
    fetchMarketplaceProducts();
    fetchHomePosts();

    const handleMarketplaceSync = () => {
      fetchMarketplaceProducts();
      fetchMarketplaceCategories();
    };

    window.addEventListener("marketplace_updated", handleMarketplaceSync);
    return () => {
      window.removeEventListener("marketplace_updated", handleMarketplaceSync);
    };
  }, []);

  const fetchMarketplaceProducts = async () => {
    try {
      const res = await marketplaceService.getProducts({ limit: 10 });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMarketplaceProducts(res.data.data);
      }
    } catch (err) {
      console.error("Fetch marketplace products error:", err);
    }
  };

  const fetchHomePosts = async () => {
    try {
      const [blogRes, visitorRes] = await Promise.all([
        api.get("/blog/posts").catch(() => null),
        visitorArticleService.getPublicArticles({ limit: 4 }).catch(() => null),
      ]);

      const blogData = (blogRes?.data?.success ? blogRes.data.data : []).map(
        (bp: any) => ({
          _id: bp._id,
          title: bp.title,
          slug: bp.slug,
          excerpt: bp.excerpt || bp.subtitle,
          coverImage: bp.coverImage,
          category: bp.category || "Spiritual Guide",
          createdAt: bp.createdAt,
          views: bp.views || 3820,
          readingTime: bp.readingTime || "6 min read",
          contentType: bp.contentType || "article",
          author: bp.authorId || {
            name: "Vedic Scholar",
            photo: bp.coverImage,
          },
        }),
      );

      const visitorData = (
        visitorRes?.data?.success ? visitorRes.data.data : []
      ).map((va: any) => ({
        _id: va._id,
        title: va.title,
        slug: va.slug,
        excerpt: va.shortDescription,
        coverImage: va.featuredImage,
        category: va.category || "Pilgrim Story",
        createdAt: va.createdAt,
        views: va.viewsCount || 1850,
        readingTime: "5 min read",
        isVerifiedStay: true,
        contentType: "article",
        author: {
          name: va.visitorId?.name || "Verified Pilgrim",
          photo: va.visitorId?.avatar || va.featuredImage,
        },
      }));

      const combined = [...visitorData, ...blogData].slice(0, 4);
      if (combined.length > 0) {
        setHomePosts(combined);
      }
    } catch (err) {
      console.error("Error fetching home posts:", err);
    }
  };

  const fetchMarketplaceCategories = async () => {
    try {
      const res = await api.get("/marketplace/categories").catch(() => null);
      if (res?.data?.success) {
        setMarketplaceCategories(res.data.data);
      }
    } catch  {
      // Silently ignore if marketplace categories endpoint is not active
    }
  };

  const fetchStays = async () => {
    try {
      const res = await ashramService.search({ verified: "true" });
      if (res.data.success) setAshrams(res.data.data);
    } catch (err) {
      console.error("Error fetching stays:", err);
      setAshrams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateBookingSearch({
      destination,
      checkIn,
      checkOut,
    });

    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (stayType) params.set("type", stayType);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("rooms", String(searchState.rooms));
    params.set("adults", String(searchState.adults));
    params.set("children", String(searchState.children));
    params.set("guests", String(totalGuests));
    if (searchTab && searchTab !== "destinations") params.set("tab", searchTab);
    navigate(`/search?${params.toString()}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    const valueLower = val.toLowerCase();
    const matches: Set<string> = new Set();
    ["Haridwar", "Rishikesh", "Vrindavan"].forEach((city) => {
      if (city.toLowerCase().startsWith(valueLower)) matches.add(city);
    });
    ashrams.forEach((ashram) => {
      if (ashram.name.toLowerCase().includes(valueLower))
        matches.add(ashram.name);
    });
    [
      "Meditation Hall",
      "River View",
      "Cow Shelter",
      "Yoga",
      "Pure Vegetarian Food",
    ].forEach((am) => {
      if (am.toLowerCase().includes(valueLower)) matches.add(am);
    });
    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };

  // "What We Offer" cards. Extracted from three near-identical hardcoded blocks
  // so the row can be mapped — and therefore duplicated, which the shared
  // marquee needs in order to wrap seamlessly at scrollWidth/2.
  const serviceHighlights = [
    {
      title: "Destinations",
      href: "/destinations/planner",
      cta: "Explore Destinations",
      description:
        "Explore sacred places, plan your trip and discover spiritual experiences.",
      img: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
      imgFallback: "/banner/ashram_himalayas.png",
      alt: "Sacred Destinations",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "text-[#0B192C] hover:bg-[#0A4DA6] hover:text-white",
    },
    {
      title: "Services",
      href: "/local",
      cta: "Explore Services",
      description:
        "Find verified services, guided tours, transport, food and more near you.",
      img: "https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=800&q=80",
      imgFallback: "/banner/ashram_rishikesh.png",
      alt: "Spiritual Services",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "text-[#0B192C] hover:bg-[#0A4DA6] hover:text-white",
    },
    {
      title: "Marketplace",
      href: "/marketplace",
      cta: "Visit Marketplace",
      description:
        "Shop spiritual products, puja items, books, handicrafts and more.",
      img: "https://images.unsplash.com/photo-1600618528240-fb9fc964b853?auto=format&fit=crop&w=800&q=80",
      imgFallback: "/banner/prashadbanner.png",
      alt: "Spiritual Marketplace",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "text-[#0B192C] hover:bg-[#0A4DA6] hover:text-white",
    },
  ];

  const selectSuggestion = (sug: string) => {
    setDestination(sug);
    setShowSuggestions(false);
  };

  const getTabbedAshrams = () => {
    if (activeTab === "top_rated")
      return [...ashrams]
        .sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))
        .slice(0, 6);
    if (activeTab === "most_booked")
      return [...ashrams]
        .sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0))
        .slice(0, 6);
    if (activeTab === "recent") return [...ashrams].slice(-6).reverse();
    if (activeTab === "govt_recom")
      return ashrams.filter((a) => (a.rating?.average || 0) >= 4.6).slice(0, 6);
    return ashrams.slice(0, 6);
  };

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: direction === "left" ? -300 : 300,
        behavior: "smooth",
      });
    }
  };

  // Destinations for carousel
  const sacredDestinations = [
    {
      name: "Rishikesh",
      state: "Uttarakhand",
      rating: "4.9",
      tours: "12 Stays",
      img: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Vrindavan",
      state: "Uttar Pradesh",
      rating: "4.8",
      tours: "18 Ashrams",
      img: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1608958416801-9c60e3a6a908?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Haridwar",
      state: "Uttarakhand",
      rating: "4.8",
      tours: "15 Stays",
      img: "https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Kedarnath",
      state: "Uttarakhand",
      rating: "4.8",
      tours: "08 Circuits",
      img: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Varanasi",
      state: "Uttar Pradesh",
      rating: "4.7",
      tours: "20 Stays",
      img: "https://images.unsplash.com/photo-1561361058-c24e36e56336?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Tirupati",
      state: "Andhra Pradesh",
      rating: "4.8",
      tours: "14 Stays",
      img: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1506461883276-594a12b11db3?auto=format&fit=crop&w=500&q=85",
    },
    {
      name: "Rameswaram",
      state: "Tamil Nadu",
      rating: "4.7",
      tours: "10 Stays",
      img: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Shirdi",
      state: "Maharashtra",
      rating: "4.6",
      tours: "16 Stays",
      img: "https://images.unsplash.com/photo-1566438480900-0609be27a4be?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=500&q=80",
    },
    {
      name: "Ayodhya",
      state: "Uttar Pradesh",
      rating: "4.7",
      tours: "25 Stays",
      img: "https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=500&q=80",
      fallback:
        "https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=500&q=80",
    },
  ];

  // (demoFeedbacks removed — the Sacred Experiences band now renders real
  // reviews only, and hides itself when there are none.)

  const feedbackImages = [
    "/banner/ashram_rishikesh.png",
    "/banner/ashram_himalayas.png",
    "/banner/ashram_varanasi.png",
    "/banner/ashram_vrindavan.png",
    "/banner/accomendation.png",
    "/banner/popular.png",
    "/banner/explore.png",
    "/banner/Blogs.png",
  ];

  // Real reviews only. The section is hidden entirely when there are none
  // rather than filled with sample testimonials — an invented quote attributed
  // to a named pilgrim is not a placeholder, it is a fabricated endorsement.
  const customerFeedbacks = feedbacks.map((r, i) => ({
    name: r.ashramId?.name || "Ashram stay",
    location: r.ashramId?.address
      ? [r.ashramId.address.city, r.ashramId.address.state]
          .filter(Boolean)
          .join(", ")
      : "",
    reviewer: r.customerId?.name || "Guest",
    verifiedStay: Boolean(r.verifiedStay),
    rating: Math.max(1, Math.round(r.rating?.overall || 5)),
    ratingValue: (r.rating?.overall || 5).toFixed(1),
    comment: r.comment,
    img: feedbackImages[i % feedbackImages.length],
  }));

  // Service icons strip aligned with Tirvona Theme & Routing
  const serviceIcons = [
    {
      id: "circuits",
      label: "Pilgrimage Circuits",
      icon: MapPin,
      category: "circuits",
      target: "/pilgrimage-circuits",
    },
    {
      id: "events",
      label: "Events & Festivals",
      icon: Sparkles,
      category: "events",
      target: "/events",
    },
    {
      id: "parking",
      label: "Parking",
      icon: CircleParking,
      category: "parking",
      target: "/parking",
    },
    {
      id: "food",
      label: "Food & Dining",
      icon: Utensils,
      category: "food",
      target: "/restaurants",
    },
    {
      id: "prasad",
      label: "Sacred Prasad",
      icon: Activity,
      category: "prasad",
      target: "#prashad",
    },
    {
      id: "shops",
      label: "Shops & Services",
      icon: LayoutGrid,
      category: "shops",
      target: "/shops",
    },
    {
      id: "puja",
      label: "Live Arti",
      icon: Heart,
      category: "puja",
      target: "/live-aarti",
    },
    {
      id: "volunteer",
      label: "Volunteer",
      icon: HeartHandshake,
      category: "volunteer",
      target: "/volunteer",
    },
  ];

  // Extract Dynamic Approved Published CMS Sections (Strictly Section-Mapped)
  const publishedHero = publishedCms.hero_banner || {};
  const publishedFestival = publishedCms.festival_banner || {};
  const publishedOffer = publishedCms.offer_banner || {};
  const activeHeroBg = publishedHero.bannerImage || heroBg;
  const activeHeading =
    publishedHero.heading ||
    "Connecting Sacred Destinations, Empowering Communities.";
  const activeSubtitle =
    publishedHero.subtitle ||
    "Plan your pilgrimage, book stays, explore holy places, shop spiritual products and contribute to a greater cause.";
  const activeCtaText = publishedHero.ctaText || "Explore Sacred Stays";
  const activeAnnouncement =
    publishedHero.announcement || publishedCms.announcement?.announcement || "";

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
          {/* w-full + min-w-0: this is a flex COLUMN, so its width is driven by
              its widest child. Without these, any child that refuses to shrink
              (an unbreakable heading, a long word) stretches this box past the
              viewport and every centered child inside it spills off both edges. */}
          <div className="w-full min-w-0 max-w-4xl lg:max-w-5xl mx-auto space-y-6 text-center flex flex-col items-center">
            {/* Main Display Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] xl:text-[62px] font-bold text-white drop-shadow-md leading-[1.25]"
              style={{
                fontFamily: "'Kalam', cursive, sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              <span className="block">Connecting Sacred Destinations,</span>
              <span className="block text-[#E58C28] mt-1 sm:mt-1.5 font-bold">
                Empowering Communities.
              </span>
            </motion.h1>

            {/* Body paragraph per requested specs: Satoshi 500 #6B6B6B / text-slate-200 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[#E2E8F0] dark:text-[#6B6B6B] text-sm sm:text-base leading-relaxed max-w-2xl mx-auto text-center drop-shadow-xs"
              style={{
                fontFamily:
                  "Satoshi, 'General Sans', Manrope, Inter, sans-serif",
                fontWeight: 500,
              }}
            >
              {activeSubtitle}
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
                onClick={() => navigate("/search")}
                className="bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs sm:text-sm font-bold pl-5 pr-1.5 py-2 rounded-full flex items-center gap-3 shadow-md hover:shadow-lg transition-all cursor-pointer group border border-white/20"
              >
                <span>{activeCtaText}</span>
                <div className="w-7 h-7 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-1 shadow-xs">
                  <ArrowRight size={14} className="stroke-[2.5]" />
                </div>
              </button>

              {/* Secondary Pill Button */}
              <button
                onClick={() => navigate("/search")}
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
        {/* max-w-full + overflow-x-auto: the three labels plus icons measure
            ~364px, which is wider than a 390px phone once page padding is
            taken off — and this app is translated, so labels get longer in
            other locales. The pill now scrolls itself instead of overflowing
            the page. */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div
            className="inline-flex max-w-full overflow-x-auto scrollbar-none items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 shadow-lg shadow-[#0B192C]/10"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {[
              {
                id: "destinations",
                icon: <Compass size={14} />,
                label: "Destinations",
              },
              { id: "stay", icon: <Bed size={14} />, label: "Stay" },
              {
                id: "experiences",
                icon: <Sparkles size={14} />,
                label: "Experiences",
              },
            ].map((tab) => {
              const active = searchTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setSearchTab(tab.id as any)}
                  whileTap={{ scale: 0.94 }}
                  className={`relative flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-colors duration-200 ${
                    active
                      ? "text-white"
                      : "text-gray-600 dark:text-gray-300 hover:text-[#0A4DA6] dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="searchTabPill"
                      className="absolute inset-0 rounded-full bg-[#0A4DA6] shadow-md shadow-[#0A4DA6]/30"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <motion.span
                    layout
                    className="relative z-10 flex items-center gap-2"
                  >
                    {tab.icon} {tab.label}
                  </motion.span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Main Search Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-[28px] sm:rounded-[36px] shadow-2xl shadow-[#0B192C]/15 border border-gray-100 dark:border-slate-800/80 p-4 sm:p-5 lg:p-6">
          {/* Two columns from the smallest size so Check In / Check Out pair up
              instead of each eating a full row — that alone removed a lot of the
              card's height on a phone. The desktop 12-column bar is unchanged.
              items-start on mobile keeps the fields top-aligned once they have
              different heights; lg restores vertical centring for the bar. */}
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3.5 lg:gap-0 items-start lg:items-center"
          >
            {/* Field 1: DESTINATIONS */}
            <div
              className="col-span-2 lg:col-span-4 relative pb-3 border-b lg:pb-0 lg:border-b-0 lg:pr-4 lg:border-r border-gray-200 dark:border-slate-800"
              ref={autocompleteRef}
            >
              <label className="block text-[10px] font-extrabold tracking-wider text-gray-400 mb-1.5 pl-1">
                Destinations
              </label>
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
                <ChevronDown
                  size={14}
                  className="text-gray-400 pointer-events-none ml-1 shrink-0"
                />
              </div>
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-3 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 text-xs"
                  >
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectSuggestion(sug)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 last:border-b-0 cursor-pointer"
                      >
                        <Compass size={13} className="text-[#0A4DA6]" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Field 3: CHECK IN */}
            <div className="col-span-1 lg:col-span-2 relative pb-3 border-b lg:pb-0 lg:border-b-0 lg:px-4 lg:border-r border-gray-200 dark:border-slate-800">
              <label className="block text-[10px] font-extrabold tracking-wider text-gray-400 mb-1.5 pl-1">
                Check In
              </label>
              <div className="relative flex items-center">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2">
                  <Calendar size={15} />
                </div>
                <DatePicker value={checkIn} onChange={setCheckIn} />
              </div>
            </div>

            {/* Field 4: CHECK OUT */}
            <div className="col-span-1 lg:col-span-2 relative pb-3 border-b lg:pb-0 lg:border-b-0 lg:px-4 lg:border-r border-gray-200 dark:border-slate-800">
              <label className="block text-[10px] font-extrabold tracking-wider text-gray-400 mb-1.5 pl-1">
                Check Out
              </label>
              <div className="relative flex items-center">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 flex items-center justify-center shrink-0 mr-2">
                  <Calendar size={15} />
                </div>
                {/* Right-anchored: Check Out is the right-hand column on phones,
                    and the 288px calendar opening left-to-right from there would
                    run past the screen edge. */}
                <DatePicker
                  value={checkOut}
                  onChange={setCheckOut}
                  min={checkIn}
                  align="right"
                />
              </div>
            </div>

            {/* Field 5: GUESTS & SEARCH.
                Stacked on phones: sharing one row forced the guest selector to
                give up most of its width to the Search button, so "1 Room · 2
                Adults" had nowhere to go. A full-width primary action is also
                the easier tap target. */}
            <div className="col-span-2 lg:col-span-4 relative lg:pl-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <GuestRoomSelector />
              </div>

              {/* Search Button */}
              <button
                type="submit"
                className="w-full sm:w-auto justify-center bg-[#0A4DA6] hover:bg-[#083D85] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-none transition-all cursor-pointer shrink-0 active:scale-95 sm:self-end"
              >
                <span>Search</span>
                <Search size={15} className="stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>

        {/* Service icons strip placed directly below booking system (Single Row Flex Container) */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] mt-4 sm:mt-5 p-2 sm:p-2.5 shadow-lg shadow-[#0B192C]/5 overflow-hidden">
          <div
            ref={setServiceStrip}
            className="flex flex-nowrap items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full"
            // (useAutoScroll forces scroll-behavior:auto while it runs — see the
            // note in that hook about the global `*` smooth-scroll rule.)
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {serviceIcons.map((item, i) => {
              const IconComponent = item.icon;
              const isActive = activeService === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveService(i);
                    if (item.target.startsWith("#")) {
                      const el = document.querySelector(item.target);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    } else {
                      navigate(`${item.target}?category=${item.category}`);
                    }
                  }}
                  className="flex-1 min-w-[78px] sm:min-w-[88px] lg:min-w-0 flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-3 px-1 text-center rounded-2xl transition-all cursor-pointer group shrink-0 lg:shrink hover:bg-blue-50/60 dark:hover:bg-slate-800/60"
                >
                  <div className="p-2 sm:p-2.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-400 group-hover:bg-[#0A4DA6] group-hover:text-white transition-colors">
                    <IconComponent size={16} className="stroke-[2.5]" />
                  </div>
                  <span className="text-[9px] font-extrabold whitespace-pre-line text-center leading-tight text-[#0B192C] dark:text-gray-200 group-hover:text-[#0A4DA6] transition-colors">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════ FEATURED OFFERS & FESTIVAL SPECIALS BANNER ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20 mt-6">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Exclusive Offers
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Exclusive discounts, promo vouchers, and festival packages for your
            sacred retreat.
          </p>
          <button
            type="button"
            onClick={() => navigate("/offers")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore All Offers <ArrowRight size={14} />
          </button>
        </div>

        {/* Horizontal Carousel (Exact same container & scroll layout as all other sections on the page) */}
        <div
          ref={offersRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: "none" }}
        >
          {(() => {
            const defaultList = [
              {
                _id: "default-1",
                offerType: "MAHAKUMBH OFFER",
                discountPercentage: 20,
                offerTitle: "Mahakumbh Sacred Stay Special",
                description:
                  "Experience the holy Kumbh Mela 2026 with 20% OFF accommodation & VIP pass.",
                promoCode: "KUMBH2026",
                image: "/banner/upcominglogo.png",
                ashramId: {
                  address: { city: "Prayagraj" },
                  name: "Shantikunj Gayatri Pariwar",
                },
              },
              {
                _id: "default-2",
                offerType: "WEEKEND OFFER",
                discountPercentage: 10,
                discountValue: 500,
                discountType: "FixedAmount",
                offerTitle: "Weekend Spiritual Yoga & Retreat",
                description:
                  "Recharge your mind & soul with our weekend spiritual retreat package in Haridwar.",
                promoCode: "WEEKEND500",
                image: "/banner/ashram_rishikesh.png",
                ashramId: {
                  address: { city: "Haridwar" },
                  name: "Prem Nagar Ashram",
                },
              },
              {
                _id: "default-3",
                offerType: "FESTIVAL OFFER",
                discountPercentage: 15,
                offerTitle: "Festival Season Kashi Discount",
                description:
                  "Get 15% instant savings on top verified ashrams across Kashi & Haridwar.",
                promoCode: "FESTIVAL2026",
                image: "/banner/ashram_varanasi.png",
                ashramId: {
                  address: { city: "Varanasi" },
                  name: "Kashi Vishwanath Ashram",
                },
              },
              {
                _id: "default-4",
                offerType: "SPECIAL OFFER",
                discountPercentage: 25,
                offerTitle: "Vrindavan Dham Yatra Deal",
                description:
                  "Exclusive 25% discount on serene dharamshala stays in holy Vrindavan.",
                promoCode: "VRINDAVAN25",
                image: "/banner/ashram_vrindavan.png",
                ashramId: {
                  address: { city: "Vrindavan" },
                  name: "Bhagwat Dham Ashram",
                },
              },
            ];

            return offers.length > 0 ? offers : defaultList;
          })().map((offer: any, idx: number) => {
            const offerImages = [
              "/banner/upcominglogo.png",
              "/banner/ashram_rishikesh.png",
              "/banner/ashram_varanasi.png",
              "/banner/ashram_vrindavan.png",
            ];
            const cardImg =
              offer.bannerImage ||
              offer.thumbnailImage ||
              offer.image ||
              offerImages[idx % offerImages.length];
            const cardTitle =
              offer.offerTitle || offer.title || "Special Ashram Offer";
            const cardDesc =
              offer.description ||
              offer.bannerText ||
              "Book early to get exclusive room rate discounts and complimentary Satvik meals.";
            const offerBadge =
              offer.offerType || offer.category || "FESTIVAL OFFER";

            const targetAshram = offer.ashramId?._id
              ? offer.ashramId
              : offer.applicableAshrams && offer.applicableAshrams[0];
            const city =
              offer.ashramId?.address?.city ||
              targetAshram?.address?.city ||
              (idx === 0 ? "Prayagraj" : "Haridwar");

            const handleCardClick = () => {
              if (targetAshram?._id) {
                navigate(
                  `/ashram/${targetAshram._id}?promoCode=${encodeURIComponent(offer.promoCode || "")}`,
                );
              } else if (
                offer._id &&
                typeof offer._id === "string" &&
                offer._id.length > 10 &&
                !offer._id.startsWith("default")
              ) {
                navigate(`/offers/${offer._id}`);
              } else {
                navigate(
                  `/search?promoCode=${encodeURIComponent(offer.promoCode || "KUMBH2026")}`,
                );
              }
            };

            return (
              <CouponVoucherCard
                key={`${offer._id || "offer"}-${idx}`}
                offer={{
                  ...offer,
                  image: cardImg,
                  offerTitle: cardTitle,
                  description: cardDesc,
                  offerType: offerBadge,
                  ashramId: { address: { city }, name: targetAshram?.name },
                }}
                onBookNow={handleCardClick}
                isCarouselItem={true}
              />
            );
          })}
        </div>
      </section>

      {/* ══════════════════════ EVERYTHING YOU NEED ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-10 lg:mb-20 mt-6 lg:mt-0">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Our Spiritual Services
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Everything you need for a blessed journey — Verified stays, temple
            tours, prasad, and sacred services.
          </p>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore All Services <ArrowRight size={14} />
          </button>
        </div>

        {/* Service Cards: 1 col mobile, 2 col tablet, 3 col desktop */}
        {/* Horizontal marquee carousel, matching the other featured sections.
            Items are duplicated so the shared auto-scroll effect can wrap at
            scrollWidth/2 for a seamless loop. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 w-full pt-2 pb-6">
          {serviceHighlights.map((card, idx) => (
            <div
              key={`${card.title}-${idx}`}
              className="w-full relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer bg-[#0B192C]"
              style={{ height: "clamp(200px, 50vw, 260px)" }}
              onClick={() => navigate(card.href)}
            >
              <img
                src={card.img}
                alt={card.alt}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = card.imgFallback;
                }}
              />
              <div className={`absolute inset-0 ${card.overlay}`} />
              <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col justify-between items-center text-center">
                <div className="space-y-2 max-w-[90%] mx-auto flex flex-col items-center">
                  <p
                    className={`text-[10px] font-extrabold tracking-widest text-center ${card.eyebrowClass}`}
                  >
                    Tirvona
                  </p>
                  <h3 className="font-extrabold text-lg sm:text-xl text-white flex items-center justify-center gap-1.5 leading-tight text-center">
                    {card.title} <ArrowRight size={15} />
                  </h3>
                  <p
                    className={`text-xs leading-relaxed text-center ${card.descriptionClass}`}
                  >
                    {card.description}
                  </p>
                </div>
                <button
                  className={`self-center mx-auto px-6 py-2.5 min-h-[40px] bg-white font-extrabold text-xs rounded-full transition-all cursor-pointer shadow hover:scale-105 ${card.ctaClass}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(card.href);
                  }}
                >
                  {card.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ POPULAR SACRED DESTINATIONS (Matching Reference Image 2) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Sacred Destinations
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Explore sacred cities across India including Rishikesh, Haridwar,
            Varanasi, Vrindavan, and Prayagraj.
          </p>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore All Destinations <ArrowRight size={14} />
          </button>
        </div>

        {/* Modern Rounded Rectangle Cards Grid/Carousel */}
        <div
          ref={carouselRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: "none" }}
        >
          {[...sacredDestinations, ...sacredDestinations].map((item, idx) => (
            <div
              key={idx}
              onClick={() =>
                navigate(
                  `/search?destination=${encodeURIComponent(item.name)}${checkIn ? `&checkIn=${checkIn}` : ""}${checkOut ? `&checkOut=${checkOut}` : ""}${totalGuests ? `&guests=${totalGuests}` : ""}`,
                )
              }
              className="flex-shrink-0 relative group cursor-pointer"
              style={{ width: "clamp(200px, 48vw, 220px)" }}
            >
              {/* Modern Rounded Rectangle Card */}
              <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                {/* Image Container */}
                <div
                  className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                  style={{ height: "clamp(170px, 40vw, 190px)" }}
                >
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = item.fallback;
                    }}
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

          {/* View All Card at the End of Horizontal Scroll */}
          <div
            onClick={() => navigate("/search")}
            className="flex-shrink-0 relative group cursor-pointer"
            style={{ width: "clamp(200px, 48vw, 220px)" }}
          >
            <div className="w-full bg-[#0A4DA6] text-white rounded-3xl overflow-hidden border border-[#0A4DA6] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-center p-6 text-center hover:-translate-y-1 h-full min-h-[266px]">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center my-auto">
                <ArrowRight
                  size={26}
                  className="text-white group-hover:translate-x-1.5 transition-transform"
                />
              </div>
              <div className="space-y-1 mb-2">
                <h4 className="font-black text-lg text-white">View All</h4>
                <p className="text-[11px] text-blue-100 font-medium">
                  Explore All 50+ Sacred Destinations
                </p>
              </div>
              <span className="px-5 py-2 rounded-full bg-white text-[#0A4DA6] font-black text-xs shadow-md">
                Browse All →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ UPCOMING ARDH KUMBH FESTIVAL BANNER (100% Full Width Edge-to-Edge Hero Banner) ══════════════════════ */}
      <section className="relative w-full py-28 sm:py-36 lg:py-44 min-h-[540px] sm:min-h-[620px] lg:min-h-[700px] flex items-center justify-center overflow-hidden rounded-none shadow-2xl mb-14 lg:mb-24 group border-y border-white/10">
        <img
          src="/banner/upcominglogo.png"
          alt="Upcoming Ardh Kumbh Festival"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1600&q=80";
          }}
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
                className="text-lg sm:text-4xl block font-bold leading-tight"
                style={{
                  fontFamily: "Kalam, cursive, sans-serif",
                  color: "#E58C28",
                }}
              >
                Featured Sacred Event
              </span>
              {/* Decorative Saffron Underline Divider */}
              <div className="flex items-center justify-center gap-2.5 my-1.5">
                <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
                <Sparkles
                  size={14}
                  className="text-[#E58C28] fill-[#E58C28] shrink-0"
                />
                <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
              </div>
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
              Experience the divine spiritual gathering on the sacred banks of
              Ganga in Haridwar. Secure your holy ashram stay today for peace
              and divine blessings.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="pt-3"
            >
              <button
                onClick={() => navigate("/search?destination=Haridwar")}
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
      <section
        id="prashad-section"
        className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20"
      >
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Prasad &amp; Puja Essentials
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Authentic Mahaprasad, puja items, and spiritual goods delivered
            directly from famous holy temples.
          </p>
          <button
            type="button"
            onClick={() => navigate("/marketplace")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore Sacred Marketplace <ArrowRight size={14} />
          </button>
        </div>

        {/* Dynamic Database-Driven Marketplace Product Cards Carousel */}
        <div
          ref={prashadRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Doubled like every other marquee row on this page. The loop wraps
              onto the second copy, so without it this row rewound halfway
              through its own content and read as a jitter. */}
          {[...prasadItems, ...prasadItems].map((item: any, idx: number) => {
            const isProduct = !!item.price || Array.isArray(item.images);
            const imgUrl = isProduct
              ? item.images?.[0] ||
                "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=500&q=80"
              : item.coverImage ||
                item.thumbnail ||
                item.img ||
                "/banner/ashram_rishikesh.png";
            const name = item.name;
            const subtitle = isProduct
              ? item.templeSource || "Sanctified Product"
              : item.originCity
                ? `${item.originCity}, ${item.originState}`
                : "Sacred Prashad";
            const priceDisplay = isProduct
              ? item.salePrice
                ? `₹${item.salePrice}`
                : `₹${item.price}`
              : null;

            return (
              <div
                // Index is part of the key because the list is deliberately
                // doubled — `_id` alone repeats across the two copies.
                key={`${item._id ?? "item"}-${idx}`}
                onClick={() => navigate("/marketplace")}
                className="flex-shrink-0 relative group cursor-pointer"
                style={{ width: "clamp(210px, 48vw, 230px)" }}
              >
                {/* Modern Rounded Rectangle Card */}
                <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                  {/* Image Container */}
                  <div
                    className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                    style={{ height: "clamp(170px, 40vw, 190px)" }}
                  >
                    <img
                      src={imgUrl}
                      alt={name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=500&q=80";
                      }}
                    />
                    {isProduct &&
                      item.salePrice &&
                      item.price > item.salePrice && (
                        <span className="absolute top-3 left-3 bg-rose-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                          {Math.round(
                            ((item.price - item.salePrice) / item.price) * 100,
                          )}
                          % OFF
                        </span>
                      )}
                    {isProduct && item.rating && (
                      <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <Star size={10} className="fill-amber-400" />{" "}
                        {item.rating}
                      </span>
                    )}
                  </div>

                  {/* Centered Bottom Title & Price Area */}
                  <div className="p-4 text-center flex flex-col items-center justify-center min-h-[84px]">
                    <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center group-hover:text-[#0A4DA6] transition-colors">
                      {name}
                    </h4>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5 text-center line-clamp-1">
                      {subtitle}
                    </p>
                    {priceDisplay && (
                      <span className="mt-1 font-black text-xs text-[#0A4DA6] dark:text-blue-400">
                        {priceDisplay}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* View All Card at the End of Horizontal Scroll */}
          <div
            onClick={() => navigate("/marketplace/categories")}
            className="flex-shrink-0 relative group cursor-pointer"
            style={{ width: "clamp(210px, 48vw, 230px)" }}
          >
            <div className="w-full bg-[#0A4DA6] text-white rounded-3xl overflow-hidden border border-[#0A4DA6] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-center p-6 text-center hover:-translate-y-1 h-full min-h-[266px]">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center my-auto">
                <ArrowRight
                  size={26}
                  className="text-white group-hover:translate-x-1.5 transition-transform"
                />
              </div>
              <div className="space-y-1 mb-2">
                <h4 className="font-black text-lg text-white">View All</h4>
                <p className="text-[11px] text-blue-100 font-medium">
                  Explore All 50+ Sacred Prashad & Categories
                </p>
              </div>
              <span className="px-5 py-2 rounded-full bg-white text-[#0A4DA6] font-black text-xs shadow-md">
                Browse All →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FEATURED RETREATS (Matching Codebase Design) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-4xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Stay Near Sacred Places
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Government-verified ashrams and dharamshalas providing peaceful
            rooms, satvik food, and morning prayers.
          </p>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore All Ashrams <ArrowRight size={14} />
          </button>
        </div>
        <div
          className="border-b border-gray-100 dark:border-slate-800 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex w-max mx-auto gap-5 lg:gap-8 text-xs font-extrabold pb-3 px-1">
            {[
              { id: "top_rated", label: "Top Rated" },
              { id: "most_booked", label: "Most Booked" },
              { id: "recent", label: "Recently Verified" },
              { id: "govt_recom", label: "Govt Recommended" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2.5 flex items-center px-1 shrink-0 relative cursor-pointer transition-all ${activeTab === tab.id ? "text-[#0A4DA6]" : "text-gray-400 hover:text-gray-600"}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-[#0A4DA6]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Modern Rounded Rectangle Cards Carousel */}
        {loading ? (
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="shrink-0 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse"
                style={{ width: "220px", height: "260px" }}
              />
            ))}
          </div>
        ) : (
          <div
            ref={featuredRef}
            className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
            style={{ scrollbarWidth: "none" }}
          >
            {[...getTabbedAshrams(), ...getTabbedAshrams()].map(
              (ashram, idx) => (
                <motion.div
                  key={`${ashram._id}-${idx}`}
                  layout
                  onClick={() =>
                    navigate(
                      `/ashram/${ashram._id}${checkIn || checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${totalGuests}` : ""}`,
                    )
                  }
                  className="flex-shrink-0 relative group cursor-pointer"
                  style={{ width: "clamp(200px, 48vw, 220px)" }}
                >
                  {/* Modern Rounded Rectangle Card */}
                  <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                    {/* Image Container */}
                    <div
                      className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                      style={{ height: "clamp(170px, 40vw, 190px)" }}
                    >
                      <img
                        src={
                          ashram.images?.[0] ||
                          "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80"
                        }
                        alt={ashram.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=500&q=80";
                        }}
                      />
                      {/* Royal Navy Blue Price Badge */}
                      <span className="absolute top-3 left-3 bg-[#0A4DA6] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm">
                        ₹{ashram.lowestNightPrice ?? 150} / night
                      </span>
                      {/* Rating Badge — only when the ashram has real reviews */}
                      {ashram.rating?.count > 0 && (
                        <span className="absolute top-3 right-3 bg-white/95 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white text-[10px] font-extrabold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm">
                          <Star
                            size={11}
                            className="text-[#D4AF37] fill-[#D4AF37]"
                          />{" "}
                          {ashram.rating.average}
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
                          <Star
                            size={11}
                            className="text-[#D4AF37] fill-[#D4AF37]"
                          />
                          <span className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
                            {ashram.rating.average}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            ({ashram.rating.count} reviews)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-semibold mt-1.5">
                          No reviews yet
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ),
            )}

            {/* View All Card at the End of Horizontal Scroll */}
            <div
              onClick={() => navigate("/search")}
              className="flex-shrink-0 relative group cursor-pointer"
              style={{ width: "clamp(200px, 48vw, 220px)" }}
            >
              <div className="w-full bg-[#0A4DA6] text-white rounded-3xl overflow-hidden border border-[#0A4DA6] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-center p-6 text-center hover:-translate-y-1 h-full min-h-[266px]">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center my-auto">
                  <ArrowRight
                    size={26}
                    className="text-white group-hover:translate-x-1.5 transition-transform"
                  />
                </div>
                <div className="space-y-1 mb-2">
                  <h4 className="font-black text-lg text-white">View All</h4>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Explore All 100+ Verified Stays & Ashrams
                  </p>
                </div>
                <span className="px-5 py-2 rounded-full bg-white text-[#0A4DA6] font-black text-xs shadow-md">
                  Browse All →
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════ SPIRITUAL MEDIA & KNOWLEDGE HUB SECTION ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Journey Through Spirituality
          </p>
          {/* Decorative Saffron Underline Divider */}
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Documentaries, pilgrimage guides, temple histories, and inspiring
            yatra stories from devotees.
          </p>
          <button
            type="button"
            onClick={() => navigate("/blog")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore Knowledge Hub <ArrowRight size={14} />
          </button>
        </div>
        <div
          ref={blogRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none max-w-7xl mx-auto mt-6 relative z-10 -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
          style={{ scrollbarWidth: "none" }}
        >
          {[...homePosts, ...homePosts].map((item, idx) => {
            const isVideo = item.contentType === "video";
            const targetUrl = isVideo
              ? `/video/${item.slug}`
              : `/blog/${item.slug}`;
            const author = item.author || {};

            return (
              <div
                key={`${item._id}-${idx}`}
                onClick={() => navigate(targetUrl)}
                className="shrink-0 w-[280px] sm:w-[320px] bg-white dark:bg-[#0B192C] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between border border-gray-100 dark:border-slate-800 group hover:-translate-y-1 cursor-pointer h-full"
              >
                <div className="flex flex-col flex-1">
                  <div className="h-44 sm:h-48 overflow-hidden bg-slate-900 relative shrink-0">
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "/blogs/rishikesh_ashram_1785404729056.png";
                      }}
                    />
                    {isVideo && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play size={20} className="fill-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#0A4DA6]" />{" "}
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={13} className="text-[#0A4DA6]" />{" "}
                        {item.views} Views
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-11 sm:h-12 flex items-start group-hover:text-[#0A4DA6] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed h-9 overflow-hidden">
                      {item.excerpt}
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/60 mt-auto shrink-0 h-16">
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <img
                      src={author.photo || author.avatar || item.coverImage}
                      alt={author.name || "Author"}
                      className="w-7 h-7 rounded-full object-cover border border-[#0A4DA6] shrink-0"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80";
                      }}
                    />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate">
                      {author.name || "Verified Author"}
                    </span>
                  </div>
                  <button className="px-3.5 py-1.5 bg-[#F0F5FC] dark:bg-blue-950/40 text-gray-700 dark:text-blue-300 group-hover:bg-[#0A4DA6] group-hover:text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                    <span>{isVideo ? "Watch Video" : "Read Article"}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════ CUSTOMER FEEDBACK & EXPERIENCES SLIDER ══════════════════════ */}
      {customerFeedbacks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 lg:mb-20 space-y-8">
          {/* Clean Text Header (No Background Wallpaper) */}
          <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
            <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
              Sacred Experiences
            </p>
            {/* Decorative Saffron Underline Divider */}
            <div className="flex items-center justify-center gap-2.5 my-1.5">
              <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
              <Sparkles
                size={14}
                className="text-[#E58C28] fill-[#E58C28] shrink-0"
              />
              <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
              Real reviews and experiences shared by pilgrims who booked their
              ashram stays through Tirvona.
            </p>
          </div>

          {/* Smooth 60FPS Sliding Gallery Carousel (Matching Reference Screenshot) */}
          <div
            ref={feedbackRef}
            className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 justify-start"
            style={{ scrollbarWidth: "none" }}
          >
            {[...customerFeedbacks, ...customerFeedbacks].map((fb, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 relative group cursor-pointer"
                style={{ width: "clamp(240px, 50vw, 280px)" }}
              >
                {/* Rounded Image Card Container (Matching Reference Screenshot Aspect & Border Radius) */}
                <div className="w-full bg-white dark:bg-[#0B192C] rounded-[28px] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col hover:-translate-y-1.5 h-[340px] sm:h-[380px] relative">
                  {/* Full Height Background Image */}
                  <img
                    src={fb.img}
                    alt={fb.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/banner/ashram_rishikesh.png";
                    }}
                  />

                  {/* Dark Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Overlay Card Content — fixed layout: rating top, review middle, user bottom */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-between text-white z-10">
                    {/* Top: Star Rating Badge (Centered at Top) */}
                    <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full w-fit mx-auto text-[#FFD700] text-xs font-bold border border-white/20 shadow-xs">
                      {[...Array(fb.rating)].map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className="fill-[#FFD700] text-[#FFD700]"
                        />
                      ))}
                      <span className="text-white text-[10px] ml-1 font-extrabold">
                        {fb.ratingValue}
                      </span>
                    </div>

                    {/* Bottom: review text (fixed height) + user info */}
                    <div className="space-y-3">
                      <p className="text-xs text-gray-100 font-medium leading-relaxed italic line-clamp-4 min-h-[4.5rem] drop-shadow-xs">
                        "{fb.comment}"
                      </p>

                      <div className="pt-3 border-t border-white/20 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-white leading-none truncate flex items-center gap-1.5">
                            {fb.reviewer}
                            {fb.verifiedStay && (
                              <span
                                title="Stayed at this ashram"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[9px] font-black shrink-0"
                              >
                                <CheckCircle size={9} /> Verified stay
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-gray-300 font-semibold mt-1 truncate">
                            {fb.name}
                            {fb.location ? ` · ${fb.location}` : ""}
                          </p>
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
