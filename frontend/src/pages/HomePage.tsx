import React, { useState, useEffect, useRef, useMemo } from "react";
import { ashramUrl } from "../lib/urls";
import { checkAshramBookingAvailable } from "../utils/ashramAvailabilityHelper";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { ashramService, reviewService } from "../services";
import { storeApi, toStoreProduct, type StoreProduct } from "../services/marketplace.service";
import { visitorArticleService } from "../services/visitorArticleService";
import { volunteerService } from "../services/volunteer.service";
import { formatCurrency } from "../utils/format";
import {
  APPROVED_SACRED_DESTINATIONS,
  isAshramInDestination,
} from "../utils/destinationNormalizer";
import { DateRangePicker } from "../components/DateRangePicker";
import { ShortStayDateTimePicker } from "../components/ShortStayDateTimePicker";
import { GuestRoomSelector } from "../components/shared/GuestRoomSelector";
import {
  useBookingSearch,
  normalizeBookingDates,
  getTodayYMD,
} from "../contexts/BookingSearchContext";
import { useLanguage } from "../contexts/LanguageContext";
import HomeAartiSections from "../modules/aarti/components/HomeAartiSections";
import { MarqueeSlider } from "../components/shared/MarqueeSlider";
import { trackViewHome, trackSearchStay } from "../lib/analytics";
import {
  ExploreLink,
  SectionHeader,
  ServiceCard,
  ServiceChip,
  TIRVONA_SERVICES,
  type TirvonaService,
} from "../design-system/premium";
import {
  Search,
  Calendar,
  Star,
  CheckCircle,
  Compass,
  ArrowRight,
  Sparkles,
  BookOpen,
  Play,
  Bed,
  Flame,
  HandHeart,
  LayoutGrid,
  ShoppingBag,
  Video,
  Ticket,
  Route,
  Store,
  Tag,
} from "lucide-react";

export const HomePage: React.FC = () => {
  const { language: _language, t } = useLanguage();
  const navigate = useNavigate();
  const { searchState, updateBookingSearch, totalGuests } = useBookingSearch();
  const [destination, setDestination] = useState("");
  const [stayType, _setStayType] = useState("");
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
  const [marketplaceProducts, setMarketplaceProducts] = useState<StoreProduct[]>([]);
  const [volunteerJobs, setVolunteerJobs] = useState<any[]>([]);
  const [volunteerJobsLoaded, setVolunteerJobsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "top_rated" | "most_booked" | "recent" | "govt_recom"
  >("top_rated");
  const [searchTab, setSearchTab] = useState<
    "destinations" | "stay" | "day-stay" | "experiences"
  >("stay");
  const [dayStayTime, setDayStayTime] = useState<string>("10:00");
  const [_offerSlideIndex, _setOfferSlideIndex] = useState<number>(0);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [_activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const _activityOptions = [
    { value: "", label: "Trip Type" },
    { value: "ashram", label: "Stay" },
    { value: "dharamshala", label: "Dharamshala" },
    { value: "homestay", label: "Homestay" },
  ];

  const carouselRef = useRef<HTMLDivElement>(null);
  const _prashadRef = useRef<HTMLDivElement>(null);
  const _featuredRef = useRef<HTMLDivElement>(null);
  const _feedbackRef = useRef<HTMLDivElement>(null);
  const _offersRef = useRef<HTMLDivElement>(null);
  const _blogRef = useRef<HTMLDivElement>(null);
  const _servicesRef = useRef<HTMLDivElement>(null);

  const [publishedCms, setPublishedCms] = useState<any>({});
  const [publishedFeatured, setPublishedFeatured] = useState<any>({});
  const [_destinationsData, setDestinationsData] = useState<any[]>([]);

  useEffect(() => {
    trackViewHome();
    fetchStays();
    fetchOffers();
    fetchFeedbacks();
    fetchPublishedCms();
    fetchPublishedFeatured();
    fetchDestinations();
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

  const fetchDestinations = async () => {
    try {
      const destRes = await ashramService.destinations();
      if (destRes.data?.success) {
        setDestinationsData(destRes.data.data || []);
      }
    } catch (err) {
      console.warn("Error fetching destinations for home:", err);
    }
  };

  useEffect(() => {
    fetchStays();
    fetchOffers();
    fetchMarketplaceProducts();
    fetchVolunteerJobs();
    fetchHomePosts();

    const handleMarketplaceSync = () => {
      fetchMarketplaceProducts();
    };

    window.addEventListener("marketplace_updated", handleMarketplaceSync);
    return () => {
      window.removeEventListener("marketplace_updated", handleMarketplaceSync);
    };
  }, []);

  const fetchMarketplaceProducts = async () => {
    try {
      // Vendor marketplace only: approved products of active stores.
      const res = await storeApi.products({ limit: 10 });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMarketplaceProducts(res.data.data.map(toStoreProduct));
      }
    } catch (err) {
      console.error("Fetch marketplace products error:", err);
    }
  };

  const fetchVolunteerJobs = async () => {
    try {
      const res = await volunteerService.getJobs({ limit: 3 });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setVolunteerJobs(res.data.data.slice(0, 3));
      }
    } catch (err) {
      console.warn("Volunteer roles load:", err);
    } finally {
      setVolunteerJobsLoaded(true);
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
          // An admin-entered author name wins over the linked author record.
          author: bp.authorName
            ? { ...(bp.authorId || {}), name: bp.authorName }
            : bp.authorId || { name: "Tirvona Editorial", photo: bp.coverImage },
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

  const fetchStays = async () => {
    try {
      const res = await ashramService.search({ verified: "true", limit: "100" });
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
    if (searchTab === "destinations" && destination.trim()) {
      const slug = destination
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      navigate(`/destination/${slug}`);
      return;
    }
    updateBookingSearch({
      destination,
      checkIn,
      checkOut,
    });

    trackSearchStay({
      destination: destination.trim(),
      check_in: checkIn,
      check_out: checkOut,
      guests: totalGuests,
      rooms: searchState.rooms,
    });

    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (stayType) params.set("type", stayType);
    if (checkIn) params.set("checkIn", checkIn);
    if (searchTab === "day-stay") {
      params.set("checkOut", checkIn);
      params.set("tab", "day-stay");
      if (dayStayTime) params.set("time", dayStayTime);
    } else {
      if (checkOut) params.set("checkOut", checkOut);
      if (searchTab && searchTab !== "destinations") params.set("tab", searchTab);
    }
    params.set("rooms", String(searchState.rooms));
    params.set("adults", String(searchState.adults));
    params.set("children", String(searchState.children));
    params.set("guests", String(totalGuests));
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
  // Admin-published CMS banners still drive their service cards (image, description, button text).
  const serviceCms: Partial<Record<TirvonaService["id"], any>> = {
    temples: publishedCms.temples_banner,
    parking: publishedCms.parking_banner,
    marketplace: publishedCms.marketplace_banner,
  };

  // Ready-made combinations for "Plan your pilgrimage". Each step links to the existing service page.
  const pilgrimageJourneys = [
    {
      eyebrow: "Darshan & stay",
      title: "A peaceful stay near the temple",
      description: "Choose the temples you want to visit, stay close by, and have sattvik meals brought to you.",
      steps: [
        { label: "Choose your temples", hint: "Timings, aartis and festivals", to: "/temples" },
        { label: "Book a stay nearby", hint: "Ashrams, dharamshalas, homestays", to: "/search" },
        { label: "Order sattvik meals", hint: "Pickup or delivered to your stay", to: "/food" },
      ],
    },
    {
      eyebrow: "Day yatra by road",
      title: "Drive in, rest, and join the aarti",
      description: "Reserve parking before you leave, freshen up for a few hours, and book your place at aarti.",
      steps: [
        { label: "Reserve parking", hint: "A confirmed slot near the temple", to: "/parking" },
        { label: "Day rest & freshen-up", hint: "Short stays by the hour", to: "/search?tab=day-stay" },
        { label: "Book the aarti", hint: "Reserve your place in advance", to: "/aarti" },
      ],
    },
    {
      eyebrow: "Puja & rituals",
      title: "A puja done properly, anywhere",
      description: "Book a verified pandit, get the samagri delivered, or join a puja streamed live.",
      steps: [
        { label: "Book a pandit", hint: "In person or live online", to: "/pandits" },
        { label: "Get puja samagri", hint: "From verified sellers", to: "/marketplace" },
        { label: "Join a live pooja", hint: "Watch from wherever you are", to: "/live-pooja" },
      ],
    },
  ];

  // Experiences beyond the seven core services, all existing pages.
  const moreExperiences = [
    { to: "/aarti", label: "Aarti Booking", hint: "Reserve your place at aarti", icon: Flame },
    { to: "/live-pooja", label: "Live Pooja", hint: "Join pujas streamed live", icon: Video },
    { to: "/events", label: "Events & Festivals", hint: "Festivals and spiritual gatherings", icon: Ticket },
    { to: "/pilgrimage-circuits", label: "Pilgrimage Circuits", hint: "Plan a multi-temple yatra", icon: Route },
    { to: "/search?tab=day-stay", label: "Day Rest & Freshen-Up", hint: "Short stays by the hour", icon: Sparkles },
    { to: "/shops", label: "Shops & Services", hint: "Local shops near holy places", icon: Store },
    { to: "/offers", label: "Offers", hint: "Current deals across Tirvona", icon: Tag },
    { to: "/travel-guides", label: "Travel Guides", hint: "Tips for planning your yatra", icon: BookOpen },
  ];

  const selectSuggestion = (sug: string) => {
    setDestination(sug);
    setShowSuggestions(false);
  };

  const getTabbedAshrams = () => {
    let list = [...ashrams];
    if (activeTab === "top_rated")
      list.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
    else if (activeTab === "most_booked")
      list.sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0));
    else if (activeTab === "recent")
      list = [...list].reverse();
    else if (activeTab === "govt_recom")
      list = list.filter((a) => (a.rating?.average || 0) >= 4.6);

    // ONLY prioritize ashrams that have active LAST MINUTE DEALS
    const _isLastMin = (o: any) =>
      Boolean(o?.isLastMinuteDeal) ||
      o?.offerType === "LAST MINUTE DEAL" ||
      o?.offerType === "Last Minute Deal" ||
      (o?.promoCode && String(o.promoCode).toUpperCase().startsWith("LASTMINUTE"));

    const dealMap = new Map<string, any>();
    offers.forEach((o: any) => {
      const aId = String(o.ashramId?._id ?? o.ashramId ?? "");
      if (aId && !dealMap.has(aId)) dealMap.set(aId, o);
      if (Array.isArray(o.applicableAshrams)) {
        o.applicableAshrams.forEach((appA: any) => {
          const appAId = String(appA?._id ?? appA ?? "");
          if (appAId && !dealMap.has(appAId)) dealMap.set(appAId, o);
        });
      }
    });

    list.sort((a, b) => {
      const aHasDeal = dealMap.has(String(a._id));
      const bHasDeal = dealMap.has(String(b._id));
      return (bHasDeal ? 1 : 0) - (aHasDeal ? 1 : 0);
    });

    return list.slice(0, 10);
  };

  const _scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: direction === "left" ? -300 : 300,
        behavior: "smooth",
      });
    }
  };

  const sacredDestinations = useMemo(() => {
    return APPROVED_SACRED_DESTINATIONS.map((dest) => {
      // Find matching live ashrams in database
      const matchingAshrams = ashrams.filter((a) =>
        isAshramInDestination(a, dest.id),
      );

      const count = matchingAshrams.length;
      const ratings = matchingAshrams
        .map((a) =>
          typeof a.rating === "number" ? a.rating : a.rating?.average || 0,
        )
        .filter((r) => r > 0);

      const avgRating =
        ratings.length > 0
          ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
          : dest.defaultRating;

      return {
        id: dest.id,
        slug: dest.slug,
        name: dest.name,
        state: dest.state,
        img: dest.image,
        tagline: dest.tagline,
        count,
        rating: avgRating,
        tours: `${count} ${count === 1 ? "Stay" : "Stays"}`,
      };
    });
  }, [ashrams]);

  const customerFeedbacks = feedbacks.map((r, _i) => ({
    name: r.ashramId?.name || "Stay",
    location: r.ashramId?.address
      ? [r.ashramId.address.city, r.ashramId.address.state]
        .filter(Boolean)
        .join(", ")
      : "",
    // A super admin posting on a guest's behalf sets displayName.
    reviewer: r.displayName || r.customerId?.name || "Guest",
    verifiedStay: Boolean(r.verifiedStay),
    rating: Math.max(1, Math.round(r.rating?.overall || 5)),
    ratingValue: (r.rating?.overall || 5).toFixed(1),
    comment: r.comment,
    img: r.ashramId?.images?.[0] || "",
  }));


  const publishedHero = publishedCms.hero_banner || {};
  const activeHeroBg = publishedHero.bannerImage || "";
  const activeHeading =
    publishedHero.heading ||
    publishedHero.title ||
    "Connecting Sacred Destinations, Empowering Communities.";
  const [headingLead, ...headingRest] = String(activeHeading).split(/,\s*/);
  const headingTail = headingRest.join(", ");
  const activeCtaText = publishedHero.ctaText || "Explore Sacred Stays";
  const activeAnnouncement =
    publishedCms.announcement?.announcement ||
    publishedCms.announcement?.text ||
    "";

  return (
    <div className="home-page tvp tvp-page pb-16 lg:pb-24 overflow-x-hidden">
      <section
        aria-labelledby="home-hero-title"
        className="relative isolate overflow-hidden rounded-b-[36px] sm:rounded-b-[48px] bg-[#1a120b] pt-28 sm:pt-36 lg:pt-40 pb-36 sm:pb-44 lg:pb-44 min-h-[600px] sm:min-h-[660px] lg:min-h-0 flex items-center"
      >
        <img
          src={activeHeroBg || "/images/home/hero-vrindavan-ghats.jpg"}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#140c05]/90 via-[#140c05]/60 to-[#140c05]/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-[#140c05]/85 to-transparent" />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-center sm:text-left mx-auto sm:mx-0">
            <motion.h1
              id="home-hero-title"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="tvp-display mt-4 text-[2.15rem] leading-[1.12] sm:text-5xl lg:text-[3.6rem] font-semibold !text-white"
            >
              {publishedHero.heading || publishedHero.title ? (
                <>
                  {headingLead}
                  {headingTail ? "," : ""}
                  {headingTail && <span className="block text-[#f5b45f]">{headingTail}</span>}
                </>
              ) : (
                <>
                  Stay, pray, eat and give seva
                  <span className="block text-[#f5b45f]">on one sacred journey.</span>
                </>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-5 max-w-2xl text-sm sm:text-lg leading-relaxed text-white/85 mx-auto sm:mx-0"
            >
              {publishedHero.subtitle ||
                "Temples, sacred stays, sattvik food, parking, verified pandits, a spiritual marketplace and seva, brought together by Tirvona so you can focus on the darshan."}
            </motion.p>

            {activeAnnouncement && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="tvp-glass mt-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              >
                <Sparkles size={13} className="text-[#f5b45f] shrink-0" />
                <span className="text-xs font-bold text-white">{activeAnnouncement}</span>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-7 flex flex-wrap items-center justify-center sm:justify-start gap-3"
            >
              <button
                type="button"
                onClick={() => navigate(publishedHero.targetUrl || "/search")}
                className="tvp-btn tvp-btn-primary"
              >
                {activeCtaText}
                <ArrowRight size={16} />
              </button>
              <a href="#tirvona-services" className="tvp-btn tvp-btn-glass">
                Explore all services
              </a>
            </motion.div>
          </div>

          <motion.nav
            aria-label="Tirvona services"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="no-mobile-stack mt-8 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3"
          >
            {TIRVONA_SERVICES.map((service) => (
              <ServiceChip key={service.id} service={service} />
            ))}
          </motion.nav>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-14 sm:-mt-20 lg:-mt-24 z-30 relative mb-8">
        <div className="flex justify-center mb-4 sm:mb-5">
          <div
            className="inline-flex max-w-full overflow-x-auto scrollbar-none items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 shadow-lg shadow-[#0B192C]/10"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            {[
              {
                id: "destinations",
                icon: <Compass size={14} />,
                label: "Destinations",
              },
              { id: "stay", icon: <Bed size={14} />, label: "Stay" },
              {
                id: "day-stay",
                icon: <Sparkles size={14} />,
                label: "Short Stay",
              },
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
                    : "text-gray-600 dark:text-gray-300 hover:text-[#F28C28] dark:hover:text-white"
                    }`}
                >
                  {active && (
                    <motion.span
                      layoutId="searchTabPill"
                      className="absolute inset-0 rounded-full bg-[#F28C28] shadow-md shadow-[#F28C28]/30"
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

        <div className="relative isolate overflow-visible bg-white dark:bg-[#0B192C] rounded-[28px] lg:rounded-full shadow-2xl shadow-[#0B192C]/10 border border-gray-200 dark:border-slate-800/80 p-1.5 sm:p-2">
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 lg:grid-cols-[1.55fr_1.35fr_1.15fr_auto] gap-1 lg:gap-0 items-center"
          >
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
                    className="w-full bg-transparent border-none p-0 text-base sm:text-sm font-bold focus:outline-none text-[#0B192C] dark:text-white placeholder:text-gray-400 truncate"
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
                        <Compass size={13} className="text-[#F28C28]" />
                        <span className="truncate">{sug}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="group rounded-2xl lg:rounded-full px-5 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-lg transition-all flex items-center min-h-[64px] lg:border-r border-gray-200/80 dark:border-slate-800/80 relative min-w-0 z-10 focus-within:z-[90]">
              {searchTab === "day-stay" ? (
                <ShortStayDateTimePicker
                  date={checkIn || getTodayYMD()}
                  time={dayStayTime}
                  pill
                  onChange={(nextDate, nextTime) => {
                    setCheckIn(nextDate);
                    setCheckOut(nextDate);
                    setDayStayTime(nextTime);
                    updateBookingSearch({
                      checkIn: nextDate,
                      checkOut: nextDate,
                    });
                  }}
                />
              ) : (
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
              )}
            </div>

            <div className="group cursor-pointer rounded-2xl lg:rounded-full px-5 py-3 bg-white dark:bg-[#0B192C] hover:bg-gray-50/80 dark:hover:bg-slate-800/50 hover:shadow-lg transition-all flex flex-col justify-center min-h-[64px] relative min-w-0 z-10 focus-within:z-[90]">
              <GuestRoomSelector pill />
            </div>

            <div className="flex items-center justify-center p-1 col-span-1 sm:col-span-2 lg:col-span-1 min-h-[64px]">
              <button
                type="submit"
                aria-label="Search stays"
                className="w-full lg:w-14 h-12 lg:h-14 px-5 lg:px-0 bg-[#F28C28] hover:bg-[#D97706] text-white font-bold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 shadow-md shadow-[#F28C28]/20 hover:shadow-lg hover:shadow-[#F28C28]/30 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <span className="lg:hidden">Search</span>
                <Search size={16} className="stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>

      </section>

      <section
        id="tirvona-services"
        aria-labelledby="tirvona-services-title"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 mt-4 lg:mt-2 scroll-mt-28 space-y-10"
      >
        <SectionHeader
          id="tirvona-services-title"
          eyebrow="Everything your yatra needs"
          title="Every part of your yatra, in one place"
          subtitle="From the temple you came to see to the room you rest in and the prasad you take home, Tirvona plans and books it all."
        />

        <div className="no-mobile-stack grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {TIRVONA_SERVICES.map((service) => {
            const cms = serviceCms[service.id];
            return (
              <ServiceCard
                key={service.id}
                service={service}
                image={cms?.bannerImage}
                description={cms?.description || cms?.subtitle}
                cta={cms?.ctaText}
                featured={service.id === "temples"}
              />
            );
          })}
        </div>

        <div className="space-y-4">
          <p className="tvp-eyebrow text-center">More on Tirvona</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {moreExperiences.map((item) => (
              <ExploreLink key={item.to} to={item.to} label={item.label} hint={item.hint} icon={item.icon} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="plan-pilgrimage-title" className="tvp-band mb-8 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <SectionHeader
            id="plan-pilgrimage-title"
            eyebrow="Plan your pilgrimage"
            title="Bring the pieces of your yatra together"
            subtitle="Pick the kind of trip you are making. Each step opens the Tirvona service that handles it."
            action={
              <Link to="/destinations/planner" className="tvp-btn tvp-btn-primary mt-1">
                Open the itinerary planner <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7">
            {pilgrimageJourneys.map((journey) => (
              <article key={journey.title} className="tvp-card tv-soft-surface rounded-3xl p-6 sm:p-7 flex flex-col">
                <p className="tvp-eyebrow">{journey.eyebrow}</p>
                <h3 className="tvp-display mt-2 text-xl font-semibold">{journey.title}</h3>
                <p className="tvp-body mt-2 text-sm leading-relaxed">{journey.description}</p>
                <ol className="mt-5 space-y-2.5">
                  {journey.steps.map((step, index) => (
                    <li key={step.to}>
                      <Link
                        to={step.to}
                        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 -mx-3 transition-colors hover:bg-[#F28C28]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C19A52]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#C19A52]/60 text-[11px] font-bold tvp-ink">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="tvp-ink block text-sm font-bold">{step.label}</span>
                          <span className="tvp-muted block text-xs">{step.hint}</span>
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-[#C19A52] transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="destinations" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-8">
        <SectionHeader
          eyebrow="Temples & destinations"
          title="Sacred Destinations"
          subtitle={publishedCms.destinations_banner?.subtitle || publishedCms.destinations_banner?.description || "Discover sacred holy destinations across India with verified stays, dharamshalas, secure parking, and divine temples."}
          action={
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="tvp-btn tvp-btn-primary mt-1"
            >
              Explore All Destinations <ArrowRight size={14} />
            </button>
          }
        />

        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={sacredDestinations}
            speed={30}
            renderItem={(item: any, idx: number) => (
              <div
                key={item.id || idx}
                onClick={() => navigate(`/destination/${item.slug}`)}
                className="flex-shrink-0 relative group cursor-pointer"
                style={{ width: "clamp(200px, 48vw, 220px)" }}
              >
                <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                  <div
                    className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                    style={{ height: "clamp(170px, 40vw, 190px)" }}
                  >
                    {item.img ? (
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : null}

                    {item.rating && (
                      <span className="absolute top-3 right-3 bg-white/95 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white text-[10px] font-extrabold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm">
                        <Star
                          size={11}
                          className="text-[#D4AF37] fill-[#D4AF37]"
                        />{" "}
                        {item.rating}
                      </span>
                    )}

                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="bg-[#F28C28] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm">
                        {item.tours}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 text-center flex flex-col items-center justify-center min-h-[72px]">
                    <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center group-hover:text-[#F28C28] transition-colors">
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

      <div className="flex flex-col">
      <div className="order-2">
        <HomeAartiSections />
      </div>

      <section
        onClick={() => publishedFeatured._id && navigate(`/featured-banner/${publishedFeatured._id}`)}
        className={`order-5 relative w-full aspect-[16/9] sm:aspect-[16/8] lg:aspect-[1920/720] min-h-[340px] sm:min-h-[440px] lg:min-h-[560px] flex items-center justify-center overflow-hidden rounded-none shadow-2xl mb-8 ${publishedFeatured._id ? "cursor-pointer" : ""}`}
      >
        {publishedFeatured.bannerImage || publishedFeatured.imageUrl || publishedFeatured.image ? (
          <img
            src={publishedFeatured.bannerImage || publishedFeatured.imageUrl || publishedFeatured.image}
            alt={publishedFeatured.heading || "Featured Tirvona banner"}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/80 via-[#0B192C]/50 to-black/30 dark:from-[#070F1B]/90 dark:via-[#070F1B]/60 dark:to-transparent" />

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
                "Experience the divine spiritual gathering on the sacred banks of Ganga in Haridwar. Secure your holy stay today for peace and divine blessings."}
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
                className="bg-[#F28C28] hover:bg-[#D97706] text-white font-extrabold text-xs sm:text-sm pl-7 pr-2 py-3 rounded-full flex items-center gap-3 shadow-2xl hover:shadow-primary/40 transition-all cursor-pointer group/btn border border-white/20"
              >
                <span>{publishedFeatured.ctaText || "View Details"}</span>
                <div className="w-8 h-8 rounded-full bg-white text-[#F28C28] flex items-center justify-center transition-transform group-hover/btn:translate-x-1 shadow-md">
                  <ArrowRight size={15} className="stroke-[2.5]" />
                </div>
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      <section
        id="marketplace"
        className="order-3 w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-8"
      >
        <SectionHeader
          eyebrow="Spiritual marketplace"
          title="Tirvona Marketplace"
          subtitle={"Puja essentials and sacred goods from verified Tirvona sellers."}
          action={
            <button
              type="button"
              onClick={() => navigate("/marketplace")}
              className="tvp-btn tvp-btn-primary mt-1"
            >
              Explore the marketplace <ArrowRight size={14} />
            </button>
          }
        />

        {marketplaceProducts.length > 0 ? (
        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={marketplaceProducts}
            speed={30}
            renderItem={(item: StoreProduct, idx: number) => {
              const fallbackImg =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 240 160' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='240' height='160' fill='%23f1f5f9'/%3E%3Cg transform='translate(108 68)' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/g%3E%3C/svg%3E";
              const imgUrl = item.images[0] || fallbackImg;
              const name = item.name;
              const subtitle = item.vendor?.name ?? item.templeSource ?? "";
              const rawPrice = item.sellingPrice;
              const isItemOutOfStock = !item.inStock;
              const discountPct =
                item.price && item.salePrice && item.salePrice < item.price
                  ? Math.round(((item.price - item.salePrice) / item.price) * 100)
                  : 0;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    navigate(`/marketplace/products/${item.slug || item._id}`);
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

                      {Number(item.rating) > 0 && (
                        <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Star size={10} className="fill-amber-400" />{" "}
                          {item.rating}
                        </span>
                      )}
                    </div>

                    <div className="p-4 text-center flex flex-col items-center justify-center min-h-[84px]">
                      <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center group-hover:text-[#F28C28] transition-colors">
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
        ) : null}
        <div className="no-mobile-stack grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ExploreLink to="/marketplace" label="Shop all products" hint="Puja samagri, books and more" icon={ShoppingBag} />
          <ExploreLink to="/marketplace/categories" label="Browse categories" hint="Find exactly what you need" icon={LayoutGrid} />
          <ExploreLink to="/vendor/onboarding" label="Sell on Tirvona" hint="Open your verified store" icon={Store} />
        </div>
      </section>

      <section
        id="seva"
        aria-labelledby="seva-title"
        className="order-4 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-10 items-stretch">
          <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-[#1a120b]">
            <img
              src="/images/home/service-volunteer.jpg"
              alt="An ashram on the ghats in Rishikesh"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#140c05]/90 via-[#140c05]/60 to-[#140c05]/25" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="tvp-eyebrow !text-[#e9c98a]">Volunteer &amp; seva</p>
              <h2 id="seva-title" className="tvp-display mt-2 text-3xl sm:text-4xl font-semibold !text-white">
                Give seva where you pray
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
                Ashrams and temples list volunteer and seva roles on Tirvona, from kitchen seva to Ganga aarti and events,
                some with stay and meals included.
              </p>
              <Link to="/volunteer" className="tvp-btn tvp-btn-primary mt-5">
                See all seva roles <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="tvp-eyebrow">Open roles now</p>
            {volunteerJobs.length > 0 ? (
              <ul className="space-y-3">
                {volunteerJobs.map((job) => (
                  <li key={job._id}>
                    <Link
                      to={`/volunteer/${job._id}`}
                      className="tvp-card group flex items-start gap-4 rounded-2xl p-4 sm:p-5 transition-colors hover:border-[#C19A52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C19A52]"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F28C28]/10 text-[#F28C28]" aria-hidden>
                        <HandHeart size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="tvp-ink block text-base font-bold leading-snug">{job.title}</span>
                        <span className="tvp-muted mt-0.5 block text-xs">
                          {[job.ashramName, [job.city, job.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {[job.duration, job.accommodation ? "Stay included" : "", job.food ? "Meals included" : ""]
                            .filter(Boolean)
                            .map((tag) => (
                              <span key={tag} className="rounded-full border border-[#C19A52]/35 px-2 py-0.5 text-[11px] font-semibold tvp-muted">
                                {tag}
                              </span>
                            ))}
                        </span>
                      </span>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-[#C19A52] transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tvp-card flex flex-1 flex-col items-start justify-center rounded-2xl p-6">
                <p className="tvp-ink text-base font-bold">
                  {volunteerJobsLoaded ? "New seva roles are added by ashrams and temples regularly." : "Loading seva roles…"}
                </p>
                <p className="tvp-muted mt-1 text-sm">Browse every open role, filter by city, and apply in a few steps.</p>
                <Link to="/volunteer" className="tvp-link mt-4 text-sm">
                  Browse volunteer roles <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>


      <section className="order-1 w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-8">
        <SectionHeader
          eyebrow="Sacred stays"
          title="Stay Near Sacred Places"
          subtitle={"Tirvona Verified stays and dharamshalas providing peaceful rooms, satvik food, and morning prayers."}
          action={
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="tvp-btn tvp-btn-primary mt-1"
            >
              Explore All Stays <ArrowRight size={14} />
            </button>
          }
        />
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
                className={`pb-2.5 flex items-center px-1 shrink-0 relative cursor-pointer transition-all ${activeTab === tab.id ? "text-[#F28C28]" : "text-gray-400 hover:text-gray-600"}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-[#F28C28]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

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
              renderItem={(ashram: any, idx: number) => {
                const aId = String(ashram._id || "");
                const isLastMin = (o: any) =>
                  Boolean(o?.isLastMinuteDeal) ||
                  o?.offerType === "LAST MINUTE DEAL" ||
                  o?.offerType === "Last Minute Deal" ||
                  (o?.promoCode && String(o.promoCode).toUpperCase().startsWith("LASTMINUTE"));

                const matchingOffers = offers.filter((o: any) => {
                  const directId = String(o.ashramId?._id ?? o.ashramId ?? "");
                  const applicableIds = Array.isArray(o.applicableAshrams)
                    ? o.applicableAshrams.map((app: any) =>
                        String(app?._id ?? app ?? ""),
                      )
                    : [];
                  return directId === aId || applicableIds.includes(aId);
                });

                const ashramDeal = matchingOffers.sort((a: any, b: any) => {
                  const aIsLast = isLastMin(a);
                  const bIsLast = isLastMin(b);
                  if (aIsLast && !bIsLast) return -1;
                  if (!aIsLast && bIsLast) return 1;
                  return (Number(b.discountValue) || 0) - (Number(a.discountValue) || 0);
                })[0];

                const rawNightPrice = ashram.lowestNightPrice ?? 150;
                let finalNightPrice = rawNightPrice;
                let dealDiscountPct = 0;
                if (ashramDeal) {
                  if (ashramDeal.discountType === "Percentage") {
                    dealDiscountPct = Math.min(100, Math.max(1, Number(ashramDeal.discountValue) || 0));
                    finalNightPrice = Math.max(0, Math.round(rawNightPrice * (1 - dealDiscountPct / 100)));
                  } else if (ashramDeal.discountType === "Flat Amount") {
                    finalNightPrice = Math.max(0, rawNightPrice - Number(ashramDeal.discountValue || 0));
                    dealDiscountPct = rawNightPrice > 0 ? Math.min(100, Math.round(((rawNightPrice - finalNightPrice) / rawNightPrice) * 100)) : 0;
                  }
                }

                const isDeal = Boolean(
                  isLastMin(ashramDeal) ||
                  String(ashramDeal?.offerType || "").toUpperCase().includes("DEAL") ||
                  String(ashramDeal?.offerTitle || "").toUpperCase().includes("DEAL")
                );

                let ribbonText = "OFFER";
                if (dealDiscountPct > 0) {
                  if (isDeal) {
                    ribbonText = `${dealDiscountPct}% OFF`;
                  } else if (ashramDeal?.promoCode) {
                    ribbonText = `${dealDiscountPct}% COUPON`;
                  } else {
                    ribbonText = `${dealDiscountPct}% OFF`;
                  }
                } else if (ashramDeal?.discountType === "Flat Amount" && ashramDeal?.discountValue) {
                  ribbonText = `₹${ashramDeal.discountValue} OFF`;
                } else if (isDeal) {
                  ribbonText = "SPECIAL DEAL";
                } else if (ashramDeal?.promoCode) {
                  ribbonText = "COUPON";
                } else {
                  ribbonText = "SPECIAL OFFER";
                }

                const queryParts: string[] = [];
                if (checkIn || checkOut) {
                  queryParts.push(`checkIn=${checkIn}&checkOut=${checkOut}&guests=${totalGuests}`);
                }
                if (ashramDeal?.promoCode) {
                  queryParts.push(`promoCode=${ashramDeal.promoCode}`);
                }
                const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
                const isAvailable = checkAshramBookingAvailable(ashram);

                return (
                  <div
                    key={ashram._id || idx}
                    onClick={() => navigate(ashramUrl(ashram, queryString))}
                    className="flex-shrink-0 relative group cursor-pointer"
                    style={{ width: "clamp(200px, 48vw, 220px)" }}
                  >
                    <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                      <div
                        className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
                        style={{ height: "clamp(170px, 40vw, 190px)" }}
                      >
                        <img
                          src={
                            ashram.images?.[0] ||
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 240 160' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='240' height='160' fill='%23f1f5f9'/%3E%3Cg transform='translate(108 68)' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/g%3E%3C/svg%3E"
                          }
                          alt={ashram.name}
                          className={`w-full h-full object-cover ${!isAvailable ? "grayscale-[20%]" : ""}`}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 240 160' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='240' height='160' fill='%23f1f5f9'/%3E%3Cg transform='translate(108 68)' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/g%3E%3C/svg%3E";
                          }}
                        />

                        {ashramDeal && (
                          <div className="absolute top-0 left-0 w-28 h-28 overflow-hidden pointer-events-none z-20">
                            <div
                              className="absolute -left-[35px] top-[20px] w-[136px] -rotate-45 bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] text-white text-[9.5px] font-black uppercase tracking-wider text-center py-1 border-y border-white/20 select-none shadow-md shadow-black/25"
                            >
                              <span className="drop-shadow-sm font-black">
                                {ribbonText}
                              </span>
                            </div>
                          </div>
                        )}

                        {!isAvailable && (
                          <div className="absolute top-2.5 right-2.5 z-10">
                            <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md bg-rose-600 text-white">
                              Not Available
                            </span>
                          </div>
                        )}

                        <div className="absolute bottom-2.5 left-2.5 z-10">
                          {ashramDeal && finalNightPrice < rawNightPrice ? (
                            <div className="bg-[#F28C28]/95 backdrop-blur-sm text-white px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5">
                              <span className="text-[10px] line-through opacity-75">
                                {formatCurrency(rawNightPrice)}
                              </span>
                              <span className="text-[10px] sm:text-[11px] font-black text-amber-200">
                                {formatCurrency(finalNightPrice)} / night
                              </span>
                            </div>
                          ) : (
                            <span className="bg-[#F28C28] text-white text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-full shadow-md">
                              {formatCurrency(rawNightPrice)} / night
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 text-center flex flex-col items-center justify-center min-h-[72px]">
                        <h4 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight line-clamp-1 text-center group-hover:text-[#F28C28] transition-colors">
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
                );
              }}
            />
          </div>
        )}
      </section>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mb-8">
        <SectionHeader
          eyebrow="Stories & guides"
          title="Journey Through Spirituality"
          subtitle={"Documentaries, pilgrimage guides, temple histories, and inspiring yatra stories from devotees."}
          action={
            <button
              type="button"
              onClick={() => navigate("/blog")}
              className="tvp-btn tvp-btn-primary mt-1"
            >
              Explore Knowledge Hub <ArrowRight size={14} />
            </button>
          }
        />
        <div className="pt-2 pb-6">
          <MarqueeSlider
            items={homePosts}
            speed={30}
            renderItem={(item: any, _idx: number) => {
              const isVideo = item.contentType === "video";
              const targetUrl = isVideo
                ? `/video/${item.slug}`
                : `/blog/${item.slug}`;
              const author = item.author || {};

              return (
                <div
                  onClick={() => navigate(targetUrl)}
                  className="flex-shrink-0 relative group cursor-pointer"
                  style={{ width: "clamp(200px, 48vw, 220px)" }}
                >
                  <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1">
                    <div
                      className="relative overflow-hidden bg-slate-900"
                      style={{ height: "clamp(170px, 40vw, 190px)" }}
                    >
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
                          <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                            <Play size={18} className="fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-[#F28C28]" />{" "}
                          {new Date(item.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen size={11} className="text-[#F28C28]" />{" "}
                          {item.views}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-10 group-hover:text-[#F28C28] transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/60">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={author.photo || author.avatar || item.coverImage}
                            alt={author.name || "Author"}
                            className="w-6 h-6 rounded-full object-cover border border-[#F28C28] shrink-0"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 240 160' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='240' height='160' fill='%23f1f5f9'/%3E%3Cg transform='translate(108 68)' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/g%3E%3C/svg%3E";
                            }} loading="lazy" decoding="async" />
                          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate">
                            {author.name || "Tirvona Editorial"}
                          </span>
                        </div>
                        <span
                          aria-label={isVideo ? "Watch video" : "Read article"}
                          className="w-7 h-7 bg-[#F0F5FC] dark:bg-blue-950/40 text-gray-700 dark:text-amber-300 group-hover:bg-[#F28C28] group-hover:text-white rounded-full flex items-center justify-center transition-colors shrink-0"
                        >
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </section>

      {customerFeedbacks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8 space-y-8">
          <SectionHeader
            eyebrow="From fellow pilgrims"
            title="Sacred Experiences"
            subtitle={"Real reviews and experiences shared by pilgrims who booked their stays through Tirvona."}
          />

          <div className="pt-2 pb-6">
            <MarqueeSlider
              items={customerFeedbacks}
              speed={30}
              renderItem={(fb: any, _idx: number) => (
                <div
                  className="flex-shrink-0 relative group cursor-pointer"
                  style={{ width: "clamp(200px, 48vw, 220px)" }}
                >
                  <div className="w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1 h-[300px] relative">
                    {fb.img ? (
                      <img
                        src={fb.img}
                        alt={fb.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                    <div className="absolute inset-0 p-4 flex flex-col justify-between text-white z-10">
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

                      <div className="space-y-3">
                        <p className="text-[11px] text-gray-100 font-medium leading-relaxed italic line-clamp-3 min-h-[3.4rem] drop-shadow-xs">
                          "{fb.comment}"
                        </p>

                        <div className="pt-2.5 border-t border-white/20 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-white leading-none flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{fb.reviewer}</span>
                              {fb.verifiedStay && (
                                <span
                                  title="Verified stay"
                                  aria-label="Verified stay"
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 shrink-0"
                                >
                                  <CheckCircle size={9} />
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
