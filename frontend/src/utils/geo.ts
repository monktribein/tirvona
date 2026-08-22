
export const hasValidCoordinates = (lat?: number | null, lng?: number | null) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);

export const buildDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default { hasValidCoordinates, buildDirectionsUrl };
