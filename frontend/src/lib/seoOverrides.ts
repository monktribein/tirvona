import axios from "axios";
import { seoService, type SeoPublicMeta } from "../services/seo.service";

/**
 * Published SEO overrides (seo_pages) for in-app navigation. The server-rendered HTML already
 * carries them on a full page load; this keeps the browser's title, description, robots and
 * added JSON-LD the same after React takes over and on every later navigation.
 */
export type SeoOverrideResult =
  | { kind: "override"; meta: SeoPublicMeta }
  | { kind: "retired"; redirectTo: string | null }
  | null;

const requests = new Map<string, Promise<SeoOverrideResult>>();
let active: { path: string; meta: SeoPublicMeta | null } = { path: "", meta: null };

/** One request per path per visit; "no record" (404) and network failures both mean "no override". */
export const fetchSeoOverride = (path: string): Promise<SeoOverrideResult> => {
  let request = requests.get(path);
  if (!request) {
    request = seoService
      .meta(path)
      .then((res): SeoOverrideResult => (res.data?.data ? { kind: "override", meta: res.data.data as SeoPublicMeta } : null))
      .catch((error): SeoOverrideResult => {
        if (axios.isAxiosError(error) && error.response?.status === 410) {
          return { kind: "retired", redirectTo: (error.response.data as { redirectTo?: string | null })?.redirectTo ?? null };
        }
        return null;
      });
    requests.set(path, request);
  }
  return request;
};

export const setActiveSeoOverride = (path: string, meta: SeoPublicMeta | null): void => {
  active = { path, meta };
};

/** The override for the page being shown, so a page setting its own title cannot undo it. */
export const activeSeoOverride = (path: string): SeoPublicMeta | null => (active.path === path ? active.meta : null);
