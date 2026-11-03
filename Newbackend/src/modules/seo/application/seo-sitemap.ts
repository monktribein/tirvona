import type { Connection } from "../../../database/orm";
import { SITE_ORIGIN, STATIC_PAGES, blogPostPath, type SeoEntityKind } from "../domain/seo-route-policy";
import { escapeHtml } from "../domain/seo-html";
import { SeoCatalog, SITEMAP_LIMIT, ashramCanonicalPath } from "./seo-catalog";
import { SEO_PAGE_MODEL } from "../infrastructure/seo-page.schema";

export interface SitemapEntry {
  path: string;
  /** The record's real last-modified time. Omitted when there is none, never faked. */
  lastmod?: Date;
}

/** The sitemap protocol's per-file limit. */
const MAX_URLS = 50_000;

const latest = (rows: Array<{ updatedAt?: unknown }>): Date | undefined => {
  let best: Date | undefined;
  for (const row of rows) {
    if (!row?.updatedAt) continue;
    const date = new Date(row.updatedAt as string);
    if (!Number.isNaN(date.getTime()) && (!best || date > best)) best = date;
  }
  return best;
};

const idOf = (value: any): string => String(value?._id ?? value ?? "");

/**
 * Every indexable canonical URL: static pages and hubs from the route policy,
 * then each public record. Aliases, booking steps, utility, private and thin
 * pages are never listed, so the sitemap agrees with each page's canonical and
 * robots tags.
 */
export async function buildSitemapEntries(connection: Connection): Promise<SitemapEntry[]> {
  const catalog = new SeoCatalog(connection);
  const settle = async <T>(work: Promise<T[]>): Promise<T[]> => work.catch(() => [] as T[]);
  const [ashrams, temples, pandits, products, categories, stores, events, circuits, posts, cities, aartis, parkings, jobs] = await Promise.all([
    settle(catalog.ashrams(SITEMAP_LIMIT)),
    settle(catalog.temples(SITEMAP_LIMIT)),
    settle(catalog.pandits(SITEMAP_LIMIT)),
    settle(catalog.products(SITEMAP_LIMIT)),
    settle(catalog.marketplaceCategories(SITEMAP_LIMIT)),
    settle(catalog.marketplaceStores(SITEMAP_LIMIT)),
    settle(catalog.events(SITEMAP_LIMIT)),
    settle(catalog.circuits(SITEMAP_LIMIT)),
    settle(catalog.blogPosts(SITEMAP_LIMIT)),
    settle(catalog.stayCities()),
    settle(catalog.aartis(SITEMAP_LIMIT)),
    settle(catalog.parkings(SITEMAP_LIMIT)),
    settle(catalog.volunteerJobs(SITEMAP_LIMIT)),
  ]);

  const hubRows: Partial<Record<SeoEntityKind, Array<{ updatedAt?: unknown }>>> = {
    ashram: ashrams,
    temple: temples,
    pandit: pandits,
    product: products,
    marketplaceCategory: categories,
    event: events,
    circuit: circuits,
    blog: posts,
    aarti: aartis,
    parking: parkings,
    volunteerJob: jobs,
  };

  const entries = new Map<string, SitemapEntry>();
  const add = (path: string | null | undefined, lastmod?: unknown) => {
    if (!path || entries.has(path)) return;
    const date = lastmod ? new Date(lastmod as string) : undefined;
    entries.set(path, { path, lastmod: date && !Number.isNaN(date.getTime()) ? date : undefined });
  };

  for (const [path, config] of Object.entries(STATIC_PAGES)) {
    if (config.robots && config.robots !== "index,follow") continue;
    add(path, config.lists ? latest(hubRows[config.lists] ?? []) : undefined);
  }

  for (const a of ashrams) add(ashramCanonicalPath(a), a.updatedAt);
  for (const city of cities) {
    add(`/ashrams/${city.citySlug}`, city.updatedAt);
    add(`/destination/${city.citySlug}`, city.updatedAt);
  }
  for (const t of temples) {
    const own = String(t.seo?.canonicalUrl ?? "");
    // A temple whose editor set a canonical elsewhere on the site is listed at that URL only.
    const path = own.startsWith(`${SITE_ORIGIN}/`) ? own.slice(SITE_ORIGIN.length) : t.slug ? `/temples/${t.slug}` : null;
    add(path, t.updatedAt);
  }
  for (const p of pandits) add(`/pandit/${p.slug || p.id}`, p.updatedAt);

  const productsByCategory = new Map<string, Date | undefined>();
  const productsByStore = new Map<string, Date | undefined>();
  for (const p of products) {
    if (p.slug) add(`/marketplace/products/${p.slug}`, p.updatedAt);
    const stamp = latest([p]);
    for (const [map, key] of [
      [productsByCategory, idOf(p.categoryId)],
      [productsByStore, idOf(p.vendorId)],
    ] as Array<[Map<string, Date | undefined>, string]>) {
      if (!key) continue;
      const prev = map.get(key);
      map.set(key, !prev || (stamp && stamp > prev) ? stamp : prev);
    }
  }
  // Empty categories and stores are noindex pages, so only those with listed products appear.
  for (const c of categories) {
    if (c.slug && productsByCategory.has(idOf(c))) add(`/marketplace/category/${c.slug}`, latest([c, { updatedAt: productsByCategory.get(idOf(c)) }]));
  }
  for (const s of stores) {
    if (s.slug && productsByStore.has(idOf(s))) add(`/marketplace/store/${s.slug}`, latest([s, { updatedAt: productsByStore.get(idOf(s)) }]));
  }
  for (const e of events) if (e.slug) add(`/events/${e.slug}`, e.updatedAt);
  for (const c of circuits) if (c.slug) add(`/circuits/${c.slug}`, c.updatedAt);
  for (const b of posts) if (b.slug) add(blogPostPath(b), b.updatedAt);
  for (const a of aartis) add(`/aarti/${a.slug || idOf(a)}`, a.updatedAt);
  for (const p of parkings) if (p.slug) add(`/parking/${p.slug}`, p.updatedAt);
  for (const j of jobs) add(`/volunteer/${idOf(j)}`, j.updatedAt);

  await applyEditorialRows(connection, entries);
  return [...entries.values()].slice(0, MAX_URLS);
}

/**
 * Live SEO publishing rows: a retired page, or a published one marked noindex, leaves the
 * sitemap (it agrees with the page's own robots tag); a published override newer than the
 * record moves <lastmod> forward. Drafts and rows under review change nothing.
 */
async function applyEditorialRows(connection: Connection, entries: Map<string, SitemapEntry>): Promise<void> {
  const model = connection.models?.[SEO_PAGE_MODEL];
  if (!model) return;
  let rows: Array<{ path: string; publicationStatus: string; indexingStatus?: string; updatedAt?: unknown }>;
  try {
    rows = (await model
      .find({ publicationStatus: { $in: ["published", "retired"] } })
      .select("path publicationStatus indexingStatus updatedAt")
      .lean()) as typeof rows;
  } catch {
    return;
  }
  for (const row of rows) {
    if (row.publicationStatus === "retired" || row.indexingStatus === "noindex") {
      entries.delete(row.path);
      continue;
    }
    const entry = entries.get(row.path);
    const stamp = row.updatedAt ? new Date(row.updatedAt as string) : undefined;
    if (entry && stamp && !Number.isNaN(stamp.getTime()) && (!entry.lastmod || stamp > entry.lastmod)) entry.lastmod = stamp;
  }
}

export const renderSitemapXml = (entries: SitemapEntry[]): string => {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod.toISOString()}</lastmod>` : "";
      // Paths come from slugs; encodeURI keeps reserved characters valid in XML and URLs.
      return `  <url>\n    <loc>${escapeHtml(`${SITE_ORIGIN}${encodeURI(decodeURISafe(entry.path))}`)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const decodeURISafe = (value: string): string => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};
