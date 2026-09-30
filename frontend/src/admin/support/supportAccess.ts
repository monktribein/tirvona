import { useAuth } from "../../contexts/AuthContext";

/** Roles that can open the Support Management console (mirrors the backend's SUPPORT_HANDLER_ROLES + super_admin). */
export const SUPPORT_CONSOLE_ROLES = [
  "super_admin",
  "support",
  "national_admin",
  "marketplace_manager",
  "finance_manager",
  "service_manager",
];

export const SUPPORT_MANAGE_ALL_PERMISSION = "support.manage_all";

/** What the signed-in person may do in the console. The backend enforces the same rules. */
export function useSupportRole() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isSuperAdmin = role === "super_admin";
  const isSupervisor =
    isSuperAdmin || (role === "support" && (user?.permissions ?? []).includes(SUPPORT_MANAGE_ALL_PERMISSION));
  /** Raising tickets for customers is for Super Admin and the Support team. */
  const canCreateTickets = isSuperAdmin || role === "support";
  return { userId: user?.id ?? "", role, isSuperAdmin, isSupervisor, canCreateTickets };
}
