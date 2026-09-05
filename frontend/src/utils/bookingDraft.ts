export interface BookingDraftPayload {
  ashramId: string;
  rooms?: { roomId: string; units: number }[];
  roomId?: string;
  roomType?: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  roomsBookedCount?: number;
  adults: number;
  children: number;
  addOnQuantities?: Record<string, number>;
  services: {
    prasad: boolean;
    meals: boolean;
    parking: boolean;
    locker: boolean;
    donation: number;
  };
  couponCode?: string;
  appliedDiscount?: number;
  specialRequests?: string;
  returnUrl: string;
  timestamp: number;
}

const DRAFT_KEY = "tirvona_booking_draft";

export const saveBookingDraft = (draft: BookingDraftPayload): void => {
  try {
    const json = JSON.stringify(draft);
    localStorage.setItem(DRAFT_KEY, json);
    sessionStorage.setItem(DRAFT_KEY, json);
  } catch (err) {
    console.error("Error saving booking draft:", err);
  }
};

export const getBookingDraft = (): BookingDraftPayload | null => {
  try {
    const raw =
      localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: BookingDraftPayload = JSON.parse(raw);

    if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
      clearBookingDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

export const clearBookingDraft = (): void => {
  try {
    localStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem("pending_booking");
  } catch (err) {
    console.error("Error clearing draft:", err);
  }
};

export const hasBookingDraft = (): boolean => {
  return getBookingDraft() !== null;
};
