/**
 * Geo support for the three nearby-search paths ($geoNear in ashrams and
 * parking, $nearSphere in temples). MongoDB computes 2dsphere distances on a
 * sphere of radius 6378100 m; the same formula is used here.
 */
const EARTH_RADIUS_M = 6378100;

export type LngLat = [number, number];

export function pointOf(value: unknown): LngLat | null {
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value[0], value[1]];
  }
  if (value && typeof value === "object") {
    const v = value as { type?: unknown; coordinates?: unknown; lng?: unknown; lat?: unknown; lon?: unknown };
    if (v.type === "Point" && Array.isArray(v.coordinates)) return pointOf(v.coordinates);
    const lng = typeof v.lng === "number" ? v.lng : typeof v.lon === "number" ? v.lon : undefined;
    if (lng !== undefined && typeof v.lat === "number") return [lng, v.lat];
  }
  return null;
}

export function distanceMeters(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function getPath(doc: unknown, path: string): unknown {
  let cur: unknown = doc;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setPath(doc: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = doc;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] == null || typeof cur[part] !== "object") cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export interface NearQuery {
  field: string;
  point: LngLat;
  maxDistance?: number;
  minDistance?: number;
}

/**
 * Removes a top-level { field: { $near | $nearSphere } } condition from a
 * filter and returns it, or null if the filter has none.
 */
export function extractNear(filter: Record<string, unknown> | undefined): { near: NearQuery; rest: Record<string, unknown> } | null {
  if (!filter) return null;
  for (const [field, cond] of Object.entries(filter)) {
    if (!cond || typeof cond !== "object" || Array.isArray(cond)) continue;
    const c = cond as Record<string, any>;
    const op = c.$nearSphere ?? c.$near;
    if (op === undefined) continue;
    const geometry = op?.$geometry ?? op;
    const point = pointOf(geometry);
    if (!point) throw new Error(`Unsupported $near specification on ${field}`);
    const isGeoJson = op?.$geometry !== undefined;
    // Legacy coordinate pairs express $nearSphere distances in radians.
    const scale = isGeoJson ? 1 : c.$nearSphere !== undefined ? EARTH_RADIUS_M : 1;
    const maxDistance = op?.$maxDistance ?? c.$maxDistance;
    const minDistance = op?.$minDistance ?? c.$minDistance;
    const rest = { ...filter };
    delete rest[field];
    return {
      near: {
        field,
        point,
        maxDistance: typeof maxDistance === "number" ? maxDistance * scale : undefined,
        minDistance: typeof minDistance === "number" ? minDistance * scale : undefined,
      },
      rest,
    };
  }
  return null;
}

/** Filters and orders documents by distance; returns [doc, distance] pairs. */
export function applyNear<T>(docs: T[], near: NearQuery): Array<[T, number]> {
  const out: Array<[T, number]> = [];
  for (const doc of docs) {
    const p = pointOf(getPath(doc, near.field));
    if (!p) continue;
    const d = distanceMeters(near.point, p);
    if (near.maxDistance !== undefined && d > near.maxDistance) continue;
    if (near.minDistance !== undefined && d < near.minDistance) continue;
    out.push([doc, d]);
  }
  out.sort((a, b) => a[1] - b[1]);
  return out;
}
