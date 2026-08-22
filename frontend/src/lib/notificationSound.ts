import { platformSettingsService } from "../services";

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
          loaded = null;
          return config;
        });
    }
    return loaded;
  };

export const refreshNotificationSound =
  async (): Promise<NotificationSoundConfig> => {
    loaded = null;
    return loadNotificationSound();
  };

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

export const playNotificationSound = (): void => {
  if (!config.enabled) return;
  const el = audio();
  if (!el) return;
  el.currentTime = 0;
  void el.play().catch(() => {
  });
};

export const previewNotificationSound = async (
  url: string,
  volume: number,
): Promise<void> => {
  const preview = new Audio(url);
  preview.volume = Math.min(1, Math.max(0, volume));
  await preview.play();
};
