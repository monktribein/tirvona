import api from "../lib/api";

export interface UserMemoryProfile {
  bookingDraft?: Record<string, any>;
  plannerDraft?: Record<string, any>;
  offerDraft?: Record<string, any>;
  marketplaceCart?: Array<any>;
  wishlist?: Array<string>;
  recentSearches?: Array<string>;
  recentCities?: Array<string>;
  filters?: Record<string, any>;
  dashboardState?: Record<string, any>;
  profileProgress?: Record<string, any>;
  preferences?: Record<string, any>;
  recentlyViewed?: Array<string>;
  lastVisitedPage?: { path: string; timestamp: Date };
}

const MEMORY_KEYS: (keyof UserMemoryProfile)[] = [
  "bookingDraft",
  "plannerDraft",
  "offerDraft",
  "marketplaceCart",
  "wishlist",
  "recentSearches",
  "recentCities",
  "filters",
  "dashboardState",
  "profileProgress",
  "preferences",
  "recentlyViewed",
  "lastVisitedPage",
];

const toMemoryPayload = (
  memoryData: Partial<UserMemoryProfile>,
): Partial<UserMemoryProfile> => {
  const payload: Partial<UserMemoryProfile> = {};
  for (const key of MEMORY_KEYS) {
    if (memoryData[key] !== undefined) {
      (payload as Record<string, unknown>)[key] = memoryData[key];
    }
  }
  return payload;
};

export const userMemoryService = {
  getMemory: async () => {
    return api.get("/user-memory", { skipToast: true });
  },

  saveMemory: async (memoryData: Partial<UserMemoryProfile>) => {
    return api.post("/user-memory", toMemoryPayload(memoryData), {
      skipToast: true,
    });
  },

  clearCategory: async (category: string) => {
    return api.delete(`/user-memory/${category}`, { skipToast: true });
  },
};

export default userMemoryService;
