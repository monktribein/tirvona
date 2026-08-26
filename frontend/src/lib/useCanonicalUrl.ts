import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const SITE_ORIGIN =
  (import.meta as any).env?.VITE_PUBLIC_SITE_URL || "https://www.tirvona.com";

const upsertLink = (rel: string, href: string): HTMLLinkElement => {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
  return tag;
};

const upsertMeta = (
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

export interface CanonicalOptions {
  /** The path this page should live at, e.g. /ashrams/haridwar/saptrishi. */
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
    const href = `${SITE_ORIGIN}${canonicalPath}`;

    upsertLink("canonical", href);
    upsertMeta("property", "og:url", href);
    if (title) {
      document.title = title;
      upsertMeta("property", "og:title", title);
    }
    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
    }
    if (image) upsertMeta("property", "og:image", image);
  }, [canonicalPath, title, description, image]);

  useEffect(() => {
    if (!replaceUrl || !canonicalPath) return;
    if (location.pathname === canonicalPath) return;
    navigate(`${canonicalPath}${location.search}`, { replace: true });
  }, [replaceUrl, canonicalPath, location.pathname, location.search, navigate]);
};
