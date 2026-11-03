import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "../../../database/orm-nest";
import type { Connection } from "../../../database/orm";
import { safeUrl, type SeoBreadcrumb, type SeoPage, type SeoSection } from "../domain/seo-html";
import {
  DEFAULT_DESCRIPTION,
  ROBOTS_INDEX,
  ROBOTS_NOINDEX_FOLLOW,
  SITE_NAME,
  SITE_ORIGIN,
  STATIC_PAGES,
  classifyPath,
  blogPostPath,
  jobDescriptionText,
  canonicalPathFor,
  entitySeo,
  normalizePath,
  summarize,
  toTitleWords,
  type SeoEntityKind,
} from "../domain/seo-route-policy";
import { SeoCatalog, ashramCanonicalPath, HUB_LIMIT } from "./seo-catalog";
import { SEO_PAGE_MODEL } from "../infrastructure/seo-page.schema";

export type SeoResolution =
  | { status: 200 | 404 | 410; page: SeoPage }
  | { status: 301; location: string };

/** The live fields of a published or retired seo_pages row (see application/seo-publishing.service.ts). */
export interface EditorialRow {
  publicationStatus: string;
  indexingStatus?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  schemaJson?: unknown;
  redirectTo?: string | null;
}

/** A published row's overrides on top of the generated page. Null fields keep the generated value. */
export function applyEditorial(page: SeoPage, row: EditorialRow): SeoPage {
  const additions = row.schemaJson ? (Array.isArray(row.schemaJson) ? row.schemaJson : [row.schemaJson]) : [];
  return {
    ...page,
    title: row.seoTitle || page.title,
    description: row.metaDescription || page.description,
    h1: row.h1 || page.h1,
    robots: row.indexingStatus === "noindex" ? ROBOTS_NOINDEX_FOLLOW : page.robots,
    editorialJsonLd: additions.length ? (additions as Array<Record<string, unknown>>) : page.editorialJsonLd,
  };
}

/** Links in every server-rendered footer, so hubs are reachable without JavaScript. */
export const FOOTER_LINKS: Array<{ label: string; path: string }> = [
  { label: "Home", path: "/" },
  { label: "Ashram & Dharamshala Stays", path: "/ashrams" },
  { label: "Temples", path: "/temples" },
  { label: "Pandits & Purohits", path: "/pandits" },
  { label: "Pilgrimage Circuits", path: "/pilgrimage-circuits" },
  { label: "Events & Festivals", path: "/events" },
  { label: "Marketplace", path: "/marketplace" },
  { label: "Food", path: "/food" },
  { label: "Articles", path: "/blog" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
  { label: "FAQ", path: "/faq" },
];

const url = (path: string): string => `${SITE_ORIGIN}${path}`;
const HOME: SeoBreadcrumb = { name: "Home", path: "/" };

const firstImage = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    const safe = safeUrl(value, SITE_ORIGIN);
    if (safe) return safe;
  }
  return undefined;
};

const isoDate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const breadcrumbLd = (crumbs: SeoBreadcrumb[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: url(crumb.path),
  })),
});

const itemListLd = (name: string, pageUrl: string, links: Array<{ label: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  url: pageUrl,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: links.map((link, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: url(link.path),
      name: link.label,
    })),
  },
});

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  url: `${SITE_ORIGIN}/`,
  logo: `${SITE_ORIGIN}/logo.png`,
};

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_ORIGIN}/#website`,
  name: SITE_NAME,
  url: `${SITE_ORIGIN}/`,
  publisher: { "@id": `${SITE_ORIGIN}/#organization` },
};

/** Approved stays in a temple's city, so visitors can go from darshan to a place to stay. */
const stayLinksSection = (city: unknown, stays: any[]): SeoSection[] => {
  const links = stays
    .map((a) => ({ label: String(a.name ?? ""), path: ashramCanonicalPath(a) ?? "" }))
    .filter((l) => l.label && l.path);
  if (!links.length) return [];
  const name = toTitleWords(city);
  const citySlug = stays.find((a) => a.citySlug)?.citySlug;
  if (citySlug) links.push({ label: `All stays in ${name}`, path: `/ashrams/${citySlug}` });
  return [{ heading: `Stays in ${name}`, links }];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** A plain string field, or "" for objects, numbers stored oddly, and missing values. */
const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const HUB_LABELS: Record<SeoEntityKind, string> = {
  ashram: "Stays",
  ashramCity: "Stays",
  temple: "Temples",
  pandit: "Pandits & Purohits",
  product: "Products",
  marketplaceCategory: "Categories",
  marketplaceStore: "Stores",
  event: "Events",
  circuit: "Circuits",
  destination: "Destinations",
  blog: "Articles",
  aarti: "Aarti",
  parking: "Parking",
  volunteerJob: "Volunteer opportunities",
};

@Injectable()
export class SeoPagesService {
  private readonly logger = new Logger(SeoPagesService.name);
  readonly catalog: SeoCatalog;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.catalog = new SeoCatalog(connection);
  }

  /**
   * What the public sees at a path: the generated page, with a published editorial row's
   * overrides applied, or a retired row's 301/410. Drafts and rows under review are ignored.
   */
  async resolve(rawPath: string): Promise<SeoResolution> {
    const resolution = await this.resolveDefault(rawPath);
    if (resolution.status !== 200) return resolution;
    const path = normalizePath(rawPath);
    const row = await this.editorialRow(path);
    if (!row) return resolution;
    if (row.publicationStatus === "retired") {
      return row.redirectTo ? { status: 301, location: row.redirectTo } : this.gone(path);
    }
    return { status: 200, page: applyEditorial(resolution.page, row) };
  }

  /** A page whose SEO record was retired without a new home: 410 tells search engines it is gone for good. */
  gone(path: string): SeoResolution {
    return {
      status: 410,
      page: {
        title: "Page removed · Tirvona",
        description: "This page has been removed from Tirvona.",
        canonicalUrl: url(path),
        robots: ROBOTS_NOINDEX_FOLLOW,
        h1: "This page has been removed",
        sections: [{ heading: "Explore Tirvona", links: FOOTER_LINKS }],
      },
    };
  }

  /**
   * The live seo_pages row for a path. Any failure (table missing in an old test database, a
   * slow query) degrades to the generated page rather than failing the render.
   */
  private async editorialRow(path: string): Promise<EditorialRow | null> {
    const model = this.connection.models?.[SEO_PAGE_MODEL];
    if (!model) return null;
    try {
      return (await model
        .findOne({ path, publicationStatus: { $in: ["published", "retired"] } })
        .select("publicationStatus indexingStatus seoTitle metaDescription h1 schemaJson redirectTo")
        .lean()) as EditorialRow | null;
    } catch (error) {
      this.logger.warn(`SEO editorial lookup failed for ${path}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * The public record behind an entity page, using the same lookups (and visibility rules) as
   * the renderer; null when it does not exist or is not public.
   */
  async entityFor(kind: SeoEntityKind, params: Record<string, string>): Promise<{ _id: unknown } | null> {
    const c = this.catalog;
    switch (kind) {
      case "ashram":
        return c.ashram(params.city, params.slug);
      case "temple":
        return c.temple(params.slug);
      case "pandit":
        return c.pandit(params.slug);
      case "product":
        return c.product(params.slug);
      case "marketplaceCategory":
        return c.marketplaceCategory(params.slug);
      case "marketplaceStore":
        return c.marketplaceStore(params.slug);
      case "event":
        return c.event(params.slug);
      case "circuit":
        return c.circuit(params.slug);
      case "blog":
        return c.blog(params.slug);
      case "aarti":
        return c.aarti(params.slug);
      case "parking":
        return c.parking(params.slug);
      case "volunteerJob":
        return c.volunteerJob(params.id);
      default:
        return null;
    }
  }

  /** The generated page only: entity status rules and the shared formula, no editorial rows. */
  async resolveDefault(rawPath: string): Promise<SeoResolution> {
    const path = normalizePath(rawPath);
    if (path !== rawPath && rawPath !== "") return { status: 301, location: path };

    const match = classifyPath(path);
    switch (match.kind) {
      case "redirect":
        return { status: 301, location: match.location };
      case "private":
      case "utility":
        return {
          status: 200,
          page: {
            title: match.kind === "utility" ? match.title : `${SITE_NAME}`,
            description: DEFAULT_DESCRIPTION,
            canonicalUrl: url(path),
            robots: match.robots,
            h1: match.kind === "utility" ? match.title.replace(/ · Tirvona$/, "") : SITE_NAME,
          },
        };
      case "section":
        return {
          status: 200,
          page: {
            title: match.title,
            description: DEFAULT_DESCRIPTION,
            canonicalUrl: url(match.canonicalPath),
            robots: ROBOTS_INDEX,
            h1: match.title.replace(/ · Tirvona$/, ""),
            breadcrumbs: [HOME, { name: match.title.replace(/ · Tirvona$/, ""), path }],
          },
        };
      case "static":
        return { status: 200, page: await this.staticPage(match.canonicalPath) };
      case "entity":
        return this.entityPage(match.entity, match.params, path, match.robots);
      default:
        return this.notFound(path);
    }
  }

  notFound(path: string): SeoResolution {
    return {
      status: 404,
      page: {
        title: "Page not found · Tirvona",
        description: "The page you were looking for could not be found on Tirvona.",
        canonicalUrl: url(path),
        robots: ROBOTS_NOINDEX_FOLLOW,
        h1: "Page not found",
        sections: [{ heading: "Explore Tirvona", links: FOOTER_LINKS }],
      },
    };
  }

  private async staticPage(canonicalPath: string): Promise<SeoPage> {
    const config = STATIC_PAGES[canonicalPath];
    const crumbs = canonicalPath === "/" ? [] : [HOME, { name: config.h1, path: canonicalPath }];
    const page: SeoPage = {
      title: config.title,
      description: config.description,
      canonicalUrl: url(canonicalPath),
      robots: config.robots ?? ROBOTS_INDEX,
      h1: config.h1,
      intro: config.description,
      breadcrumbs: crumbs,
      clientJsonLd: config.clientJsonLd,
      jsonLd: canonicalPath === "/" ? [ORGANIZATION_LD, WEBSITE_LD] : [breadcrumbLd(crumbs)],
    };
    if (config.lists) {
      const links = await this.hubLinks(config.lists);
      if (links.length) {
        page.sections = [{ heading: `${HUB_LABELS[config.lists]} on Tirvona`, links }];
        page.jsonLd = [...(page.jsonLd ?? []), itemListLd(config.h1, page.canonicalUrl, links)];
      }
    }
    if (canonicalPath === "/") {
      page.sections = [{ heading: "Explore Tirvona", links: FOOTER_LINKS.slice(1) }];
    }
    return page;
  }

  /** Links to the newest public records of one type, for hub pages. */
  async hubLinks(kind: SeoEntityKind): Promise<Array<{ label: string; path: string }>> {
    const c = this.catalog;
    switch (kind) {
      case "ashram":
        return (await c.ashrams(HUB_LIMIT))
          .map((a) => ({ label: String(a.name ?? ""), path: ashramCanonicalPath(a) ?? "" }))
          .filter((l) => l.label && l.path);
      case "temple":
        return (await c.temples()).filter((t) => t.slug).map((t) => ({ label: t.name, path: `/temples/${t.slug}` }));
      case "pandit":
        return (await c.pandits())
          .map((p) => ({ label: p.displayName, path: `/pandit/${p.slug || p.id}` }))
          .filter((l) => l.label);
      case "product":
        return (await c.products()).filter((p) => p.slug).map((p) => ({ label: p.name, path: `/marketplace/products/${p.slug}` }));
      case "marketplaceCategory":
        return (await c.marketplaceCategories())
          .filter((m) => m.slug)
          .map((m) => ({ label: m.name, path: `/marketplace/category/${m.slug}` }));
      case "event":
        return (await c.events()).filter((e) => e.slug).map((e) => ({ label: e.name, path: `/events/${e.slug}` }));
      case "circuit":
        return (await c.circuits()).filter((x) => x.slug).map((x) => ({ label: x.name, path: `/circuits/${x.slug}` }));
      case "blog":
        return (await c.blogPosts()).filter((b) => b.slug).map((b) => ({ label: b.title, path: blogPostPath(b) }));
      case "aarti":
        return (await c.aartis())
          .map((a) => ({ label: String(a.name ?? ""), path: `/aarti/${a.slug || a._id}` }))
          .filter((l) => l.label);
      case "parking":
        return (await c.parkings()).filter((p) => p.slug && p.name).map((p) => ({ label: p.name, path: `/parking/${p.slug}` }));
      case "volunteerJob":
        return (await c.volunteerJobs())
          .map((j) => ({ label: [j.title, j.ashramName].filter(Boolean).join(" — "), path: `/volunteer/${j._id}` }))
          .filter((l) => l.label);
      default:
        return [];
    }
  }

  private async entityPage(
    entity: SeoEntityKind,
    params: Record<string, string>,
    path: string,
    robots: string | undefined,
  ): Promise<SeoResolution> {
    const page = await this.buildEntity(entity, params, path);
    if (!page) return this.notFound(path);
    if ("redirect" in page) return { status: 301, location: page.redirect };
    if (robots) page.robots = robots;
    return { status: 200, page };
  }

  private async buildEntity(
    entity: SeoEntityKind,
    params: Record<string, string>,
    path: string,
  ): Promise<SeoPage | { redirect: string } | null> {
    const c = this.catalog;
    switch (entity) {
      case "ashram": {
        const row = await c.ashram(params.city, params.slug);
        if (!row) return null;
        const canonical = ashramCanonicalPath(row);
        const isBook = path.endsWith("/book");
        // Old id links and edited cities move to the current URL; the booking step keeps its own path.
        if (canonical && !isBook && path !== canonical) return { redirect: canonical };
        if (canonical && isBook && path !== `${canonical}/book`) return { redirect: `${canonical}/book` };
        const selfPath = canonical ? `${canonical}${isBook ? "/book" : ""}` : path;
        return this.ashramPage(row, selfPath, await c.templesInCity(row.address?.city));
      }
      case "ashramCity": {
        const rows = await c.ashrams(HUB_LIMIT, params.city);
        if (!rows.length) return null;
        const { title, description } = entitySeo.ashramCity(params.city);
        const cityPath = `/ashrams/${params.city.toLowerCase()}`;
        const links = rows
          .map((a) => ({ label: String(a.name ?? ""), path: ashramCanonicalPath(a) ?? "" }))
          .filter((l) => l.label && l.path);
        const crumbs = [HOME, { name: "Stays", path: "/ashrams" }, { name: toTitleWords(params.city), path: cityPath }];
        return {
          title,
          description,
          canonicalUrl: url(cityPath),
          robots: ROBOTS_INDEX,
          h1: `Stays in ${toTitleWords(params.city)}`,
          intro: description,
          breadcrumbs: crumbs,
          sections: [{ heading: `Properties in ${toTitleWords(params.city)}`, links }],
          jsonLd: [breadcrumbLd(crumbs), itemListLd(`Stays in ${toTitleWords(params.city)}`, url(cityPath), links)],
        };
      }
      case "temple": {
        const row = await c.temple(params.slug);
        if (!row) return null;
        return this.templePage(row, row.address?.city ? await c.ashrams(12, row.address.city) : []);
      }
      case "pandit": {
        const row = await c.pandit(params.slug);
        return row ? this.panditPage(row) : null;
      }
      case "product": {
        const row = await c.product(params.slug);
        if (!row) return null;
        const canonical = `/marketplace/products/${row.slug}`;
        if (row.slug && path !== canonical) return { redirect: canonical };
        return this.productPage(row);
      }
      case "marketplaceCategory": {
        const row = await c.marketplaceCategory(params.slug);
        if (!row) return null;
        const products = await c.productsInCategory(row._id);
        const { title, description } = entitySeo.marketplaceCategory(row);
        const selfPath = `/marketplace/category/${row.slug}`;
        const links = products.filter((p) => p.slug).map((p) => ({ label: p.name, path: `/marketplace/products/${p.slug}` }));
        const crumbs = [HOME, { name: "Marketplace", path: "/marketplace" }, { name: row.name, path: selfPath }];
        return {
          title,
          description,
          canonicalUrl: url(selfPath),
          // An empty category is a thin page: reachable, but not offered to search engines.
          robots: links.length ? ROBOTS_INDEX : ROBOTS_NOINDEX_FOLLOW,
          h1: row.name,
          intro: summarize(row.description, 400) || undefined,
          breadcrumbs: crumbs,
          sections: [{ heading: `Products in ${row.name}`, links }],
          jsonLd: [breadcrumbLd(crumbs), itemListLd(row.name, url(selfPath), links)],
        };
      }
      case "marketplaceStore": {
        const row = await c.marketplaceStore(params.slug);
        if (!row) return null;
        const products = await c.productsInStore(row._id);
        const { title, description } = entitySeo.marketplaceStore({ ...row, city: row.address?.city });
        const selfPath = `/marketplace/store/${row.slug}`;
        const links = products.filter((p) => p.slug).map((p) => ({ label: p.name, path: `/marketplace/products/${p.slug}` }));
        const crumbs = [HOME, { name: "Marketplace", path: "/marketplace" }, { name: row.storeName, path: selfPath }];
        return {
          title,
          description,
          canonicalUrl: url(selfPath),
          robots: links.length ? ROBOTS_INDEX : ROBOTS_NOINDEX_FOLLOW,
          h1: row.storeName,
          intro: summarize(row.description, 400) || undefined,
          image: firstImage(row.logoUrl),
          breadcrumbs: crumbs,
          sections: [{ heading: `Products from ${row.storeName}`, links }],
          jsonLd: [breadcrumbLd(crumbs), itemListLd(row.storeName, url(selfPath), links)],
        };
      }
      case "event": {
        const row = await c.event(params.slug);
        if (!row) return null;
        if (row.slug && params.slug !== row.slug) return { redirect: `/events/${row.slug}` };
        return this.eventPage(row);
      }
      case "circuit": {
        const row = await c.circuit(params.slug);
        return row ? this.circuitPage(row) : null;
      }
      case "destination": {
        const city = params.slug.toLowerCase();
        const rows = await c.ashrams(HUB_LIMIT, city);
        if (!rows.length) return null;
        const { title, description } = entitySeo.destination(city);
        const selfPath = canonicalPathFor(path);
        const links = rows
          .map((a) => ({ label: String(a.name ?? ""), path: ashramCanonicalPath(a) ?? "" }))
          .filter((l) => l.label && l.path);
        const crumbs = [HOME, { name: "Pilgrimage Circuits", path: "/pilgrimage-circuits" }, { name: toTitleWords(city), path: selfPath }];
        return {
          title,
          description,
          canonicalUrl: url(selfPath),
          robots: ROBOTS_INDEX,
          h1: toTitleWords(city),
          intro: description,
          breadcrumbs: crumbs,
          sections: [
            { heading: `Stays in ${toTitleWords(city)}`, links },
            { heading: "Plan your stay", links: [{ label: `All stays in ${toTitleWords(city)}`, path: `/ashrams/${city}` }] },
          ],
          jsonLd: [breadcrumbLd(crumbs)],
        };
      }
      case "blog": {
        const row = await c.blog(params.slug);
        if (!row) return null;
        // Videos and articles share one table; each has exactly one URL prefix.
        if (path !== blogPostPath(row)) return { redirect: blogPostPath(row) };
        return this.blogPage(row);
      }
      case "aarti": {
        const row = await c.aarti(params.slug);
        if (!row) return null;
        const canonical = `/aarti/${row.slug || row._id}`;
        if (path !== canonical) return { redirect: canonical };
        return this.aartiPage(row, canonical);
      }
      case "parking": {
        const row = await c.parking(params.slug);
        if (!row) return null;
        const canonical = `/parking/${row.slug || row._id}`;
        if (path !== canonical) return { redirect: canonical };
        return this.parkingPage(row, canonical);
      }
      case "volunteerJob": {
        const row = await c.volunteerJob(params.id);
        if (!row) return null;
        // The app links jobs by id; /volunteer/job/:id and slug links move there.
        const canonical = `/volunteer/${row._id}`;
        if (path !== canonical) return { redirect: canonical };
        return this.volunteerJobPage(row, canonical);
      }
      default:
        return null;
    }
  }

  private ashramPage(row: any, selfPath: string, cityTemples: any[] = []): SeoPage {
    const { title, description } = entitySeo.ashram(row);
    const city = toTitleWords(row.address?.city);
    const cityPath = row.citySlug ? `/ashrams/${row.citySlug}` : undefined;
    const crumbs: SeoBreadcrumb[] = [HOME, { name: "Stays", path: "/ashrams" }];
    if (city && cityPath) crumbs.push({ name: city, path: cityPath });
    crumbs.push({ name: row.name, path: selfPath });
    const image = firstImage(row.images, row.coverImage);
    const addressText = [row.address?.street, row.address?.area, row.address?.city, row.address?.state, row.address?.pincode]
      .filter(Boolean)
      .join(", ");
    const coords = row.address?.coordinates?.coordinates;
    // [77.209, 28.613] is the schema default meaning "no pin chosen" (see AshramsService), not a real location.
    const hasGeo =
      Array.isArray(coords) &&
      coords.length === 2 &&
      !(coords[0] === 0 && coords[1] === 0) &&
      !(coords[0] === 77.209 && coords[1] === 28.613);
    const sections: SeoSection[] = [
      { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1200)] },
      { heading: "Location", facts: [["Address", addressText]] },
      { heading: "Amenities", items: (row.amenities ?? []).map(toTitleWords) },
    ];
    if (cityPath) {
      const explore = [{ label: `More stays in ${city}`, path: cityPath }];
      for (const t of cityTemples) if (t.slug && t.name) explore.push({ label: `${t.name} temple`, path: `/temples/${t.slug}` });
      explore.push({ label: `Visiting ${city}`, path: `/destination/${row.citySlug}` });
      sections.push({ heading: `Explore ${city}`, links: explore });
    }
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      image,
      ogType: "place",
      breadcrumbs: crumbs,
      sections,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          "@id": `${url(selfPath)}#lodging`,
          name: row.name,
          description,
          url: url(selfPath),
          image,
          address: {
            "@type": "PostalAddress",
            streetAddress: row.address?.street,
            addressLocality: row.address?.city,
            addressRegion: row.address?.state,
            postalCode: row.address?.pincode,
            addressCountry: "IN",
          },
          geo: hasGeo ? { "@type": "GeoCoordinates", longitude: coords[0], latitude: coords[1] } : undefined,
          amenityFeature: (row.amenities ?? []).length
            ? row.amenities.map((a: string) => ({ "@type": "LocationFeatureSpecification", name: toTitleWords(a), value: true }))
            : undefined,
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  /** Mirrors the JSON-LD TempleDetailPage writes (same id), so hydration replaces it instead of duplicating. */
  private templePage(row: any, cityStays: any[] = []): SeoPage {
    const { title, description } = entitySeo.temple(row);
    const ownCanonical = String(row.seo?.canonicalUrl ?? "");
    const canonical = ownCanonical.startsWith(`${SITE_ORIGIN}/`) ? ownCanonical : url(`/temples/${row.slug}`);
    const image = firstImage(row.seo?.ogImage, row.media?.coverImage);
    const crumbs = [HOME, { name: "Temples", path: "/temples" }, { name: row.name, path: `/temples/${row.slug}` }];
    const dayMap: Record<string, string> = { Monday: "Mo", Tuesday: "Tu", Wednesday: "We", Thursday: "Th", Friday: "Fr", Saturday: "Sa", Sunday: "Su" };
    const openingHours = (row.timings ?? []).flatMap((day: any) =>
      (day.timeSlots ?? [])
        .filter((slot: any) => !slot.isClosed && slot.startTime && slot.endTime)
        .map((slot: any) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: dayMap[day.dayOfWeek] || day.dayOfWeek,
          opens: slot.isOpen24Hours ? "00:00" : slot.startTime,
          closes: slot.isOpen24Hours ? "23:59" : slot.endTime,
        })),
    );
    const timingItems = (row.timings ?? []).flatMap((day: any) =>
      (day.timeSlots ?? [])
        .filter((slot: any) => slot.startTime && slot.endTime && !slot.isClosed)
        .map((slot: any) => `${day.dayOfWeek}: ${slot.title ? `${slot.title} ` : ""}${slot.startTime}–${slot.endTime}`),
    );
    const coords = row.address?.coordinates?.coordinates;
    const hasGeo = Array.isArray(coords) && coords.length === 2 && !(coords[0] === 0 && coords[1] === 0);
    return {
      title,
      description,
      canonicalUrl: canonical,
      robots: ROBOTS_INDEX,
      h1: row.name,
      intro: summarize(row.shortDescription, 400) || undefined,
      image,
      ogType: "place",
      breadcrumbs: crumbs,
      jsonLdId: "temple-jsonld",
      sections: [
        { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1500)] },
        {
          heading: "Visitor information",
          facts: [
            ["Deity", row.deity],
            ["Location", [row.address?.city, row.address?.state].filter(Boolean).join(", ")],
            ["Best time to visit", row.visitorInfo?.bestTimeToVisit],
            ["Dress code", row.visitorInfo?.dressCode],
            ["Entry fee", row.visitorInfo?.entryFee],
          ],
        },
        { heading: "Timings", items: timingItems },
        ...stayLinksSection(row.address?.city, cityStays),
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": ["PlaceOfWorship", "TouristAttraction"],
          name: row.name,
          alternateName: row.templeShortName || undefined,
          description,
          url: canonical,
          image: firstImage(row.media?.coverImage),
          telephone: row.visitorInfo?.templeContactNumber || undefined,
          address: {
            "@type": "PostalAddress",
            streetAddress: row.address?.street,
            addressLocality: row.address?.city,
            addressRegion: row.address?.state,
            postalCode: row.address?.pincode,
            addressCountry: row.address?.country || "India",
          },
          geo: hasGeo ? { "@type": "GeoCoordinates", longitude: coords[0], latitude: coords[1] } : undefined,
          openingHoursSpecification: openingHours.length ? openingHours : undefined,
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private panditPage(row: any): SeoPage {
    const { title, description } = entitySeo.pandit(row);
    const selfPath = `/pandit/${row.slug || row.id}`;
    const crumbs = [HOME, { name: "Pandits", path: "/pandits" }, { name: row.displayName, path: selfPath }];
    const image = firstImage(row.avatarUrl);
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.displayName,
      image,
      ogType: "profile",
      breadcrumbs: crumbs,
      sections: [
        { heading: `About ${row.displayName}`, paragraphs: [summarize(row.bio, 1500)] },
        {
          heading: "Profile details",
          facts: [
            ["Based in", [row.homeCity, row.homeState].filter(Boolean).join(", ")],
            ["Experience", row.experienceYears ? `${row.experienceYears} years` : ""],
            ["Languages", (row.languages ?? []).join(", ")],
            ["Traditions", (row.traditions ?? []).join(", ")],
            ["Serves", (row.serviceCities ?? []).map((s: any) => s.city).filter(Boolean).join(", ")],
          ],
        },
        { heading: "Services", items: row.specializations ?? [] },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: url(selfPath),
          dateModified: isoDate(row.updatedAt),
          mainEntity: {
            "@type": "Person",
            name: row.displayName,
            description,
            image,
            knowsLanguage: (row.languages ?? []).length ? row.languages : undefined,
            address: row.homeCity
              ? { "@type": "PostalAddress", addressLocality: row.homeCity, addressRegion: row.homeState, addressCountry: "IN" }
              : undefined,
          },
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private productPage(row: any): SeoPage {
    const vendor = row.vendorId && typeof row.vendorId === "object" ? row.vendorId : null;
    const category = row.categoryId && typeof row.categoryId === "object" ? row.categoryId : null;
    const { title, description } = entitySeo.product({ ...row, storeName: vendor?.storeName });
    const selfPath = `/marketplace/products/${row.slug}`;
    const crumbs: SeoBreadcrumb[] = [HOME, { name: "Marketplace", path: "/marketplace" }];
    if (category?.slug) crumbs.push({ name: category.name, path: `/marketplace/category/${category.slug}` });
    crumbs.push({ name: row.name, path: selfPath });
    const image = firstImage(row.images);
    const price = Number(row.salePrice ?? row.price);
    const tracked = row.inventory?.trackInventory !== false;
    const inStock = !tracked || Number(row.stock ?? 0) > 0;
    const links: Array<{ label: string; path: string }> = [];
    if (vendor?.slug) links.push({ label: `More from ${vendor.storeName}`, path: `/marketplace/store/${vendor.slug}` });
    if (category?.slug) links.push({ label: `More in ${category.name}`, path: `/marketplace/category/${category.slug}` });
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      image,
      ogType: "product",
      breadcrumbs: crumbs,
      sections: [
        { heading: "Description", paragraphs: [summarize(row.description, 1500)] },
        {
          heading: "Details",
          facts: [
            ["Price", Number.isFinite(price) && price > 0 ? `₹${price}` : ""],
            ["Availability", inStock ? "In stock" : "Out of stock"],
            ["Sold by", vendor?.storeName ?? ""],
          ],
        },
        { heading: "Store and category", links },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: row.name,
          description,
          image,
          url: url(selfPath),
          category: category?.name,
          offers:
            Number.isFinite(price) && price > 0
              ? {
                  "@type": "Offer",
                  url: url(selfPath),
                  price: price.toFixed(2),
                  priceCurrency: row.currency || "INR",
                  availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  seller: vendor?.storeName ? { "@type": "Organization", name: vendor.storeName } : undefined,
                }
              : undefined,
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private eventPage(row: any): SeoPage {
    const { title, description } = entitySeo.event(row);
    const selfPath = `/events/${row.slug || row._id}`;
    const crumbs = [HOME, { name: "Events", path: "/events" }, { name: row.name, path: selfPath }];
    const image = firstImage(row.coverImage, row.images);
    const start = isoDate(row.startDate);
    const end = isoDate(row.endDate);
    const venueText = [row.venue?.name, row.venue?.line1, row.venue?.city, row.venue?.state].filter(Boolean).join(", ");
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      intro: summarize(row.tagline, 300) || undefined,
      image,
      breadcrumbs: crumbs,
      sections: [
        { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1500)] },
        {
          heading: "Event details",
          facts: [
            ["Dates", [start?.slice(0, 10), end?.slice(0, 10)].filter(Boolean).join(" to ")],
            ["Venue", venueText],
            ["Deity", row.deity],
            ["Registration", row.requiresRegistration ? "Required" : ""],
          ],
        },
        { heading: "Highlights", items: row.highlights ?? [] },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Event",
          name: row.name,
          description,
          image,
          url: url(selfPath),
          startDate: start,
          endDate: end,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: venueText
            ? {
                "@type": "Place",
                name: row.venue?.name || row.venue?.city,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: row.venue?.line1,
                  addressLocality: row.venue?.city,
                  addressRegion: row.venue?.state,
                  postalCode: row.venue?.pincode,
                  addressCountry: "IN",
                },
              }
            : undefined,
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private circuitPage(row: any): SeoPage {
    const { title, description } = entitySeo.circuit(row);
    const selfPath = `/circuits/${row.slug || row._id}`;
    const crumbs = [HOME, { name: "Pilgrimage Circuits", path: "/pilgrimage-circuits" }, { name: row.name, path: selfPath }];
    const image = firstImage(row.coverImage, row.images);
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      intro: summarize(row.summary, 400) || undefined,
      image,
      breadcrumbs: crumbs,
      sections: [
        { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1500)] },
        {
          heading: "Circuit details",
          facts: [
            ["Route", [row.startCity, row.endCity].filter(Boolean).join(" to ")],
            ["Duration", row.durationDays ? `${row.durationDays} days` : ""],
            ["Distance", row.totalDistanceKm ? `${row.totalDistanceKm} km` : ""],
            ["Difficulty", toTitleWords(row.difficulty)],
            ["Best seasons", (row.bestSeasons ?? []).map(toTitleWords).join(", ")],
          ],
        },
        { heading: "Highlights", items: row.highlights ?? [] },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: row.name,
          description,
          image,
          url: url(selfPath),
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private aartiPage(row: any, selfPath: string): SeoPage {
    const { title, description } = entitySeo.aarti(row);
    const crumbs = [HOME, { name: "Aarti", path: "/aarti" }, { name: row.name, path: selfPath }];
    const venue = row.venue ?? {};
    const days = Array.isArray(row.daysOfWeek) && row.daysOfWeek.length
      ? row.daysOfWeek.map((d: number) => WEEKDAYS[d]).filter(Boolean).join(", ")
      : "";
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      image: firstImage(row.images, row.coverImage),
      breadcrumbs: crumbs,
      sections: [
        { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1500)] },
        {
          heading: "Timings and venue",
          facts: [
            ["Deity", textOf(row.deity)],
            ["Venue", [venue.name, venue.address, venue.city, venue.state].map(textOf).filter(Boolean).join(", ")],
            ["Starts at", textOf(row.startTime)],
            ["Duration", Number(row.durationMinutes) > 0 ? `${Number(row.durationMinutes)} minutes` : ""],
            ["Days", days],
            ["Dress code", textOf(row.dressCode)],
          ],
        },
        { heading: "Facilities", items: (row.facilities ?? []).map(toTitleWords) },
      ],
      jsonLd: [breadcrumbLd(crumbs)],
    };
  }

  private parkingPage(row: any, selfPath: string): SeoPage {
    const { title, description } = entitySeo.parking(row);
    const crumbs = [HOME, { name: "Parking", path: "/parking" }, { name: row.name, path: selfPath }];
    const address = [row.address?.line1, row.address?.street, row.address?.area, row.address?.city, row.address?.state, row.address?.pincode]
      .map(textOf)
      .filter(Boolean)
      .join(", ");
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.name,
      image: firstImage(row.images, row.coverImage),
      breadcrumbs: crumbs,
      sections: [
        { heading: `About ${row.name}`, paragraphs: [summarize(row.description, 1500)] },
        { heading: "Location", facts: [["Address", address]] },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "ParkingFacility",
          name: row.name,
          description,
          url: url(selfPath),
          image: firstImage(row.images, row.coverImage),
          address: {
            "@type": "PostalAddress",
            streetAddress: textOf(row.address?.line1 || row.address?.street) || undefined,
            addressLocality: textOf(row.address?.city) || undefined,
            addressRegion: textOf(row.address?.state) || undefined,
            postalCode: textOf(row.address?.pincode) || undefined,
            addressCountry: "India",
          },
          geo: hasGeo ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng } : undefined,
        },
        breadcrumbLd(crumbs),
      ],
    };
  }

  private volunteerJobPage(row: any, selfPath: string): SeoPage {
    const { title, description } = entitySeo.volunteerJob(row);
    const crumbs = [HOME, { name: "Volunteer & Seva", path: "/volunteer" }, { name: row.title, path: selfPath }];
    const provided = (value: unknown): string =>
      typeof value === "boolean" ? (value ? "Provided" : "Not provided") : toTitleWords(textOf(value));
    const body = summarize(jobDescriptionText(row), 2000);
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.title,
      breadcrumbs: crumbs,
      sections: [
        { heading: "About this opportunity", paragraphs: [body] },
        {
          heading: "Details",
          facts: [
            ["Organisation", textOf(row.ashramName)],
            ["Location", [row.city, row.state].map((v) => toTitleWords(textOf(v))).filter(Boolean).join(", ")],
            ["Type", toTitleWords(textOf(row.type))],
            ["Department", textOf(row.department)],
            ["Duration", textOf(row.duration)],
            ["Openings", Number(row.openingsCount) > 0 ? String(Number(row.openingsCount)) : ""],
            ["Accommodation", provided(row.accommodation)],
            ["Food", provided(row.food)],
          ],
        },
      ],
      jsonLd: [
        // Google requires a description, a posting date, an organisation and a place; without them no JobPosting is published.
        ...(body && row.ashramName && row.city && row.createdAt
          ? [
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                title: row.title,
                description: body,
                datePosted: isoDate(row.createdAt),
                employmentType: "VOLUNTEER",
                hiringOrganization: { "@type": "Organization", name: textOf(row.ashramName) },
                jobLocation: {
                  "@type": "Place",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: toTitleWords(textOf(row.city)),
                    addressRegion: toTitleWords(textOf(row.state)) || undefined,
                    addressCountry: "IN",
                  },
                },
                url: url(selfPath),
              },
            ]
          : []),
        breadcrumbLd(crumbs),
      ],
    };
  }

  private blogPage(row: any): SeoPage {
    const { title, description } = entitySeo.blog(row);
    const selfPath = blogPostPath(row);
    const crumbs = [HOME, { name: "Articles", path: "/blog" }, { name: row.title, path: selfPath }];
    const image = firstImage(row.coverImage);
    const author = (row.authorId && typeof row.authorId === "object" ? row.authorId.name : null) || row.authorName;
    return {
      title,
      description,
      canonicalUrl: url(selfPath),
      robots: ROBOTS_INDEX,
      h1: row.title,
      image,
      ogType: "article",
      breadcrumbs: crumbs,
      sections: [{ heading: "Article summary", paragraphs: [summarize(row.content, 3000)] }],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: summarize(row.title, 110),
          description,
          image,
          url: url(selfPath),
          mainEntityOfPage: url(selfPath),
          datePublished: isoDate(row.publishedAt ?? row.createdAt),
          dateModified: isoDate(row.updatedAt),
          author: author ? { "@type": "Person", name: author } : { "@type": "Organization", name: SITE_NAME },
          publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        },
        breadcrumbLd(crumbs),
      ],
    };
  }
}
