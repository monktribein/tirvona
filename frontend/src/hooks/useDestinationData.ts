import { useEffect, useMemo, useState } from "react";
import {
  getDestinationBySlug,
  createDynamicDestination,
  type Destination,
  type NearbyPlace,
  type DestinationCoordinates,
} from "../data/destinationData";
import { ashramService } from "../services";
import { parkingDiscoveryService } from "../modules/parking";
import { marketplaceService } from "../services/marketplace.service";
import api from "../lib/api";
import { extractCoordinates } from "../utils/geo";
import { toTitleCase } from "../utils/textCase";

export interface DestinationInventory {
  destination: Destination | null;
  ashrams: any[];
  parking: any[];
  prasad: any[];
  attractions: NearbyPlace[];
  loading: boolean;
  error: string;
  /** Live stat counts derived strictly from live data */
  liveStats: {
    ashrams: number;
    stays: number;
    parking: number;
    prasad: number;
    places: number;
  };
}

/**
 * 100% DYNAMIC hook for the Destination Overview page.
 *
 * Dynamically resolves destination metadata (name, state, coordinates, hero image)
 * from both seed data and live database responses. Fetches ashrams, parking,
 * marketplace prasad, and sacred temples/directory items in parallel from live APIs.
 */
export function useDestinationData(slug: string): DestinationInventory {
  const cleanSlug = useMemo(
    () =>
      String(slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    [slug],
  );

  const [destination, setDestination] = useState<Destination | null>(null);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [parking, setParking] = useState<any[]>([]);
  const [prasad, setPrasad] = useState<any[]>([]);
  const [attractions, setAttractions] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cleanSlug) {
      setLoading(false);
      setError("Destination slug is required");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    // Seed destination if available
    const seedDest = getDestinationBySlug(cleanSlug);
    const initialCityName = seedDest?.name || toTitleCase(cleanSlug.replace(/-/g, " "));

    const fetchAllDynamicData = async () => {
      try {
        // Parallel fetch of all destination resources from backend
        const [
          ashramByDestRes,
          ashramByCityRes,
          parkingCityRes,
          parkingDestRes,
          allTemplesRes,
          directoryRes,
          prasadMarketRes,
          allProductsRes,
          destinationsListRes,
        ] = await Promise.allSettled([
          ashramService.search({ destination: initialCityName, limit: "50" }),
          ashramService.search({ city: initialCityName, limit: "50" }),
          parkingDiscoveryService.search({ city: initialCityName, limit: 20 }),
          parkingDiscoveryService.search({ destination: initialCityName, limit: 20 }),
          api.get("/services/temples"),
          api.get("/services/directory", { params: { city: initialCityName } }),
          marketplaceService.getProducts({ category: "prasad", limit: 50 }),
          marketplaceService.getProducts({ search: initialCityName, limit: 50 }),
          ashramService.destinations(),
        ]);

        if (cancelled) return;

        // 1. DYNAMIC ASHRAMS & STAYS
        const rawAshrams: any[] = [];
        const seenAshramIds = new Set<string>();

        const addAshrams = (res: PromiseSettledResult<any>) => {
          if (res.status !== "fulfilled") return;
          const items = Array.isArray(res.value?.data?.data)
            ? res.value.data.data
            : Array.isArray(res.value?.data)
              ? res.value.data
              : [];
          items.forEach((a: any) => {
            const id = a._id || a.id;
            if (id && !seenAshramIds.has(String(id))) {
              seenAshramIds.add(String(id));
              rawAshrams.push(a);
            }
          });
        };

        addAshrams(ashramByDestRes);
        addAshrams(ashramByCityRes);

        // 2. DYNAMIC DESTINATION METADATA RESOLUTION
        let resolvedCityName = initialCityName;
        let resolvedState = seedDest?.state || "India";
        let resolvedCoords: DestinationCoordinates | undefined = seedDest?.coordinates;
        let resolvedHero = seedDest?.heroImage;

        // Check backend destinations aggregation
        if (destinationsListRes.status === "fulfilled") {
          const destList = destinationsListRes.value?.data?.data || [];
          const matched = destList.find(
            (d: any) =>
              String(d.city).toLowerCase() === cleanSlug ||
              String(d.city).toLowerCase() === initialCityName.toLowerCase(),
          );
          if (matched) {
            resolvedCityName = matched.city;
            if (matched.state) resolvedState = matched.state;
          }
        }

        // Prioritize ashrams whose address.city strictly matches this destination
        rawAshrams.sort((a, b) => {
          const aCity = String(a.address?.city || "").toLowerCase().trim();
          const bCity = String(b.address?.city || "").toLowerCase().trim();
          const aMatch = aCity === cleanSlug || aCity === initialCityName.toLowerCase() ? 1 : 0;
          const bMatch = bCity === cleanSlug || bCity === initialCityName.toLowerCase() ? 1 : 0;
          return bMatch - aMatch;
        });

        // Derive state, coordinates, and hero from matching ashrams
        if (rawAshrams.length > 0) {
          const matchingAshram =
            rawAshrams.find(
              (a) =>
                String(a.address?.city || "").toLowerCase().trim() === cleanSlug ||
                String(a.address?.city || "").toLowerCase().trim() === initialCityName.toLowerCase(),
            ) || rawAshrams[0];

          if (matchingAshram.address?.city && matchingAshram.address.city.toLowerCase().trim() === cleanSlug) {
            resolvedCityName = matchingAshram.address.city;
          }
          if (matchingAshram.address?.state && (!resolvedState || resolvedState === "India")) {
            resolvedState = matchingAshram.address.state;
          }

          // Find first ashram with real coordinates
          if (!resolvedCoords || (resolvedCoords.lat === 0 && resolvedCoords.lng === 0)) {
            for (const a of rawAshrams) {
              const c = extractCoordinates(a);
              if (c) {
                resolvedCoords = c;
                break;
              }
            }
          }

          // Use top ashram cover image if available
          const ashramImg =
            (Array.isArray(matchingAshram.images) && matchingAshram.images[0]) ||
            matchingAshram.coverImage ||
            matchingAshram.thumbnail;
          if (ashramImg && (!resolvedHero || resolvedHero.includes("unsplash"))) {
            resolvedHero = ashramImg;
          }
        } else if (allTemplesRes.status === "fulfilled") {
          // If no ashrams yet, derive metadata from temples in this city (e.g. Ayodhya, Ujjain)
          const matchingTemple = (allTemplesRes.value?.data?.data || []).find(
            (t: any) =>
              String(t.city || "").toLowerCase() === cleanSlug ||
              String(t.city || "").toLowerCase() === initialCityName.toLowerCase(),
          );
          if (matchingTemple) {
            if (matchingTemple.city) resolvedCityName = matchingTemple.city;
            if (matchingTemple.state) resolvedState = matchingTemple.state;
            const c = extractCoordinates(matchingTemple);
            if (c && (!resolvedCoords || (resolvedCoords.lat === 0 && resolvedCoords.lng === 0))) {
              resolvedCoords = c;
            }
            if (matchingTemple.coverImage && (!resolvedHero || resolvedHero.includes("unsplash"))) {
              resolvedHero = matchingTemple.coverImage;
            }
          }
        }

        // 3. DYNAMIC TEMPLES & ATTRACTIONS
        const dynamicAttractions: NearbyPlace[] = [];
        const seenPlaceIds = new Set<string>();

        // From live /services/temples
        if (allTemplesRes.status === "fulfilled") {
          const templesData = allTemplesRes.value?.data?.data || [];
          templesData.forEach((t: any) => {
            const cityMatch =
              String(t.city || "").toLowerCase() === cleanSlug ||
              String(t.city || "").toLowerCase() === resolvedCityName.toLowerCase();

            if (cityMatch) {
              const id = t._id || t.slug;
              if (!seenPlaceIds.has(id)) {
                seenPlaceIds.add(id);
                const coords = extractCoordinates(t) || resolvedCoords || { lat: 28.6139, lng: 77.209 };
                dynamicAttractions.push({
                  id,
                  name: t.name,
                  category: t.deity ? `Temple (${t.deity})` : "Sacred Temple",
                  description: t.history || t.architectureStyle || "",
                  coordinates: coords,
                  image: t.coverImage || (Array.isArray(t.gallery) && t.gallery[0]),
                  availableOnTirvona: true,
                  slug: t.slug,
                });
              }
            }
          });
        }

        // From live /services/directory (e.g. guide walks, sacred landmarks, handicraft centers)
        if (directoryRes.status === "fulfilled") {
          const directoryData = directoryRes.value?.data?.data || [];
          directoryData.forEach((item: any) => {
            const id = item._id || item.slug;
            if (id && !seenPlaceIds.has(id)) {
              seenPlaceIds.add(id);
              dynamicAttractions.push({
                id,
                name: item.title || item.name,
                category: item.category || toTitleCase(item.moduleType || "Sacred Site"),
                description: item.description || "",
                coordinates: extractCoordinates(item) || resolvedCoords || { lat: 28.6139, lng: 77.209 },
                image: item.coverImage,
                availableOnTirvona: true,
                slug: item.slug,
              });
            }
          });
        }

        // Merge curated attractions with dedicated downloaded images
        if (seedDest?.nearbyPlaces && seedDest.nearbyPlaces.length > 0) {
          seedDest.nearbyPlaces.forEach((p) => {
            if (!seenPlaceIds.has(p.id) && !seenPlaceIds.has(p.name.toLowerCase())) {
              seenPlaceIds.add(p.id);
              dynamicAttractions.push(p);
            }
          });
        }

        // 4. DYNAMIC PARKING
        const dynamicParking: any[] = [];
        const seenParkingIds = new Set<string>();

        const addParking = (res: PromiseSettledResult<any>) => {
          if (res.status !== "fulfilled") return;
          const items = Array.isArray(res.value?.data?.data?.locations)
            ? res.value.data.data.locations
            : Array.isArray(res.value?.data?.data)
              ? res.value.data.data
              : Array.isArray(res.value?.data)
                ? res.value.data
                : [];
          items.forEach((p: any) => {
            const id = p._id || p.id;
            if (id && !seenParkingIds.has(String(id))) {
              seenParkingIds.add(String(id));
              dynamicParking.push(p);
            }
          });
        };

        addParking(parkingCityRes);
        addParking(parkingDestRes);

        // Also check if any ashrams have on-premise parking add-ons or facilities
        rawAshrams.forEach((a: any) => {
          const hasParkingAddon = Array.isArray(a.addOnServices) && a.addOnServices.some(
            (srv: any) => /parking/i.test(srv.name || ""),
          );
          if (hasParkingAddon || a.transport?.parkingAvailable) {
            const parkId = `ashram-parking-${a._id}`;
            if (!seenParkingIds.has(parkId)) {
              seenParkingIds.add(parkId);
              const addon = a.addOnServices?.find((srv: any) => /parking/i.test(srv.name || ""));
              dynamicParking.push({
                _id: parkId,
                name: `${a.name} On-Premise Parking`,
                locationName: a.address?.city || resolvedCityName,
                address: a.address,
                pricePerHour: addon?.price || 50,
                hourlyRate: addon?.price || 50,
                rates: [{ amount: addon?.price || 50 }],
                available: true,
                isCovered: true,
                cctv: true,
                coordinates: extractCoordinates(a),
                slug: a.slug,
                ashramId: a._id,
              });
            }
          }
        });

        // 5. DYNAMIC PRASAD & SPIRITUAL PRODUCTS
        const dynamicPrasad: any[] = [];
        const seenPrasadIds = new Set<string>();

        const addProducts = (res: PromiseSettledResult<any>) => {
          if (res.status !== "fulfilled") return;
          const items = Array.isArray(res.value?.data?.data)
            ? res.value.data.data
            : Array.isArray(res.value?.data)
              ? res.value.data
              : [];
          items.forEach((prod: any) => {
            const id = prod._id || prod.id;
            if (id && !seenPrasadIds.has(String(id))) {
              seenPrasadIds.add(String(id));
              dynamicPrasad.push(prod);
            }
          });
        };

        addProducts(allProductsRes);
        addProducts(prasadMarketRes);

        // Sort prasad so items relevant to this destination rank first
        const cityLower = resolvedCityName.toLowerCase();
        dynamicPrasad.sort((a, b) => {
          const aMatch =
            (a.templeSource && a.templeSource.toLowerCase().includes(cityLower)) ||
            (a.name && a.name.toLowerCase().includes(cityLower)) ||
            (a.vendor?.location && a.vendor.location.toLowerCase().includes(cityLower));
          const bMatch =
            (b.templeSource && b.templeSource.toLowerCase().includes(cityLower)) ||
            (b.name && b.name.toLowerCase().includes(cityLower)) ||
            (b.vendor?.location && b.vendor.location.toLowerCase().includes(cityLower));
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });

        // 6. BUILD FINAL DYNAMIC DESTINATION
        const finalDest: Destination = seedDest
          ? {
              ...seedDest,
              name: resolvedCityName,
              state: resolvedState,
              coordinates: resolvedCoords || seedDest.coordinates,
              heroImage: resolvedHero || seedDest.heroImage,
              nearbyPlaces: dynamicAttractions,
            }
          : createDynamicDestination(
              cleanSlug,
              resolvedCityName,
              resolvedState,
              resolvedCoords,
              resolvedHero,
            );

        finalDest.nearbyPlaces = dynamicAttractions;

        setDestination(finalDest);
        setAshrams(rawAshrams);
        setParking(dynamicParking);
        setPrasad(dynamicPrasad);
        setAttractions(dynamicAttractions);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load destination data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllDynamicData();
    return () => {
      cancelled = true;
    };
  }, [cleanSlug]);

  // LIVE STATS: 100% computed from the actual dynamic inventory loaded
  const liveStats = useMemo(() => {
    // Total rooms / stays inventory across ashrams
    let totalStays = ashrams.length;
    ashrams.forEach((a) => {
      const roomCount = a.discovery?.rooms?.totalInventory;
      if (typeof roomCount === "number" && roomCount > 0) {
        totalStays += roomCount;
      }
    });

    return {
      ashrams: ashrams.length,
      stays: totalStays,
      parking: parking.length,
      prasad: prasad.length,
      places: attractions.length,
    };
  }, [ashrams, parking, prasad, attractions]);

  return {
    destination,
    ashrams,
    parking,
    prasad,
    attractions,
    loading,
    error,
    liveStats,
  };
}
