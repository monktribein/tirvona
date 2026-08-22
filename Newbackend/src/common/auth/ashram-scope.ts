import { ForbiddenException } from "@nestjs/common";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { canManageAllAshrams, isAshramOwner } from "./ashram-access";

export type AshramScope = string[] | null;

export const UNRESTRICTED_ASHRAM_SCOPE: AshramScope = null;

export const isUnrestricted = (scope: AshramScope): scope is null =>
  scope === null;

export const assignedAshramIds = (
  user: Pick<AuthenticatedUser, "scopedAshramIds" | "employerAshramId">,
): string[] => [
  ...new Set([
    ...(user.scopedAshramIds ?? []).map(String),
    ...(user.employerAshramId ? [String(user.employerAshramId)] : []),
  ]),
];

export const resolveAshramScope = async (
  user: AuthenticatedUser,
  ashrams: Model<any>,
): Promise<AshramScope> => {
  if (canManageAllAshrams(user)) return UNRESTRICTED_ASHRAM_SCOPE;

  const ids = new Set<string>(assignedAshramIds(user));

  if (isAshramOwner(user)) {
    const owned = await ashrams
      .find({ ownerId: user.id, deletedAt: null })
      .select("_id")
      .lean();
    for (const row of owned as any[]) ids.add(String(row._id));
  }

  return [...ids];
};

export const scopeContains = (
  scope: AshramScope,
  ashramId: unknown,
): boolean => {
  if (isUnrestricted(scope)) return true;
  const id = ashramId == null ? "" : String((ashramId as any)?._id ?? ashramId);
  return id !== "" && scope.includes(id);
};

export const assertAshramInScope = (
  scope: AshramScope,
  ashramId: unknown,
  message = "You do not have access to this ashram.",
): void => {
  if (!scopeContains(scope, ashramId)) throw new ForbiddenException(message);
};

export const ashramScopeFilter = (
  scope: AshramScope,
  field = "ashramId",
): Record<string, unknown> =>
  isUnrestricted(scope) ? {} : { [field]: { $in: scope } };

export const narrowRequestedAshrams = (
  scope: AshramScope,
  requested: readonly string[] | undefined,
): string[] | null => {
  const asked = [...new Set((requested ?? []).map(String).filter(Boolean))];
  if (isUnrestricted(scope)) return asked.length ? asked : null;
  if (!asked.length) return scope;
  const allowed = asked.filter((id) => scope.includes(id));
  if (!allowed.length)
    throw new ForbiddenException("You do not have access to this ashram.");
  return allowed;
};
