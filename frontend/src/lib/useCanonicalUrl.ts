import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_ORIGIN,
  STATIC_PAGES,
  canonicalUrlFor,
  classifyPath,
  robotsFor,
} from "../seo/routePolicy";
import { activeSeoOverride, fetchSeoOverride, setActiveSeoOverride } from "./seoOverrides";
import type { SeoPublicMeta } from "../services/seo.service";

export const CANONICAL_ORIGIN = SITE_ORIGIN;

/**
 * Normalizes any route, pathname, or full URL to Tirvona's preferred
 * HTTPS canonical URL (https://www.tirvona.com/...). Follows the shared route
 * policy (src/seo/routePolicy.ts), which the server-rendered HTML uses too:
 * aliases resolve to one URL and query strings (filters, utm_*, gclid, ...)
 * are never part of a canonical.
 */
export const cleanCanonicalUrl = (rawPathOrUrl: string): string => {
  if (!rawPathOrUrl) return `${CANONICAL_ORIGIN}/`;

  try {
    const url = new URL(rawPathOrUrl, CANONICAL_ORIGIN);
    return canonicalUrlFor(url.pathname);
  } catch {
    return `${CANONICAL_ORIGIN}/`;
  }
};

export const upsertLink = (rel: string, href: string): HTMLLinkElement => {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
  return tag;
};

export const upsertMeta = (
  attr: "name" | "property",
  key: string,
  content: string,
): HTMLMetaElement => {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
  return tag;
};

export const setCanonicalMeta = (
  href: string,
  options?: {
    title?: string;
    description?: string;
    image?: string;
  },
): void => {
  const cleanHref = cleanCanonicalUrl(href);
  upsertLink("canonical", cleanHref);
  upsertMeta("property", "og:url", cleanHref);
  upsertMeta("name", "twitter:url", cleanHref);

  // A published SEO record's title and description win over the page's own, as on the server.
  const override = activeSeoOverride(new URL(cleanHref).pathname);
  const title = override?.title || options?.title;
  const description = override?.description || options?.description;
  if (title) {
    document.title = title;
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);
  }
  if (description) {
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:description", description);
  }
  if (options?.image) {
    upsertMeta("property", "og:image", options.image);
    upsertMeta("name", "twitter:image", options.image);
  }
};

/** Writes a published SEO record's overrides into the head (title, description, robots, added JSON-LD). */
export const applySeoOverride = (meta: SeoPublicMeta): void => {
  if (meta.title) {
    document.title = meta.title;
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("name", "twitter:title", meta.title);
  }
  if (meta.description) {
    upsertMeta("name", "description", meta.description);
    upsertMeta("property", "og:description", meta.description);
    upsertMeta("name", "twitter:description", meta.description);
  }
  upsertMeta("name", "robots", meta.robots);
  document.querySelectorAll('script[data-seo-editorial="true"]').forEach((node) => node.remove());
  if (meta.schema) {
    // Marked like the server's copy, so the tracker removes it on the next navigation.
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seoSsr = "true";
    script.dataset.seoEditorial = "true";
    script.textContent = JSON.stringify(meta.schema);
    document.head.appendChild(script);
  }
};

export interface CanonicalOptions {
  /** The path this page should live at, e.g. /ashrams/vrindavan/hotel-krishna-anandam. */
  canonicalPath?: string | null;
  title?: string;
  description?: string;
  image?: string;
  /**
   * Replaces the address bar when the visitor arrived on a legacy or
   * non-canonical path. The server issues the real 301; this keeps the URL
   * tidy for in-app navigation and local development.
   */
  replaceUrl?: boolean;
}

/**
 * Hook to set page-specific canonical URL, document title, and SEO meta tags.
 */
export const useCanonicalUrl = ({
  canonicalPath,
  title,
  description,
  image,
  replaceUrl = true,
}: CanonicalOptions): void => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!canonicalPath) return;
    const cleanHref = cleanCanonicalUrl(canonicalPath);
    setCanonicalMeta(cleanHref, { title, description, image });
  }, [canonicalPath, title, description, image]);

  useEffect(() => {
    if (!replaceUrl || !canonicalPath) return;
    const targetUrl = new URL(canonicalPath, CANONICAL_ORIGIN);
    if (location.pathname === targetUrl.pathname) return;
    navigate(`${targetUrl.pathname}${location.search}`, { replace: true });
  }, [replaceUrl, canonicalPath, location.pathname, location.search, navigate]);
};

/**
 * Global component that runs on route changes to ensure EVERY page dynamically
 * receives a self-referencing canonical URL using the preferred HTTPS WWW origin
 * and stripping any tracking parameters (utm_*, gclid, fbclid, etc.).
 *
 * It also keeps the robots tag in line with the route policy (private pages
 * noindex). On the first load the server already wrote the page's title,
 * description and JSON-LD, so those are left alone; on later in-app
 * navigation they are reset to the new route's static values (or the site
 * defaults), and entity pages then set their own through useCanonicalUrl.
 */
export const CanonicalUrlTracker: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const firstRender = useRef(true);

  // Published SEO records (seo_pages) for public pages: applied once they arrive, and kept
  // when the page then sets its own title (setCanonicalMeta reads the active override).
  useEffect(() => {
    const canonicalPath = new URL(cleanCanonicalUrl(location.pathname)).pathname;
    setActiveSeoOverride(canonicalPath, null);
    const kind = classifyPath(location.pathname).kind;
    if (kind !== "static" && kind !== "entity") return;
    let current = true;
    fetchSeoOverride(canonicalPath).then((result) => {
      if (!current || !result) return;
      if (result.kind === "retired") {
        if (result.redirectTo) navigate(result.redirectTo, { replace: true });
        else upsertMeta("name", "robots", "noindex,follow");
        return;
      }
      setActiveSeoOverride(canonicalPath, result.meta);
      applySeoOverride(result.meta);
    });
    return () => {
      current = false;
    };
  }, [location.pathname, navigate]);

  // Canonicals never carry the query string, so filter changes must not reset what the page set.
  useEffect(() => {
    const clean = cleanCanonicalUrl(location.pathname);
    upsertLink("canonical", clean);
    upsertMeta("property", "og:url", clean);
    upsertMeta("name", "twitter:url", clean);
    upsertMeta("name", "robots", robotsFor(location.pathname));

    if (firstRender.current) {
      firstRender.current = false;
      // Pages that write their own JSON-LD replace the server's copy instead of duplicating it.
      document
        .querySelectorAll('script[data-seo-client-replaces="true"]')
        .forEach((node) => node.remove());
      return;
    }

    document.querySelectorAll('script[data-seo-ssr="true"]').forEach((node) => node.remove());
    const match = classifyPath(location.pathname);
    const staticPage = match.kind === "static" ? STATIC_PAGES[match.canonicalPath] : undefined;
    const title =
      staticPage?.title ??
      (match.kind === "utility" || match.kind === "section" ? match.title : DEFAULT_TITLE);
    document.title = title;
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);
    const description = staticPage?.description ?? DEFAULT_DESCRIPTION;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:description", description);
  }, [location.pathname]);

  return null;
};
