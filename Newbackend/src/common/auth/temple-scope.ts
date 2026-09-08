import { ForbiddenException } from "@nestjs/common";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { canManageAllTemples, isTempleOwner } from "./temple-access";

export type TempleScope = string[] | null;

export const UNRESTRICTED_TEMPLE_SCOPE: TempleScope = null;

export const isUnrestrictedTempleScope = (scope: TempleScope): scope is null =>
  scope === null;

export const assignedTempleIds = (
  user: Pick<AuthenticatedUser, "scopedTempleIds" | "employerTempleId">,
): string[] => [
  ...new Set([
    ...(user.scopedTempleIds ?? []).map(String),
    ...(user.employerTempleId ? [String(user.employerTempleId)] : []),
  ]),
];

export const resolveTempleScope = async (
  user: AuthenticatedUser,
  temples: Model<any>,
): Promise<TempleScope> => {
  if (canManageAllTemples(user)) return UNRESTRICTED_TEMPLE_SCOPE;

  const ids = new Set<string>(assignedTempleIds(user));

  if (isTempleOwner(user)) {
    const owned = await temples
      .find({ ownerId: user.id, deletedAt: null })
      .select("_id")
      .lean();
    for (const row of owned as any[]) ids.add(String(row._id));
  }

  return [...ids];
};

export const templeScopeContains = (
  scope: TempleScope,
  templeId: unknown,
): boolean => {
  if (isUnrestrictedTempleScope(scope)) return true;
  const id = templeId == null ? "" : String((templeId as any)?._id ?? templeId);
  return id !== "" && scope.includes(id);
};

export const assertTempleInScope = (
  scope: TempleScope,
  templeId: unknown,
  message = "You do not have access to this temple.",
): void => {
  if (!templeScopeContains(scope, templeId)) throw new ForbiddenException(message);
};

export const templeScopeFilter = (
  scope: TempleScope,
  field = "_id",
): Record<string, unknown> =>
  isUnrestrictedTempleScope(scope) ? {} : { [field]: { $in: scope } };
