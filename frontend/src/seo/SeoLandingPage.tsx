import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Calendar,
  Users,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  Car,
  UtensilsCrossed,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  PhoneCall,
  BedDouble,
  SlidersHorizontal,
} from "lucide-react";
import { useCanonicalUrl } from "../lib/useCanonicalUrl";
import { ashramService } from "../services";
import { ashramUrl, ashramBookUrl } from "../lib/urls";
import { checkAshramBookingAvailable } from "../utils/ashramAvailabilityHelper";
import {
  useBookingSearch,
  getTodayYMD,
  getTomorrowYMD,
} from "../contexts/BookingSearchContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { formatCurrency } from "../utils/format";
import {
  trackSearchStay,
  trackViewSearchResults,
  trackClickBookNow,
} from "../lib/analytics";
import type { SeoLandingConfig } from "./seoLandingConfigs";
import { TEMPLE_COORDS } from "./seoLandingConfigs";
import { VRINDAVAN_DUMMY_STAYS } from "../data/vrindavanStaysData";

interface SeoLandingPageProps {
  config: SeoLandingConfig;
}

// Haversine distance calculator
function calculateDistanceKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): number | null {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    isNaN(lat1) ||
    isNaN(lng1) ||
    isNaN(lat2) ||
    isNaN(lng2) ||
    (lat1 === 0 && lng1 === 0)
  ) {
    return null;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatProximity(
  distKm: number | null,
  templeName: string = "Temple",
): string {
  if (distKm == null) return `Near ${templeName}`;
  if (distKm < 1) {
    const metres = Math.round(distKm * 1000);
    return `${metres} m from ${templeName}`;
  }
  return `${distKm.toFixed(1)} km from ${templeName}`;
}

function extractCoords(ashram: any): { lat: number; lng: number } | null {
  const c =
    ashram.location?.coordinates?.coordinates ||
    ashram.location?.coordinates ||
    ashram.address?.coordinates?.coordinates ||
    ashram.address?.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) return { lat, lng };
  }
  const lat = Number(
    ashram.latitude ||
      ashram.address?.latitude ||
      ashram.location?.latitude ||
      ashram.lat,
  );
  const lng = Number(
    ashram.longitude ||
      ashram.address?.longitude ||
      ashram.location?.longitude ||
      ashram.lng,
  );
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { lat, lng };
  }
  return null;
}

export const SeoLandingPage: React.FC<SeoLandingPageProps> = ({ config }) => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { searchState, updateBookingSearch } = useBookingSearch();

  // Search Bar State
  const [checkIn, setCheckIn] = useState<string>(
    searchState.checkIn || getTodayYMD(),
  );
  const [checkOut, setCheckOut] = useState<string>(
    searchState.checkOut || getTomorrowYMD(searchState.checkIn || getTodayYMD()),
  );
  const [guests, setGuests] = useState<number>(searchState.adults || 2);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const lastTrackedConfigRef = useRef<string>("");

  // Filter States
  const [activeFilterTab, setActiveFilterTab] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [amenityFilter, setAmenityFilter] = useState<string>("all");
  const [distanceFilter, setDistanceFilter] = useState<string>("all");

  // Dynamic Inventory State
  const [stays, setStays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FAQ Accordion State
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({
    0: true,
  });

  const toggleFaq = (idx: number) => {
    setOpenFaqs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Canonical & Title Hook
  useCanonicalUrl({
    canonicalPath: config.route,
    title: config.title,
    description: config.metaDescription,
    replaceUrl: false,
  });

  // Load Dynamic Live Inventory from Database
  useEffect(() => {
    let isMounted = true;
    const fetchInventory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real stays from Vrindavan
        let list: any[] = [];
        try {
          const res = await ashramService.search({ city: "Vrindavan" });
          list = res.data?.data || res.data || [];
        } catch (apiErr) {
          console.warn("ashramService search fallback:", apiErr);
        }

        if (!Array.isArray(list) || list.length === 0) {
          list = VRINDAVAN_DUMMY_STAYS;
        } else {
          // Ensure the 5 card stays are included so guests can always see them
          const existingNames = new Set(list.map((i: any) => (i.name || "").toLowerCase().trim()));
          for (const dummy of VRINDAVAN_DUMMY_STAYS) {
            if (!existingNames.has(dummy.name.toLowerCase().trim())) {
              list.unshift(dummy);
            }
          }
        }

        if (!isMounted) return;

        // Reference coords for distance calculations
        const refCoords =
          config.targetTemple?.coords || TEMPLE_COORDS.PREM_MANDIR;
        const refName = config.targetTemple?.name
          ? config.targetTemple.name.replace(/Temple Vrindavan|Vrindavan/gi, "").trim()
          : "Vrindavan Temples";

        const processed = list.map((item) => {
          const coords = extractCoords(item);
          const dist = coords
            ? calculateDistanceKm(
                coords.lat,
                coords.lng,
                refCoords.lat,
                refCoords.lng,
              )
            : null;

          const rawPrice =
            Number(item.lowestNightPrice) ||
            Number(item.pricing?.lowestNightPrice) ||
            0;

          const isHotel =
            item.ashramType === "hotel" ||
            item.type === "hotel" ||
            /hotel/i.test(item.name || "");

          const isHomestay =
            item.ashramType === "homestay" ||
            item.type === "homestay" ||
            /homestay|guest/i.test(item.name || "");

          const isDharamshala =
            item.ashramType === "dharamshala" ||
            item.type === "dharamshala" ||
            /dharamshala|ashram|bhawan/i.test(item.name || "");

          const hasParking = Boolean(
            item.transport?.parkingAvailable ||
              item.discovery?.parking?.available,
          );

          const hasAc = Boolean(
            item.discovery?.rooms?.hasAc ||
              (item.amenities || []).some((a: string) => /ac|air/i.test(a)),
          );

          const hasAttachedBath = (item.amenities || []).some((a: string) =>
            /bath|attached/i.test(a),
          );

          return {
            ...item,
            calculatedPrice: rawPrice,
            computedDistanceKm: dist,
            displayDistance: formatProximity(dist, refName),
            isHotel,
            isHomestay,
            isDharamshala,
            hasParking,
            hasAc,
            hasAttachedBath,
          };
        });

        // Filter only approved/active properties
        const approved = processed.filter(
          (p) => !p.status || p.status === "approved",
        );

        setStays(approved);

        if (lastTrackedConfigRef.current !== config.id) {
          lastTrackedConfigRef.current = config.id;
          trackViewSearchResults({
            destination: config.h1,
            check_in: checkIn,
            check_out: checkOut,
            guests,
            results_count: approved.length,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Failed to load dynamic stays:", err);
          setError("Unable to load latest inventory. Please refresh.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInventory();
    return () => {
      isMounted = false;
    };
  }, [config.id]);

  // Click outside guest picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        guestPickerRef.current &&
        !guestPickerRef.current.contains(e.target as Node)
      ) {
        setShowGuestPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBookingSearch({
      checkIn,
      checkOut,
      adults: guests,
    });
    trackSearchStay({
      destination: "Vrindavan",
      check_in: checkIn,
      check_out: checkOut,
      guests,
    });
    const el = document.getElementById("stays-listing-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const getStayQuery = () => {
    const parts: string[] = [];
    if (checkIn) parts.push(`checkIn=${encodeURIComponent(checkIn)}`);
    if (checkOut) parts.push(`checkOut=${encodeURIComponent(checkOut)}`);
    if (guests) parts.push(`adults=${encodeURIComponent(guests)}`);
    parts.push(`rooms=1`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  };

  const getDetailsUrl = (stay: any) => ashramUrl(stay, getStayQuery());
  const getBookUrl = (stay: any) => ashramBookUrl(stay, getStayQuery());

  const handleNavigateDetails = (stay: any) => {
    navigate(getDetailsUrl(stay));
  };

  const handleNavigateBooking = (stay: any, e: React.MouseEvent) => {
    e.stopPropagation();
    trackClickBookNow({
      property_id: String(stay._id || ""),
      property_name: stay.name,
    });
    navigate(getBookUrl(stay));
  };

  // Main filtered listing
  const filteredStays = useMemo(() => {
    return stays.filter((stay) => {
      // Filter tab
      if (activeFilterTab === "hotel" && !stay.isHotel) return false;
      if (activeFilterTab === "dharamshala" && !stay.isDharamshala) return false;
      if (activeFilterTab === "homestay" && !stay.isHomestay) return false;
      if (activeFilterTab === "parking" && !stay.hasParking) return false;

      // Price Filter
      const price = stay.calculatedPrice;
      if (priceFilter === "under-1000" && (price <= 0 || price > 1000))
        return false;
      if (priceFilter === "1000-2000" && (price < 1000 || price > 2000))
        return false;
      if (priceFilter === "2000-plus" && price < 2000) return false;

      // Distance Filter
      if (distanceFilter !== "all" && stay.computedDistanceKm != null) {
        if (distanceFilter === "under-1km" && stay.computedDistanceKm > 1.0)
          return false;
        if (distanceFilter === "1km-2km" && (stay.computedDistanceKm <= 1.0 || stay.computedDistanceKm > 2.0))
          return false;
        if (distanceFilter === "under-2km" && stay.computedDistanceKm > 2.0)
          return false;
      }

      // Amenity Filter
      if (amenityFilter === "ac" && !stay.hasAc) return false;
      if (amenityFilter === "parking" && !stay.hasParking) return false;
      if (amenityFilter === "bath" && !stay.hasAttachedBath) return false;

      return true;
    });
  }, [stays, activeFilterTab, priceFilter, distanceFilter, amenityFilter]);

  // Section Subsets matching required H2s
  const hotelSubset = useMemo(() => {
    return stays.filter((s) => s.isHotel).slice(0, 6);
  }, [stays]);

  const budgetSubset = useMemo(() => {
    return stays
      .filter((s) => s.calculatedPrice > 0 && s.calculatedPrice <= 1000)
      .slice(0, 6);
  }, [stays]);

  const familySubset = useMemo(() => {
    return stays
      .filter((s) => s.hasAc || s.hasAttachedBath || s.isHomestay || s.calculatedPrice >= 800)
      .slice(0, 6);
  }, [stays]);

  const parkingSubset = useMemo(() => {
    return stays.filter((s) => s.hasParking).slice(0, 6);
  }, [stays]);

  // JSON-LD Structured Data
  const jsonLd = useMemo(() => {
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.tirvona.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Vrindavan Stays",
          item: "https://www.tirvona.com/ashrams/vrindavan",
        },
        ...(config.id !== "vrindavan"
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: config.h1,
                item: config.canonicalUrl,
              },
            ]
          : []),
      ],
    };

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: config.h1,
      description: config.metaDescription,
      numberOfItems: stays.length,
      itemListElement: stays.slice(0, 10).map((stay, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "LodgingBusiness",
          name: stay.name,
          url: `https://www.tirvona.com${ashramUrl(stay)}`,
          image: Array.isArray(stay.images) ? stay.images[0] : stay.coverImage,
          priceRange: stay.calculatedPrice ? `₹${stay.calculatedPrice}` : "₹₹",
          address: {
            "@type": "PostalAddress",
            streetAddress: stay.address?.street || "Vrindavan",
            addressLocality: "Vrindavan",
            addressRegion: "Uttar Pradesh",
            postalCode: "281121",
            addressCountry: "IN",
          },
        },
      })),
    };

    const faqSchema =
      config.faqs.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: config.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: f.a,
              },
            })),
          }
        : null;

    return { breadcrumbSchema, itemListSchema, faqSchema };
  }, [config, stays]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#070D18] text-slate-800 dark:text-slate-100 font-sans selection:bg-[#F28C28] selection:text-white transition-colors duration-200">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd.breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd.itemListSchema),
        }}
      />
      {jsonLd.faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd.faqSchema),
          }}
        />
      )}

      {/* ── BREADCRUMBS ────────────────────────────────────────────── */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        <ol className="flex items-center flex-wrap gap-1.5">
          <li>
            <Link
              to="/"
              className="hover:text-[#F28C28] dark:hover:text-[#E58C28] transition-colors"
            >
              Home
            </Link>
          </li>
          <li>
            <ChevronRight size={12} className="text-slate-400" />
          </li>
          {config.id === "vrindavan" ? (
            <li className="text-slate-900 dark:text-white font-bold" aria-current="page">
              Vrindavan Stays
            </li>
          ) : (
            <>
              <li>
                <Link
                  to="/ashrams/vrindavan"
                  className="hover:text-[#F28C28] dark:hover:text-[#E58C28] transition-colors"
                >
                  Vrindavan Stays
                </Link>
              </li>
              <li>
                <ChevronRight size={12} className="text-slate-400" />
              </li>
              <li className="text-slate-900 dark:text-white font-bold truncate max-w-xs sm:max-w-md" aria-current="page">
                {config.h1}
              </li>
            </>
          )}
        </ol>
      </nav>

      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-6 space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F28C28]/10 dark:bg-[#F28C28]/25 border border-[#F28C28]/20 text-[#F28C28] dark:text-amber-300 text-[11px] font-black uppercase tracking-wider">
            <Sparkles size={12} className="text-[#E58C28]" />
            <span>Tirvona Verified Stays</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {config.h1}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed font-normal">
            {config.heroCopy}
          </p>
        </div>

        {/* ── SEARCH BAR CONTAINER ─────────────────────────────────── */}
        <div className="bg-white dark:bg-[#0B192C] rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 p-2 sm:p-3">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center"
          >
            {/* Check-in */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
              <Calendar size={18} className="text-[#F28C28] shrink-0" />
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Check-in Date
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={getTodayYMD()}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (e.target.value >= checkOut) {
                      setCheckOut(getTomorrowYMD(e.target.value));
                    }
                  }}
                  className="text-xs font-black text-slate-900 dark:text-white bg-transparent focus:outline-none w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Check-out */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
              <Calendar size={18} className="text-[#F28C28] shrink-0" />
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Check-out Date
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={getTomorrowYMD(checkIn)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="text-xs font-black text-slate-900 dark:text-white bg-transparent focus:outline-none w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Guests */}
            <div
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3 relative"
              ref={guestPickerRef}
            >
              <Users size={18} className="text-[#F28C28] shrink-0" />
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Pilgrim Guests
                </label>
                <button
                  type="button"
                  onClick={() => setShowGuestPicker(!showGuestPicker)}
                  className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between w-full cursor-pointer"
                >
                  <span>{guests} Guests, 1 Room</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </div>

              {showGuestPicker && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 z-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        Total Guests
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Adults & Children
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={guests <= 1}
                        onClick={() => setGuests((g) => Math.max(1, g - 1))}
                        className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold w-4 text-center">
                        {guests}
                      </span>
                      <button
                        type="button"
                        disabled={guests >= 15}
                        onClick={() => setGuests((g) => Math.min(15, g + 1))}
                        className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA Search Button */}
            <div>
              <button
                type="submit"
                className="w-full h-12 bg-[#E58C28] hover:bg-[#cf7b1e] active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Search size={16} />
                <span>Search Stays</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── QUICK FILTER CHIPS ───────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-slate-400 font-bold flex items-center gap-1 shrink-0 pr-1">
            <SlidersHorizontal size={13} /> Filters:
          </span>

          {[
            { id: "all", label: "All Stays" },
            { id: "hotel", label: "Hotels" },
            { id: "dharamshala", label: "Dharamshalas & Ashrams" },
            { id: "homestay", label: "Guest Houses" },
            { id: "parking", label: "With Parking" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilterTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeFilterTab === tab.id
                  ? "bg-[#F28C28] text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#F28C28]/40"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Quick Price Filter */}
          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
          >
            <option value="all">Any Price</option>
            <option value="under-1000">Under ₹1000</option>
            <option value="1000-2000">₹1000 – ₹2000</option>
            <option value="2000-plus">₹2000+</option>
          </select>

          {/* Quick Amenity Filter */}
          <select
            value={amenityFilter}
            onChange={(e) => setAmenityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
          >
            <option value="all">Any Amenity</option>
            <option value="ac">AC Rooms</option>
            <option value="parking">Parking Included</option>
            <option value="bath">Attached Bath</option>
          </select>
        </div>
      </header>

      {/* ── MAIN CONTENT BODY ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-12">
        {/* ── MAIN INVENTORY SECTION ───────────────────────────────── */}
        <section id="stays-listing-section" className="space-y-4 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {config.h2Sections[0]?.title || config.h1}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {config.listingCopy}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-[#F28C28]/10 text-[#F28C28] dark:bg-[#E58C28]/15 dark:text-[#E58C28] px-3 py-1 rounded-full whitespace-nowrap">
                {filteredStays.length} Available Stays
              </span>
            </div>
          </div>

          {/* Property Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-white dark:bg-[#0B192C] border border-red-200 dark:border-red-900/40 rounded-2xl p-6 space-y-3">
              <p className="text-xs text-red-600 dark:text-red-400 font-bold">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 rounded-full bg-[#F28C28] text-white text-xs font-bold"
              >
                Reload Page
              </button>
            </div>
          ) : filteredStays.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 p-6">
              <Building2 size={36} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No stays match your active filter selection.
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try resetting your filters or exploring all available Vrindavan
                stays across our verified partner network.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveFilterTab("all");
                  setPriceFilter("all");
                  setAmenityFilter("all");
                  setDistanceFilter("all");
                }}
                className="px-5 py-2 rounded-full bg-[#F28C28] text-white text-xs font-bold hover:bg-[#D97706] transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStays.map((stay) => {
                const isAvailable = checkAshramBookingAvailable(stay);
                const price = stay.calculatedPrice;
                const primaryImage =
                  (Array.isArray(stay.images) && stay.images[0]) ||
                  stay.coverImage ||
                  stay.thumbnail ||
                  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80";

                const addressText =
                  stay.address?.street || stay.address?.area || "Vrindavan";

                return (
                  <article
                    key={stay._id || stay.slug}
                    onClick={() => handleNavigateDetails(stay)}
                    className="bg-white dark:bg-[#0B192C] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      {/* Image Header with Price & Badge */}
                      <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <img
                          src={primaryImage}
                          alt={stay.name}
                          loading="lazy"
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                            !isAvailable ? "grayscale-[20%]" : ""
                          }`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                        {!isAvailable && (
                          <div className="absolute top-3 left-3 bg-rose-600 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md z-10">
                            Not Available
                          </div>
                        )}

                        {/* Top-Right Badge: Legitimate Tirvona Trusted */}
                        {stay.isVerified && (
                          <div className="absolute top-3 right-3 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1 shadow-sm">
                            <ShieldCheck size={12} className="text-emerald-600" />
                            <span>Tirvona Trusted</span>
                          </div>
                        )}

                        {/* Bottom-Left Pill: Price */}
                        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-black shadow-md border border-white/10 flex items-center gap-1">
                          <span className="text-[10px] font-normal text-slate-300">
                            From
                          </span>
                          <span className="text-amber-300">
                            {price > 0
                              ? formatCurrency(price, currency)
                              : "₹450"}
                          </span>
                          <span className="text-[9px] font-normal text-slate-400">
                            /night
                          </span>
                        </div>
                      </div>

                      {/* Card Content Details */}
                      <div className="p-5 space-y-3">
                        {/* Title & Proximity */}
                        <div>
                          <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-snug group-hover:text-[#F28C28] dark:group-hover:text-[#E58C28] transition-colors line-clamp-1">
                            {stay.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <MapPin
                              size={13}
                              className="text-[#E58C28] shrink-0"
                            />
                            <span className="truncate">{stay.displayDistance}</span>
                            <span className="text-slate-300 dark:text-slate-600">
                              •
                            </span>
                            <span className="truncate text-slate-400">
                              {addressText}
                            </span>
                          </div>
                        </div>

                        {/* Key Amenities */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {stay.hasAc && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FFF4E5]/40 text-[#F28C28] dark:text-amber-300 text-[10px] font-bold">
                              AC
                            </span>
                          )}
                          {stay.hasParking && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                              <Car size={10} /> Parking
                            </span>
                          )}
                          {stay.hasAttachedBath && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                              Attached Bath
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            Pure Satvik
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="p-4 pt-0 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateDetails(stay);
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-colors cursor-pointer text-center"
                      >
                        View Stay
                      </button>
                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={(e) => {
                          if (isAvailable) handleNavigateBooking(stay, e);
                        }}
                        className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-colors text-center shadow-xs ${
                          !isAvailable
                            ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            : "bg-[#F28C28] hover:bg-[#D97706] text-white cursor-pointer"
                        }`}
                      >
                        {isAvailable ? "Book Now" : "Not Available"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── REQUIRED H2 SUPPORTING ACCOMMODATION SECTIONS ────────────── */}
        {config.h2Sections
          .filter(
            (sec) =>
              sec.id !== "stays-in-vrindavan" &&
              sec.id !== "stays-near-banke-bihari-temple" &&
              sec.id !== "stays-near-prem-mandir" &&
              sec.id !== "stays-near-iskcon-vrindavan" &&
              sec.id !== "budget-stays-in-vrindavan" &&
              sec.id !== "family-stays-in-vrindavan" &&
              sec.id !== "why-book-with-tirvona",
          )
          .map((sec) => {
            // Determine relevant stays for this specific H2 section
            let sectionStays: any[] = [];
            if (sec.filterKey === "hotel") sectionStays = hotelSubset;
            else if (sec.filterKey === "budget") sectionStays = budgetSubset;
            else if (sec.filterKey === "under_1000") sectionStays = budgetSubset;
            else if (sec.filterKey === "family") sectionStays = familySubset;
            else if (sec.filterKey === "parking") sectionStays = parkingSubset;
            else sectionStays = stays.slice(0, 3);

            return (
              <section
                key={sec.id}
                id={sec.id}
                className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-slate-800"
              >
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {sec.title}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                    {sec.subtitle}
                  </p>
                </div>

                {sectionStays.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {sectionStays.slice(0, 3).map((item) => (
                      <div
                        key={`sec-${sec.id}-${item._id || item.slug}`}
                        onClick={() => handleNavigateDetails(item)}
                        className="bg-white dark:bg-[#0B192C] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-3.5 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <img
                          src={
                            (Array.isArray(item.images) && item.images[0]) ||
                            item.coverImage ||
                            "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80"
                          }
                          alt={item.name}
                          className="w-16 h-16 rounded-lg object-cover group-hover:scale-105 transition-transform shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#F28C28] transition-colors">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.displayDistance}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-black text-[#E58C28]">
                              {item.calculatedPrice > 0
                                ? formatCurrency(
                                    item.calculatedPrice,
                                    currency,
                                  )
                                : "₹450"}
                              <span className="text-[9px] text-slate-400 font-normal">
                                /night
                              </span>
                            </span>
                            <span className="text-[10px] font-bold text-[#F28C28] dark:text-amber-400 flex items-center gap-0.5">
                              View <ChevronRight size={10} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {/* ── SECTION: WHY BOOK YOUR STAY WITH TIRVONA? ──────────────── */}
        <section className="bg-white dark:bg-[#0B192C] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#E58C28]">
              Verified Pilgrim Hospitality
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Why Book Your Stay with Tirvona?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              {config.whyBookCopy}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFF4E5]/50 text-[#F28C28] flex items-center justify-center font-black text-xs">
                <CheckCircle2 size={18} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                100% In-Person Verified
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tirvona verification officers inspect rooms, water, safety, and
                cleanliness before listing.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-[#E58C28] flex items-center justify-center font-black text-xs">
                <Clock size={18} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                Temple Proximity Ease
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Walk or take rapid e-rickshaws to morning Mangala Aarti and
                evening Sandhya Aarti without traffic delays.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-black text-xs">
                <ShieldCheck size={18} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                Zero Hidden Charges
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Transparent room tariffs with clear booking guarantees and
                direct instant confirmation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-black text-xs">
                <UtensilsCrossed size={18} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                Satvik Food & Hospitality
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Clean pilgrim atmospheres catering to elderly parents, families,
                and spiritual travelers.
              </p>
            </div>
          </div>
        </section>

        {/* ── TARGET TEMPLE GUIDE (WHERE APPLICABLE) ────────────────── */}
        {config.targetTemple && (
          <section className="bg-white dark:bg-[#0B192C] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 rounded-xl overflow-hidden h-52 relative">
              <img
                src={config.targetTemple.image}
                alt={config.targetTemple.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-white">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-300 block">
                  Sacred Vrindavan Shrine
                </span>
                <h3 className="text-base font-black">
                  {config.targetTemple.name}
                </h3>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3 text-xs">
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <MapPin size={15} className="text-[#E58C28] shrink-0 mt-0.5" />
                <span>{config.targetTemple.address}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Darshan Timings
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  {config.targetTemple.darshanTimings}
                </p>
              </div>

              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Devotees visiting {config.targetTemple.name} are advised to
                select nearby accommodations to comfortably attend Aarti ceremonies
                and avoid peak afternoon queue crowds.
              </p>
            </div>
          </section>
        )}

        {/* ── APPROVED FAQS ────────────────────────────────────────── */}
        {config.faqs.length > 0 && (
          <section className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#E58C28]">
                Help & Answers
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.faqs.map((faq, idx) => {
                const isOpen = Boolean(openFaqs[idx]);
                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[#0B192C] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 text-left flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {faq.q}
                      </span>
                      <ChevronDown
                        size={15}
                        className={`text-[#E58C28] shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                        <p className="pt-2.5">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── INTERNAL LINKING MESH ────────────────────────────────── */}
        <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#E58C28]">
              Explore Sacred Braj
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Explore More Stays in Vrindavan
            </h2>
            <p className="text-xs text-slate-500">
              Discover accommodations across all key spiritual landmarks in
              Vrindavan
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {config.internalLinks.map((link, idx) => (
              <Link
                key={idx}
                to={link.to}
                className="group bg-white dark:bg-[#0B192C] border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-32 overflow-hidden bg-slate-900">
                    <img
                      src={link.image}
                      alt={link.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
                    <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/10">
                      {link.tag}
                    </span>
                  </div>
                  <div className="p-4 space-y-1">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-[#F28C28] dark:group-hover:text-[#E58C28] transition-colors line-clamp-1">
                      {link.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {link.description}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-3 pt-0 flex items-center gap-1 text-xs font-black text-[#F28C28] dark:text-[#E58C28]">
                  <span>Explore Stays</span>
                  <ArrowRight
                    size={12}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FINAL BOTTOM CTA ─────────────────────────────────────── */}
        <section className="relative rounded-3xl overflow-hidden text-white shadow-xl bg-gradient-to-r from-[#0B192C] via-[#F28C28] to-[#0B192C] p-8 sm:p-12">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-amber-300 border border-white/10">
              <Sparkles size={11} /> Instant Pilgrimage Confirmation
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Ready to Book Your Stay in <br />
              <span className="text-[#E58C28]">Vrindavan with Tirvona?</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
              Compare verified ashrams, dharamshalas, and hotels by distance,
              amenities, and real pricing. Instant confirmed reservations.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("stays-listing-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-3 bg-[#E58C28] hover:bg-[#cf7b1e] active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <span>View Available Stays</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SeoLandingPage;
