import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const CANONICAL_ORIGIN = "https://www.tirvona.com";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_EXACT_PARAMS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "twclid",
  "yclid",
  "mc_eid",
  "igshid",
  "_ga",
  "_gl",
  "ref",
  "source",
  "campaign",
]);

/**
 * Normalizes any route, pathname, or full URL to Tirvona's preferred
 * HTTPS canonical URL (https://www.tirvona.com/...) and strips tracking parameters
 * such as utm_source, utm_medium, gclid, fbclid, etc.
 */
export const cleanCanonicalUrl = (rawPathOrUrl: string): string => {
  if (!rawPathOrUrl) return `${CANONICAL_ORIGIN}/`;

  try {
    const url = new URL(rawPathOrUrl, CANONICAL_ORIGIN);
    let pathname = url.pathname.replace(/\/+/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    const params = new URLSearchParams(url.search);
    const keysToDelete: string[] = [];
    params.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
        TRACKING_EXACT_PARAMS.has(lower)
      ) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => params.delete(key));

    // For indexable destination, stay, content and SEO landing pages, canonical
    // URLs are clean paths without query parameters.
    const isStandardCleanPage =
      pathname === "/" ||
      pathname.startsWith("/ashrams") ||
      pathname.startsWith("/stays") ||
      pathname.startsWith("/Stays-near-prem-mandir-vrindavan") ||
      pathname.startsWith("/temples") ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/contact") ||
      pathname.startsWith("/faq") ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/refund-policy") ||
      pathname.startsWith("/cancellation-policy") ||
      pathname.startsWith("/stay-policies") ||
      pathname.startsWith("/govt-guidelines");

    const searchStr =
      isStandardCleanPage || params.size === 0 ? "" : `?${params.toString()}`;

    return `${CANONICAL_ORIGIN}${pathname}${searchStr}`;
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

  if (options?.title) {
    document.title = options.title;
    upsertMeta("property", "og:title", options.title);
    upsertMeta("name", "twitter:title", options.title);
  }
  if (options?.description) {
    upsertMeta("name", "description", options.description);
    upsertMeta("property", "og:description", options.description);
    upsertMeta("name", "twitter:description", options.description);
  }
  if (options?.image) {
    upsertMeta("property", "og:image", options.image);
    upsertMeta("name", "twitter:image", options.image);
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
 */
export const CanonicalUrlTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const raw = `${location.pathname}${location.search}`;
    const clean = cleanCanonicalUrl(raw);
    upsertLink("canonical", clean);
    upsertMeta("property", "og:url", clean);
    upsertMeta("name", "twitter:url", clean);
  }, [location.pathname, location.search]);

  return null;
};
