import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Star,
  ArrowRight,
  Sparkles,
  CircleParking,
  Bed,
  ShoppingBag,
  Compass,
  ChevronRight,
  Navigation,
  Home,
  ShieldCheck,
} from "lucide-react";
import { useDestinationData } from "../hooks/useDestinationData";
import {
  haversineDistance,
  extractCoordinates,
  hasValidCoordinates,
} from "../utils/geo";
import { formatCurrency } from "../utils/format";
import { toTitleCase } from "../utils/textCase";
import { ashramUrl } from "../lib/urls";
import { TirvonaMapView, type MapMarker } from "../components/TirvonaMapView";
import type { NearbyPlace } from "../data/destinationData";
import { MarqueeSlider } from "../components/shared/MarqueeSlider";
import "./DestinationOverviewPage.css";

// ─── Animation presets ───────────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45 },
};

// ─── Section heading component ───────────────────────────────────────────────
const SectionHeading: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
}> = ({ title, subtitle, className = "" }) => (
  <div className={`text-center space-y-2 max-w-3xl mx-auto py-2 ${className}`}>
    <p className="dest-section-title text-base sm:text-4xl font-bold">
      {title}
    </p>
    <div className="flex items-center justify-center gap-2.5 my-1.5">
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
      <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
    </div>
    {subtitle && (
      <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
        {subtitle}
      </p>
    )}
  </div>
);

// ─── Tab definitions ─────────────────────────────────────────────────────────
type InventoryTab = "ashrams" | "stays" | "parking" | "prasad";
type StayFilter = "all" | "ashram" | "dharamshala" | "homestay";

const tabConfig: { key: InventoryTab; label: string; icon: React.ElementType }[] = [
  { key: "ashrams", label: "Ashrams", icon: Home },
  { key: "stays", label: "Stays & Rooms", icon: Bed },
  { key: "parking", label: "Parking", icon: CircleParking },
  { key: "prasad", label: "Prasad & Puja", icon: ShoppingBag },
];

// ─── Stay / Ashram Card ──────────────────────────────────────────────────────
const StayCard: React.FC<{
  ashram: any;
  destinationCenter?: { lat: number; lng: number } | null;
}> = ({ ashram, destinationCenter }) => {
  const navigate = useNavigate();

  const img =
    (Array.isArray(ashram.images) &&
      ashram.images.find((x: any) => typeof x === "string" && x.trim())) ||
    ashram.coverImage ||
    ashram.thumbnail ||
    ashram.img ||
    "";

  const ratingVal =
    typeof ashram.rating === "number"
      ? ashram.rating
      : ashram.rating?.average || 0;

  const city = ashram.address?.city || "";
  const state = ashram.address?.state || "";
  const minPrice =
    ashram.lowestNightPrice ||
    ashram.pricing?.lowestNightPrice ||
    ashram.startingPrice ||
    ashram.minPrice ||
    0;

  const isVerified = Boolean(
    ashram.status === "approved" ||
      ashram.isVerified ||
      ashram.verified,
  );

  const coords = useMemo(() => extractCoordinates(ashram), [ashram]);

  const dist = useMemo(() => {
    if (!destinationCenter || !coords) return null;
    return haversineDistance(
      destinationCenter.lat,
      destinationCenter.lng,
      coords.lat,
      coords.lng,
    );
  }, [coords, destinationCenter]);

  const typeLabel =
    ashram.ashramType === "dharamshala"
      ? "Dharamshala"
      : ashram.ashramType === "homestay"
        ? "Guest House"
        : "Ashram";

  return (
    <div
      onClick={() => navigate(ashramUrl(ashram))}
      className="group cursor-pointer bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-all duration-300 hover:-translate-y-1 flex flex-col hover:shadow-lg"
      style={{ width: "clamp(260px, 42vw, 310px)" }}
    >
      {/* Image & Badges */}
      <div className="dest-card-img-wrap relative h-[180px] bg-gray-100 dark:bg-slate-900">
        {img ? (
          <img
            src={img}
            alt={ashram.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-700">
            <Bed size={36} />
          </div>
        )}
        <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-[#0B192C]/80 backdrop-blur-xs text-white text-[10px] font-extrabold tracking-wide">
          {typeLabel}
        </span>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-tight line-clamp-1 group-hover:text-[#0A4DA6] transition-colors">
          {ashram.name}
        </h4>
        <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
          <MapPin size={11} className="shrink-0 text-gray-400" />
          {[city, state].filter(Boolean).join(", ")}
        </p>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            {ratingVal > 0 ? (
              <span className="flex items-center gap-0.5 text-xs font-extrabold text-[#E58C28]">
                <Star size={12} className="fill-[#E58C28]" />
                {ratingVal.toFixed(1)}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs font-extrabold text-[#E58C28]">
                <Star size={12} className="fill-[#E58C28]" /> 4.8
              </span>
            )}
            {dist !== null && (
              <span className="text-[10px] text-gray-400 font-bold">
                {dist} km
              </span>
            )}
            {isVerified && (
              <span title="Verified Ashram">
                <ShieldCheck
                  size={14}
                  className="text-[#0A4DA6] dark:text-blue-400"
                />
              </span>
            )}
          </div>

          {minPrice > 0 ? (
            <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
              {formatCurrency(minPrice)}
              <span className="text-[10px] font-bold text-gray-400">
                {" "}
                /night
              </span>
            </span>
          ) : (
            <span className="text-[11px] font-extrabold text-[#0A4DA6] dark:text-blue-400">
              Donation / Stay
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(ashramUrl(ashram));
          }}
          className="mt-2 w-full py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs"
        >
          View Ashram
        </button>
      </div>
    </div>
  );
};

// ─── Parking Card ────────────────────────────────────────────────────────────
const ParkingCard: React.FC<{
  lot: any;
  selectedAshramCoords?: { lat: number; lng: number } | null;
}> = ({ lot, selectedAshramCoords }) => {
  const navigate = useNavigate();
  const name = lot.name || lot.locationName || "Tirvona Parking Facility";
  const slug = lot.slug || lot._id || "";
  const city = lot.address?.city || lot.city || "";
  const price =
    lot.hourlyRate ||
    lot.pricePerHour ||
    (Array.isArray(lot.rates) && lot.rates[0]?.amount) ||
    50;
  const available = lot.available !== false;

  const coords = useMemo(() => extractCoordinates(lot), [lot]);

  const dist = useMemo(() => {
    if (!selectedAshramCoords || !coords) return null;
    return haversineDistance(
      selectedAshramCoords.lat,
      selectedAshramCoords.lng,
      coords.lat,
      coords.lng,
    );
  }, [coords, selectedAshramCoords]);

  return (
    <div
      onClick={() =>
        navigate(
          lot.ashramId
            ? `/ashram/${lot.ashramId}`
            : slug
              ? `/parking/${slug}`
              : "/parking",
        )
      }
      className="group cursor-pointer bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-all duration-300 hover:-translate-y-1 flex flex-col p-5 hover:shadow-lg"
      style={{ width: "clamp(240px, 38vw, 280px)" }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-[rgba(10,77,166,0.1)] flex items-center justify-center shrink-0">
          <CircleParking size={20} className="text-[#0A4DA6]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white line-clamp-1 group-hover:text-[#0A4DA6] transition-colors">
            {name}
          </h4>
          {city && (
            <p className="text-[11px] text-gray-400 font-bold">{city}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {dist !== null && (
          <span className="text-[10px] text-gray-500 font-bold bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {dist} km away
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 mt-auto">
        <span
          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
            available
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-50 text-red-500"
          }`}
        >
          {available ? "Spaces Available" : "Full"}
        </span>
        <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
          {formatCurrency(price)}
          <span className="text-[10px] font-bold text-gray-400"> /hr</span>
        </span>
      </div>

      <button
        type="button"
        className="w-full py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs"
      >
        View Parking
      </button>
    </div>
  );
};

// ─── Prasad Card ─────────────────────────────────────────────────────────────
const PrasadCard: React.FC<{ product: any }> = ({ product }) => {
  const navigate = useNavigate();
  const img =
    (Array.isArray(product.images) && product.images[0]) ||
    product.coverImage ||
    "";
  const slug = product.slug || product._id || "";
  const price = product.salePrice || product.price || 0;
  const ratingVal =
    typeof product.rating === "number"
      ? product.rating
      : product.rating?.average || 4.9;

  return (
    <div
      onClick={() =>
        navigate(slug ? `/marketplace/products/${slug}` : "/marketplace")
      }
      className="group cursor-pointer bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 transition-all duration-300 hover:-translate-y-1 flex flex-col hover:shadow-lg"
      style={{ width: "clamp(220px, 36vw, 260px)" }}
    >
      <div className="dest-card-img-wrap relative h-[150px] bg-gray-100 dark:bg-slate-900">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-700">
            <ShoppingBag size={30} />
          </div>
        )}
        <span className="dest-badge dest-badge--tirvona absolute top-3 left-3 shadow-xs">
          <ShieldCheck size={10} /> Certified Prasad
        </span>
      </div>

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white line-clamp-1 group-hover:text-[#0A4DA6] transition-colors">
          {product.name}
        </h4>
        {product.templeSource && (
          <p className="text-[10px] text-gray-400 font-bold line-clamp-1">
            {product.templeSource}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50 dark:border-slate-800/60">
          <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
            {formatCurrency(price)}
          </span>
          <span className="flex items-center gap-0.5 text-xs font-extrabold text-[#E58C28]">
            <Star size={11} className="fill-[#E58C28]" />
            {ratingVal.toFixed(1)}
          </span>
        </div>

        <button
          type="button"
          className="mt-2 w-full py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs"
        >
          View Prasad
        </button>
      </div>
    </div>
  );
};

const getDynamicPlaceImage = (place: NearbyPlace): string => {
  const text = (place.name + " " + (place.category || "") + " " + (place.description || "")).toLowerCase();

  // Guard against mismatched seed URLs
  if (
    place.image &&
    !place.image.includes("1601050690597") &&
    !place.image.includes("1545205597") &&
    !place.image.includes("1546833999") &&
    place.image.trim().length > 0
  ) {
    return place.image;
  }

  if (text.includes("rudraksha") || text.includes("gemstone") || text.includes("mala") || text.includes("sphatik")) {
    return "/images/services/rudraksha_store.jpg";
  }
  if (text.includes("innova") || text.includes("cab") || text.includes("rental") || text.includes("taxi") || text.includes("transport")) {
    return "/images/services/innova_cab.jpg";
  }
  if (text.includes("gita") || text.includes("book") || text.includes("scripture") || text.includes("bhagavad")) {
    return "/images/services/bhagavad_gita.jpg";
  }
  if (text.includes("chotiwala") || text.includes("restaurant") || text.includes("bhojnalaya") || text.includes("thali") || text.includes("satvik")) {
    return "/images/services/satvik_thali.jpg";
  }
  if (text.includes("ghat")) {
    return "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80&auto=format&fit=crop";
  }
  if (text.includes("kund") || text.includes("sarovar") || text.includes("ganga") || text.includes("pokhar") || text.includes("lake") || text.includes("pond")) {
    return "https://images.unsplash.com/photo-1588096344356-9b0f80f3cab5?w=800&q=80&auto=format&fit=crop";
  }
  if (text.includes("grove") || text.includes("van") || text.includes("hill") || text.includes("parvat") || text.includes("park") || text.includes("nature")) {
    return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80&auto=format&fit=crop";
  }
  if (text.includes("museum") || text.includes("heritage") || text.includes("mahal") || text.includes("fort")) {
    return "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80&auto=format&fit=crop";
  }
  if (text.includes("ashram") || text.includes("niketan")) {
    return "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80&auto=format&fit=crop";
  }
  return "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=800&q=80&auto=format&fit=crop";
};

// ─── Attraction / Discovery Card ─────────────────────────────────────────────
const AttractionCard: React.FC<{
  place: NearbyPlace;
  distanceKm?: number | null;
  onSelectPlace?: (place: NearbyPlace) => void;
}> = ({ place, distanceKm, onSelectPlace }) => {
  const [imgSrc, setImgSrc] = useState(() => getDynamicPlaceImage(place));

  React.useEffect(() => {
    setImgSrc(getDynamicPlaceImage(place));
  }, [place]);

  const handleClick = () => {
    if (onSelectPlace) {
      onSelectPlace(place);
    } else {
      const mapEl = document.getElementById("dest-map");
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (place.externalUrl) {
        window.open(place.externalUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
      style={{ width: "clamp(240px, 40vw, 290px)" }}
    >
      <div className="dest-card-img-wrap relative bg-gray-100 dark:bg-slate-900 flex items-center justify-center h-[160px]">
        <img
          src={imgSrc}
          alt={place.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => {
            setImgSrc(
              "https://images.unsplash.com/photo-1627894483216-2138af692e32?w=800&q=80&auto=format&fit=crop",
            );
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 flex-1 p-4">
        <h4 className="font-extrabold leading-tight line-clamp-1 text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] transition-colors text-sm">
          {place.name}
        </h4>
        <p className="text-[10px] text-[#E58C28] font-bold">{place.category}</p>

        {place.description && (
          <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed">
            {place.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50 dark:border-slate-800/60">
          {distanceKm != null ? (
            <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
              <Navigation size={10} className="text-[#0A4DA6]" />
              {distanceKm} km from stay
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 font-bold">
              Destination Landmark
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="mt-1.5 w-full py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer bg-[#0A4DA6] hover:bg-[#083b80] text-white shadow-xs flex items-center justify-center gap-1.5"
        >
          <MapPin size={12} /> Visit on Map
        </button>
      </div>
    </div>
  );
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const SkeletonCards: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="dest-scroll-row">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="skeleton dest-skeleton-card"
        style={{ width: "clamp(260px, 42vw, 310px)" }}
      />
    ))}
  </div>
);

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyCategory: React.FC<{
  category: string;
  destinationName: string;
}> = ({ category, destinationName }) => (
  <div className="text-center py-12 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3">
    <Sparkles size={28} className="mx-auto text-gray-300 dark:text-slate-700" />
    <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
      No {category} currently listed on Tirvona
    </h4>
    <p className="text-xs text-gray-400 font-medium max-w-sm mx-auto">
      We are actively adding new verified {category.toLowerCase()} in{" "}
      {destinationName}. Discover other sacred experiences below.
    </p>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DYNAMIC DESTINATION OVERVIEW PAGE
// ═════════════════════════════════════════════════════════════════════════════

const DestinationOverviewPage: React.FC = () => {
  const { slug = "", city = "" } = useParams<{ slug?: string; city?: string }>();
  const resolvedSlug = slug || city;
  const navigate = useNavigate();

  const {
    destination,
    ashrams,
    parking,
    prasad,
    attractions,
    loading,
    error: _error,
    liveStats,
  } = useDestinationData(resolvedSlug);

  const [activeTab, setActiveTab] = useState<InventoryTab>("ashrams");
  const [stayFilter, setStayFilter] = useState<StayFilter>("all");
  const [selectedAshramIdx, setSelectedAshramIdx] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [activeCoords, setActiveCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleSelectPlaceOnMap = useCallback((place: NearbyPlace) => {
    setActivePlaceId(place.id);
    if (place.coordinates && hasValidCoordinates(place.coordinates.lat, place.coordinates.lng)) {
      setActiveCoords({ lat: place.coordinates.lat, lng: place.coordinates.lng });
    }
    const mapEl = document.getElementById("dest-map");
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Selected Ashram for relative distance calculation
  const selectedAshram = ashrams[selectedAshramIdx] || ashrams[0] || null;

  const selectedAshramCoords = useMemo(() => {
    if (!selectedAshram) return destination?.coordinates || null;
    return extractCoordinates(selectedAshram) || destination?.coordinates || null;
  }, [selectedAshram, destination]);

  // Dynamically calculate distance from selected ashram to all attractions and sort ascending (shortest distance first)
  const nearbyWithDistance = useMemo(() => {
    const list = attractions.map((place) => {
      let dist: number | null = null;
      if (
        selectedAshramCoords &&
        place.coordinates &&
        hasValidCoordinates(place.coordinates.lat, place.coordinates.lng)
      ) {
        dist = haversineDistance(
          selectedAshramCoords.lat,
          selectedAshramCoords.lng,
          place.coordinates.lat,
          place.coordinates.lng,
        );
      }
      return { ...place, distanceKm: dist };
    });

    // Ascending sort: closest landmarks (shortest distance) appear first
    return [...list].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [attractions, selectedAshramCoords]);

  // Filter ashrams/stays by sub-filter
  const filteredAshrams = useMemo(() => {
    if (stayFilter === "all") return ashrams;
    return ashrams.filter((a) => {
      const type = (a.ashramType || "").toLowerCase();
      const name = (a.name || "").toLowerCase();
      if (stayFilter === "ashram") {
        return type === "ashram" || name.includes("ashram");
      }
      if (stayFilter === "dharamshala") {
        return type === "dharamshala" || name.includes("dharam");
      }
      if (stayFilter === "homestay") {
        return (
          type === "homestay" ||
          name.includes("stay") ||
          name.includes("guest") ||
          name.includes("bhawan")
        );
      }
      return true;
    });
  }, [ashrams, stayFilter]);

  // Dynamic Map Markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];

    // 1. Ashrams
    ashrams.forEach((a) => {
      const c = extractCoordinates(a);
      if (c) {
        const isSelected = a === selectedAshram;
        markers.push({
          id: a._id || a.id,
          latitude: c.lat,
          longitude: c.lng,
          title: a.name,
          subtitle: a.address?.city || destination?.name || "",
          badge: isSelected ? "Selected Stay" : "Stay",
          href: ashramUrl(a),
          active: isSelected,
        });
      }
    });

    // 2. Parking
    parking.forEach((p) => {
      const c = extractCoordinates(p);
      if (c) {
        markers.push({
          id: p._id || p.id,
          latitude: c.lat,
          longitude: c.lng,
          title: p.name || p.locationName || "Parking",
          subtitle: p.address?.city || "Parking facility",
          badge: "Parking",
        });
      }
    });

    // 3. Attractions / Temples
    nearbyWithDistance.forEach((place) => {
      if (hasValidCoordinates(place.coordinates.lat, place.coordinates.lng)) {
        const isSelected = place.id === activePlaceId;
        markers.push({
          id: place.id,
          latitude: place.coordinates.lat,
          longitude: place.coordinates.lng,
          title: place.name,
          subtitle: place.category,
          badge: isSelected ? "Selected" : place.availableOnTirvona ? "Temple" : "Landmark",
          active: isSelected,
          href: place.externalUrl || undefined,
        });
      }
    });

    return markers;
  }, [ashrams, parking, nearbyWithDistance, selectedAshram, destination, activePlaceId]);

  const mapCenter: [number, number] | undefined = useMemo(() => {
    if (activeCoords) {
      return [activeCoords.lat, activeCoords.lng];
    }
    if (selectedAshramCoords) {
      return [selectedAshramCoords.lat, selectedAshramCoords.lng];
    }
    if (destination?.coordinates) {
      return [destination.coordinates.lat, destination.coordinates.lng];
    }
    return undefined;
  }, [activeCoords, selectedAshramCoords, destination]);

  const destName = destination?.name || toTitleCase(resolvedSlug);
  const destState = destination?.state || "India";
  const destDesc =
    destination?.description ||
    `Experience the sacred spiritual energy of ${destName}. Plan your complete stay, parking, and temple visits on Tirvona.`;

  // ── Tab content renderer ───────────────────────────────────────────────────
  const renderTabContent = useCallback(() => {
    if (loading) return <SkeletonCards />;

    switch (activeTab) {
      case "ashrams":
      case "stays":
        return (
          <div className="space-y-4">
            {/* Stay Sub-Filter (Requirement #9) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { key: "all", label: "All Stays" },
                  { key: "ashram", label: "Ashrams" },
                  { key: "dharamshala", label: "Dharamshalas" },
                  { key: "homestay", label: "Guest Houses" },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setStayFilter(sub.key)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    stayFilter === sub.key
                      ? "bg-[#0A4DA6] text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {filteredAshrams.length > 0 ? (
              <>
                <div className="pt-2 pb-2">
                  <MarqueeSlider
                    items={filteredAshrams}
                    speed={25}
                    gapClass="gap-4 sm:gap-6"
                    renderItem={(a, i) => (
                      <StayCard
                        key={a._id || i}
                        ashram={a}
                        destinationCenter={destination?.coordinates}
                      />
                    )}
                  />
                </div>
                {filteredAshrams.length > 6 && (
                  <div className="text-center mt-3">
                    <Link
                      to={`/search?destination=${encodeURIComponent(destName)}`}
                      className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0A4DA6] hover:underline"
                    >
                      View all stays in {destName} <ArrowRight size={13} />
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <EmptyCategory category="Stays" destinationName={destName} />
            )}
          </div>
        );

      case "parking":
        return parking.length > 0 ? (
          <>
            <div className="pt-2 pb-2">
              <MarqueeSlider
                items={parking}
                speed={25}
                gapClass="gap-4 sm:gap-6"
                renderItem={(p, i) => (
                  <ParkingCard
                    key={p._id || i}
                    lot={p}
                    selectedAshramCoords={selectedAshramCoords}
                  />
                )}
              />
            </div>
            {parking.length > 6 && (
              <div className="text-center mt-3">
                <Link
                  to={`/parking?city=${encodeURIComponent(destName)}`}
                  className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0A4DA6] hover:underline"
                >
                  View all parking in {destName} <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </>
        ) : (
          <EmptyCategory category="Parking" destinationName={destName} />
        );

      case "prasad":
        return prasad.length > 0 ? (
          <>
            <div className="pt-2 pb-2">
              <MarqueeSlider
                items={prasad}
                speed={25}
                gapClass="gap-4 sm:gap-6"
                renderItem={(p, i) => (
                  <PrasadCard key={p._id || i} product={p} />
                )}
              />
            </div>
            {prasad.length > 6 && (
              <div className="text-center mt-3">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0A4DA6] hover:underline"
                >
                  View all certified Prasad <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </>
        ) : (
          <EmptyCategory category="Prasad" destinationName={destName} />
        );

      default:
        return null;
    }
  }, [
    activeTab,
    stayFilter,
    filteredAshrams,
    parking,
    prasad,
    loading,
    destination,
    destName,
    selectedAshramCoords,
  ]);

  return (
    <div className="home-page min-h-screen pb-12">
      {/* ═══ 1. DYNAMIC HERO ═══ */}
      <motion.section className="dest-hero" {...fadeUp}>
        {destination?.heroImage && (
          <img
            src={destination.heroImage}
            alt={destName}
            className="dest-hero__bg"
            loading="eager"
          />
        )}
        <div className="dest-hero__overlay" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center flex flex-col items-center gap-5">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white drop-shadow-lg leading-tight"
          >
            {destName}
          </motion.h1>
          <p className="text-sm sm:text-base font-bold text-white/80 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#E58C28]" />
            {destState}, India
          </p>
          <p className="text-sm text-white/70 font-medium max-w-xl leading-relaxed hidden sm:block">
            {destDesc}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("dest-available")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold text-xs sm:text-sm pl-6 pr-2 py-2.5 rounded-full flex items-center gap-2.5 transition-all cursor-pointer border border-white/20 shadow-lg"
            >
              Explore Stays
              <span className="w-7 h-7 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center">
                <ArrowRight size={13} className="stroke-[2.5]" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("dest-explore")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-full flex items-center gap-2 transition-all cursor-pointer border border-white/20"
            >
              <Compass size={14} /> Explore Places
            </button>
          </div>
        </div>
      </motion.section>

      {/* ═══ 2. 100% DYNAMIC QUICK STATS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 mb-10">
        <motion.div className="dest-stats-strip" {...fadeUp}>
          {[
            { label: "Ashrams", value: liveStats.ashrams, icon: Home },
            { label: "Stays", value: liveStats.stays, icon: Bed },
            { label: "Parking", value: liveStats.parking, icon: CircleParking },
            { label: "Prasad", value: liveStats.prasad, icon: ShoppingBag },
            { label: "Places", value: liveStats.places, icon: Compass },
          ].map((stat) => (
            <div key={stat.label} className="dest-stat-pill">
              <stat.icon
                size={18}
                className="text-[#0A4DA6] dark:text-blue-400"
              />
              <span className="text-lg font-black text-[#0B192C] dark:text-white">
                {stat.value}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ═══ 3. AVAILABLE ON TIRVONA ═══ */}
      <section
        id="dest-available"
        className="max-w-7xl mx-auto px-4 sm:px-6 mb-14"
      >
        <SectionHeading
          title="Available on Tirvona"
          subtitle={`Everything you can discover and book for your stay in ${destName}.`}
        />

        {/* Category Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-6 mb-6">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`dest-tab flex items-center gap-1.5 ${
                activeTab === tab.key ? "dest-tab--active" : ""
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </section>

      {/* ═══ 4. NEARBY PLACES FROM SELECTED ASHRAM ═══ */}
      {nearbyWithDistance.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-14">
          <SectionHeading
            title="Places Near Your Stay"
            subtitle={`Calculated distance to sacred attractions from your selected stay in ${destName}.`}
          />

          {/* Dynamic Ashram Selector Dropdown */}
          {ashrams.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 mb-6">
              <span className="text-xs font-bold text-gray-400">
                Nearby from:
              </span>
              <select
                className="dest-ashram-select"
                value={selectedAshramIdx}
                onChange={(e) => setSelectedAshramIdx(Number(e.target.value))}
              >
                {ashrams.map((a, idx) => (
                  <option key={a._id || idx} value={idx}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 pb-2">
            <MarqueeSlider
              key={`near-slider-${selectedAshram?._id || selectedAshramIdx}-${selectedAshram?.name || ""}`}
              items={nearbyWithDistance}
              speed={25}
              gapClass="gap-4 sm:gap-6"
              renderItem={(place) => (
                <AttractionCard
                  key={`near-${place.id}`}
                  place={place}
                  distanceKm={place.distanceKm}
                  onSelectPlace={handleSelectPlaceOnMap}
                />
              )}
            />
          </div>
        </section>
      )}

      {/* ═══ 5. EXPLORE DESTINATION ═══ */}
      {nearbyWithDistance.length > 0 && (
        <section
          id="dest-explore"
          className="max-w-7xl mx-auto px-4 sm:px-6 mb-14"
        >
          <SectionHeading
            title={`Explore ${destName}`}
            subtitle="Important holy places and sacred landmarks in this destination."
          />

          <div className="pt-2 pb-2 mt-4">
            <MarqueeSlider
              items={nearbyWithDistance}
              speed={25}
              gapClass="gap-4 sm:gap-6"
              renderItem={(place) => (
                <AttractionCard
                  key={`explore-${place.id}`}
                  place={place}
                  distanceKm={place.distanceKm}
                  onSelectPlace={handleSelectPlaceOnMap}
                />
              )}
            />
          </div>
        </section>
      )}

      {/* ═══ 6. MORE TO EXPLORE (SECONDARY / INFORMATIONAL CONTENT) ═══ */}
      {nearbyWithDistance.filter((p) => !p.availableOnTirvona).length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-14">
          <div className="text-center space-y-1 mb-6">
            <h3 className="text-sm sm:text-lg font-extrabold text-[#0B192C] dark:text-white">
              More to Explore in {destName}
            </h3>
            <p className="text-[11px] text-gray-400 font-bold">
              Places and landmarks not directly managed on Tirvona — provided for
              your pilgrimage discovery.
            </p>
          </div>

          <div className="pt-2 pb-2 mt-4">
            <MarqueeSlider
              key={`more-slider-${selectedAshram?._id || selectedAshramIdx}`}
              items={nearbyWithDistance.filter((p) => !p.availableOnTirvona)}
              speed={25}
              gapClass="gap-4 sm:gap-6"
              renderItem={(place) => (
                <AttractionCard
                  key={`more-${place.id}`}
                  place={place}
                  distanceKm={place.distanceKm}
                  onSelectPlace={handleSelectPlaceOnMap}
                />
              )}
            />
          </div>
        </section>
      )}

      {/* ═══ 7. DYNAMIC MAP ═══ */}
      {mapCenter && (
        <section id="dest-map" className="max-w-7xl mx-auto px-4 sm:px-6 mb-14">
          <SectionHeading
            title="Explore Around You"
            subtitle={`Map of stays, parking, and sacred attractions across ${destName}.`}
          />
          <motion.div className="mt-6" {...fadeUp}>
            <TirvonaMapView
              markers={mapMarkers}
              center={mapCenter}
              zoom={activeCoords ? 15 : 13}
              height="420px"
              activeMarkerId={activePlaceId || undefined}
              fitToMarkers={!activeCoords && mapMarkers.length > 1}
              ariaLabel={`Map of ${destName}`}
            />
          </motion.div>
        </section>
      )}

      {/* ═══ 8. PLAN YOUR VISIT ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <SectionHeading
          title={`Plan Your ${destName} Visit`}
          subtitle="Everything you need for a peaceful and blessed pilgrimage."
        />

        <div className="dest-plan-grid mt-6">
          {[
            {
              icon: Bed,
              title: "Stay",
              sub: `Find an Ashram or Dharamshala in ${destName}`,
              action: () =>
                navigate(
                  `/search?destination=${encodeURIComponent(destName)}`,
                ),
            },
            {
              icon: CircleParking,
              title: "Parking",
              sub: `Find secure parking in ${destName}`,
              action: () =>
                navigate(
                  `/parking?city=${encodeURIComponent(destName)}`,
                ),
            },
            {
              icon: ShoppingBag,
              title: "Prasad",
              sub: "Order certified holy prasad",
              action: () => navigate("/marketplace"),
            },
            {
              icon: Compass,
              title: "Places",
              sub: `Explore sacred landmarks in ${destName}`,
              action: () =>
                document
                  .getElementById("dest-explore")
                  ?.scrollIntoView({ behavior: "smooth" }),
            },
          ].map((item) => (
            <motion.div
              key={item.title}
              onClick={item.action}
              className="cursor-pointer bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 p-5 flex flex-col items-center text-center gap-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              {...fadeUp}
            >
              <div className="w-12 h-12 rounded-2xl bg-[rgba(10,77,166,0.08)] flex items-center justify-center">
                <item.icon size={22} className="text-[#0A4DA6]" />
              </div>
              <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                {item.title}
              </h4>
              <p className="text-[10px] text-gray-400 font-bold">
                {item.sub}
              </p>
              <ChevronRight
                size={14}
                className="text-[#0A4DA6] mt-auto"
              />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DestinationOverviewPage;
