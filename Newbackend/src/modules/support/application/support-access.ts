import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  SUPPORT_AGENT_ROLE,
  SUPPORT_HANDLER_ROLES,
  SUPPORT_MANAGE_ALL_PERMISSION,
} from "../domain/support.constants";

/**
 * Who may see and work which tickets.
 *
 * - super_admin, and support agents holding `support.manage_all`, are
 *   supervisors: every ticket, assigning anyone, the full dashboard.
 * - A support agent sees tickets assigned to them plus the unassigned queue.
 * - A handler role (marketplace_manager, finance_manager, …) sees the same,
 *   but only inside categories that list that role in `handlerRoles`.
 * - Everyone else is a customer and only ever sees their own tickets.
 */
export const isSupervisor = (user: AuthenticatedUser): boolean =>
  user.role === "super_admin" ||
  (user.role === SUPPORT_AGENT_ROLE &&
    (user.permissions ?? []).includes(SUPPORT_MANAGE_ALL_PERMISSION));

export const isStaff = (user: AuthenticatedUser): boolean =>
  user.role === "super_admin" ||
  (SUPPORT_HANDLER_ROLES as readonly string[]).includes(user.role);

/**
 * Mongo filter limiting tickets to what this staff member may see.
 * `handledCategories` are the category keys whose handlerRoles include the
 * user's role (only relevant for non-support handler roles).
 */
export function staffScopeFilter(
  user: AuthenticatedUser,
  handledCategories: string[],
): Record<string, unknown> {
  if (isSupervisor(user)) return {};
  const mineOrQueue = { $or: [{ assignedTo: user.id }, { assignedTo: null }] };
  if (user.role === SUPPORT_AGENT_ROLE) return mineOrQueue;
  return {
    $and: [
      mineOrQueue,
      { category: { $in: handledCategories.length ? handledCategories : ["__none__"] } },
    ],
  };
}

export function canStaffSee(
  user: AuthenticatedUser,
  ticket: { assignedTo?: unknown; category: string },
  handledCategories: string[],
): boolean {
  if (isSupervisor(user)) return true;
  const assignee = ticket.assignedTo ? String((ticket.assignedTo as any)?._id ?? ticket.assignedTo) : null;
  const mineOrQueue = assignee === null || assignee === user.id;
  if (!mineOrQueue) return false;
  if (user.role === SUPPORT_AGENT_ROLE) return true;
  return handledCategories.includes(ticket.category);
}
