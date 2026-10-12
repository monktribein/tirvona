/**
 * Live online katha / puja is streamed on YouTube by the pandit. Tirvona only
 * stores the link: a channel's live page (youtube.com/@name/live) or a
 * specific stream / video (youtube.com/watch?v=..., youtu.be/..., /live/...).
 * Only real YouTube hosts are accepted, so the link can never point elsewhere.
 */
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface YouTubeLink {
  /** Normalised https URL. */
  url: string;
  /** Present for a specific video / stream, so it can be embedded in Tirvona. */
  videoId: string | null;
}

export const parseYouTubeUrl = (raw: unknown): YouTubeLink | null => {
  const text = String(raw ?? "").trim();
  if (!text || text.length > 300) return null;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host) || !["https:", "http:"].includes(parsed.protocol)) return null;
  parsed.protocol = "https:";

  let videoId: string | null = null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") videoId = parts[0] ?? null;
  else if (parts[0] === "watch") videoId = parsed.searchParams.get("v");
  else if (["live", "embed", "shorts", "v"].includes(parts[0]) && parts[1]) videoId = parts[1];
  if (videoId && !VIDEO_ID.test(videoId)) videoId = null;

  // A youtu.be or watch link without a valid id points at nothing.
  if ((host === "youtu.be" || parts[0] === "watch") && !videoId) return null;
  if (host !== "youtu.be" && parts.length === 0) return null; // bare youtube.com
  return { url: parsed.toString(), videoId };
};
