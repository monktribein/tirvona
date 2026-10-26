/**
 * Menu configuration published from Super Admin → Assistant Management.
 *
 * It is data only: visibility, an enabled flag, an order and (for modules) a display name for ids the
 * code already registers. Ids the code does not know are ignored, and nothing in it is ever run or
 * opened. It never grants access: who may see a record is still decided by the user's role and the API.
 */
import api from "../../lib/api";
import type { AssistantEntryConfig, AssistantMenuConfig } from "./assistantTypes";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/;
const LABEL_MAX = 40;
/** How long a fetched configuration is trusted before the next time the assistant opens re-reads it. */
export const CONFIG_FRESH_MS = 60_000;
const STORAGE_KEY = "tirvona_assistant_config";

export interface PublishedConfig {
  revision: number;
  entries: AssistantEntryConfig[];
  updatedAt: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
}

/** Keeps only well-formed entries; anything odd is dropped rather than trusted. */
export const sanitizeEntries = (raw: unknown): AssistantEntryConfig[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AssistantEntryConfig[] = [];
  for (const item of raw.slice(0, 300)) {
    const e = item as Partial<AssistantEntryConfig> | null;
    if (!e || typeof e.id !== "string" || !ID.test(e.id) || seen.has(e.id)) continue;
    if (typeof e.visible !== "boolean" || typeof e.enabled !== "boolean") continue;
    if (typeof e.order !== "number" || !Number.isFinite(e.order)) continue;
    seen.add(e.id);
    const label =
      typeof e.label === "string" && e.label.trim() && e.label.length <= LABEL_MAX && !/[<>]/.test(e.label)
        ? e.label.trim()
        : undefined;
    out.push({ id: e.id, visible: e.visible, enabled: e.enabled, order: e.order, ...(label ? { label } : {}) });
  }
  return out;
};

export const toMenuConfig = (published: PublishedConfig | null): AssistantMenuConfig | null =>
  published && published.entries.length
    ? { revision: published.revision, byId: new Map(published.entries.map((e) => [e.id, e])) }
    : null;

const sanitizePublished = (body: any): PublishedConfig | null => {
  const data = body?.data;
  if (!data || typeof data !== "object") return null;
  return {
    revision: Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0,
    entries: sanitizeEntries(data.entries),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    updatedByName: typeof data.updatedByName === "string" ? data.updatedByName : null,
  };
};

let memory: { config: PublishedConfig; at: number } | null = null;

const remember = (config: PublishedConfig) => {
  memory = { config, at: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* storage can be unavailable; the in-memory copy still works */
  }
};

/** The last configuration that loaded safely on this device (public, not per-account data). */
const lastKnownGood = (): PublishedConfig | null => {
  if (memory) return memory.config;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePublished({ data: JSON.parse(raw) }) : null;
  } catch {
    return null;
  }
};

export const configIsFresh = () => Boolean(memory && Date.now() - memory.at < CONFIG_FRESH_MS);

export const assistantConfigApi = {
  /**
   * The published configuration every visitor gets. When the request fails, falls back to the last
   * safely loaded one, then to the built-in menu (null) — never to an error the visitor has to handle.
   */
  async load(force = false): Promise<PublishedConfig | null> {
    if (!force && memory && configIsFresh()) return memory.config;
    try {
      const res = await api.get("/assistant-config", { skipToast: true });
      const config = sanitizePublished(res.data);
      if (config) {
        remember(config);
        return config;
      }
    } catch {
      /* fall through to the last known good copy */
    }
    return lastKnownGood();
  },

  /** Super Admin only; the server enforces it. Includes who published last. */
  async loadForAdmin(): Promise<PublishedConfig> {
    const res = await api.get("/assistant-config/admin", { skipToast: true });
    const config = sanitizePublished(res.data);
    if (!config) throw new Error("The assistant configuration could not be read.");
    return config;
  },

  async publish(entries: AssistantEntryConfig[], expectedRevision: number): Promise<PublishedConfig> {
    const res = await api.put("/assistant-config", { entries, expectedRevision }, { skipToast: true });
    const config = sanitizePublished(res.data);
    if (!config) throw new Error("The server did not return the published configuration.");
    remember(config);
    return config;
  },

  async reset(): Promise<PublishedConfig> {
    const res = await api.delete("/assistant-config", { skipToast: true });
    const config = sanitizePublished(res.data);
    if (!config) throw new Error("The server did not return the restored configuration.");
    remember(config);
    return config;
  },
};

