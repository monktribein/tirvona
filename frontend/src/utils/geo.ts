// Shared geo helpers.
//
// Kept out of TirvonaMap.tsx so that file exports only its component — mixing
// component and value exports in one module breaks React Fast Refresh.

/**
 * Whether a coordinate pair is usable on a map.
 *
 * Rejects 0,0 explicitly: "null island" is what an unset or failed geocode
 * looks like, and dropping a pin in the Atlantic is worse than showing none.
 */
export const hasValidCoordinates = (lat?: number | null, lng?: number | null) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

/** Google Maps turn-by-turn link — used to hand a phone over to navigation. */
export const buildDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default { hasValidCoordinates, buildDirectionsUrl };
