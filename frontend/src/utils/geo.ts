
export const hasValidCoordinates = (lat?: number | null, lng?: number | null) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/** Haversine distance between two points in kilometres. */
export const haversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

export const buildDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/**
 * Robustly extracts { lat, lng } from any entity regardless of schema:
 * - entity.latitude / entity.longitude
 * - entity.lat / entity.lng
 * - entity.address?.coordinates?.coordinates [lng, lat]
 * - entity.location?.coordinates [lng, lat]
 * - entity.geo?.coordinates [lng, lat]
 */
export const extractCoordinates = (
  item: any,
): { lat: number; lng: number } | null => {
  if (!item) return null;

  if (hasValidCoordinates(item.latitude, item.longitude)) {
    return { lat: Number(item.latitude), lng: Number(item.longitude) };
  }
  if (hasValidCoordinates(item.lat, item.lng)) {
    return { lat: Number(item.lat), lng: Number(item.lng) };
  }

  const addr = item.address?.coordinates?.coordinates;
  if (Array.isArray(addr) && addr.length >= 2 && hasValidCoordinates(addr[1], addr[0])) {
    return { lat: Number(addr[1]), lng: Number(addr[0]) };
  }

  const loc = item.location?.coordinates;
  if (Array.isArray(loc) && loc.length >= 2 && hasValidCoordinates(loc[1], loc[0])) {
    return { lat: Number(loc[1]), lng: Number(loc[0]) };
  }

  const geo = item.geo?.coordinates;
  if (Array.isArray(geo) && geo.length >= 2 && hasValidCoordinates(geo[1], geo[0])) {
    return { lat: Number(geo[1]), lng: Number(geo[0]) };
  }

  return null;
};

export default {
  hasValidCoordinates,
  haversineDistance,
  buildDirectionsUrl,
  extractCoordinates,
};
