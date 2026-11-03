/**
 * SEO publishing: editorial overrides for public pages and their review workflow
 * (docs/seo/README.md). Pure rules only — no database, no Nest — so they are unit tested
 * on their own and shared by the service and the DB constraints in migration 0014.
 *
 * A page without a seo_pages row behaves exactly as before: the entity's own status governs
 * visibility and the shared formula builds its title. A row only ever adds overrides.
 */
import type { SeoEntityKind } from "./seo-route-policy";

/** Every entity kind the route policy knows, in the order it declares them. */
export const SEO_ENTITY_PAGE_TYPES = [
  "ashram",
  "ashramCity",
  "temple",
  "pandit",
  "product",
  "marketplaceCategory",
  "marketplaceStore",
  "event",
  "circuit",
  "destination",
  "blog",
  "aarti",
  "parking",
  "volunteerJob",
] as const satisfies readonly SeoEntityKind[];

export const SEO_PAGE_TYPES = ["static", "landing", ...SEO_ENTITY_PAGE_TYPES] as const;
export type SeoPageType = (typeof SEO_PAGE_TYPES)[number];

/** Page types that describe a place or a fixed page rather than one record, so they carry no entity id. */
export const SEO_PAGE_TYPES_WITHOUT_ENTITY: readonly SeoPageType[] = ["static", "landing", "ashramCity", "destination"];

export const SEO_INDEXING_STATUSES = ["index", "noindex"] as const;
export type SeoIndexingStatus = (typeof SEO_INDEXING_STATUSES)[number];

export const SEO_PUBLICATION_STATUSES = ["draft", "in_review", "approved", "published", "retired"] as const;
export type SeoPublicationStatus = (typeof SEO_PUBLICATION_STATUSES)[number];

/**
 * Granted per user by a Super Admin (User Management → permissions); super_admin holds all.
 * Suggested split: writer = edit; fact-checker = verify; SEO lead = approve + publish + retire.
 */
export const SEO_PERMISSIONS = {
  edit: "seo.pages.edit",
  verify: "seo.pages.verify",
  approve: "seo.pages.approve",
  publish: "seo.pages.publish",
  retire: "seo.pages.retire",
} as const;
export type SeoCapability = keyof typeof SEO_PERMISSIONS;

/** Lowercase, no query, no "//", no trailing slash except the root. Same rule as the DB CHECK. */
export const SEO_PATH_PATTERN = /^\/([a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*)?$/;
export const SEO_SLUG_PATTERN = /^([a-z0-9]+(-[a-z0-9]+)*)?$/;
export const SEO_PATH_MAX = 300;
export const SEO_SLUG_MAX = 120;

export const SEO_LIMITS = {
  title: { max: 70, recommended: [30, 65] as const },
  description: { max: 170, recommended: [70, 160] as const },
  h1: { max: 120 },
  schemaBytes: 16 * 1024,
  contentBytes: 64 * 1024,
  comment: 1000,
} as const;

/** JSON-LD types an editor may add. Generated schema stays authoritative; these only add to it. */
export const SEO_SCHEMA_TYPES = ["FAQPage", "HowTo", "Event"] as const;
/** Ratings and reviews need real, verifiable reviews behind them, which a hand-written block is not. */
const FORBIDDEN_SCHEMA_KEYS = new Set(["aggregateRating", "review", "reviews"]);
/** Where URLs inside added schema may point: this site or the image CDN (plus the schema.org vocabulary). */
const ALLOWED_URL_PREFIXES = ["https://www.tirvona.com/", "https://res.cloudinary.com/", "https://schema.org/"];
const isAllowedUrl = (value: string): boolean =>
  value === "https://schema.org" || ALLOWED_URL_PREFIXES.some((prefix) => value.startsWith(prefix));

export interface SeoTexts {
  seoTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
}

export interface SeoCheck {
  errors: string[];
  warnings: string[];
}

/** Any markup at all: text is escaped on output anyway, but editors are told up front. */
export const hasMarkup = (value: string): boolean => /[<>]/.test(value);

/** Trims; empty means "no override" (null), so the shared formula is used again. */
export const cleanText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text : null;
};

/** Hard limits are errors; the recommended ranges only warn. */
export function checkTexts(texts: SeoTexts): SeoCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rules: Array<[keyof SeoTexts, string, number, readonly [number, number] | undefined]> = [
    ["seoTitle", "SEO title", SEO_LIMITS.title.max, SEO_LIMITS.title.recommended],
    ["metaDescription", "Meta description", SEO_LIMITS.description.max, SEO_LIMITS.description.recommended],
    ["h1", "H1", SEO_LIMITS.h1.max, undefined],
  ];
  for (const [key, label, max, recommended] of rules) {
    const value = texts[key];
    if (value === undefined || value === null) continue;
    if (hasMarkup(value)) errors.push(`${label} must be plain text (no < or >).`);
    if (value.length > max) errors.push(`${label} is ${value.length} characters; the limit is ${max}.`);
    else if (recommended && (value.length < recommended[0] || value.length > recommended[1])) {
      warnings.push(`${label} is ${value.length} characters; ${recommended[0]}–${recommended[1]} reads best in search results.`);
    }
  }
  return { errors, warnings };
}

const byteLength = (value: unknown): number => Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Added JSON-LD: allow-listed @types, no ratings/reviews, on-site URLs, at most 16 KB. */
export function checkSchemaJson(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const errors: string[] = [];
  const items = Array.isArray(value) ? value : [value];
  if (!items.length || !items.every(isPlainObject)) return ["Schema must be a JSON object or a list of objects."];
  if (byteLength(value) > SEO_LIMITS.schemaBytes) errors.push(`Schema is larger than ${SEO_LIMITS.schemaBytes / 1024} KB.`);
  for (const item of items) {
    const type = item["@type"];
    if (typeof type !== "string" || !(SEO_SCHEMA_TYPES as readonly string[]).includes(type)) {
      errors.push(`Schema @type must be one of ${SEO_SCHEMA_TYPES.join(", ")}.`);
    }
  }
  const walk = (node: unknown, trail: string): void => {
    if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${trail}[${i}]`));
    if (isPlainObject(node)) {
      for (const [key, child] of Object.entries(node)) {
        if (FORBIDDEN_SCHEMA_KEYS.has(key)) errors.push(`Schema may not contain "${key}" (${trail || "top level"}).`);
        walk(child, trail ? `${trail}.${key}` : key);
      }
      return;
    }
    if (typeof node === "string") {
      if (/^[a-z][a-z0-9+.-]*:/i.test(node) && !isAllowedUrl(node)) {
        errors.push(`Schema URL at ${trail} must be on www.tirvona.com or res.cloudinary.com.`);
      }
      if (hasMarkup(node)) errors.push(`Schema text at ${trail} must be plain text.`);
    }
  };
  walk(value, "");
  return [...new Set(errors)];
}

/** Page copy for static/landing pages: intro, sections[{heading, body}], faq[{question, answer}]; at most 64 KB. */
export function checkContentJson(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!isPlainObject(value)) return ["Content must be a JSON object."];
  const errors: string[] = [];
  if (byteLength(value) > SEO_LIMITS.contentBytes) errors.push(`Content is larger than ${SEO_LIMITS.contentBytes / 1024} KB.`);
  const allowed = new Set(["intro", "sections", "faq"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`Content may not contain "${key}".`);
  const text = (v: unknown, where: string) => {
    if (typeof v !== "string" || !v.trim()) errors.push(`${where} must be non-empty text.`);
    else if (hasMarkup(v)) errors.push(`${where} must be plain text.`);
  };
  if (value.intro !== undefined) text(value.intro, "intro");
  const list = (key: "sections" | "faq", fields: [string, string]) => {
    const items = value[key];
    if (items === undefined) return;
    if (!Array.isArray(items)) return void errors.push(`${key} must be a list.`);
    items.forEach((item, i) => {
      if (!isPlainObject(item) || Object.keys(item).some((k) => !fields.includes(k))) {
        errors.push(`${key}[${i}] must have exactly: ${fields.join(", ")}.`);
        return;
      }
      for (const field of fields) text(item[field], `${key}[${i}].${field}`);
    });
  };
  list("sections", ["heading", "body"]);
  list("faq", ["question", "answer"]);
  return [...new Set(errors)];
}

/** Where a retired page may send visitors: an on-site path other than itself. */
export function checkRedirect(redirectTo: string, path: string): string[] {
  if (!SEO_PATH_PATTERN.test(redirectTo) || redirectTo.length > SEO_PATH_MAX) {
    return ["Redirect must be a lowercase site path such as /temples/banke-bihari."];
  }
  return redirectTo === path ? ["A page cannot redirect to itself."] : [];
}

export const canonicalUrlForPath = (path: string): string => `https://www.tirvona.com${path}`;

/** Normalised for the "same title on two published pages" check. */
export const textKey = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();
