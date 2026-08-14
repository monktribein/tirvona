import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { ashramService, reviewService, marketplaceService } from "../services";
import { visitorArticleService } from "../services/visitorArticleService";
import { formatCurrency } from "../utils/format";
import { toTitleCase } from "../utils/textCase";
import { CouponVoucherCard } from "../components/CouponVoucherCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { GuestRoomSelector } from "../components/shared/GuestRoomSelector";
import {
  useBookingSearch,
  normalizeBookingDates,
} from "../contexts/BookingSearchContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAutoScroll } from "../hooks/useAutoScroll";
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
  Flame,
} from "lucide-react";

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { searchState, updateBookingSearch, totalGuests } = useBookingSearch();
  const [destination, setDestination] = useState("");
  const [stayType, setStayType] = useState("");
  const initialDates = normalizeBookingDates(
    searchState.checkIn,
    searchState.checkOut,
  );
  const [checkIn, setCheckIn] = useState(initialDates.checkIn);
  const [checkOut, setCheckOut] = useState(initialDates.checkOut);

  const [ashrams, setAshrams] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [homePosts, setHomePosts] = useState<any[]>([]);
  const [marketplaceCategories, setMarketplaceCategories] = useState<any[]>([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState<any[]>([]);
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
    { value: "homestay", label: "Homestay" },
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
  const [publishedFeatured, setPublishedFeatured] = useState<any>({});

  useEffect(() => {
    fetchStays();
    fetchOffers();
    fetchFeedbacks();
    fetchPublishedCms();
    fetchPublishedFeatured();
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

  useEffect(() => {
    const refreshRooms = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== "tirvona:rooms-updated") return;
      void fetchStays();
    };
    const refreshOnFocus = () => void fetchStays();
    window.addEventListener("tirvona:rooms-updated", refreshRooms);
    window.addEventListener("storage", refreshRooms);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("tirvona:rooms-updated", refreshRooms);
      window.removeEventListener("storage", refreshRooms);
      window.removeEventListener("focus", refreshOnFocus);
    };
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

  const fetchPublishedFeatured = async () => {
    try {
      const res = await api.get("/cms/featured-banners/published");
      if (res.data?.success) setPublishedFeatured(res.data.data || {});
    } catch (err) {
      console.warn("Published featured banner load:", err);
    }
  };

  const fetchOffers = async () => {
    try {
      const res = await api.get("/offers?status=active");
      if (res.data?.success && Array.isArray(res.data.data)) {
        const homepageOffers = res.data.data.filter((o: any) => {
          const route = o.targetRoute || o.category || "homepage";
          return route === "homepage" || route === "all";
        });
        setOffers(homepageOffers.length > 0 ? homepageOffers : res.data.data);
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

  const ensureLoopItems = <T,>(arr: T[], minCount = 6): T[] => {
    if (!arr || arr.length === 0) return [];
    let base = [...arr];
    while (base.length < minCount) {
      base = [...base, ...arr];
    }
    return base;
  };

  // Reusable 60FPS GPU-Accelerated translate3d Marquee Slider Component
  interface MarqueeSliderProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    speed?: number;
    className?: string;
    gapClass?: string;
    minItems?: number;
  }

  function MarqueeSlider<T>({
    items,
    renderItem,
    speed = 30,
    className = "",
    gapClass = "gap-4 sm:gap-6",
    minItems = 6,
  }: MarqueeSliderProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const posRef = useRef(0);
    const halfWidthRef = useRef(0);
    const isPausedRef = useRef(false);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, pos: 0, didDrag: false });
    const momentumVelRef = useRef(0);
    const lastPointerRef = useRef({ x: 0, time: 0 });
    const isVisibleRef = useRef(false);
    const [isGrabbing, setIsGrabbing] = useState(false);

    const baseList = useMemo(() => ensureLoopItems(items, minItems), [items, minItems]);
    const loopList = useMemo(() => {
      if (baseList.length === 0) return [];
      return [...baseList, ...baseList];
    }, [baseList]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current = entry.isIntersecting;
        },
        { threshold: 0 }
      );
      observer.observe(container);

      return () => {
        observer.disconnect();
      };
    }, []);

    useEffect(() => {
      if (loopList.length === 0) return;
      const track = trackRef.current;
      if (!track) return;

      const measure = () => {
        const kids = track.children;
        const halfIdx = baseList.length;
        if (kids.length >= halfIdx * 2 && halfIdx > 0) {
          const firstChild = kids[0] as HTMLElement;
          const halfChild = kids[halfIdx] as HTMLElement;
          if (firstChild && halfChild) {
            halfWidthRef.current = halfChild.offsetLeft - firstChild.offsetLeft;
          }
        }
      };

      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(track);
      for (const kid of Array.from(track.children)) {
        ro.observe(kid);
      }
      const mo = new MutationObserver(measure);
      mo.observe(track, { childList: true, subtree: true });

      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }, [baseList, loopList]);

    useEffect(() => {
      if (loopList.length === 0) return;
      const track = trackRef.current;
      if (!track) return;

      let animId: number;
      let lastTime = performance.now();

      const step = (now: number) => {
        animId = requestAnimationFrame(step);
        if (!isVisibleRef.current) return;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (halfWidthRef.current <= 0 || isDraggingRef.current) return;

        // Apply smooth cursor drag momentum decay
        if (Math.abs(momentumVelRef.current) > 1) {
          posRef.current += momentumVelRef.current * dt;
          momentumVelRef.current *= Math.pow(0.92, dt * 60);
          if (Math.abs(momentumVelRef.current) < 2) {
            momentumVelRef.current = 0;
          }
        } else if (!isPausedRef.current) {
          posRef.current += speed * dt;
        }

        const W = halfWidthRef.current;
        if (W > 0) {
          while (posRef.current >= W) posRef.current -= W;
          while (posRef.current < 0) posRef.current += W;
        }

        track.style.transform = `translate3d(${-posRef.current}px, 0, 0)`;
      };

      animId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animId);
    }, [loopList, speed]);

    const handleMouseEnter = () => {
      if (!isDraggingRef.current) isPausedRef.current = true;
    };
    const handleMouseLeave = () => {
      if (!isDraggingRef.current) isPausedRef.current = false;
    };

    const wheelTimerRef = useRef<any>(null);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (Math.abs(delta) > 1) {
          posRef.current += delta;
          const W = halfWidthRef.current;
          if (W > 0) {
            while (posRef.current >= W) posRef.current -= W;
            while (posRef.current < 0) posRef.current += W;
          }
          if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(${-posRef.current}px, 0, 0)`;
          }

          isPausedRef.current = true;
          if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
          wheelTimerRef.current = setTimeout(() => {
            isPausedRef.current = false;
          }, 600);
        }
      };

      container.addEventListener("wheel", handleWheel, { passive: true });
      return () => {
        container.removeEventListener("wheel", handleWheel);
        if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      };
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDraggingRef.current = true;
      setIsGrabbing(true);
      momentumVelRef.current = 0;
      const now = performance.now();
      dragStartRef.current = { x: e.clientX, pos: posRef.current, didDrag: false };
      lastPointerRef.current = { x: e.clientX, time: now };

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = ev.clientX - dragStartRef.current.x;
        if (Math.abs(dx) > 3) {
          dragStartRef.current.didDrag = true;
        }

        const moveTime = performance.now();
        const deltaT = (moveTime - lastPointerRef.current.time) / 1000;
        if (deltaT > 0.005) {
          const moveDx = lastPointerRef.current.x - ev.clientX;
          momentumVelRef.current = moveDx / deltaT;
          lastPointerRef.current = { x: ev.clientX, time: moveTime };
        }

        let nextPos = dragStartRef.current.pos - dx;
        const W = halfWidthRef.current;
        if (W > 0) {
          while (nextPos >= W) nextPos -= W;
          while (nextPos < 0) nextPos += W;
        }
        posRef.current = nextPos;
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-nextPos}px, 0, 0)`;
        }
      };

      const cleanupPointer = () => {
        isDraggingRef.current = false;
        setIsGrabbing(false);
        const elapsed = performance.now() - lastPointerRef.current.time;
        if (elapsed > 60) {
          momentumVelRef.current = 0;
        } else {
          momentumVelRef.current = Math.max(-1800, Math.min(1800, momentumVelRef.current));
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", cleanupPointer);
        window.removeEventListener("pointercancel", cleanupPointer);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", cleanupPointer);
      window.addEventListener("pointercancel", cleanupPointer);
    };

    const handleClickCapture = (e: React.MouseEvent) => {
      if (dragStartRef.current.didDrag) {
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current.didDrag = false;
      }
    };

    if (loopList.length === 0) return null;

    return (
      <div
        ref={containerRef}
        className={`overflow-hidden w-full relative select-none touch-pan-y py-4 -my-2 ${isGrabbing ? "cursor-grabbing" : "cursor-grab"} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          ref={trackRef}
          className={`flex ${gapClass} w-max will-change-transform select-none py-2 px-1`}
          style={{ transform: "translate3d(0, 0, 0)" }}
        >
          {loopList.map((item, idx) => (
            <React.Fragment key={idx}>
              {renderItem(item, idx)}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

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
          views: bp.views || 0,
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
        views: va.viewsCount || 0,
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
    } catch {
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
    ashrams.forEach((ashram: any) => {
      const city = ashram.address?.city || ashram.address?.district;
      if (city && city.toLowerCase().includes(valueLower)) {
        matches.add(city);
      }
      if (ashram.name && ashram.name.toLowerCase().includes(valueLower)) {
        matches.add(ashram.name);
      }
      if (Array.isArray(ashram.amenities)) {
        ashram.amenities.forEach((am: string) => {
          if (typeof am === "string" && am.toLowerCase().includes(valueLower)) {
            matches.add(am);
          }
        });
      }
    });
    setSuggestions(Array.from(matches).slice(0, 6));
    setShowSuggestions(true);
  };
  const serviceHighlights = [
    {
      title: publishedCms.destinations_banner?.title || "Destinations",
      href: "/pilgrimage-circuits",
      cta: publishedCms.destinations_banner?.ctaText || "Explore Holy Places",
      description:
        publishedCms.destinations_banner?.description ||
        publishedCms.destinations_banner?.subtitle ||
        "Explore sacred places, plan your trip and discover spiritual experiences.",
      img: publishedCms.destinations_banner?.bannerImage || "",
      alt: "Sacred Destinations",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "bg-[#0A4DA6] text-white hover:bg-[#083D85]",
    },
    {
      title: publishedCms.parking_banner?.title || "Parking",
      href: "/parking",
      cta: publishedCms.parking_banner?.ctaText || "Explore Parking",
      description:
        publishedCms.parking_banner?.description ||
        publishedCms.parking_banner?.subtitle ||
        "Reserve hassle-free vehicle parking slots near ashrams, temples, and yatra circuits.",
      img: publishedCms.parking_banner?.bannerImage || "",
      alt: "Sacred Parking Facilities",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "bg-[#0A4DA6] text-white hover:bg-[#083D85]",
    },
    {
      title: publishedCms.marketplace_banner?.title || "Marketplace",
      href: "/marketplace",
      cta: publishedCms.marketplace_banner?.ctaText || "Visit Marketplace",
      description:
        publishedCms.marketplace_banner?.description ||
        publishedCms.marketplace_banner?.subtitle ||
        "Shop spiritual products, puja items, books, handicrafts and more.",
      img: publishedCms.marketplace_banner?.bannerImage || "",
      alt: "Spiritual Marketplace",
      overlay: "bg-gradient-to-t from-black/90 via-black/55 to-black/35",
      eyebrowClass: "text-[#E58C28]",
      descriptionClass: "text-gray-200",
      ctaClass: "bg-[#0A4DA6] text-white hover:bg-[#083D85]",
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

  // Dynamically group database ashrams by destination city/location
  const sacredDestinations = useMemo(() => {
    if (!ashrams || ashrams.length === 0) return [];

    const destMap = new Map<
      string,
      {
        name: string;
        state: string;
        img: string;
        count: number;
        ratingSum: number;
        ratingCount: number;
      }
    >();

    ashrams.forEach((a: any) => {
      const city =
        a.address?.city?.trim() ||
        a.address?.district?.trim() ||
        a.address?.state?.trim();
      if (!city) return;

      const key = city.toLowerCase();
      const primaryImg =
        (Array.isArray(a.images) &&
          a.images.find(
            (img: any) => typeof img === "string" && img.trim().length > 0,
          )) ||
        a.coverImage ||
        a.thumbnail ||
        a.img ||
        "";

      const ratingVal =
        typeof a.rating === "number" ? a.rating : a.rating?.average || 0;

      const existing = destMap.get(key);
      if (!existing) {
        destMap.set(key, {
          name: toTitleCase(city),
          state: toTitleCase(a.address?.state),
          img: primaryImg,
          count: 1,
          ratingSum: ratingVal,
          ratingCount: ratingVal ? 1 : 0,
        });
      } else {
        existing.count += 1;
        if (!existing.img && primaryImg) {
          existing.img = primaryImg;
        }
        if (ratingVal) {
          existing.ratingSum += ratingVal;
          existing.ratingCount += 1;
        }
      }
    });

    return Array.from(destMap.values()).map((d) => ({
      name: d.name,
      state: d.state,
      rating: d.ratingCount > 0 ? (d.ratingSum / d.ratingCount).toFixed(1) : "4.8",
      tours: `${d.count} ${d.count === 1 ? "Stay" : "Stays"}`,
      img: d.img,
    }));
  }, [ashrams]);

  // Real reviews only. The section is hidden entirely when there are none
  // rather than filled with sample testimonials.
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
    img: r.ashramId?.images?.[0] || "",
  }));

  // Service icons strip aligned with Tirvona Theme & Routing with Parking in the center & highlighted
  const serviceIcons = [
    {
      id: "circuits",
      label: "Pilgrimage",
      icon: MapPin,
      category: "circuits",
      target: "/pilgrimage-circuits",
      isHighlight: false,
    },
    {
      id: "events",
      label: "Events & Festivals",
      icon: Sparkles,
      category: "events",
      target: "/events",
      isHighlight: false,
    },
    {
      id: "food",
      label: "Food & Dining",
      icon: Utensils,
      category: "food",
      target: "/restaurants",
      isHighlight: false,
    },
    {
      id: "prasad",
      label: "Sacred Prasad",
      icon: Activity,
      category: "prasad",
      target: "#prashad",
      isHighlight: false,
    },
    {
      id: "parking",
      label: "Parking",
      icon: CircleParking,
      category: "parking",
      target: "/parking",
      isHighlight: true,
    },
    {
      id: "shops",
      label: "Shops & Services",
      icon: LayoutGrid,
      category: "shops",
      target: "/shops",
      isHighlight: false,
    },
    {
      id: "pooja",
      label: "Live Pooja",
      icon: Flame,
      category: "pooja",
      target: "/temples",
      isHighlight: false,
    },
    {
      id: "aarti",
      label: "Arati Booking",
      icon: Heart,
      category: "aarti",
      target: "/temples",
      isHighlight: false,
    },
    {
      id: "volunteer",
      label: "Volunteer",
      icon: HeartHandshake,
      category: "volunteer",
      target: "/volunteer",
      isHighlight: false,
    },
  ];

  // Extract Dynamic Approved Published CMS Sections (Strictly Section-Mapped)
  const publishedHero = publishedCms.hero_banner || {};
  const publishedOffer = publishedCms.offer_banner || {};
  /**
   * Published banner values, with the bundled defaults as fallbacks.
   *
   * `activeHeroBg` used to be assigned `heroBg` outright, so an approved hero
   * image never reached the page: the CMS published it, /cms/published served
   * it, and the homepage rendered the bundled asset regardless. The heading,
   * CTA and announcement were computed here and then never referenced in the
   * JSX at all — which is why editing a banner in the admin panel appeared to
   * do nothing.
   */
  const activeHeroBg = publishedHero.bannerImage || "";
  // Split on the comma so an edited heading keeps the two-line treatment, with
  // the second line in saffron, exactly as the static copy had it.
  const activeHeading =
    publishedHero.heading ||
    publishedHero.title ||
    "Connecting Sacred Destinations, Empowering Communities.";
  const [headingLead, ...headingRest] = String(activeHeading).split(/,\s*/);
  const headingTail = headingRest.join(", ");
  const activeSubtitle =
    publishedHero.subtitle ||
    "Plan your pilgrimage, book stays, explore holy places, shop spiritual products and contribute to a greater cause.";
  const activeCtaText = publishedHero.ctaText || "Explore Sacred Stays";
  const activeAnnouncement =
    publishedCms.announcement?.announcement ||
    publishedCms.announcement?.text ||
    "";

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      {/* ══════════════════════ HERO SECTION (Full Width with Rounded Bottom Corners) ══════════════════════ */}
      <section className="relative pt-28 sm:pt-36 lg:pt-40 pb-40 sm:pb-52 lg:pb-60 min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] flex items-center overflow-hidden rounded-b-[36px] sm:rounded-b-[48px] shadow-xl bg-gradient-to-br from-[#0B192C] via-[#0D233E] to-[#0B192C]">
        {/* Background Image Container */}
        <div className="absolute inset-0 z-0">
          {activeHeroBg ? (
            <img
              src={activeHeroBg}
              alt="Tirvona Hero Banner"
              className="w-full h-full object-cover object-center"
              loading="eager"
            />
          ) : null}
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
              <span className="block">
                {headingLead}
                {headingTail ? "," : ""}
              </span>
              {headingTail && (
                <span className="block text-[#E58C28] mt-1 sm:mt-1.5 font-bold">
                  {headingTail}
                </span>
              )}
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

            {/* Both of these render only when the CMS supplies them, so an
                unpublished banner adds nothing to the hero rather than showing
                an empty button or an blank strip. */}
            {activeAnnouncement && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="mx-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E58C28]/20 border border-[#E58C28]/40 backdrop-blur-xs"
              >
                <Sparkles size={13} className="text-[#E58C28] shrink-0" />
                <span className="text-xs font-bold text-white">
                  {activeAnnouncement}
                </span>
              </motion.div>
            )}

            {activeCtaText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex justify-center pt-1"
              >
                <button
                  type="button"
                  onClick={() => navigate(publishedHero.targetUrl || "/search")}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-sm font-extrabold shadow-lg transition-all cursor-pointer"
                >
                  {activeCtaText}
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════ FLOATING BOOKING & SEARCH CARD (Overlapping Hero 50%) ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-20 sm:-mt-24 lg:-mt-24 z-30 relative mb-12 sm:mb-16 lg:mb-20">
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
                  className={`relative flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-colors duration-200 ${active
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
        <div className="relative isolate overflow-visible bg-white dark:bg-[#0B192C] rounded-[28px] lg:rounded-full shadow-2xl shadow-[#0B192C]/10 border border-gray-200 dark:border-slate-800/80 p-1.5 sm:p-2">
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.55fr_1.35fr_1.15fr_auto] gap-1 lg:gap-0 items-center"
          >
            {/* Field 1: DESTINATION (30% / 2fr ratio) */}
            <div
              className="group cursor-pointer rounded-2xl lg:rounded-full px-5 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-lg transition-all flex flex-col justify-center min-h-[64px] lg:border-r border-gray-200/80 dark:border-slate-800/80 relative min-w-0 z-10 focus-within:z-[90]"
              ref={autocompleteRef}
            >
              <label className="block text-[11px] font-extrabold text-[#0B192C] dark:text-white mb-0.5 select-none">
                Where
              </label>
              <div className="relative flex items-center gap-2.5 min-w-0 w-full">
                <div className="min-w-0 flex-1 relative flex items-center">
                  <input
                    type="text"
                    placeholder="Search destinations"
                    value={destination}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-transparent border-none p-0 text-xs sm:text-sm font-bold focus:outline-none text-[#0B192C] dark:text-white placeholder:text-gray-400 truncate"
                  />
                </div>
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
                        <span className="truncate">{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date range: one cohesive interaction for arrival and departure. */}
            <div className="group rounded-2xl lg:rounded-full px-5 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-lg transition-all flex items-center min-h-[64px] lg:border-r border-gray-200/80 dark:border-slate-800/80 relative min-w-0 z-10 focus-within:z-[90]">
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(nextIn, nextOut) => {
                  setCheckIn(nextIn);
                  setCheckOut(nextOut);
                  updateBookingSearch({ checkIn: nextIn, checkOut: nextOut });
                }}
                pill
              />
            </div>

            {/* Field 3: GUESTS */}
            <div className="group cursor-pointer rounded-2xl lg:rounded-full px-5 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-lg transition-all flex flex-col justify-center min-h-[64px] relative min-w-0 z-10 focus-within:z-[90]">
              <GuestRoomSelector pill />
            </div>

            {/* Field 5: SEARCH BUTTON (16% / auto ratio) */}
            <div className="flex items-center justify-center p-1 col-span-1 sm:col-span-2 lg:col-span-1 min-h-[64px]">
              <button
                type="submit"
                aria-label="Search stays"
                className="w-full lg:w-14 h-12 lg:h-14 px-5 lg:px-0 bg-[#0A4DA6] hover:bg-[#083D85] text-white font-bold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 shadow-md shadow-[#0A4DA6]/20 hover:shadow-lg hover:shadow-[#0A4DA6]/30 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <span className="lg:hidden">Search</span>
                <Search size={16} className="stroke-[2.5]" />
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
              const isHighlight = item.isHighlight;
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
                  <div
                    className={`p-2 sm:p-2.5 rounded-full transition-all ${
                      isHighlight
                        ? "bg-[#0A4DA6] text-white shadow-md ring-2 ring-[#E58C28] ring-offset-1 ring-offset-white dark:ring-offset-[#0B192C]"
                        : "bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-400 group-hover:bg-[#0A4DA6] group-hover:text-white"
                    }`}
                  >
                    <IconComponent size={16} className="stroke-[2.5]" />
                  </div>
                  <span
                    className={`text-[9px] font-black whitespace-pre-line text-center leading-tight transition-colors ${
                      isHighlight
                        ? "text-[#0A4DA6] dark:text-amber-400 font-extrabold"
                        : "text-[#0B192C] dark:text-gray-200 group-hover:text-[#0A4DA6]"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════ EVERYTHING YOU NEED ══════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-10 lg:mb-20 mt-6 lg:mt-0">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Explore Tirvona
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
            Find verified ashram stays and authentic spiritual experiences with Tirvona.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 w-full pt-2 pb-6">
          {serviceHighlights.map((card, idx) => (
            <div
              key={`${card.title}-${idx}`}
              className="w-full relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer bg-[#0B192C]"
              style={{ height: "clamp(200px, 50vw, 260px)" }}
              onClick={() => navigate(card.href)}
            >
              {card.img ? (
                <img
                  src={card.img}
                  alt={card.alt}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : null}
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
                  className={`self-center mx-auto px-6 py-2.5 min-h-[40px] font-extrabold text-xs rounded-full transition-all cursor-pointer shadow-md border border-white/20 ${card.ctaClass}`}
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
            Explore sacred cities across India including Vrindavan, Mathura,
            Goverdhan, Barsana, and Haridwar.
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
        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={sacredDestinations}
            speed={30}
            renderItem={(item: any, idx: number) => (
              <div
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
                    {item.img ? (
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
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
            )}
          />
        </div>
      </section>

      {/* ══════════════════════ UPCOMING ARDH KUMBH FESTIVAL BANNER (100% Full Width Edge-to-Edge Hero Banner) ══════════════════════ */}
      <section
        onClick={() => publishedFeatured._id && navigate(`/featured-banner/${publishedFeatured._id}`)}
        className={`relative w-full aspect-[16/7] sm:aspect-[21/9] lg:aspect-[1920/540] min-h-[280px] sm:min-h-[360px] lg:min-h-[440px] flex items-center justify-center overflow-hidden rounded-none shadow-2xl mb-14 lg:mb-24 ${publishedFeatured._id ? "cursor-pointer" : ""}`}
      >
        {/* Published festival banner */}
        {publishedFeatured.bannerImage || publishedFeatured.imageUrl || publishedFeatured.image ? (
          <img
            src={publishedFeatured.bannerImage || publishedFeatured.imageUrl || publishedFeatured.image}
            alt={publishedFeatured.heading || "Featured Tirvona banner"}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
        {/* Subtle gradient overlay for high contrast text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/80 via-[#0B192C]/50 to-black/30 dark:from-[#070F1B]/90 dark:via-[#070F1B]/60 dark:to-transparent" />

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
              {publishedFeatured.heading ||
                publishedFeatured.title ||
                "Upcoming Aradh Kumbh Festival"}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[#E2E8F0] text-sm sm:text-base leading-relaxed max-w-2xl font-medium drop-shadow-md"
            >
              {publishedFeatured.description ||
                publishedFeatured.subtitle ||
                "Experience the divine spiritual gathering on the sacred banks of Ganga in Haridwar. Secure your holy ashram stay today for peace and divine blessings."}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="pt-3"
            >
              <button
                onClick={() =>
                  navigate(
                    publishedFeatured._id
                      ? `/featured-banner/${publishedFeatured._id}`
                      : publishedFeatured.targetUrl || "/search?destination=Haridwar",
                  )
                }
                className="bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold text-xs sm:text-sm pl-7 pr-2 py-3 rounded-full flex items-center gap-3 shadow-2xl hover:shadow-primary/40 transition-all cursor-pointer group/btn border border-white/20"
              >
                <span>{publishedFeatured.ctaText || "View Details"}</span>
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
        id="prashad"
        className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20"
      >
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Sacred Prasad
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
            Authentic Mahaprasad delivered directly from famous holy temples.
          </p>
          <button
            type="button"
            onClick={() => navigate("/marketplace")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore Sacred Prasad <ArrowRight size={14} />
          </button>
        </div>

        {/* Dynamic Database-Driven Marketplace Product Cards Carousel */}
        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={
              marketplaceProducts.length > 0
                ? marketplaceProducts
                : marketplaceCategories.length > 0
                  ? marketplaceCategories
                  : [
                    {
                      _id: "prasad-1",
                      name: "neelkanth mahadev prasad",
                      templeSource: "Heritage Brass Guild",
                      price: 799,
                      rating: 4.8,
                      images: [
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
                      ],
                    },
                    {
                      _id: "prasad-2",
                      name: "ganga arti prasad",
                      templeSource: "Haridwar Ganga Sabha Trust",
                      price: 899,
                      rating: 5.0,
                      images: [
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
                      ],
                    },
                    {
                      _id: "prasad-3",
                      name: "Nitya Puja prasad",
                      templeSource: "Tirvona Spiritual Foundation",
                      price: 499,
                      rating: 4.9,
                      images: [
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
                      ],
                    },
                    {
                      _id: "prasad-4",
                      name: "Vrindavan prasad",
                      templeSource: "ISKCON Vrindavan Artisans",
                      price: 199,
                      rating: 4.9,
                      images: [
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
                      ],
                    },
                  ]
            }
            speed={30}
            renderItem={(item: any, idx: number) => {
              const isProduct =
                !!item.price || Array.isArray(item.images) || item.salePrice;
              const fallbackImg =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
              const imgUrl = isProduct
                ? item.images?.[0] || item.img || fallbackImg
                : item.coverImage ||
                item.thumbnail ||
                item.img ||
                fallbackImg;
              const name = item.name || item.title || "Sacred Prasad";
              const subtitle =
                item.templeSource ||
                item.subtitle ||
                (item.originCity
                  ? `${item.originCity}, ${item.originState}`
                  : "Sanctified Prasad");
              const rawPrice = item.price || item.salePrice || 199;
              const isItemOutOfStock =
                item.status === "out_of_stock" ||
                (item.stock !== undefined && Number(item.stock) <= 0) ||
                (item.stockCount !== undefined && Number(item.stockCount) <= 0);
              const discountPct =
                isProduct && item.price && item.salePrice && item.salePrice < item.price
                  ? Math.round(((item.price - item.salePrice) / item.price) * 100)
                  : 0;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    const targetId = item.slug || item._id;
                    if (targetId) {
                      if (isProduct) {
                        navigate(`/marketplace/product/${targetId}`);
                      } else {
                        navigate(`/marketplace/category/${targetId}`);
                      }
                    } else {
                      navigate("/marketplace");
                    }
                  }}
                  className="flex-shrink-0 relative group cursor-pointer"
                  style={{ width: "clamp(210px, 48vw, 230px)" }}
                >
                  <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                    <div
                      className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                      style={{ height: "clamp(170px, 40vw, 190px)" }}
                    >
                      <img
                        src={imgUrl}
                        alt={name}
                        className="w-full h-full object-cover opacity-90"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = fallbackImg;
                        }}
                      />
                      {isItemOutOfStock ? (
                        <span className="absolute top-3 left-3 bg-red-600/90 backdrop-blur-md text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md tracking-wider">
                          OUT OF STOCK
                        </span>
                      ) : discountPct > 0 ? (
                        <span className="absolute top-3 left-3 bg-rose-500/90 backdrop-blur-md text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md tracking-wider">
                          ${discountPct}% OFF
                        </span>
                      ) : null}

                      {(item.rating || isProduct) && (
                        <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Star size={10} className="fill-amber-400" />{" "}
                          {item.rating || 4.9}
                        </span>
                      )}
                    </div>

                    <div className="p-4 text-center flex flex-col items-center justify-center min-h-[84px]">
                      <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center group-hover:text-[#0A4DA6] transition-colors">
                        {t(name)}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-bold mt-0.5 text-center line-clamp-1">
                        {t(subtitle)}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-2">
                        <span className="font-black text-xs text-[#0B192C] dark:text-gray-300">
                          {formatCurrency(rawPrice)}
                        </span>
                        {isItemOutOfStock && (
                          <span className="text-[9px] font-extrabold text-red-500 uppercase bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200/50 dark:border-red-900/30">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
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
            Tirvona Verified ashrams and dharamshalas providing peaceful
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
              { id: "recent", label: "Recently Tirvona Verified" },
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
          <div className="pt-2 pb-6">
            <MarqueeSlider
              items={getTabbedAshrams()}
              speed={30}
              renderItem={(ashram: any, idx: number) => (
                <div
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
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                        }
                        alt={ashram.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                        }}
                      />
                      {/* Royal Navy Blue Price Badge */}
                      <span className="absolute top-3 left-3 bg-[#0A4DA6] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm">
                        {formatCurrency(ashram.lowestNightPrice ?? 150)} / night
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
                </div>
              )}
            />
          </div>
        )}
      </section>

      {/* ══════════════════════ FEATURED OFFERS & FESTIVAL SPECIALS BANNER ══════════════════════ */}
      {/* Rendered only when real offers exist. This block used to fall back to
        four invented campaigns — Mahakumbh/KUMBH2026, Vrindavan/VRINDAVAN25 and
        two more — none of which were in the database. Visitors were shown promo
        codes that could never be redeemed, and the section kept advertising
        them after every offer had been deleted. */}
      {offers.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-12 lg:mb-20 mt-6">
        {/* Clean Text Header (No Background Wallpaper) */}
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            {publishedOffer.heading || publishedOffer.title || "Exclusive Offers"}
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
            {publishedOffer.description ||
              publishedOffer.subtitle ||
              "Exclusive discounts, promo vouchers, and festival packages for your sacred retreat."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/offers")}
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Explore All Offers <ArrowRight size={14} />
          </button>
        </div>

        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={offers}
            speed={30}
            renderItem={(offer: any, idx: number) => {
              const cardImg =
                offer.bannerImage ||
                offer.thumbnailImage ||
                offer.image ||
                "";

              const targetAshram = offer.ashramId?._id
                ? offer.ashramId
                : offer.applicableAshrams && offer.applicableAshrams[0];
              const city =
                offer.ashramId?.address?.city || targetAshram?.address?.city;

              // A coupon bound to an ashram goes straight to that ashram's
              // booking page with the code pre-applied. Anything unbound falls
              // back to the offer's own page.
              const handleCardClick = () => {
                const boundAshramId = String(
                  offer.ashramId?._id ??
                    offer.ashramId ??
                    targetAshram?._id ??
                    "",
                );
                const promo = encodeURIComponent(offer.promoCode || "");
                if (boundAshramId) {
                  navigate(`/ashram/${boundAshramId}?promoCode=${promo}`);
                } else if (offer._id) {
                  navigate(`/offers/${offer._id}`);
                } else if (offer.promoCode) {
                  navigate(`/search?promoCode=${promo}`);
                }
              };

              return (
                <CouponVoucherCard
                  key={`${offer._id || "offer"}-${idx}`}
                  offer={{
                    ...offer,
                    image: cardImg,
                    // Only pass an ashram through when the offer names one;
                    // an empty object would print a card with a blank pin.
                    ashramId:
                      city || targetAshram?.name
                        ? { address: { city }, name: targetAshram?.name }
                        : undefined,
                  }}
                  onBookNow={handleCardClick}
                  isCarouselItem={true}
                />
              );
            }}
          />
        </div>
      </section>
      )}

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
        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={homePosts}
            speed={30}
            renderItem={(item: any, idx: number) => {
              const isVideo = item.contentType === "video";
              const targetUrl = isVideo
                ? `/video/${item.slug}`
                : `/blog/${item.slug}`;
              const author = item.author || {};

              return (
                <div
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
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
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
            }}
          />
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
          <div className="pt-2 pb-6">
            <MarqueeSlider
              items={customerFeedbacks}
              speed={30}
              renderItem={(fb: any, idx: number) => (
                <div
                  className="flex-shrink-0 relative group cursor-pointer"
                  style={{ width: "clamp(240px, 50vw, 280px)" }}
                >
                  {/* Rounded Image Card Container (Matching Reference Screenshot Aspect & Border Radius) */}
                  <div className="w-full bg-white dark:bg-[#0B192C] rounded-[28px] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col hover:-translate-y-1.5 h-[340px] sm:h-[380px] relative">
                    {/* Full Height Background Image */}
                    {fb.img ? (
                      <img
                        src={fb.img}
                        alt={fb.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                    ) : null}

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
              )}
            />
          </div>
        </section>
      )}
    </div>
  );
};
export default HomePage;
