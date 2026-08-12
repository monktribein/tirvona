/**
 * The public Smart Contact API client.
 *
 * Deliberately tiny and dependency-free — no axios, no query library. The page
 * makes exactly one read on load and fire-and-forget writes on taps, and spec
 * §39 budgets the whole page at under two seconds on mobile data.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const API_ROOT = `${API_BASE_URL}/api/v1/smart-contact`;

/**
 * Reads the slug out of the path.
 *
 * `/c/ravindr-bhardwaj` in production; the last non-empty segment is taken so
 * the same code works when the app is served from the Vite dev server root.
 */
export const slugFromLocation = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return last === "c" ? "" : last;
};

/** `?src=business-card` — QR placement attribution (spec §28). */
export const sourceFromLocation = () => {
  const value = new URLSearchParams(window.location.search).get("src") ?? "";
  return value.slice(0, 60);
};

export const fetchProfile = async (slug, { source, scan } = {}) => {
  const params = new URLSearchParams();
  if (source) params.set("src", source);
  // Tells the server this visit began as a scan rather than a shared link, so
  // the funnel in spec §51 can separate the two stages.
  if (scan) params.set("scan", "true");
  const query = params.toString();

  let response;
  try {
    response = await fetch(
      `${API_ROOT}/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
      { headers: { Accept: "application/json" } },
    );
  } catch {
    // fetch rejects with an opaque TypeError ("Failed to fetch") for a dead
    // server, a DNS failure and a CORS rejection alike — the browser will not
    // say which. Surfacing that string helps nobody, so it becomes a message
    // that at least names the thing to check.
    const error = new Error(
      "Could not reach the Tirvona contact service. Please check your connection and try again.",
    );
    error.network = true;
    throw error;
  }

  if (response.status === 404) {
    const error = new Error("This Tirvona contact page could not be found.");
    error.notFound = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error("Could not load this contact page. Please try again.");
  }

  const payload = await response.json();
  return payload.data;
};

/**
 * Reports a CTA tap.
 *
 * `keepalive` rather than a plain fetch: taps on Call and WhatsApp navigate
 * away immediately, and without it the browser cancels the in-flight request
 * before it leaves — which would systematically undercount exactly the two
 * actions the product most wants to measure. Errors are swallowed; a failed
 * count must never interrupt someone trying to make a phone call.
 */
export const logEvent = (slug, eventType, source) => {
  if (!slug || !eventType) return;
  try {
    void fetch(`${API_ROOT}/${encodeURIComponent(slug)}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source ? { eventType, source } : { eventType }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics is best-effort by design */
  }
};

/** The dynamic .vcf endpoint (spec §9). */
export const vcardUrl = (slug, source) => {
  const query = source ? `?src=${encodeURIComponent(source)}` : "";
  return `${API_ROOT}/${encodeURIComponent(slug)}/vcard${query}`;
};
