
const API_BASE_URL = (import.meta.env.VITE_API_URL || "api.tirvona.com")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const API_ROOT = `${API_BASE_URL}/api/v1/smart-contact`;

export const slugFromLocation = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return last === "c" ? "" : last;
};

export const sourceFromLocation = () => {
  const value = new URLSearchParams(window.location.search).get("src") ?? "";
  return value.slice(0, 60);
};

export const fetchProfile = async (slug, { source, scan } = {}) => {
  const params = new URLSearchParams();
  if (source) params.set("src", source);
  if (scan) params.set("scan", "true");
  const query = params.toString();

  let response;
  try {
    response = await fetch(
      `${API_ROOT}/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
      { headers: { Accept: "application/json" } },
    );
  } catch {
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
  }
};

export const vcardUrl = (slug, source) => {
  const query = source ? `?src=${encodeURIComponent(source)}` : "";
  return `${API_ROOT}/${encodeURIComponent(slug)}/vcard${query}`;
};

export const idCardUrl = (slug, source) => {
  const query = source ? `?src=${encodeURIComponent(source)}` : "";
  return `${API_ROOT}/${encodeURIComponent(slug)}/id-card${query}`;
};
