/**
 * Turn a machine value into something a person reads.
 *
 * The API returns enum-shaped values — `BOOKING_ENGINE`, `pending_approval`,
 * `ASHRAM_VERIFY_APPROVED` — and the console used to print them verbatim, so
 * screens were full of shouting underscored tokens. Rendering goes through
 * here instead; the stored value is never rewritten, only its presentation.
 *
 *   humanizeLabel("BOOKING_ENGINE")         → "Booking engine"
 *   humanizeLabel("pending_approval")       → "Pending approval"
 *   humanizeLabel("ASHRAM_VERIFY_APPROVED") → "Ashram verify approved"
 *   humanizeLabel("super_admin")            → "Super admin"
 */
export const humanizeLabel = (value?: string | null): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const words = text
    .replace(/[_-]+/g, " ")
    // Split camelCase / PascalCase without touching runs of capitals.
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const label = words
    .map((word, index) => {
      // A token that is already mixed case is a proper name the author chose —
      // "McKinsey", "iPhone" — so it is left exactly as written.
      const isShouted = word === word.toUpperCase();
      const base = isShouted ? word.toLowerCase() : word;
      return index === 0 ? base.charAt(0).toUpperCase() + base.slice(1) : base;
    })
    .join(" ");
  return tUi(label);
};

/** Title Case each word, for names and headings rather than enum values. */
export const titleizeLabel = (value?: string | null): string =>
  humanizeLabel(value)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default humanizeLabel;
import { tUi } from "../contexts/LanguageContext";
