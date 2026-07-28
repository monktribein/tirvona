import api from '../lib/api';

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

export const userMemoryService = {
  getMemory: async () => {
    return api.get('/user-memory');
  },

  saveMemory: async (memoryData: Partial<UserMemoryProfile>) => {
    return api.post('/user-memory', memoryData);
  },

  clearCategory: async (category: string) => {
    return api.delete(`/user-memory/${category}`);
  },
};

export default userMemoryService;
