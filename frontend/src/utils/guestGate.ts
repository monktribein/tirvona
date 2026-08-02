/**
 * Guest Intent & Authentication Gate System
 * Temporarily preserves intent, search filters, selected rooms, products, or job applications
 * when an unauthenticated guest attempts a protected action.
 */

export interface GuestPendingIntent {
  type:
    | "ashram_booking"
    | "volunteer_apply"
    | "marketplace_cart"
    | "wishlist_add"
    | "review_submit"
    | "generic";
  returnUrl: string;
  data?: Record<string, any>;
  timestamp?: number;
}

const GUEST_INTENT_KEY = "tirvona_guest_pending_intent";

export const setGuestPendingIntent = (intent: GuestPendingIntent): void => {
  try {
    sessionStorage.setItem(
      GUEST_INTENT_KEY,
      JSON.stringify({ ...intent, timestamp: Date.now() }),
    );
  } catch (err) {
    console.error("Error saving guest pending intent:", err);
  }
};

export const getGuestPendingIntent = (): GuestPendingIntent | null => {
  try {
    const raw = sessionStorage.getItem(GUEST_INTENT_KEY);
    if (!raw) return null;
    const parsed: GuestPendingIntent = JSON.parse(raw);
    // Expire intents older than 1 hour
    if (parsed.timestamp && Date.now() - parsed.timestamp > 3600 * 1000) {
      sessionStorage.removeItem(GUEST_INTENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearGuestPendingIntent = (): void => {
  try {
    sessionStorage.removeItem(GUEST_INTENT_KEY);
  } catch (err) {
    console.error("Error clearing guest pending intent:", err);
  }
};
