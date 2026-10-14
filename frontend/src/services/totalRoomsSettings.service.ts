export interface TotalRoomsOverrideConfig {
  enabled: boolean;
  totalRooms?: number | null;
  registeredRooms?: number | null;
  onlineRooms?: number | null; // Tirvona rooms
  offlineRooms?: number | null;
  availableRooms?: number | null;
  bookedRooms?: number | null;
  occupiedRooms?: number | null;
  blockedRooms?: number | null;
  heldRooms?: number | null;
  updatedAt?: string | null;
}

const STORAGE_KEY = "tirvona_total_rooms_override";
export const OVERRIDE_EVENT_KEY = "tirvona_total_rooms_override_changed";

export const defaultOverrideConfig: TotalRoomsOverrideConfig = {
  enabled: false,
  totalRooms: null,
  registeredRooms: null,
  onlineRooms: null,
  offlineRooms: null,
  availableRooms: null,
  bookedRooms: null,
  occupiedRooms: null,
  blockedRooms: null,
  heldRooms: null,
  updatedAt: null,
};

export const getLocalOverride = (): TotalRoomsOverrideConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultOverrideConfig;
    const parsed = JSON.parse(raw);
    return { ...defaultOverrideConfig, ...parsed };
  } catch {
    return defaultOverrideConfig;
  }
};

export const setLocalOverride = (config: TotalRoomsOverrideConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(OVERRIDE_EVENT_KEY, { detail: config }));
  } catch {
    // ignore local storage errors
  }
};

export const totalRoomsSettingsService = {
  getOverride: (): TotalRoomsOverrideConfig => {
    return getLocalOverride();
  },

  saveOverride: (config: TotalRoomsOverrideConfig): TotalRoomsOverrideConfig => {
    const hasCustomValue = Object.entries(config).some(
      ([k, v]) => k !== "enabled" && k !== "updatedAt" && v !== null && v !== undefined,
    );
    const payload: TotalRoomsOverrideConfig = {
      ...config,
      enabled: hasCustomValue ? true : Boolean(config.enabled),
      updatedAt: new Date().toISOString(),
    };
    setLocalOverride(payload);
    return payload;
  },

  resetOverride: (): TotalRoomsOverrideConfig => {
    const resetConfig: TotalRoomsOverrideConfig = {
      enabled: false,
      totalRooms: null,
      registeredRooms: null,
      onlineRooms: null,
      offlineRooms: null,
      availableRooms: null,
      bookedRooms: null,
      occupiedRooms: null,
      blockedRooms: null,
      heldRooms: null,
      updatedAt: new Date().toISOString(),
    };
    setLocalOverride(resetConfig);
    return resetConfig;
  },
};

