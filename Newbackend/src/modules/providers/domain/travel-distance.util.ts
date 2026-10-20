/**
 * Geocoding and route distance utilities for Pandit travel validation.
 * Supports Haversine distance, canonical coordinate resolution,
 * and morning/evening shift eligibility with a 50 km travel radius.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ServiceLocationPoint {
  city?: string;
  state?: string;
  line1?: string;
  pincode?: string;
  coordinates?: {
    coordinates?: [number, number]; // [lng, lat]
    lat?: number;
    lng?: number;
  };
  lat?: number;
  lng?: number;
}

/**
 * Known holy pilgrimage cities, temple hubs and NCR regions.
 * Coordinates verified against official district centroids / municipal coordinates.
 */
export const PILGRIMAGE_CITY_COORDINATES: Record<string, GeoPoint> = {
  // NCR & UP Western Corridor
  noida: { lat: 28.5355, lng: 77.391 },
  "greater noida": { lat: 28.4744, lng: 77.504 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  "delhi ncr": { lat: 28.6139, lng: 77.209 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  meerut: { lat: 28.9845, lng: 77.7064 },
  aligarh: { lat: 27.8974, lng: 78.088 },
  agra: { lat: 27.1767, lng: 78.0081 },

  // Braj Bhumi
  mathura: { lat: 27.4924, lng: 77.6737 },
  vrindavan: { lat: 27.5806, lng: 77.7007 },
  govardhan: { lat: 27.4967, lng: 77.4667 },
  barsana: { lat: 27.6478, lng: 77.3758 },
  nandgaon: { lat: 27.7167, lng: 77.3833 },
  gokul: { lat: 27.4419, lng: 77.7214 },

  // Uttarakhand Char Dham & Foothills
  haridwar: { lat: 29.9457, lng: 78.1642 },
  rishikesh: { lat: 30.0869, lng: 78.2676 },
  dehradun: { lat: 30.3165, lng: 78.0322 },

  // Uttar Pradesh Major Pilgrimages
  ayodhya: { lat: 26.7922, lng: 82.1998 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  kashi: { lat: 25.3176, lng: 82.9739 },
  prayagraj: { lat: 25.4358, lng: 81.8463 },
  allahabad: { lat: 25.4358, lng: 81.8463 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  chitrakoot: { lat: 25.1767, lng: 80.8719 },
  naimisharanya: { lat: 27.352, lng: 80.485 },

  // Madhya Pradesh
  ujjain: { lat: 23.1765, lng: 75.7885 },
  omkareshwar: { lat: 22.2458, lng: 76.1517 },
  indore: { lat: 22.7196, lng: 75.8577 },

  // Gujarat
  dwarka: { lat: 22.2442, lng: 68.9685 },
  somnath: { lat: 20.888, lng: 70.401 },

  // Maharashtra
  nashik: { lat: 19.9975, lng: 73.7898 },
  trimbakeshwar: { lat: 19.9381, lng: 73.5303 },
  shirdi: { lat: 19.7667, lng: 74.4764 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },

  // Rajasthan
  pushkar: { lat: 26.4897, lng: 74.5511 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  khatu: { lat: 27.3995, lng: 75.3129 },
  salasar: { lat: 27.7167, lng: 74.7167 },

  // South India
  tirupati: { lat: 13.6288, lng: 79.4192 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  rameswaram: { lat: 9.2876, lng: 79.3129 },
  puri: { lat: 19.8135, lng: 85.8312 },
};

/**
 * Calculates Great-Circle / Haversine distance in kilometres between two coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const radians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusKm = 6371;
  return Math.round(earthRadiusKm * c * 10) / 10;
}

const isValidCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Resolves a GeoPoint from structured location data or a city name.
 */
export function resolveLocationPoint(
  location?: ServiceLocationPoint | string | null,
): GeoPoint | null {
  if (!location) return null;

  if (typeof location === "string") {
    const key = location.trim().toLowerCase();
    return PILGRIMAGE_CITY_COORDINATES[key] ?? null;
  }

  // Check explicit lat/lng properties
  // A coordinate that is not on Earth is a data error: it is skipped (falling back to the city), never turned into a distance.
  if (
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    isValidCoordinate(location.lat, location.lng)
  ) {
    return { lat: location.lat, lng: location.lng };
  }

  // Check GeoJSON coordinates [lng, lat]
  const coords = location.coordinates?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (typeof lat === "number" && typeof lng === "number" && isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  if (
    typeof location.coordinates?.lat === "number" &&
    typeof location.coordinates?.lng === "number"
  ) {
    const { lat, lng } = location.coordinates;
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  // Fallback to city lookup
  if (location.city) {
    const cityKey = location.city.trim().toLowerCase();
    if (PILGRIMAGE_CITY_COORDINATES[cityKey]) {
      return PILGRIMAGE_CITY_COORDINATES[cityKey];
    }
    // Substring match e.g. "Noida Sector 62" -> "noida"
    for (const [knownCity, pt] of Object.entries(PILGRIMAGE_CITY_COORDINATES)) {
      if (cityKey.includes(knownCity) || knownCity.includes(cityKey)) {
        return pt;
      }
    }
  }

  return null;
}

/**
 * Evaluates whether two service locations are within a specified maximum travel radius.
 * Default is 50 km per the Tirvona Pandit Booking Specification.
 */
export function validateTravelDistance(
  fromLocation: ServiceLocationPoint | string | null | undefined,
  toLocation: ServiceLocationPoint | string | null | undefined,
  maxDistanceKm = 50,
): { valid: boolean; distanceKm: number | null; reason?: string } {
  const pt1 = resolveLocationPoint(fromLocation);
  const pt2 = resolveLocationPoint(toLocation);

  if (!pt1 || !pt2) {
    // If locations cannot be geocoded, we cannot reliably assert they are within 50km
    return {
      valid: false,
      distanceKm: null,
      reason:
        "Unable to determine the straight-line distance between locations with required confidence.",
    };
  }

  const distanceKm = haversineDistanceKm(pt1.lat, pt1.lng, pt2.lat, pt2.lng);

  if (distanceKm > maxDistanceKm) {
    return {
      valid: false,
      distanceKm,
      reason: `Location is ${distanceKm} km away in a straight line, not road distance, exceeding the maximum allowed travel radius of ${maxDistanceKm} km (straight-line distance).`,
    };
  }

  return {
    valid: true,
    distanceKm,
  };
}

/**
 * Validates travel time and buffers between consecutive same-day services.
 * Assumes average road speed of 35 km/h for buffer calculations plus 45 mins ritual prep.
 */
export function validateShiftTravelFeasibility(params: {
  priorEndAt: Date;
  newStartAt: Date;
  priorLocation?: ServiceLocationPoint | null;
  newLocation?: ServiceLocationPoint | null;
  maxRadiusKm?: number;
}): { feasible: boolean; distanceKm: number | null; requiredBufferMinutes: number; reason?: string } {
  const {
    priorEndAt,
    newStartAt,
    priorLocation,
    newLocation,
    maxRadiusKm = 50,
  } = params;

  const distanceCheck = validateTravelDistance(
    priorLocation,
    newLocation,
    maxRadiusKm,
  );

  if (!distanceCheck.valid) {
    return {
      feasible: false,
      distanceKm: distanceCheck.distanceKm,
      requiredBufferMinutes: 0,
      reason: distanceCheck.reason,
    };
  }

  const distanceKm = distanceCheck.distanceKm ?? 0;
  // Estimate transit time: ~35 km/h in Indian pilgrimage city corridors + 45 min prep buffer
  const transitMinutes = Math.round((distanceKm / 35) * 60);
  const prepBufferMinutes = 45;
  const totalRequiredBuffer = transitMinutes + prepBufferMinutes;

  const availableBufferMs = newStartAt.getTime() - priorEndAt.getTime();
  const availableBufferMinutes = Math.floor(availableBufferMs / 60_000);

  if (availableBufferMinutes < totalRequiredBuffer) {
    return {
      feasible: false,
      distanceKm,
      requiredBufferMinutes: totalRequiredBuffer,
      reason: `Insufficient buffer time (${availableBufferMinutes} min available, ${totalRequiredBuffer} min required for ${distanceKm} km (straight-line) travel & preparation).`,
    };
  }

  return {
    feasible: true,
    distanceKm,
    requiredBufferMinutes: totalRequiredBuffer,
  };
}
