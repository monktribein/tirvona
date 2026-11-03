/**
 * Location scope for the `hr` and `executive` roles: such a login sees and
 * manages only records whose address mentions the city of the HR office it is
 * assigned to.
 *
 * Addresses across Tirvona are free text in many shapes ("Raman Reti,
 * Vrindavan", "Vrindaban, UP", city/district fields...), so a record is in
 * scope when any of its address fields contains one of the scope's place
 * names, ignoring case. Places that are run as one area are grouped:
 * Vrindavan is inside Mathura district, so either office covers both.
 */
import { ForbiddenException, NotFoundException } from "@nestjs/common";

export const HR_ROLE = "hr";
export const EXECUTIVE_ROLE = "executive";
/** Roles limited to the area of their assigned office. */
export const LOCATION_SCOPED_ROLES: readonly string[] = [HR_ROLE, EXECUTIVE_ROLE];

/** Place names treated as one area, spelling variants included. */
const AREA_GROUPS: Array<{ label: string; names: string[] }> = [
  { label: "Vrindavan & Mathura", names: ["vrindavan", "vrindaban", "brindavan", "brindaban", "mathura", "muttra"] },
];

/** null = not location-restricted (every role except `hr` and `executive`). */
export type LocationScope = {
  /** The office's city as entered, for display. */
  city: string;
  officeName: string;
  /** The area as people say it, e.g. "Vrindavan & Mathura". */
  area?: string;
  /** Lower-case place names a record's address must contain one of. Empty = sees nothing. */
  terms: string[];
} | null;

export const isLocationScopedUser = (user: { role?: string } | null | undefined): boolean =>
  LOCATION_SCOPED_ROLES.includes(String(user?.role ?? ""));

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** The place names an office in `city` covers. */
export function placeTermsForCity(city: string): string[] {
  const key = normalise(city ?? "");
  if (!key) return [];
  const group = areaGroupFor(key);
  return group ? [...group.names] : [key];
}

/** The area an office in `city` covers, as people say it. */
export function areaLabelForCity(city: string): string {
  const key = normalise(city ?? "");
  if (!key) return "";
  return areaGroupFor(key)?.label ?? key.replace(/\b\w/g, (c) => c.toUpperCase());
}

const areaGroupFor = (key: string) => AREA_GROUPS.find((g) => g.names.some((name) => key.includes(name)));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A query filter keeping only records in scope: any of `fields` contains a
 * place name. {} when unrestricted; a filter matching nothing when the HR
 * login has no office yet.
 */
export function locationFilter(scope: LocationScope, fields: string[]): Record<string, unknown> {
  if (scope === null) return {};
  if (!scope.terms.length) return { _id: { $in: [] } };
  return {
    $or: fields.flatMap((field) =>
      scope.terms.map((term) => ({ [field]: new RegExp(escapeRegex(term), "i") })),
    ),
  };
}

/** `base` narrowed to the scope, without disturbing an $or it already has. */
export function withLocation(
  base: Record<string, unknown>,
  scope: LocationScope,
  fields: string[],
): Record<string, unknown> {
  const location = locationFilter(scope, fields);
  if (!Object.keys(location).length) return base;
  if (!Object.keys(base).length) return location;
  return { $and: [base, location] };
}

/** Whether any of the given address texts is in scope. */
export function locationMatches(scope: LocationScope, ...texts: unknown[]): boolean {
  if (scope === null) return true;
  if (!scope.terms.length) return false;
  const haystack = texts
    .flatMap((t) => (Array.isArray(t) ? t : [t]))
    .filter((t) => t !== null && t !== undefined)
    .map((t) => normalise(typeof t === "object" ? JSON.stringify(t) : String(t)))
    .join(" | ");
  return scope.terms.some((term) => haystack.includes(term));
}

/**
 * Refuses a record outside the scope. Reported as not found, so an HR login
 * cannot learn that records exist in another city.
 */
export function assertInLocation(scope: LocationScope, what: string, ...texts: unknown[]): void {
  if (!locationMatches(scope, ...texts)) throw new NotFoundException(`${what} not found`);
}

/** Refuses creating or moving a record to an address outside the scope. */
export function assertWritableInLocation(scope: LocationScope, ...texts: unknown[]): void {
  if (!locationMatches(scope, ...texts))
    throw new ForbiddenException(
      scope?.terms.length
        ? `This address is outside your office's area (${scope.city}).`
        : "Your HR account has no office assigned yet. Ask a Super Admin to assign one.",
    );
}

/** For actions that are never location-scoped (platform-wide settings): HR may not do them. */
export function refuseHr(user: { role?: string }, message = "HR accounts cannot do this."): void {
  if (isLocationScopedUser(user)) throw new ForbiddenException(message);
}
