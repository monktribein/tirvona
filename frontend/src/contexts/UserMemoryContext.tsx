import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  userMemoryService,
  type UserMemoryProfile,
} from "../services/userMemory.service";
import { useAuth } from "./AuthContext";

interface UserMemoryContextType {
  memory: UserMemoryProfile;
  updateMemoryCategory: (category: keyof UserMemoryProfile, value: any) => void;
  clearMemoryCategory: (category: keyof UserMemoryProfile) => void;
  syncMemory: () => Promise<void>;
  loading: boolean;
}

const defaultMemory: UserMemoryProfile = {
  bookingDraft: {},
  plannerDraft: {},
  offerDraft: {},
  marketplaceCart: [],
  wishlist: [],
  recentSearches: [],
  recentCities: [],
  filters: {},
  dashboardState: {},
  profileProgress: {},
  preferences: { language: "en", currency: "INR", theme: "light" },
  recentlyViewed: [],
  lastVisitedPage: { path: "/", timestamp: new Date() },
};

const UserMemoryContext = createContext<UserMemoryContextType>({
  memory: defaultMemory,
  updateMemoryCategory: () => {},
  clearMemoryCategory: () => {},
  syncMemory: async () => {},
  loading: false,
});

export const UserMemoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [memory, setMemory] = useState<UserMemoryProfile>(() => {
    try {
      const cached = localStorage.getItem("tirvona_user_memory");
      return cached ? JSON.parse(cached) : defaultMemory;
    } catch  {
      return defaultMemory;
    }
  });

  const [loading, setLoading] = useState(false);
  const syncTimerRef = useRef<any>(null);

  // Load memory from MongoDB backend
  useEffect(() => {
    fetchRemoteMemory();
  }, [user]);

  const fetchRemoteMemory = async () => {
    setLoading(true);
    try {
      const res = await userMemoryService.getMemory();
      if (res.data?.success && res.data.data) {
        const {
          _id: _discardedId,
          __v: _discardedVersion,
          createdAt: _discardedCreatedAt,
          updatedAt: _discardedUpdatedAt,
          sessionId: _discardedSessionId,
          userId: _discardedUserId,
          ...remoteMemory
        } = res.data.data;
        const merged = { ...defaultMemory, ...remoteMemory };
        setMemory(merged);
        localStorage.setItem("tirvona_user_memory", JSON.stringify(merged));
      }
    } catch  {
      console.warn("UserMemory fetch offline/fallback to cache");
    } finally {
      setLoading(false);
    }
  };

  // Schedule debounced auto-save sync to MongoDB
  const scheduleSync = (updatedMemory: UserMemoryProfile) => {
    localStorage.setItem("tirvona_user_memory", JSON.stringify(updatedMemory));

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      try {
        await userMemoryService.saveMemory(updatedMemory);
      } catch  {
        console.warn("Debounced UserMemory sync error (cached locally)");
      }
    }, 2500);
  };

  const updateMemoryCategory = (
    category: keyof UserMemoryProfile,
    value: any,
  ) => {
    setMemory((prev) => {
      const updated = { ...prev, [category]: value };
      scheduleSync(updated);
      return updated;
    });
  };

  const clearMemoryCategory = (category: keyof UserMemoryProfile) => {
    setMemory((prev) => {
      const emptyVal = Array.isArray(prev[category]) ? [] : {};
      const updated = { ...prev, [category]: emptyVal };
      scheduleSync(updated);
      userMemoryService.clearCategory(category as string).catch(() => {});
      return updated;
    });
  };

  const syncMemory = async () => {
    await fetchRemoteMemory();
  };

  return (
    <UserMemoryContext.Provider
      value={{
        memory,
        updateMemoryCategory,
        clearMemoryCategory,
        syncMemory,
        loading,
      }}
    >
      {children}
    </UserMemoryContext.Provider>
  );
};

export const useMemory = () => useContext(UserMemoryContext);
export default UserMemoryContext;
