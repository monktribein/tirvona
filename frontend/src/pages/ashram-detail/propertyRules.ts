/**
 * Presentation helpers for the Property Rules & Policies section. Everything here only
 * re-arranges what the property owner entered: it never adds, removes or rewrites a rule.
 */

/** Rules that say who may stay (couples, bachelors, local guests, ID, age ...). */
const GUEST_RULE_PATTERN =
  /\b(couples?|bachelors?|unmarried|married|marriage|spouse|wife|husband|local ids?|local residents?|locals?|id proofs?|identity|aadhaar|aadhar|passport|visitors?|outsiders?|minors?|age|children|child|kids?|male|female|ladies|gents|men|women|mixed|groups?)\b/i;

/** Splits owner text into trimmed lines, dropping empty lines and any leading bullet mark. */
export const textLines = (value: unknown): string[] =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*·]+\s*/, "").trim())
    .filter(Boolean);

export interface GroupedRules {
  /** Couple, bachelor and other "who may stay" rules. */
  guest: string[];
  /** Every other rule. A rule that does not clearly match the guest group is shown here. */
  general: string[];
}

/** Sorts the property's own rule strings into the two groups. Every rule lands in exactly one. */
export function groupPropertyRules(rules: unknown): GroupedRules {
  const list = Array.isArray(rules) ? rules : [];
  const grouped: GroupedRules = { guest: [], general: [] };
  for (const entry of list) {
    for (const line of textLines(entry)) {
      (GUEST_RULE_PATTERN.test(line) ? grouped.guest : grouped.general).push(line);
    }
  }
  return grouped;
}

/**
 * Renders an owner-set "HH:MM" policy time as "12:00 PM". Values that already carry AM/PM
 * are shown as written. Returns null when the property has not set a usable time, so the
 * page can say so instead of showing a made-up default.
 */
export function formatPolicyTime(clock: unknown): string | null {
  const text = String(clock ?? "").trim();
  if (!text) return null;
  if (/\b(am|pm)\b/i.test(text)) return text;
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match || Number(match[1]) > 23) return null;
  const hours = Number(match[1]);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

export interface NearbyPlace {
  name: string;
  distance?: string;
  type?: string;
}

/** Nearby attractions as the property entered them (plain strings or { name, distance, type }). */
export function nearbyPlaces(value: unknown): NearbyPlace[] {
  if (!Array.isArray(value)) return [];
  const places: NearbyPlace[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim()) places.push({ name: item.trim() });
    } else if (item && typeof item === "object" && String((item as any).name ?? "").trim()) {
      const { name, distance, type } = item as Record<string, unknown>;
      places.push({
        name: String(name).trim(),
        distance: String(distance ?? "").trim() || undefined,
        type: String(type ?? "").trim() || undefined,
      });
    }
  }
  return places;
}
