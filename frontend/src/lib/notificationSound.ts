import { platformSettingsService } from "../services";

/**
 * The platform-wide notification alert tone.
 *
 * The Super Admin uploads one sound in the Notification Center and it plays on
 * every dashboard, for every role — so this module is deliberately a singleton
 * shared by the whole app rather than per-provider state. `NotificationContext`
 * calls `playNotificationSound()` for every notification it surfaces, and the
 * settings screen calls `refreshNotificationSound()` after saving so open tabs
 * pick the new tone up without a reload.
 */

export interface NotificationSoundConfig {
  enabled: boolean;
  url: string;
  fileName: string;
  volume: number;
}

const DEFAULT_CONFIG: NotificationSoundConfig = {
  enabled: false,
  url: "",
  fileName: "",
  volume: 0.7,
};

let config: NotificationSoundConfig = DEFAULT_CONFIG;
let loaded: Promise<NotificationSoundConfig> | null = null;
let element: HTMLAudioElement | null = null;
let unlocked = false;

const subscribers = new Set<(next: NotificationSoundConfig) => void>();

const publish = () => subscribers.forEach((fn) => fn(config));

/** Subscribe to config changes. Returns an unsubscribe function. */
export const onNotificationSoundChange = (
  fn: (next: NotificationSoundConfig) => void,
): (() => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

export const getNotificationSound = (): NotificationSoundConfig => config;

const normalize = (raw: unknown): NotificationSoundConfig => {
  const value = (raw ?? {}) as Partial<NotificationSoundConfig>;
  const url = typeof value.url === "string" ? value.url : "";
  return {
    // A tone that is "enabled" with no file is the same as no tone at all.
    enabled: Boolean(value.enabled) && url.length > 0,
    url,
    fileName: typeof value.fileName === "string" ? value.fileName : "",
    volume:
      typeof value.volume === "number" && Number.isFinite(value.volume)
        ? Math.min(1, Math.max(0, value.volume))
        : 0.7,
  };
};

const applyConfig = (next: NotificationSoundConfig) => {
  const changed = next.url !== config.url;
  config = next;
  if (changed) {
    element = null;
    unlocked = false;
  }
  if (element) element.volume = config.volume;
  publish();
};

/** Reads the setting once and caches it; concurrent callers share one request. */
export const loadNotificationSound =
  async (): Promise<NotificationSoundConfig> => {
    if (!loaded) {
      loaded = platformSettingsService
        .getSettings()
        .then((res) => {
          applyConfig(normalize(res.data?.data?.notificationSound));
          return config;
        })
        .catch(() => {
          // The tone is a nicety; a settings outage must never break a
          // dashboard. Fall back to silence and allow a later retry.
          loaded = null;
          return config;
        });
    }
    return loaded;
  };

/** Re-reads the setting after the Super Admin saves a new tone. */
export const refreshNotificationSound =
  async (): Promise<NotificationSoundConfig> => {
    loaded = null;
    return loadNotificationSound();
  };

/** Applies a locally-known config immediately (used by the settings form). */
export const setNotificationSound = (raw: unknown): void =>
  applyConfig(normalize(raw));

const audio = (): HTMLAudioElement | null => {
  if (!config.url) return null;
  if (!element) {
    element = new Audio(config.url);
    element.preload = "auto";
    element.crossOrigin = "anonymous";
  }
  element.volume = config.volume;
  return element;
};

/**
 * Browsers refuse to play audio until the user has interacted with the page,
 * and the rejection is silent. Priming a muted play on the first real gesture
 * buys the permission up front, so the first genuine notification is audible
 * instead of being the one that gets swallowed.
 */
export const primeNotificationSound = (): void => {
  if (unlocked) return;
  const el = audio();
  if (!el) return;
  const wasMuted = el.muted;
  el.muted = true;
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = wasMuted;
      unlocked = true;
    })
    .catch(() => {
      el.muted = wasMuted;
    });
};

/** Plays the configured tone. Silent no-op when disabled or not yet allowed. */
export const playNotificationSound = (): void => {
  if (!config.enabled) return;
  const el = audio();
  if (!el) return;
  // Restart rather than queue: a burst of notifications should sound like one
  // alert, not a stack of overlapping copies.
  el.currentTime = 0;
  void el.play().catch(() => {
    /* autoplay still blocked — nothing useful to do or say */
  });
};

/** Plays an arbitrary URL once, for the "test" button on the settings form. */
export const previewNotificationSound = async (
  url: string,
  volume: number,
): Promise<void> => {
  const preview = new Audio(url);
  preview.volume = Math.min(1, Math.max(0, volume));
  await preview.play();
};
