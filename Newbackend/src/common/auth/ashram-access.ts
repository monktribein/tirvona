import type { AuthenticatedUser } from "../decorators/current-user.decorator";

/** Canonical roles used by the accommodation console. */
export const ASHRAM_ADMIN_ROLE = "ashram_admin";
export const ASHRAM_OWNER_ROLE = "ashram_owner";

/**
 * The first platform-wide accommodation account predates the dedicated role
 * and was stored as an ordinary owner. This recogniser is retained only while
 * old databases are upgraded.
 */
export const isLegacyPlatformStayAdmin = (
  user: Pick<AuthenticatedUser, "role" | "name" | "permissions">,
): boolean =>
  user.role === "owner" &&
  (user.permissions?.includes("ashrams.manage_all") ||
    String(user.name ?? "").trim().toLowerCase() === "ashram stay admin");

/** Resolve old role values without ever granting a scoped owner global access. */
export const canonicalAshramRole = (
  user: Pick<AuthenticatedUser, "role" | "name" | "permissions">,
): string => {
  if (user.role === ASHRAM_ADMIN_ROLE) return ASHRAM_ADMIN_ROLE;
  if (user.role === ASHRAM_OWNER_ROLE) return ASHRAM_OWNER_ROLE;
  if (user.role === "stay_admin") return ASHRAM_ADMIN_ROLE;
  if (isLegacyPlatformStayAdmin(user)) return ASHRAM_ADMIN_ROLE;
  if (user.role === "owner") return ASHRAM_OWNER_ROLE;
  return user.role;
};

export const isAshramOwner = (
  user: Pick<AuthenticatedUser, "role" | "name" | "permissions">,
): boolean => canonicalAshramRole(user) === ASHRAM_OWNER_ROLE;

export const canManageAllAshrams = (
  user: Pick<AuthenticatedUser, "role" | "name" | "permissions">,
): boolean =>
  user.role === "super_admin" ||
  user.role === ASHRAM_ADMIN_ROLE ||
  user.role === "stay_admin" ||
  user.permissions?.includes("ashrams.manage_all") ||
  isLegacyPlatformStayAdmin(user);
