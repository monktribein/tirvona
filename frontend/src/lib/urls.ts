/**
 * Builds public, id-free URLs. Every helper falls back to the legacy id path
 * when an API response has not been widened to include slugs yet — the server
 * 301s those to the canonical URL, so links keep working during the migration.
 */

const clean = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export interface SluggableAshram {
  _id?: string;
  id?: string;
  slug?: string;
  citySlug?: string;
  address?: { city?: string };
}

const cityOf = (ashram: SluggableAshram): string =>
  clean(ashram.citySlug) ||
  clean(ashram.address?.city).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const ashramUrl = (
  ashram: SluggableAshram | null | undefined,
  query = "",
): string => {
  if (!ashram) return "/ashrams";
  const id = ashram._id ?? ashram.id ?? "";
  const slug = clean(ashram.slug);
  const city = cityOf(ashram);
  const path = slug && city ? `/ashrams/${city}/${slug}` : `/ashram/${id}`;
  return query ? `${path}${query.startsWith("?") ? query : `?${query}`}` : path;
};

export const ashramBookUrl = (
  ashram: SluggableAshram | null | undefined,
  query = "",
): string => {
  const base = ashramUrl(ashram);
  const path = base.startsWith("/ashrams/") ? `${base}/book` : base;
  return query ? `${path}${query.startsWith("?") ? query : `?${query}`}` : path;
};

/** Bookings are addressed by their human reference, never the database id. */
export const bookingUrl = (booking: {
  bookingId?: string;
  _id?: string;
  id?: string;
}): string =>
  `/booking/${clean(booking?.bookingId) || booking?._id || booking?.id || ""}`;

export const destinationUrl = (city: string): string =>
  `/destinations/${clean(city).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
