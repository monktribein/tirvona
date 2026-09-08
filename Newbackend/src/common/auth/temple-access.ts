import type { AuthenticatedUser } from "../decorators/current-user.decorator";

export const TEMPLE_OWNER_ROLE = "temple_owner";

export const isTempleOwner = (
  user: Pick<AuthenticatedUser, "role">,
): boolean => user.role === TEMPLE_OWNER_ROLE;

export const canManageAllTemples = (
  user: Pick<AuthenticatedUser, "role">,
): boolean => user.role === "super_admin";
