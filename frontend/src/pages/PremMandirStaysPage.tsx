import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Star,
  Sparkles,
  Bed,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Compass,
  SlidersHorizontal,
  Navigation,
  ExternalLink,
  ChevronRight,
  Phone,
  Clock,
  Car,
  Wifi,
  UtensilsCrossed,
} from "lucide-react";
import {
  PREM_MANDIR_PROPERTIES,
  type PremMandirProperty,
} from "../data/premMandirStaysData";
import { formatCurrency } from "../utils/format";
import { useCanonicalUrl } from "../lib/useCanonicalUrl";

// Animation presets aligned with Tirvona design
const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const filterTabs = [
  { id: "all", label: "All Stays" },
  { id: "Near Prem Mandir", label: "Near Prem Mandir" },
  { id: "Near Banke Bihari", label: "Near Banke Bihari" },
  { id: "Near ISKCON", label: "Near ISKCON" },
  { id: "Budget Stay", label: "Budget Stay" },
  { id: "Family Stay", label: "Family Stay" },
];

export const PremMandirStaysPage: React.FC = () => {
  const navigate = useNavigate();

  // Canonical SEO tags
  useCanonicalUrl({
    canonicalPath: "/Stays-near-prem-mandir-vrindavan",
    title: "Stays Near Prem Mandir, Vrindavan · Verified Ashrams & Dharamshalas | Tirvona",
    description:
      "Find and book verified stays, ashrams, and dharamshalas near Prem Mandir, Vrindavan. Transparent pricing, authentic amenities, and instant reservations on Tirvona.",
  });

  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"distance" | "price_asc" | "price_desc" | "popular">("popular");

  // Filter properties in memory (frontend only)
  const filteredProperties = useMemo(() => {
    let list = [...PREM_MANDIR_PROPERTIES];

    if (activeFilter !== "all") {
      list = list.filter((p) => p.tags.includes(activeFilter));
    }

    switch (sortBy) {
      case "distance":
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        break;
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "popular":
      default:
        list.sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount);
        break;
    }

    return list;
  }, [activeFilter, sortBy]);

  return (
    <div className="home-page min-h-screen bg-[#F8FAFC] dark:bg-[#070F1B] text-[#0B192C] dark:text-white pb-20">      {/* FULL-BLEED HERO BANNER (MATCHING HOMEPAGE STYLE & FULLY RESPONSIVE) */}
      <section className="relative pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-28 lg:pb-36 min-h-[340px] sm:min-h-[440px] lg:min-h-[520px] flex items-center justify-center overflow-hidden rounded-b-[28px] sm:rounded-b-[44px] shadow-xl bg-gradient-to-br from-[#0B192C] via-[#0D233E] to-[#0B192C]">
        {/* BACKGROUND IMAGE WITH RESPONSIVE OBJECT POSITIONING */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/destinations/vrindavan/prem-mandir-vrindavan-hero.jpg"
            alt="Prem Mandir, Vrindavan"
            className="w-full h-full object-cover object-[center_35%] sm:object-center transform scale-100 sm:scale-105 transition-transform duration-1000 ease-out"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B192C]/75 via-[#0B192C]/45 to-[#0B192C]/85" />
        </div>

        {/* HERO CONTENT CENTERED */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex justify-center py-4">
          <div className="w-full min-w-0 max-w-4xl mx-auto space-y-3 sm:space-y-4 text-center flex flex-col items-center">
            {/* HEADING IN KALAM CURSIVE */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl sm:text-4xl md:text-5xl lg:text-[54px] font-bold text-white drop-shadow-lg leading-[1.25] px-2"
              style={{
                fontFamily: "'Kalam', cursive, sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              <span className="block">Stays Near Prem Mandir,</span>
              <span className="block text-[#E58C28] mt-0.5 sm:mt-1.5 font-bold">
                Vrindavan.
              </span>
            </motion.h1>

            {/* SUBTITLE */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[#E2E8F0] text-xs sm:text-base leading-relaxed max-w-2xl mx-auto text-center drop-shadow-md font-medium px-4"
            >
              Plan your pilgrimage, book verified ashrams, serene dharamshalas, and family guest houses near Prem Mandir.
            </motion.p>
          </div>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <div id="prem-mandir-stays-grid" className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 pt-8 sm:pt-10 z-20 relative">
        {/* SECTION HEADER */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
              <Compass size={18} className="text-[#0A4DA6] shrink-0" />
              Available Stays Near Prem Mandir
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-400 font-semibold mt-0.5">
              Showing {filteredProperties.length} verified spiritual accommodation(s)
            </p>
          </div>
        </div>


        {/* PROPERTY CARDS GRID (1 col mobile, 2 col tablet, 3 col desktop) */}
        {filteredProperties.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] border border-dashed border-gray-200 dark:border-slate-800 rounded-3xl space-y-3">
            <Bed size={36} className="mx-auto text-gray-300 dark:text-slate-600" />
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              No stays match this filter
            </h3>
            <p className="text-xs text-gray-400">
              Try clicking "All Stays" to view all available accommodations in Vrindavan.
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="mt-2 px-4 py-2 bg-[#0A4DA6] text-white text-xs font-bold rounded-xl"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {filteredProperties.map((property) => (
              <motion.article
                key={property.id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-[#0A4DA6]/40 transition-all duration-300 flex flex-col justify-between group text-left"
              >
                {/* TOP IMAGE & BADGES */}
                <div className="relative h-52 sm:h-56 bg-gray-100 dark:bg-slate-900 overflow-hidden shrink-0">
                  <img
                    src={property.image}
                    alt={property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                    }}
                  />

                  {/* GRADIENT OVERLAY */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* RATING BADGE (TOP RIGHT) */}
                  <div className="absolute top-3 right-3 bg-white/95 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm">
                    <Star size={12} className="text-[#D4AF37] fill-[#D4AF37]" />
                    <span>{property.rating.toFixed(1)}</span>
                    <span className="text-[9px] text-gray-400 font-semibold">
                      ({property.reviewCount})
                    </span>
                  </div>

                  {/* PRICE PILL (BOTTOM LEFT OVERLAY) */}
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-[#0A4DA6] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-md">
                      Starts {formatCurrency(property.price)} / night
                    </span>
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* TITLE + TIRVONA TRUSTED BADGE */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white leading-snug group-hover:text-[#0A4DA6] transition-colors line-clamp-1">
                        {property.name}
                      </h3>
                      {property.trusted && (
                        <img
                          src="/Verified badge/verified.png"
                          alt="Tirvona Trusted"
                          title="Tirvona Trusted™"
                          className="h-8 w-auto object-contain inline-block shrink-0 select-none align-middle"
                        />
                      )}
                    </div>

                    {/* LOCATION */}
                    <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
                      <MapPin size={12} className="text-[#0A4DA6] shrink-0" />
                      <span className="truncate">{property.location}</span>
                    </p>

                    {/* SHORT DESCRIPTION / TAGLINE */}
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed font-medium">
                      {property.tagline || property.description}
                    </p>
                  </div>

                  {/* KEY AMENITIES */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex flex-wrap gap-1.5">
                      {property.amenities.slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-slate-800/80"
                        >
                          {amenity}
                        </span>
                      ))}
                      {property.amenities.length > 3 && (
                        <span className="text-[10px] font-bold text-gray-400 self-center px-1">
                          +{property.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CARD ACTIONS: VIEW STAY & BOOK NOW */}
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2.5">
                    {/* View Stay Button */}
                    <Link
                      to={property.detailsUrl}
                      className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition-all text-center flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      View Stay <ChevronRight size={14} />
                    </Link>

                    {/* Book Now Button -> Links directly to existing Tirvona booking route */}
                    <Link
                      to={property.bookingUrl}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1 shadow-sm shadow-[#0A4DA6]/20 cursor-pointer"
                    >
                      Book Now <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremMandirStaysPage;

