/**
 * Public URLs are built from these slugs, so they must be stable, lowercase and
 * free of anything that would need escaping. Database ids stay internal.
 */

const DIACRITICS = /[̀-ͯ]/g;

export const slugify = (value: string): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

export const citySlug = (value: string): string => slugify(value);

/**
 * Reserved words would collide with real routes if an entity ever slugged to
 * them, e.g. an ashram literally named "Book".
 */
export const RESERVED_SLUGS = new Set([
  "book",
  "booking",
  "bookings",
  "search",
  "admin",
  "api",
  "new",
  "edit",
  "create",
  "parking",
  "aarti",
  "pooja",
  "marketplace",
  "destinations",
  "ashrams",
  "profile",
  "login",
  "register",
]);

export interface UniqueSlugOptions {
  /** Returns true when the candidate is already taken within the same scope. */
  exists: (candidate: string) => Promise<boolean>;
  /** Hard cap so a pathological input cannot loop forever. */
  maxAttempts?: number;
  fallback?: string;
}

/**
 * Produces the cleanest slug that is free within its scope: "saptrishi-ashram"
 * first, then "-2", "-3" and so on. Callers scope `exists` to a single city so
 * the same name in another city keeps the clean form.
 */
export const uniqueSlug = async (
  source: string,
  { exists, maxAttempts = 50, fallback = "listing" }: UniqueSlugOptions,
): Promise<string> => {
  const base = slugify(source) || fallback;
  const seed = RESERVED_SLUGS.has(base) ? `${base}-listing` : base;

  if (!(await exists(seed))) return seed;

  for (let counter = 2; counter <= maxAttempts; counter += 1) {
    const candidate = `${seed}-${counter}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${seed}-${Date.now().toString(36)}`;
};
