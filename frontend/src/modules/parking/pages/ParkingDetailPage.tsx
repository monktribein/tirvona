import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Star,
  Navigation,
  Clock,
  Phone,
  ShieldCheck,
  CircleParking,
  AlertCircle,
  Loader2,
  Info,
  CheckCircle2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { setGuestPendingIntent } from "../../../utils/guestGate";
import { parkingDiscoveryService } from "../services/parking.service";
import type {
  ParkingLocationDetail,
  ParkingSlotTypeAvailability,
  ParkingVehicleType,
  ParkingVehicleTypeCode,
} from "../types/parking.types";
import {
  formatCurrency,
  formatDateTime,
  nextHalfHour,
  toLocalInputValue,
  availabilityTone,
  vehicleLabel,
  getMinimumParkingEntry,
  getMinimumParkingExit,
  normalizeParkingWindow,
} from "../utils/parkingFormat";
import ParkingAmenityList from "../components/ParkingAmenityList";
import VehicleTypePicker from "../components/VehicleTypePicker";
import TirvonaMap from "../../../components/TirvonaMap";
import { hasValidCoordinates } from "../../../utils/geo";

/**
 * Pick a usable bay as soon as a visitor chooses their vehicle. EV charging
 * bays are preferred for EVs; otherwise the lowest live total wins, with
 * availability used as the tie-breaker. Visitors may still choose another
 * compatible bay from the list.
 */
const recommendedSlotType = (
  slots: ParkingSlotTypeAvailability[],
  vehicle: ParkingVehicleTypeCode,
) =>
  [...slots]
    .filter((slot) => slot.isAvailable && slot.availableCount > 0)
    .sort((left, right) => {
      if (vehicle === "ev" && left.hasEvCharging !== right.hasEvCharging)
        return left.hasEvCharging ? -1 : 1;
      const leftTotal = left.pricing?.totalAmount ?? Number.MAX_SAFE_INTEGER;
      const rightTotal = right.pricing?.totalAmount ?? Number.MAX_SAFE_INTEGER;
      if (leftTotal !== rightTotal) return leftTotal - rightTotal;
      return right.availableCount - left.availableCount;
    })[0];

/**
 * Parking detail & area selection.
 *
 * Everything a visitor needs before committing: photos, map link, amenities,
 * opening hours, live availability per area with real pricing, reviews and
 * terms. Choosing an area carries the selection into checkout.
 */
export const ParkingDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaults = useMemo(() => {
    const entry = nextHalfHour();
    return {
      entry: toLocalInputValue(entry),
      exit: toLocalInputValue(new Date(entry.getTime() + 3 * 3600000)),
    };
  }, []);

  const initialWindow = useMemo(
    () =>
      normalizeParkingWindow(
        searchParams.get("entryAt") || defaults.entry,
        searchParams.get("exitAt") || defaults.exit,
      ),
    [defaults, searchParams],
  );

  const [entryAt, setEntryAt] = useState(initialWindow.entry);
  const [exitAt, setExitAt] = useState(initialWindow.exit);
  const [vehicleType, setVehicleType] = useState<ParkingVehicleTypeCode>(
    (searchParams.get("vehicleType") as ParkingVehicleTypeCode) || "car",
  );

  const [parking, setParking] = useState<ParkingLocationDetail | null>(null);
  const [slotTypes, setSlotTypes] = useState<ParkingSlotTypeAvailability[]>([]);
  const [selectedSlotType, setSelectedSlotType] = useState<string>("");
  const [vehicleTypes, setVehicleTypes] = useState<ParkingVehicleType[]>([]);

  // Gallery. Mirrors the ashram detail page so both listing types behave
  // identically: tap the hero to open the lightbox, swipe on mobile, arrow
  // keys and Escape while the lightbox is open.
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(0);

  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await parkingDiscoveryService.getVehicleTypes();
        if (res.data?.success) setVehicleTypes(res.data.data || []);
      } catch {
        // Non-fatal — the picker simply renders empty.
      }
    })();
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      setLoading(true);
      setError("");
      try {
        const res = await parkingDiscoveryService.getDetail(slug, {
          entryAt: entryAt ? new Date(entryAt).toISOString() : undefined,
          exitAt: exitAt ? new Date(exitAt).toISOString() : undefined,
          vehicleType,
        });
        if (cancelled) return;
        if (res.data?.success) {
          setParking(res.data.data);
          const nextSlots = res.data.data.slotTypes || [];
          setSlotTypes(nextSlots);
          setSelectedSlotType(
            recommendedSlotType(nextSlots, vehicleType)?.slotTypeId || "",
          );
          // Navigating between listings must not leave the gallery pointing at
          // an index the new listing may not have.
          setActiveImage(0);
        }
      } catch (err) {
        if (!cancelled)
          setError(getErrorMessage(err, "Could not load this parking."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-fetch the whole page when the listing changes; window changes go
    // through refreshAvailability below, which is much cheaper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /** Re-price and re-check availability when the window or vehicle changes. */
  const refreshAvailability = useCallback(async () => {
    if (!parking) return;
    setCheckingAvailability(true);
    setError("");
    try {
      const res = await parkingDiscoveryService.getAvailability(parking._id, {
        entryAt: new Date(entryAt).toISOString(),
        exitAt: new Date(exitAt).toISOString(),
        vehicleType,
      });
      if (res.data?.success) {
        const nextSlots = res.data.data.slotTypes || [];
        setSlotTypes(nextSlots);
        setSelectedSlotType(
          recommendedSlotType(nextSlots, vehicleType)?.slotTypeId || "",
        );
      }
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not check availability for those times."),
      );
    } finally {
      setCheckingAvailability(false);
    }
  }, [parking, entryAt, exitAt, vehicleType]);

  useEffect(() => {
    if (parking) refreshAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryAt, exitAt, vehicleType]);

  // ── Gallery navigation ─────────────────────────────────────────────────────
  const galleryImages = useMemo(() => {
    if (!parking) return [] as string[];
    const list = parking.images?.length ? parking.images : [parking.coverImage];
    return list.filter(Boolean) as string[];
  }, [parking]);

  const nextImage = useCallback(() => {
    setActiveImage((i) =>
      galleryImages.length ? (i + 1) % galleryImages.length : 0,
    );
  }, [galleryImages.length]);

  const prevImage = useCallback(() => {
    setActiveImage((i) =>
      galleryImages.length
        ? (i - 1 + galleryImages.length) % galleryImages.length
        : 0,
    );
  }, [galleryImages.length]);

  const onHeroTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    // Ignore anything under 40px so a tap-to-open-lightbox is not read as a swipe.
    if (Math.abs(dx) <= 40) return;
    if (dx < 0) nextImage();
    else prevImage();
  };

  // Keyboard navigation while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, nextImage, prevImage]);

  const selected = slotTypes.find((s) => s.slotTypeId === selectedSlotType);

  const handleProceed = () => {
    if (!selected || !parking) return;

    const params = new URLSearchParams({
      locationId: parking._id,
      slotTypeId: selected.slotTypeId,
      vehicleType,
      entryAt: new Date(entryAt).toISOString(),
      exitAt: new Date(exitAt).toISOString(),
    });

    // Send an unauthenticated visitor to log in first, then straight back here —
    // the same pattern the stay booking flow uses.
    if (!user) {
      const returnUrl = `/parking/checkout?${params.toString()}`;
      setGuestPendingIntent({
        type: "parking_booking",
        returnUrl,
      });
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    navigate(`/parking/checkout?${params.toString()}`);
  };

  if (loading) {
    // Mirrors the real layout — centred title block, 16:9 hero, thumbnails —
    // so the page does not jump when the data arrives.
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16 space-y-10">
        <div className="flex flex-col items-center gap-3 pb-4">
          <div className="h-5 w-56 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-full" />
          <div className="h-10 w-2/3 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
          <div className="h-3 w-72 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-full" />
        </div>
        <div className="space-y-3 -mt-4">
          <div className="w-full aspect-video bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-24 h-16 sm:w-28 sm:h-20 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
          <div className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (!parking) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-20 text-center space-y-4">
        <CircleParking
          size={40}
          className="text-gray-300 dark:text-slate-700 mx-auto"
        />
        <h1 className="font-extrabold text-lg text-[#0B192C] dark:text-white">
          Parking not found
        </h1>
        <p className="text-xs text-gray-400 font-medium">
          {error || "This listing is no longer available."}
        </p>
        <button
          onClick={() => navigate("/parking")}
          className="bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
        >
          Browse all parking
        </button>
      </div>
    );
  }

  const FALLBACK_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16 space-y-10">
      {/* ── Title header ──
          Same centred treatment as the ashram detail page: status chip + city
          line, large display title, then the address. */}
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm tracking-wider">
            <ShieldCheck size={12} />{" "}
            {parking.isVerified ? "Verified Parking" : "Parking"}
          </span>
          <span className="text-xs text-gray-400 font-extrabold tracking-wider">
            {[parking.address?.city, parking.address?.state]
              .filter(Boolean)
              .join(", ")}
          </span>
          {parking.rating?.count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0B192C] dark:text-white">
              <Star size={12} className="fill-[#D4AF37] text-[#D4AF37]" />
              {parking.rating.average.toFixed(1)}
              <span className="text-gray-400 font-bold">
                ({parking.rating.count})
              </span>
            </span>
          )}
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {parking.name}
        </h2>

        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <MapPin size={12} className="text-[#0A4DA6]" />
          {[parking.address?.line1, parking.address?.landmark]
            .filter(Boolean)
            .join(", ")}
          {parking.address?.pincode ? `, Pin: ${parking.address.pincode}` : ""}
        </p>
      </div>

      {/* ── Hero + thumbnail gallery ── */}
      <div className="space-y-3 -mt-4">
        <div
          className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm cursor-zoom-in group bg-gray-100 dark:bg-slate-900"
          onClick={() => galleryImages.length > 0 && setLightboxOpen(true)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={onHeroTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeImage}
              src={
                galleryImages[activeImage] || galleryImages[0] || FALLBACK_IMAGE
              }
              alt={parking.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
          </AnimatePresence>

          {galleryImages.length > 1 && (
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-bold backdrop-blur-sm">
              {activeImage + 1} / {galleryImages.length}
            </div>
          )}

          <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={13} /> View Gallery
          </div>
        </div>

        {galleryImages.length > 1 && (
          <div
            className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x"
            style={{ scrollbarWidth: "none" }}
          >
            {galleryImages.map((img, idx) => (
              <button
                key={img + idx}
                onClick={() => setActiveImage(idx)}
                aria-label={`Show image ${idx + 1}`}
                className={`relative shrink-0 w-24 h-16 sm:w-28 sm:h-20 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all snap-start group ${idx === activeImage
                  ? "border-[#0A4DA6] ring-2 ring-[#0A4DA6]/20"
                  : "border-transparent opacity-70 hover:opacity-100"
                  }`}
              >
                <img
                  src={img}
                  alt={`${parking.name} ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 sm:left-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 sm:right-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.img
              key={activeImage}
              src={galleryImages[activeImage]}
              alt={`${parking.name} full view`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </AnimatePresence>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
            {activeImage + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick facts */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                icon: Clock,
                label: "Hours",
                value: parking.openingHours?.is24x7
                  ? "24×7"
                  : `${parking.openingHours?.opensAt}–${parking.openingHours?.closesAt}`,
              },
              {
                icon: CircleParking,
                label: "Capacity",
                value: `${parking.totalCapacity} bays`,
              },
              {
                icon: Navigation,
                label: "Nearest",
                value: parking.nearbyDestinations?.[0]?.name || "—",
              },
              {
                icon: Phone,
                label: "Contact",
                value: parking.contactPhone || "—",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-3 space-y-1 shadow-sm"
              >
                <span className="inline-flex items-center gap-1 text-[9px] tracking-wider font-bold text-gray-400">
                  <Icon size={11} className="stroke-[2.5]" /> {label}
                </span>
                <p className="text-[11px] font-black text-[#0B192C] dark:text-white line-clamp-1">
                  {value}
                </p>
              </div>
            ))}
          </section>

          {parking.description && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-2 shadow-sm">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                About this parking
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                {parking.description}
              </p>
            </section>
          )}

          {/* Amenities */}
          {parking.amenities?.length > 0 && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Amenities &amp; Facilities
              </h2>
              <ParkingAmenityList
                amenities={parking.amenities}
                variant="grid"
              />
            </section>
          )}

          {/* Nearby */}
          {parking.nearbyDestinations?.length > 0 && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Nearby Destinations
              </h2>
              <ul className="space-y-2">
                {parking.nearbyDestinations.map((d, i) => (
                  <li
                    key={d.name + i}
                    className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900/60 rounded-2xl px-3.5 py-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-200">
                      <Navigation
                        size={13}
                        className="text-[#0A4DA6] stroke-[2.5] shrink-0"
                      />
                      {d.name}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 shrink-0">
                      {d.walkingMinutes
                        ? `${d.walkingMinutes} min walk`
                        : `${d.distanceKm ?? 0} km`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Location map */}
          {hasValidCoordinates(parking.latitude, parking.longitude) && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
                  <MapPin size={15} className="text-[#0A4DA6] stroke-[2.5]" />
                  Location
                </h2>
                {parking.googleMapsUrl && (
                  <a
                    href={parking.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0A4DA6] dark:text-blue-300 hover:underline"
                  >
                    <Navigation size={12} className="stroke-[2.5]" />
                    Get directions
                  </a>
                )}
              </div>

              <TirvonaMap
                height="340px"
                zoom={15}
                center={[parking.latitude, parking.longitude]}
                ariaLabel={`Map showing ${parking.name}`}
                markers={[
                  {
                    id: parking._id,
                    latitude: parking.latitude,
                    longitude: parking.longitude,
                    title: parking.name,
                    subtitle: [parking.address?.landmark, parking.address?.city]
                      .filter(Boolean)
                      .join(", "),
                    badge: parking.availability?.availableCount
                      ? `${parking.availability.availableCount} free`
                      : undefined,
                  },
                ]}
              />

              {parking.nearbyDestinations?.length > 0 && (
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  {parking.nearbyDestinations[0].walkingMinutes
                    ? `About ${parking.nearbyDestinations[0].walkingMinutes} minutes on foot to ${parking.nearbyDestinations[0].name}.`
                    : `Near ${parking.nearbyDestinations[0].name}.`}
                </p>
              )}
            </section>
          )}

          {/* Reviews */}
          <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
            <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              Reviews{" "}
              {parking.reviewCount > 0 && (
                <span className="text-gray-400 font-bold">
                  ({parking.reviewCount})
                </span>
              )}
            </h2>

            {parking.reviews?.length ? (
              <ul className="space-y-3">
                {parking.reviews.map((r) => (
                  <li key={r._id} className="pb-3 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                        {r.customerId?.name || "Verified Visitor"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#0B192C] dark:text-white">
                        <Star
                          size={11}
                          className="fill-[#D4AF37] text-[#D4AF37]"
                        />
                        {r.rating.overall.toFixed(1)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                        {r.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 font-medium py-2">
                No reviews yet. Be the first to park and review.
              </p>
            )}
          </section>

          {/* Terms */}
          {parking.termsAndConditions && (
            <section className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-[24px] p-5 space-y-2">
              <h2 className="inline-flex items-center gap-2 font-extrabold text-sm text-amber-900 dark:text-amber-200">
                <Info size={14} className="stroke-[2.5]" /> Terms &amp;
                Conditions
              </h2>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 font-medium leading-relaxed whitespace-pre-line">
                {parking.termsAndConditions}
              </p>
            </section>
          )}
        </div>

        {/* Booking rail */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-4 shadow-lg">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Book your bay
              </h2>

              {/* Window */}
              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="detail-entry"
                    className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1"
                  >
                    Entry
                  </label>
                  <input
                    id="detail-entry"
                    type="datetime-local"
                    value={entryAt}
                    min={getMinimumParkingEntry()}
                    onChange={(e) => {
                      const nextEntry = e.target.value;
                      setEntryAt(nextEntry);
                      const minimumExit = getMinimumParkingExit(nextEntry);
                      if (exitAt < minimumExit) setExitAt(minimumExit);
                    }}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="detail-exit"
                    className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1"
                  >
                    Exit
                  </label>
                  <input
                    id="detail-exit"
                    type="datetime-local"
                    value={exitAt}
                    min={getMinimumParkingExit(entryAt)}
                    onChange={(e) => setExitAt(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
                  />
                </div>
              </div>

              {/* Vehicle */}
              <div>
                <span className="block text-[10px] tracking-wider font-bold text-gray-400 mb-2">
                  Vehicle
                </span>
                <VehicleTypePicker
                  options={vehicleTypes}
                  value={vehicleType}
                  onChange={(nextVehicle) => {
                    setSelectedSlotType("");
                    setVehicleType(nextVehicle);
                  }}
                  supported={parking.supportedVehicleTypes}
                  compact
                />
              </div>

              {error && (
                <p className="flex items-start gap-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle
                    size={13}
                    className="shrink-0 mt-0.5 stroke-[2.5]"
                  />
                  {error}
                </p>
              )}

              {/* Areas */}
              {false && (
              <div className="space-y-2">
                <span className="flex items-center justify-between text-[10px] tracking-wider font-bold text-gray-400">
                  Parking area selected automatically
                  {checkingAvailability && (
                    <Loader2
                      size={12}
                      className="animate-spin text-[#0A4DA6]"
                    />
                  )}
                </span>

                {slotTypes.length === 0 ? (
                  <p className="text-[11px] text-gray-400 font-medium py-2">
                    No area at this parking accepts a{" "}
                    {vehicleLabel(vehicleType)}.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {slotTypes.map((slot) => {
                      const isSelected = selectedSlotType === slot.slotTypeId;
                      const disabled = !slot.isAvailable;

                      return (
                        <li key={slot.slotTypeId}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setSelectedSlotType(slot.slotTypeId)}
                            className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer ${isSelected
                              ? "border-[#0A4DA6] bg-blue-50/70 dark:bg-slate-800 ring-2 ring-[#0A4DA6]/20"
                              : disabled
                                ? "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 opacity-60 cursor-not-allowed"
                                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B192C] hover:border-[#0A4DA6]"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                                  {isSelected && (
                                    <CheckCircle2
                                      size={13}
                                      className="text-[#0A4DA6] shrink-0 stroke-[2.5]"
                                    />
                                  )}
                                  {slot.name}
                                  {isSelected && (
                                    <span className="rounded-full bg-[#0A4DA6]/10 px-2 py-0.5 text-[8px] font-black text-[#0A4DA6]">
                                      Best match
                                    </span>
                                  )}
                                </p>
                                <p
                                  className={`text-[10px] font-bold ${availabilityTone(slot.availableCount, slot.totalCapacity)}`}
                                >
                                  {slot.availableCount > 0
                                    ? `${slot.availableCount} available`
                                    : "Full"}
                                </p>
                                {(slot.isCovered || slot.hasEvCharging) && (
                                  <p className="text-[9px] font-bold text-gray-400">
                                    {[
                                      slot.isCovered && "Covered",
                                      slot.hasEvCharging && "EV charging",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                              </div>

                              {slot.pricing && (
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-black text-[#0B192C] dark:text-white">
                                    {formatCurrency(slot.pricing.totalAmount)}
                                  </p>
                                  <p className="text-[9px] font-bold text-gray-400">
                                    {slot.pricing.durationHours} hr total
                                  </p>
                                </div>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              )}

              {/* Fare summary */}
              {checkingAvailability && (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 py-4 text-xs font-bold text-[#0A4DA6] dark:bg-blue-950/30">
                  <Loader2 size={14} className="animate-spin" /> Calculating parking amount...
                </div>
              )}
              {selected?.pricing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-3 space-y-1.5 overflow-hidden"
                >
                  {selected.pricing.isPeak && (
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2.5 py-1 inline-flex items-center gap-1">
                      <Info size={10} className="stroke-[2.5]" />
                      Peak pricing ×{selected.pricing.peakMultiplier}
                    </p>
                  )}
                  {[
                    ["Base fee", selected.pricing.baseFee],
                    [
                      `Parking (${selected.pricing.durationHours} hr)`,
                      selected.pricing.durationAmount,
                    ],
                    [
                      `GST (${selected.pricing.taxPercent}%)`,
                      selected.pricing.taxAmount,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between text-[11px] font-semibold"
                    >
                      <span className="text-gray-500 dark:text-gray-400">
                        {label}
                      </span>
                      <span className="text-slate-700 dark:text-gray-200">
                        {formatCurrency(value as number)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5">
                    <span className="text-xs font-black text-[#0B192C] dark:text-white">
                      Total
                    </span>
                    <span className="text-base font-black text-[#0A4DA6] dark:text-blue-300">
                      {formatCurrency(selected.pricing.totalAmount)}
                    </span>
                  </div>
                </motion.div>
              )}

              <button
                type="button"
                onClick={handleProceed}
                disabled={!selected || checkingAvailability}
                className="w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold px-5 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {checkingAvailability
                  ? "Finding the best available bay..."
                  : selected?.pricing
                    ? `Continue to Payment · ${formatCurrency(selected.pricing.totalAmount)}`
                    : "No compatible bay available"}
              </button>

              <p className="text-[10px] text-gray-400 font-medium text-center leading-relaxed">
                Entry {formatDateTime(entryAt)} · Exit {formatDateTime(exitAt)}
              </p>
            </section>

            {/* Navigate */}
            {parking.googleMapsUrl && (
              <a
                href={parking.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-5 py-3 rounded-full shadow-sm transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <Navigation size={14} className="stroke-[2.5]" />
                Navigate with Google Maps
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailPage;
