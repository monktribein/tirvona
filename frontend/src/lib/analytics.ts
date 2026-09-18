/**
 * Google Tag (gtag.js) tracking utility for Google Analytics 4 (GA4) & Google Ads
 */

export const GOOGLE_ADS_ID: string = "AW-18454245978";
export const GA4_MEASUREMENT_ID: string = "G-57XM8N389";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// In-memory set to prevent duplicate purchase events during the current session
const recordedPurchases = new Set<string>();

/**
 * Filter out undefined, null, or empty string properties so payloads are clean and snake_case compliant.
 */
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

/**
 * Core event emitter for GA4 and Google properties
 */
export function trackEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const payload = cleanParams(params);

  // Send event solely to the authoritative GA4 measurement ID
  window.gtag("event", eventName, {
    ...payload,
    send_to: GA4_MEASUREMENT_ID,
  });
}

/**
 * Tracks a SPA page view across configured Google properties (Google Ads & GA4).
 *
 * @param path The path including pathname and search query (excluding hash)
 * @param title Optional page title
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const pageTitle = title || document.title;
  const pageLocation = window.location.href;

  // Track page_view in Google Ads
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: pageTitle,
    page_location: pageLocation,
    send_to: GOOGLE_ADS_ID,
  });

  // Track page_view in GA4
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: pageTitle,
    page_location: pageLocation,
    send_to: GA4_MEASUREMENT_ID,
  });
}

// -------------------------------------------------------------
// REQUIRED OTA & BUSINESS EVENTS
// -------------------------------------------------------------

/** 1. view_home: When the homepage is actually viewed */
export function trackViewHome(): void {
  trackEvent("view_home");
}

/** 2. search_stay: When the user performs a stay/property search */
export interface SearchStayParams {
  destination?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  rooms?: number;
}
export function trackSearchStay(params: SearchStayParams): void {
  trackEvent("search_stay", {
    destination: params.destination,
    check_in: params.check_in,
    check_out: params.check_out,
    guests: params.guests,
    rooms: params.rooms,
  });
}

/** 3. view_search_results: When search results are actually displayed */
export interface ViewSearchResultsParams {
  destination?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  results_count?: number;
}
export function trackViewSearchResults(params: ViewSearchResultsParams): void {
  trackEvent("view_search_results", {
    destination: params.destination,
    check_in: params.check_in,
    check_out: params.check_out,
    guests: params.guests,
    results_count: params.results_count,
  });
}

/** 4. view_property: When a property/stay detail page is viewed */
export interface ViewPropertyParams {
  property_id?: string;
  property_name?: string;
  destination?: string;
}
export function trackViewProperty(params: ViewPropertyParams): void {
  trackEvent("view_property", {
    property_id: params.property_id,
    property_name: params.property_name,
    destination: params.destination,
  });
}

/** 5. select_room: When the user selects a room */
export interface SelectRoomParams {
  property_id?: string;
  property_name?: string;
  room_id?: string;
  room_name?: string;
  room_nights?: number;
  room_value?: number;
  currency?: string;
}
export function trackSelectRoom(params: SelectRoomParams): void {
  trackEvent("select_room", {
    property_id: params.property_id,
    property_name: params.property_name,
    room_id: params.room_id,
    room_name: params.room_name,
    room_nights: params.room_nights,
    room_value: params.room_value,
    currency: params.currency || "INR",
  });
}

/** 6. click_book_now: When the user clicks the Book Now action */
export interface ClickBookNowParams {
  property_id?: string;
  property_name?: string;
  room_id?: string;
  room_name?: string;
}
export function trackClickBookNow(params: ClickBookNowParams): void {
  trackEvent("click_book_now", {
    property_id: params.property_id,
    property_name: params.property_name,
    room_id: params.room_id,
    room_name: params.room_name,
  });
}

/** 7. begin_checkout: When booking/checkout begins */
export interface BeginCheckoutParams {
  booking_id?: string;
  property_id?: string;
  property_name?: string;
  destination?: string;
  check_in?: string;
  check_out?: string;
  room_nights?: number;
  booking_value?: number;
  currency?: string;
}
export function trackBeginCheckout(params: BeginCheckoutParams): void {
  trackEvent("begin_checkout", {
    booking_id: params.booking_id,
    property_id: params.property_id,
    property_name: params.property_name,
    destination: params.destination,
    check_in: params.check_in,
    check_out: params.check_out,
    room_nights: params.room_nights,
    booking_value: params.booking_value,
    currency: params.currency || "INR",
  });
}

/** 8. add_guest_details: When required guest details step is completed (NO PII) */
export interface AddGuestDetailsParams {
  booking_id?: string;
  property_id?: string;
  property_name?: string;
  destination?: string;
  guests_count?: number;
}
export function trackAddGuestDetails(params: AddGuestDetailsParams): void {
  trackEvent("add_guest_details", {
    booking_id: params.booking_id,
    property_id: params.property_id,
    property_name: params.property_name,
    destination: params.destination,
    guests_count: params.guests_count,
  });
}

/** 9. begin_payment: When payment is initiated (NO PII, NO card/UPI info) */
export interface BeginPaymentParams {
  booking_id?: string;
  property_id?: string;
  property_name?: string;
  booking_value?: number;
  currency?: string;
}
export function trackBeginPayment(params: BeginPaymentParams): void {
  trackEvent("begin_payment", {
    booking_id: params.booking_id,
    property_id: params.property_id,
    property_name: params.property_name,
    booking_value: params.booking_value,
    currency: params.currency || "INR",
  });
}

/** 10. purchase: Triggered ONLY after a booking is confirmed with deduplication */
export interface PurchaseParams {
  booking_id: string;
  property_id?: string;
  property_name?: string;
  destination?: string;
  check_in?: string;
  check_out?: string;
  room_nights?: number;
  booking_value: number;
  platform_revenue?: number;
  currency?: string;
}
export function trackPurchase(params: PurchaseParams): void {
  if (!params.booking_id) {
    console.warn("[Analytics] Purchase event ignored: missing booking_id");
    return;
  }

  // Deduplication check
  const storageKey = `tirvona_purchase_${params.booking_id}`;
  if (recordedPurchases.has(params.booking_id)) {
    return;
  }
  try {
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
      return;
    }
  } catch {}

  // Mark as recorded
  recordedPurchases.add(params.booking_id);
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }
  } catch {}

  trackEvent("purchase", {
    booking_id: params.booking_id,
    property_id: params.property_id,
    property_name: params.property_name,
    destination: params.destination,
    check_in: params.check_in,
    check_out: params.check_out,
    room_nights: params.room_nights,
    booking_value: params.booking_value,
    platform_revenue: params.platform_revenue ?? 0,
    currency: params.currency || "INR",
  });
}

/** 11. booking_failed: When a booking/payment transaction fails */
export interface BookingFailedParams {
  booking_id?: string;
  property_id?: string;
  property_name?: string;
  failure_stage?: string;
  currency?: string;
}
export function trackBookingFailed(params: BookingFailedParams): void {
  trackEvent("booking_failed", {
    booking_id: params.booking_id,
    property_id: params.property_id,
    property_name: params.property_name,
    failure_stage: params.failure_stage,
    currency: params.currency || "INR",
  });
}

/** 12. click_whatsapp: When user clicks WhatsApp action */
export interface ClickWhatsAppParams {
  page_type?: string;
  property_id?: string;
  property_name?: string;
}
export function trackClickWhatsApp(params: ClickWhatsAppParams = {}): void {
  trackEvent("click_whatsapp", {
    page_type: params.page_type,
    property_id: params.property_id,
    property_name: params.property_name,
  });
}

/** 13. click_call: When user clicks a phone/call action */
export interface ClickCallParams {
  page_type?: string;
  property_id?: string;
  property_name?: string;
}
export function trackClickCall(params: ClickCallParams = {}): void {
  trackEvent("click_call", {
    page_type: params.page_type,
    property_id: params.property_id,
    property_name: params.property_name,
  });
}
