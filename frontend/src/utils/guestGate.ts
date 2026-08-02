/**
 * Session-scoped authentication return intent.
 *
 * It preserves the route, scroll position, domain-specific draft data and safe
 * form controls while a guest signs in. Passwords, OTPs, payment data, tokens,
 * files and government identifiers are deliberately never persisted.
 */

export type GuestIntentType =
  | "ashram_booking"
  | "parking_booking"
  | "service_booking"
  | "volunteer_apply"
  | "marketplace_cart"
  | "wishlist_add"
  | "review_submit"
  | "generic";

interface SafeFormField {
  index: number;
  id?: string;
  name?: string;
  occurrence?: number;
  value?: string;
  checked?: boolean;
}

interface PageSnapshot {
  fields: SafeFormField[];
  scrollX: number;
  scrollY: number;
}

export interface GuestPendingIntent {
  type: GuestIntentType;
  returnUrl: string;
  data?: Record<string, unknown>;
  page?: PageSnapshot;
  timestamp?: number;
}

const GUEST_INTENT_KEY = "tirvona_guest_pending_intent";
const MAX_INTENT_AGE_MS = 60 * 60 * 1000;
const FIELD_SELECTOR = "input, textarea, select";
const SENSITIVE_FIELD =
  /(password|passcode|otp|one.?time|token|secret|card|cvv|cvc|government|govt|aadhaar|aadhar|pan.?number)/i;

const isSensitiveField = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) => {
  const inputType = field instanceof HTMLInputElement ? field.type : "";
  if (["password", "hidden", "file"].includes(inputType)) return true;
  if (
    field.autocomplete === "one-time-code" ||
    field.autocomplete === "cc-number"
  )
    return true;
  return SENSITIVE_FIELD.test(
    `${field.name} ${field.id} ${field.autocomplete}`,
  );
};

const capturePage = (): PageSnapshot | undefined => {
  if (typeof document === "undefined") return undefined;
  const controls = Array.from(
    document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(FIELD_SELECTOR),
  );
  const nameCounts = new Map<string, number>();
  const fields = controls.flatMap((field, index): SafeFormField[] => {
    if (field.disabled || isSensitiveField(field)) return [];
    if (
      field instanceof HTMLInputElement &&
      ["button", "submit", "reset"].includes(field.type)
    )
      return [];
    const name = field.name || undefined;
    const occurrence = name ? (nameCounts.get(name) ?? 0) : undefined;
    if (name) nameCounts.set(name, (occurrence ?? 0) + 1);
    const locator = {
      index,
      id: field.id || undefined,
      name,
      occurrence,
    };
    if (
      field instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(field.type)
    )
      return [{ ...locator, checked: field.checked }];
    return [{ ...locator, value: field.value }];
  });
  return { fields, scrollX: window.scrollX, scrollY: window.scrollY };
};

export const safeLocalReturnUrl = (
  candidate?: string | null,
): string | null => {
  if (!candidate || typeof window === "undefined") return null;
  try {
    if (candidate.startsWith("//")) return null;
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (["/login", "/register"].includes(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export const currentReturnUrl = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const setGuestPendingIntent = (intent: GuestPendingIntent): void => {
  try {
    const returnUrl = safeLocalReturnUrl(intent.returnUrl);
    if (!returnUrl) return;
    // A snapshot only belongs to the page it was captured from. Some actions
    // intentionally return to the next step (for example parking detail ->
    // checkout); restoring controls from the previous page there can populate
    // unrelated inputs that happen to share a DOM index.
    const page =
      intent.page ??
      (safeLocalReturnUrl(currentReturnUrl()) === returnUrl
        ? capturePage()
        : undefined);
    sessionStorage.setItem(
      GUEST_INTENT_KEY,
      JSON.stringify({
        ...intent,
        returnUrl,
        page,
        timestamp: Date.now(),
      }),
    );
  } catch (err) {
    console.error("Error saving authentication return intent:", err);
  }
};

export const getGuestPendingIntent = (): GuestPendingIntent | null => {
  try {
    const raw = sessionStorage.getItem(GUEST_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestPendingIntent;
    if (
      !parsed.timestamp ||
      Date.now() - parsed.timestamp > MAX_INTENT_AGE_MS ||
      !safeLocalReturnUrl(parsed.returnUrl)
    ) {
      clearGuestPendingIntent();
      return null;
    }
    return parsed;
  } catch {
    clearGuestPendingIntent();
    return null;
  }
};

export const clearGuestPendingIntent = (): void => {
  try {
    sessionStorage.removeItem(GUEST_INTENT_KEY);
  } catch (err) {
    console.error("Error clearing authentication return intent:", err);
  }
};

const setNativeValue = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) => {
  const prototype =
    field instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
};

/** Restores safe mounted controls. Returns false while async page controls are absent. */
export const restorePendingPageSnapshot = (): boolean => {
  const intent = getGuestPendingIntent();
  if (!intent?.page) return true;
  if (safeLocalReturnUrl(currentReturnUrl()) !== intent.returnUrl) return false;

  const controls = Array.from(
    document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(FIELD_SELECTOR),
  );
  if (intent.page.fields.length > 0 && controls.length === 0) return false;

  for (const snapshot of intent.page.fields) {
    const field =
      (snapshot.id
        ? controls.find((control) => control.id === snapshot.id)
        : undefined) ??
      (snapshot.name
        ? controls.filter(
            (control) =>
              control.name === snapshot.name && !isSensitiveField(control),
          )[snapshot.occurrence ?? 0]
        : undefined) ??
      controls[snapshot.index];
    if (!field || isSensitiveField(field)) continue;
    if (
      field instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(field.type) &&
      snapshot.checked !== undefined
    ) {
      field.checked = snapshot.checked;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (snapshot.value !== undefined) {
      setNativeValue(field, snapshot.value);
    }
  }
  window.scrollTo(intent.page.scrollX, intent.page.scrollY);
  return true;
};
