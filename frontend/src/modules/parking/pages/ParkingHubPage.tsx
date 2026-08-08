import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CircleParking,
  Navigation,
  AlertCircle,
  Loader2,
  LayoutGrid,
  Map as MapIcon,
  Sparkles,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { parkingDiscoveryService } from "../services/parking.service";
import type {
  ParkingLocation,
  ParkingVehicleType,
  ParkingVehicleTypeCode,
} from "../types/parking.types";
import { nextHalfHour, toLocalInputValue } from "../utils/parkingFormat";
import ParkingSearchBar from "../components/ParkingSearchBar";
import ParkingFilterPanel from "../components/ParkingFilterPanel";
import ParkingCard from "../components/ParkingCard";
import TirvonaMap from "../../../components/TirvonaMap";
import { hasValidCoordinates } from "../../../utils/geo";

/**
 * Parking discovery.
 *
 * The landing page for the Parking module: search by destination or temple,
 * filter, and see live availability before opening a listing.
 */
export const ParkingHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Default the window to the next half hour plus three hours — a realistic
  // temple visit, and it means the page shows real availability on first load.
  const defaults = useMemo(() => {
    const entry = nextHalfHour();
    const exit = new Date(entry.getTime() + 3 * 3600000);
    return { entry: toLocalInputValue(entry), exit: toLocalInputValue(exit) };
  }, []);

  const [destination, setDestination] = useState(
    searchParams.get("destination") || "",
  );
  const [templeSlug] = useState(searchParams.get("temple") || "");
  const [entryAt, setEntryAt] = useState(
    searchParams.get("entryAt") || defaults.entry,
  );
  const [exitAt, setExitAt] = useState(
    searchParams.get("exitAt") || defaults.exit,
  );
  const [vehicleType, setVehicleType] = useState<ParkingVehicleTypeCode | "">(
    (searchParams.get("vehicleType") as ParkingVehicleTypeCode) || "car",
  );

  const [amenities, setAmenities] = useState<string[]>([]);
  const [covered, setCovered] = useState(false);
  const [evCharging, setEvCharging] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortBy, setSortBy] = useState("recommended");
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [vehicleTypes, setVehicleTypes] = useState<ParkingVehicleType[]>([]);
  const [amenityOptions, setAmenityOptions] = useState<
    { key: string; label: string }[]
  >([]);
  const [sortOptions, setSortOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "recommended", label: "Recommended" }]);

  const [results, setResults] = useState<ParkingLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const [view, setView] = useState<"list" | "map">("list");
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  // Only results that actually carry usable coordinates can be mapped; a
  // listing saved without a position would otherwise land on null island.
  const mappableResults = useMemo(
    () => results.filter((p) => hasValidCoordinates(p.latitude, p.longitude)),
    [results],
  );

  // Filter metadata drives the UI, so a vehicle class added server-side appears
  // here without a frontend change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vt, filters] = await Promise.all([
          parkingDiscoveryService.getVehicleTypes(),
          parkingDiscoveryService.getFilterOptions(),
        ]);
        if (cancelled) return;
        if (vt.data?.success) setVehicleTypes(vt.data.data || []);
        if (filters.data?.success) {
          setAmenityOptions(filters.data.data.amenities || []);
          setSortOptions(filters.data.data.sortOptions || []);
        }
      } catch {
        // Non-fatal: search still works with an empty vehicle picker.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await parkingDiscoveryService.search({
        destination: destination || undefined,
        templeSlug: templeSlug || undefined,
        vehicleType: vehicleType || undefined,
        amenities,
        covered,
        evCharging,
        minRating: minRating || undefined,
        sortBy,
        entryAt: entryAt ? new Date(entryAt).toISOString() : undefined,
        exitAt: exitAt ? new Date(exitAt).toISOString() : undefined,
        ...(coords ? { ...coords, radiusKm } : {}),
        limit: 24,
      });

      if (res.data?.success) {
        setResults(res.data.data || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not load parking right now."));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [
    destination,
    templeSlug,
    vehicleType,
    amenities,
    covered,
    evCharging,
    minRating,
    sortBy,
    entryAt,
    exitAt,
    coords,
    radiusKm,
  ]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const handleSubmit = () => {
    const next = new URLSearchParams();
    if (destination) next.set("destination", destination);
    if (entryAt) next.set("entryAt", entryAt);
    if (exitAt) next.set("exitAt", exitAt);
    if (vehicleType) next.set("vehicleType", vehicleType);
    setSearchParams(next, { replace: true });
    runSearch();
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser cannot share a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(
          "We could not access your location. Search by destination instead.",
        );
      },
      { timeout: 10000 },
    );
  };

  const resetFilters = () => {
    setAmenities([]);
    setCovered(false);
    setEvCharging(false);
    setMinRating(0);
    setSortBy("recommended");
  };

  const handleFilterChange = (patch: Record<string, unknown>) => {
    if ("amenities" in patch) setAmenities(patch.amenities as string[]);
    if ("covered" in patch) setCovered(patch.covered as boolean);
    if ("evCharging" in patch) setEvCharging(patch.evCharging as boolean);
    if ("minRating" in patch) setMinRating(patch.minRating as number);
    if ("radiusKm" in patch) setRadiusKm(patch.radiusKm as number);
    if ("sortBy" in patch) setSortBy(patch.sortBy as string);
  };

  // Carried onto each card's link so the visitor's dates survive navigation.
  const detailQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (entryAt) q.set("entryAt", entryAt);
    if (exitAt) q.set("exitAt", exitAt);
    if (vehicleType) q.set("vehicleType", vehicleType);
    return q.toString() ? `?${q.toString()}` : "";
  }, [entryAt, exitAt, vehicleType]);

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Sacred Parking Facilities
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
            Verified, secure parking near India&rsquo;s holiest destinations.
            Book ahead, pay online, and enter with a single QR scan.
          </p>
        </div>
      </div>

      {/* Search panel below the hero banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20">
        <ParkingSearchBar
          destination={destination}
          entryAt={entryAt}
          exitAt={exitAt}
          vehicleType={vehicleType}
          vehicleTypes={vehicleTypes}
          loading={loading}
          onChange={(patch) => {
            if (patch.destination !== undefined)
              setDestination(patch.destination);
            if (patch.entryAt !== undefined) setEntryAt(patch.entryAt);
            if (patch.exitAt !== undefined) setExitAt(patch.exitAt);
            if (patch.vehicleType !== undefined)
              setVehicleType(patch.vehicleType);
          }}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters */}
          <div className="lg:w-64 xl:w-72 shrink-0 space-y-3">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="w-full inline-flex items-center justify-center gap-2 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {locating ? (
                <Loader2 size={14} className="animate-spin stroke-[2.5]" />
              ) : (
                <Navigation size={14} className="stroke-[2.5]" />
              )}
              {coords ? "Using your location" : "Parking near me"}
            </button>

            <ParkingFilterPanel
              amenityOptions={amenityOptions}
              selectedAmenities={amenities}
              covered={covered}
              evCharging={evCharging}
              minRating={minRating}
              radiusKm={radiusKm}
              hasCoordinates={Boolean(coords)}
              sortBy={sortBy}
              sortOptions={sortOptions}
              onChange={handleFilterChange}
              onReset={resetFilters}
            />
          </div>

          {/* List */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
                {loading
                  ? "Finding parking…"
                  : `${total} parking ${total === 1 ? "option" : "options"}`}
              </h2>

              {/* List / map toggle. Hidden when nothing has coordinates, so the
                  control is never offered for an empty map. */}
              {mappableResults.length > 0 && (
                <div className="inline-flex bg-gray-100 dark:bg-slate-800 rounded-full p-0.5">
                  {(
                    [
                      { key: "list", label: "List", icon: LayoutGrid },
                      { key: "map", label: "Map", icon: MapIcon },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                        view === key
                          ? "bg-white dark:bg-[#0B192C] text-[#0A4DA6] dark:text-blue-300 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6]"
                      }`}
                    >
                      <Icon size={13} className="stroke-[2.5]" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
                <AlertCircle
                  size={15}
                  className="shrink-0 mt-0.5 stroke-[2.5]"
                />
                <p className="text-xs font-semibold">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-80 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]"
                  />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
                <CircleParking
                  size={36}
                  className="text-gray-300 dark:text-slate-700 mx-auto"
                />
                <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  No parking found
                </h4>
                <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
                  Try a different destination, widen your filters, or change
                  your entry and exit times.
                </p>
              </div>
            ) : view === "map" ? (
              <div className="space-y-3">
                <TirvonaMap
                  height="560px"
                  fitToMarkers
                  ariaLabel="Map of parking search results"
                  markers={mappableResults.map((p) => ({
                    id: p._id,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    title: p.name,
                    subtitle: [p.address?.landmark, p.address?.city]
                      .filter(Boolean)
                      .join(", "),
                    badge: p.availability?.availableCount
                      ? `${p.availability.availableCount} free`
                      : undefined,
                    href: `/parking/${p.slug}${detailQuery}`,
                    active: p._id === activeMarker,
                  }))}
                  onMarkerClick={setActiveMarker}
                />

                {mappableResults.length < results.length && (
                  <p className="text-[10px] text-gray-400 font-medium text-center">
                    {results.length - mappableResults.length} result(s) have no
                    location set and are only visible in the list.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((parking, index) => (
                  <motion.div
                    key={parking._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(index * 0.04, 0.4),
                    }}
                  >
                    <ParkingCard parking={parking} query={detailQuery} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ParkingHubPage;
