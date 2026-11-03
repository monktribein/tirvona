/**
 * Tirvona public route SEO policy — the single contract for canonical URLs,
 * indexing and static page metadata.
 *
 * Two byte-identical copies exist on purpose:
 *   frontend/src/seo/routePolicy.ts                      (browser, after hydration)
 *   Newbackend/src/modules/seo/domain/seo-route-policy.ts (server-rendered HTML)
 * so the first HTML a crawler receives and the page React later shows agree.
 * `seo-route-policy.spec.ts` fails if the two copies drift. Edit both together.
 *
 * Pure data and functions only: no imports, no DOM, no Node APIs.
 */

export const SITE_ORIGIN = "https://www.tirvona.com";
export const SITE_NAME = "Tirvona";
export const TITLE_SUFFIX = " · Tirvona";
export const DEFAULT_TITLE = "Tirvona - Spiritual Stays & Verified Vedic Pandits";
export const DEFAULT_DESCRIPTION =
  "Tirvona - Spiritual Stays, Verified Vedic Pandits & Purohits, Temple Poojas, and Sacred Pilgrimages across India.";

export const ROBOTS_INDEX = "index,follow";
/** Public utility pages (login, search, checkout steps): keep links crawlable. */
export const ROBOTS_NOINDEX_FOLLOW = "noindex,follow";
/** Signed-in dashboards and personal pages. */
export const ROBOTS_PRIVATE = "noindex,nofollow";

export type SeoEntityKind =
  | "ashram"
  | "ashramCity"
  | "temple"
  | "pandit"
  | "product"
  | "marketplaceCategory"
  | "marketplaceStore"
  | "event"
  | "circuit"
  | "destination"
  | "blog"
  | "aarti"
  | "parking"
  | "volunteerJob";

export interface StaticPageSeo {
  title: string;
  description: string;
  h1: string;
  /** Hub pages list this entity type in their server-rendered HTML. */
  lists?: SeoEntityKind;
  /** The React page renders its own JSON-LD, so the server copy is dropped after hydration. */
  clientJsonLd?: boolean;
  /** Pages that are public but should not be indexed. */
  robots?: string;
}

export type RouteMatch =
  | { kind: "static"; canonicalPath: string; page: StaticPageSeo }
  | { kind: "entity"; entity: SeoEntityKind; params: Record<string, string>; robots?: string }
  | { kind: "redirect"; location: string }
  | { kind: "private"; robots: string }
  | { kind: "utility"; robots: string; title: string }
  | { kind: "section"; title: string; canonicalPath: string }
  | { kind: "unknown" };

const page = (
  title: string,
  description: string,
  h1: string,
  extra: Partial<StaticPageSeo> = {},
): StaticPageSeo => ({ title, description, h1, ...extra });

/** Indexable static and hub pages, keyed by their canonical path. */
export const STATIC_PAGES: Record<string, StaticPageSeo> = {
  "/": page(
    DEFAULT_TITLE,
    "Book verified ashram and dharamshala stays, Vedic pandits and purohits, temple aarti, pilgrimage circuits and sacred products across India on Tirvona.",
    "Stay, pray, eat and give seva",
  ),
  "/ashrams": page(
    "Ashram & Dharamshala Stays in India · Tirvona",
    "Search verified ashram, dharamshala and hotel stays in holy cities across India. Compare rooms, tariffs and availability, and book online on Tirvona.",
    "Ashram & Dharamshala Stays",
    { lists: "ashram" },
  ),
  "/ashrams/vrindavan": page(
    "Hotels & Stays in Vrindavan | Tirvona",
    "Find hotels and stays in Vrindavan. Compare locations, prices, amenities and available rooms on Tirvona.",
    "Stays in Vrindavan",
    { clientJsonLd: true },
  ),
  "/stays-near-banke-bihari-vrindavan": page(
    "Hotels Near Banke Bihari Temple Vrindavan | Tirvona",
    "Find hotels and stays near Banke Bihari Temple, Vrindavan. Compare prices, location, amenities and available rooms on Tirvona.",
    "Stays Near Banke Bihari Temple, Vrindavan",
    { clientJsonLd: true },
  ),
  "/stays-near-prem-mandir-vrindavan": page(
    "Hotels Near Prem Mandir Vrindavan | Tirvona",
    "Find hotels and stays near Prem Mandir, Vrindavan. Compare locations, prices, amenities and available stays on Tirvona.",
    "Stays Near Prem Mandir, Vrindavan",
    { clientJsonLd: true },
  ),
  "/stays-near-iskcon-vrindavan": page(
    "Hotels Near ISKCON Vrindavan Temple | Tirvona",
    "Find hotels and stays near ISKCON Vrindavan Temple. Compare prices, location, amenities and available rooms on Tirvona.",
    "Stays Near ISKCON Vrindavan",
    { clientJsonLd: true },
  ),
  "/budget-stays-in-vrindavan": page(
    "Budget Hotels & Stays in Vrindavan | Tirvona",
    "Find budget hotels and stays in Vrindavan. Compare affordable options by price, location, amenities and availability on Tirvona.",
    "Budget Stays in Vrindavan",
    { clientJsonLd: true },
  ),
  "/family-stays-in-vrindavan": page(
    "Family Hotels & Stays in Vrindavan | Tirvona",
    "Find family-friendly hotels and stays in Vrindavan. Compare rooms, prices, locations, amenities and availability on Tirvona.",
    "Family Stays in Vrindavan",
    { clientJsonLd: true },
  ),
  "/temples": page(
    "Temples in India — Timings, Darshan & Visitor Guide · Tirvona",
    "Explore temples across India with darshan timings, aarti schedules, visitor information and directions, and find stays nearby on Tirvona.",
    "Temples",
    { lists: "temple" },
  ),
  "/pandits": page(
    "Book Verified Pandits & Purohits · Tirvona",
    "Find verified pandits, purohits, acharyas and jyotishis for pujas, ceremonies and consultations. Compare languages, traditions and service cities on Tirvona.",
    "Verified Pandits & Purohits",
    { lists: "pandit" },
  ),
  "/marketplace": page(
    "Tirvona Marketplace — Puja Items, Prasad & Spiritual Products",
    "Shop puja items, prasad, books, handicrafts and spiritual products from verified sellers on the Tirvona Marketplace.",
    "Tirvona Marketplace",
    { lists: "product" },
  ),
  "/marketplace/categories": page(
    "Marketplace Categories · Tirvona",
    "Browse every Tirvona Marketplace category: puja items, prasad, books, handicrafts and more from verified sellers.",
    "Marketplace categories",
    { lists: "marketplaceCategory" },
  ),
  "/food": page(
    "Sattvic Food & Restaurants Near Holy Places · Tirvona",
    "Order sattvic and vegetarian food from restaurants near temples and holy places, with live order tracking on Tirvona.",
    "Food & Restaurants",
  ),
  "/events": page(
    "Spiritual Events & Sacred Festivals · Tirvona",
    "Discover upcoming spiritual events, kathas and sacred festivals at ashrams and temples, with dates, venues and registration on Tirvona.",
    "Events & Sacred Festivals",
    { lists: "event" },
  ),
  "/pilgrimage-circuits": page(
    "Pilgrimage Circuits & Yatra Routes · Tirvona",
    "Plan pilgrimage circuits and yatra routes across India with stops, durations, distances and the best seasons to travel on Tirvona.",
    "Pilgrimage Circuits",
    { lists: "circuit" },
  ),
  "/blog": page(
    "Sacred Articles & Knowledge Hub · Tirvona",
    "Read articles and watch videos on temples, festivals, rituals, pilgrimage planning and spiritual travel from the Tirvona knowledge hub.",
    "Sacred Articles & Knowledge Hub",
    { lists: "blog" },
  ),
  "/aarti": page(
    "Temple Aarti Booking & Live Darshan · Tirvona",
    "Book participation in temple and ashram aarti, see aarti timings and watch live darshan on Tirvona.",
    "Aarti",
    { lists: "aarti" },
  ),
  "/live-pooja": page(
    "Live Pooja & Online Darshan · Tirvona",
    "Watch live pooja and online darshan from temples and ashrams on Tirvona.",
    "Live Pooja",
  ),
  "/parking": page(
    "Parking Near Temples & Ashrams · Tirvona",
    "Find and book parking near temples, ashrams and holy places on Tirvona.",
    "Parking",
    { lists: "parking" },
  ),
  "/offers": page(
    "Offers & Deals on Spiritual Stays · Tirvona",
    "Current offers and promo codes on ashram stays and services booked through Tirvona.",
    "Offers",
  ),
  "/volunteer": page(
    "Volunteer & Seva Opportunities · Tirvona",
    "Find volunteer and seva opportunities at ashrams, temples and spiritual organisations, and apply online on Tirvona.",
    "Volunteer & Seva",
    { lists: "volunteerJob" },
  ),
  "/local": page(
    "Local Services Near Holy Places · Tirvona",
    "Find local services near temples and holy places, including guides, transport and shops, on Tirvona.",
    "Local Services",
  ),
  "/services": page(
    "Spiritual Services · Tirvona",
    "Explore the spiritual services available on Tirvona: stays, pandits, aarti, events, food, parking and pilgrimage planning.",
    "Services",
  ),
  "/travel-guides": page("Travel Guides · Tirvona", "Travel guides for holy cities and pilgrimage destinations, listed on Tirvona.", "Travel Guides"),
  "/local-guides": page("Local Guides · Tirvona", "Local guides for temples and holy places, listed on Tirvona.", "Local Guides"),
  "/transport": page("Transport · Tirvona", "Transport options for pilgrims at holy cities, listed on Tirvona.", "Transport"),
  "/shops": page("Shops · Tirvona", "Shops near temples and holy places, listed on Tirvona.", "Shops"),
  "/puja-items": page("Puja Items · Tirvona", "Puja items and samagri sellers listed on Tirvona.", "Puja Items"),
  "/religious-products": page("Religious Products · Tirvona", "Religious products and sellers listed on Tirvona.", "Religious Products"),
  "/books": page("Spiritual Books · Tirvona", "Spiritual and religious book sellers listed on Tirvona.", "Books"),
  "/handicrafts": page("Handicrafts · Tirvona", "Religious handicrafts and artisans listed on Tirvona.", "Handicrafts"),
  // Matches what AboutPage writes after it mounts.
  "/about": page(
    "About Tirvona | India's Digital Platform for Religious Destinations",
    "Tirvona connects pilgrims with verified stays, local services, and sacred marketplaces across India's holy destinations.",
    "About Tirvona",
  ),
  "/contact": page("Contact Tirvona", "Contact the Tirvona team for help with bookings, partnerships or listing your ashram, temple or service.", "Contact Us"),
  "/faq": page("Frequently Asked Questions · Tirvona", "Answers to common questions about booking stays, pandits, payments, cancellations and refunds on Tirvona.", "Frequently Asked Questions"),
  "/help": page("Help Center · Tirvona", "Get help with bookings, payments, cancellations, refunds and your Tirvona account.", "Help Center"),
  "/partner": page("Partner with Tirvona", "List your ashram, dharamshala, temple service or business on Tirvona and reach pilgrims across India.", "Partner with Tirvona"),
  "/press": page("Press · Tirvona", "Press information and media resources about Tirvona.", "Press"),
  "/owner-guide": page("Owner Guide · Tirvona", "A guide for ashram and stay owners to list, manage and grow their property on Tirvona.", "Owner Guide"),
  "/terms": page("Terms of Service · Tirvona", "The terms and conditions that apply when you use Tirvona.", "Terms of Service"),
  "/privacy": page("Privacy Policy · Tirvona", "How Tirvona collects, uses and protects your personal information.", "Privacy Policy"),
  "/privacy/delete-account": page("Delete your Tirvona account | Tirvona", "How to request deletion of your Tirvona account and associated data.", "Delete Your Account"),
  "/refund-policy": page("Refund Policy · Tirvona", "How refunds work for bookings and orders made on Tirvona.", "Refund Policy"),
  "/cancellation-policy": page("Cancellation Policy · Tirvona", "Cancellation rules for stays, services and orders booked on Tirvona.", "Cancellation Policy"),
  "/stay-policies": page("Stay Policies · Tirvona", "Check-in, check-out, identity and conduct policies for stays booked on Tirvona.", "Stay Policies"),
  "/govt-guidelines": page("Government Guidelines for Pilgrims · Tirvona", "Government guidelines that apply to pilgrim accommodation and stays booked on Tirvona.", "Government Guidelines"),
  "/cookie-policy": page("Cookie Policy · Tirvona", "How Tirvona uses cookies and similar technologies.", "Cookie Policy"),
};

/**
 * Exact aliases: the same page reachable at more than one URL. The key renders
 * normally (no redirect, so existing links keep working) but declares the value
 * as its canonical URL.
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  "/public": "/",
  "/stays": "/ashrams",
  "/stays-in-vrindavan": "/ashrams/vrindavan",
  "/pandit": "/pandits",
  "/pandit/explore": "/pandits",
  "/providers": "/pandits",
  "/restaurants": "/food",
  "/circuits": "/pilgrimage-circuits",
  "/destinations": "/pilgrimage-circuits",
  "/careers": "/volunteer",
};

/** Exact paths that permanently moved: the server answers 301. */
export const PERMANENT_REDIRECTS: Record<string, string> = {
  "/Stays-near-prem-mandir-vrindavan": "/stays-near-prem-mandir-vrindavan",
  "/delete-account": "/privacy/delete-account",
};

/** Signed-in areas. Matched on whole path segments. */
export const PRIVATE_PREFIXES: string[] = [
  "/admin",
  "/ashram-admin",
  "/ashram-owner",
  "/owner",
  "/staff",
  "/stay-admin",
  "/stay-owner",
  "/temple-owner",
  "/profile",
  "/support",
  "/dashboard",
  "/wallet",
  "/vendor",
  "/restaurant",
  "/booking",
  "/food/orders",
  "/food/vendor",
  "/parking/my-bookings",
  "/parking/dashboard",
  "/parking/staff",
  "/parking/gate",
  "/parking/partner",
  "/parking/booking",
  "/parking/pay",
  "/aarti/booking",
  "/aarti/gate",
  "/events/gate",
  "/events/pass",
  "/pandit/dashboard",
  "/pandit/availability",
  "/pandit/offerings",
  "/pandit/profile",
  "/pandit/verification",
  "/provider",
];

/** Public utility pages: reachable without signing in, but not search landing pages. */
export const UTILITY_PAGES: Record<string, string> = {
  "/login": "Sign In · Tirvona",
  "/register": "Create an Account · Tirvona",
  "/reset-password": "Reset Password · Tirvona",
  "/search": "Search · Tirvona",
  "/destinations/planner": "Itinerary Planner · Tirvona",
  "/marketplace/checkout": "Checkout · Tirvona",
  "/aarti/checkout": "Checkout · Tirvona",
  "/parking/checkout": "Checkout · Tirvona",
};

/**
 * Public dynamic routes that do not yet have entity-aware metadata. They keep
 * a self canonical and a section title but are left out of the sitemap.
 */
const SECTION_PATTERNS: Array<[RegExp, string]> = [
  [/^\/aarti\/[^/]+\/[^/]+$/, "Aarti"],
  [/^\/pooja\/[^/]+\/[^/]+$/, "Pooja"],
  [/^\/parking\/[^/]+\/[^/]+$/, "Parking"],
  [/^\/offers\/(category|city)\/[^/]+$/, "Offers"],
  [/^\/offers\/[^/]+$/, "Offer"],
  [/^\/featured-banner\/[^/]+$/, "Featured"],
];

const SEGMENT = "([^/]+)";

const ENTITY_PATTERNS: Array<{
  re: RegExp;
  entity: SeoEntityKind;
  keys: string[];
  robots?: string;
}> = [
  { re: new RegExp(`^/ashrams/${SEGMENT}/${SEGMENT}/book$`), entity: "ashram", keys: ["city", "slug"], robots: ROBOTS_NOINDEX_FOLLOW },
  { re: new RegExp(`^/ashrams/${SEGMENT}/${SEGMENT}$`), entity: "ashram", keys: ["city", "slug"] },
  { re: new RegExp(`^/(?:ashram|stay)/${SEGMENT}$`), entity: "ashram", keys: ["slug"] },
  { re: new RegExp(`^/ashrams/${SEGMENT}$`), entity: "ashramCity", keys: ["city"] },
  { re: new RegExp(`^/temples/${SEGMENT}$`), entity: "temple", keys: ["slug"] },
  { re: new RegExp(`^/(?:pandit|provider)/${SEGMENT}$`), entity: "pandit", keys: ["slug"] },
  { re: new RegExp(`^/marketplace/products?/${SEGMENT}$`), entity: "product", keys: ["slug"] },
  { re: new RegExp(`^/marketplace/category/${SEGMENT}$`), entity: "marketplaceCategory", keys: ["slug"] },
  { re: new RegExp(`^/marketplace/store/${SEGMENT}$`), entity: "marketplaceStore", keys: ["slug"] },
  { re: new RegExp(`^/events/${SEGMENT}$`), entity: "event", keys: ["slug"] },
  { re: new RegExp(`^/(?:circuits|pilgrimage-circuits)/${SEGMENT}$`), entity: "circuit", keys: ["slug"] },
  { re: new RegExp(`^/(?:destinations|destination)/${SEGMENT}$`), entity: "destination", keys: ["slug"] },
  { re: new RegExp(`^/blog/${SEGMENT}$`), entity: "blog", keys: ["slug"] },
  { re: new RegExp(`^/video/${SEGMENT}$`), entity: "blog", keys: ["slug"] },
  { re: new RegExp(`^/aarti/${SEGMENT}$`), entity: "aarti", keys: ["slug"] },
  { re: new RegExp(`^/parking/${SEGMENT}$`), entity: "parking", keys: ["slug"] },
  { re: new RegExp(`^/volunteer/(?:job/)?${SEGMENT}$`), entity: "volunteerJob", keys: ["id"] },
];

const underPrefix = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Collapses duplicate slashes and drops a trailing slash. Never changes case. */
export const normalizePath = (pathname: string): string => {
  let path = `/${String(pathname ?? "")}`.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  return path || "/";
};

/** The canonical path for a page path: aliases resolved, query strings never included. */
export const canonicalPathFor = (pathname: string): string => {
  const path = normalizePath(pathname);
  if (PERMANENT_REDIRECTS[path]) return PERMANENT_REDIRECTS[path];
  if (CANONICAL_ALIASES[path]) return CANONICAL_ALIASES[path];
  const provider = /^\/provider\/([^/]+)$/.exec(path);
  if (provider && !isPrivatePath(path)) return `/pandit/${provider[1]}`;
  const circuit = /^\/pilgrimage-circuits\/([^/]+)$/.exec(path);
  if (circuit) return `/circuits/${circuit[1]}`;
  const destination = /^\/destinations\/([^/]+)$/.exec(path);
  if (destination && destination[1] !== "planner") return `/destination/${destination[1]}`;
  const legacyProduct = /^\/marketplace\/product\/([^/]+)$/.exec(path);
  if (legacyProduct) return `/marketplace/products/${legacyProduct[1]}`;
  return path;
};

export const canonicalUrlFor = (pathname: string): string =>
  `${SITE_ORIGIN}${canonicalPathFor(pathname)}`;

/** True for paths that must never be indexed. `/provider/:id` public profiles are excluded. */
export const isPrivatePath = (pathname: string): boolean => {
  const path = normalizePath(pathname);
  if (/^\/provider\/[^/]+$/.test(path)) {
    const segment = path.split("/")[2];
    return [
      "dashboard",
      "availability",
      "bookings",
      "offerings",
      "profile",
      "verification",
      "wallet",
    ].includes(segment);
  }
  return PRIVATE_PREFIXES.some((prefix) => underPrefix(path, prefix));
};

/** The robots directive the page should carry, or null for an entity page that decides for itself. */
export const robotsFor = (pathname: string): string => {
  const match = classifyPath(pathname);
  if (match.kind === "private") return match.robots;
  if (match.kind === "utility") return match.robots;
  if (match.kind === "unknown") return ROBOTS_NOINDEX_FOLLOW;
  if (match.kind === "static") return match.page.robots ?? ROBOTS_INDEX;
  if (match.kind === "entity") return match.robots ?? ROBOTS_INDEX;
  return ROBOTS_INDEX;
};

/** Classifies a path the browser or crawler asked for. Order matters: private before public. */
export const classifyPath = (pathname: string): RouteMatch => {
  const path = normalizePath(pathname);
  if (PERMANENT_REDIRECTS[path]) return { kind: "redirect", location: PERMANENT_REDIRECTS[path] };
  if (UTILITY_PAGES[path] || /^\/reset-password\/[^/]+$/.test(path)) {
    return {
      kind: "utility",
      robots: ROBOTS_NOINDEX_FOLLOW,
      title: UTILITY_PAGES[path] ?? UTILITY_PAGES["/reset-password"],
    };
  }
  if (isPrivatePath(path)) return { kind: "private", robots: ROBOTS_PRIVATE };

  const canonicalPath = canonicalPathFor(path);
  const staticPage = STATIC_PAGES[canonicalPath];
  if (staticPage && (path === canonicalPath || CANONICAL_ALIASES[path])) {
    return { kind: "static", canonicalPath, page: staticPage };
  }

  for (const pattern of ENTITY_PATTERNS) {
    const found = pattern.re.exec(path);
    if (!found) continue;
    const params: Record<string, string> = {};
    pattern.keys.forEach((key, index) => {
      params[key] = safeDecode(found[index + 1]);
    });
    return { kind: "entity", entity: pattern.entity, params, robots: pattern.robots };
  }

  for (const [re, title] of SECTION_PATTERNS) {
    if (re.test(path)) return { kind: "section", title: `${title}${TITLE_SUFFIX}`, canonicalPath: path };
  }
  return { kind: "unknown" };
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** A volunteer job's own description, else its list of responsibilities as sentences. */
export const jobDescriptionText = (j: { description?: string; responsibilities?: string | string[] }): string => {
  if (typeof j.description === "string" && j.description.trim()) return j.description;
  const duties = Array.isArray(j.responsibilities) ? j.responsibilities : [j.responsibilities];
  return duties.filter((d): d is string => typeof d === "string" && d.trim() !== "").map((d) => d.trim().replace(/\.?$/, ".")).join(" ");
};

/** A knowledge-hub post lives at /video/:slug when it is a video, else /blog/:slug (same rule as BlogListPage). */
export const blogPostPath = (p: { slug?: string; contentType?: string; youtubeUrl?: string }): string =>
  `${p.youtubeUrl || p.contentType === "video" ? "/video" : "/blog"}/${p.slug}`;

// ── Entity titles and descriptions: one formula for server and browser ────────

export const toTitleWords = (value: unknown): string =>
  String(value ?? "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Plain-text summary cut on a word boundary near `max` characters. */
export const summarize = (value: unknown, max = 160): string => {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
};

const join = (parts: unknown[], separator = ", "): string =>
  parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(separator);

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  PANDIT: "Pandit",
  PUROHIT: "Purohit",
  ACHARYA: "Acharya",
  VEDIC_SCHOLAR: "Vedic Scholar",
  KATHA_VACHAK: "Katha Vachak",
  JYOTISHI: "Jyotishi",
  PROVIDER_TEAM: "Pandit Team",
};

export const entitySeo = {
  ashram(a: { name?: string; description?: string; address?: { city?: string } }) {
    const city = toTitleWords(a.address?.city);
    const name = String(a.name ?? "").trim();
    return {
      title: `${name}${city ? ` in ${city}` : ""}${TITLE_SUFFIX}`,
      description:
        summarize(a.description) ||
        `Book a stay at ${name}${city ? ` in ${city}` : ""} on Tirvona. See rooms, tariffs, amenities and availability.`,
    };
  },
  ashramCity(citySlug: string) {
    const city = toTitleWords(citySlug);
    return {
      title: `Stays in ${city}${TITLE_SUFFIX}`,
      description: `Book verified stays in ${city}. Compare rooms, tariffs and availability on Tirvona.`,
    };
  },
  temple(t: { name?: string; shortDescription?: string; description?: string; seo?: { seoTitle?: string; seoDescription?: string } }) {
    return {
      title: String(t.seo?.seoTitle || t.name || "").trim(),
      description: summarize(t.seo?.seoDescription || t.shortDescription || t.description),
    };
  },
  pandit(p: { displayName?: string; providerType?: string; bio?: string; homeCity?: string; specializations?: string[]; languages?: string[] }) {
    const role = PROVIDER_TYPE_LABELS[String(p.providerType ?? "")] ?? "Pandit";
    const name = String(p.displayName ?? "").trim();
    const where = String(p.homeCity ?? "").trim();
    const fallback = join(
      [
        `${name} is a verified ${role.toLowerCase()} on Tirvona${where ? ` based in ${where}` : ""}.`,
        p.specializations?.length ? `Services: ${p.specializations.slice(0, 4).join(", ")}.` : "",
        p.languages?.length ? `Languages: ${p.languages.slice(0, 4).join(", ")}.` : "",
      ],
      " ",
    );
    return {
      title: `${name} — ${role}${where ? ` in ${where}` : ""}${TITLE_SUFFIX}`,
      description: summarize(p.bio) || summarize(fallback),
    };
  },
  product(p: { name?: string; description?: string; storeName?: string }) {
    const name = String(p.name ?? "").trim();
    return {
      title: `${name}${TITLE_SUFFIX}`,
      description:
        summarize(p.description) ||
        `Buy ${name}${p.storeName ? ` from ${p.storeName}` : ""} on the Tirvona Marketplace.`,
    };
  },
  marketplaceCategory(c: { name?: string; description?: string }) {
    const name = String(c.name ?? "").trim();
    return {
      title: `${name} — Tirvona Marketplace`,
      description: summarize(c.description) || `Shop ${name} from verified sellers on the Tirvona Marketplace.`,
    };
  },
  marketplaceStore(s: { storeName?: string; description?: string; city?: string }) {
    const name = String(s.storeName ?? "").trim();
    return {
      title: `${name} — Tirvona Marketplace`,
      description:
        summarize(s.description) ||
        `Shop products from ${name}${s.city ? `, ${s.city}` : ""} on the Tirvona Marketplace.`,
    };
  },
  event(e: { name?: string; tagline?: string; description?: string; venue?: { name?: string; city?: string }; startDate?: string | Date }) {
    const name = String(e.name ?? "").trim();
    const city = String(e.venue?.city ?? "").trim();
    return {
      title: `${name}${city ? ` in ${city}` : ""}${TITLE_SUFFIX}`,
      description:
        summarize(e.description || e.tagline) ||
        summarize(`${name}${e.venue?.name ? ` at ${e.venue.name}` : ""}${city ? `, ${city}` : ""}. See dates, schedule and registration on Tirvona.`),
    };
  },
  circuit(c: { name?: string; summary?: string; description?: string; durationDays?: number }) {
    const name = String(c.name ?? "").trim();
    return {
      title: `${name} — Pilgrimage Circuit${TITLE_SUFFIX}`,
      description:
        summarize(c.summary || c.description) ||
        `${name}${c.durationDays ? `: a ${c.durationDays}-day` : ": a"} pilgrimage circuit with stops, distances and travel tips on Tirvona.`,
    };
  },
  destination(citySlug: string) {
    const city = toTitleWords(citySlug);
    return {
      title: `${city} — Stays, Temples & Travel Guide${TITLE_SUFFIX}`,
      description: `Plan a visit to ${city}: verified stays, temples, parking and local services listed on Tirvona.`,
    };
  },
  blog(b: { title?: string; excerpt?: string; content?: string }) {
    return {
      title: `${String(b.title ?? "").trim()}${TITLE_SUFFIX}`,
      description: summarize(b.excerpt || b.content),
    };
  },
  aarti(a: { name?: string; deity?: string; description?: string; venue?: { name?: string; city?: string } }) {
    const name = String(a.name ?? "").trim();
    const place = [a.venue?.name, a.venue?.city].filter(Boolean).join(", ");
    return {
      title: `${name}${place ? ` at ${place}` : ""}${TITLE_SUFFIX}`,
      description:
        summarize(a.description) ||
        `Book participation in ${name}${place ? ` at ${place}` : ""} on Tirvona. See timings, passes and availability.`,
    };
  },
  parking(p: { name?: string; description?: string; address?: { city?: string } }) {
    const name = String(p.name ?? "").trim();
    const city = toTitleWords(p.address?.city);
    return {
      title: `${name}${city ? ` — Parking in ${city}` : " — Parking"}${TITLE_SUFFIX}`,
      description:
        summarize(p.description) ||
        `Book a parking slot at ${name}${city ? ` in ${city}` : ""} on Tirvona. See vehicle types, rates and availability.`,
    };
  },
  volunteerJob(j: { title?: string; ashramName?: string; city?: string; responsibilities?: string | string[]; description?: string }) {
    const title = String(j.title ?? "").trim();
    const where = [j.ashramName, toTitleWords(j.city)].filter(Boolean).join(", ");
    return {
      title: `${title}${where ? ` — ${where}` : ""}${TITLE_SUFFIX}`,
      description:
        summarize(jobDescriptionText(j)) ||
        `Apply for ${title}${where ? ` at ${where}` : ""} on Tirvona.`,
    };
  },
};
