// Geo helpers for parking proximity search.

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres between two lat/lng pairs.
 *
 * Used to annotate results with a distance figure after a $geoNear query, and
 * as the fallback ordering when a caller supplies coordinates but the 2dsphere
 * index is unavailable (e.g. a fresh database before the index is built).
 */
export const distanceKm = (lat1, lon1, lat2, lon2) => {
  if (![lat1, lon1, lat2, lon2].every((v) => Number.isFinite(Number(v)))) return null;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return Number((EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))).toFixed(2));
};

/** Both coordinates present and inside the valid ranges. */
export const hasValidCoordinates = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/** Turn-by-turn link for the "Navigate" button on the detail page. */
export const buildGoogleMapsUrl = (lat, lng, label = '') => {
  if (!hasValidCoordinates(lat, lng)) return '';
  const destination = `${lat},${lng}`;
  const query = label ? `&destination_place_id=&query=${encodeURIComponent(label)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${query}`;
};

export default { distanceKm, hasValidCoordinates, buildGoogleMapsUrl };
