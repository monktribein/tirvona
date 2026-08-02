import React, { createContext, useContext, useState, useEffect } from "react";

export interface BookingSearchState {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
}

interface BookingSearchContextType {
  searchState: BookingSearchState;
  updateBookingSearch: (partial: Partial<BookingSearchState>) => void;
  totalGuests: number;
  summaryLabel: string;
}

const STORAGE_KEY = "tirvona_booking_search";

export const getStoredBookingSearch = (): BookingSearchState => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        destination: parsed.destination || "",
        checkIn: parsed.checkIn || "",
        checkOut: parsed.checkOut || "",
        rooms: Math.max(1, Number(parsed.rooms) || 1),
        adults: Math.max(1, Number(parsed.adults) || 2),
        children: Math.max(0, Number(parsed.children) || 0),
      };
    }
  } catch  {
    // Fallback to default
  }
  return {
    destination: "",
    checkIn: "",
    checkOut: "",
    rooms: 1,
    adults: 2,
    children: 0,
  };
};

export const formatBookingSummary = (
  rooms: number,
  adults: number,
  children: number,
): string => {
  const r = Math.max(1, rooms || 1);
  const a = Math.max(1, adults || 1);
  const c = Math.max(0, children || 0);

  const parts: string[] = [];
  parts.push(`${r} Room${r > 1 ? "s" : ""}`);
  parts.push(`${a} Adult${a > 1 ? "s" : ""}`);
  if (c > 0) {
    parts.push(`${c} Child${c > 1 ? "ren" : ""}`);
  }
  return parts.join(" · ");
};

const defaultContext: BookingSearchContextType = {
  searchState: getStoredBookingSearch(),
  updateBookingSearch: () => {},
  totalGuests: 2,
  summaryLabel: "1 Room · 2 Adults",
};

const BookingSearchContext =
  createContext<BookingSearchContextType>(defaultContext);

export const BookingSearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [searchState, setSearchState] = useState<BookingSearchState>(
    getStoredBookingSearch,
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searchState));
    } catch (e) {
      console.warn("BookingSearchContext storage write error", e);
    }
  }, [searchState]);

  const updateBookingSearch = (partial: Partial<BookingSearchState>) => {
    setSearchState((prev) => {
      const next = {
        ...prev,
        ...partial,
        rooms:
          partial.rooms !== undefined ? Math.max(1, partial.rooms) : prev.rooms,
        adults:
          partial.adults !== undefined
            ? Math.max(1, partial.adults)
            : prev.adults,
        children:
          partial.children !== undefined
            ? Math.max(0, partial.children)
            : prev.children,
      };
      return next;
    });
  };

  const totalGuests = (searchState.adults || 1) + (searchState.children || 0);
  const summaryLabel = formatBookingSummary(
    searchState.rooms,
    searchState.adults,
    searchState.children,
  );

  return (
    <BookingSearchContext.Provider
      value={{
        searchState,
        updateBookingSearch,
        totalGuests,
        summaryLabel,
      }}
    >
      {children}
    </BookingSearchContext.Provider>
  );
};

export const useBookingSearch = () => useContext(BookingSearchContext);
export default BookingSearchContext;
