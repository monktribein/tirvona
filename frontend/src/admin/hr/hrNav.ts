import type { HrAccessInfo } from "../../services/hr.service";

export interface HrNavGroup {
  groupName: string;
  kind: "hr" | "my-work";
  links: { label: string; path: string }[];
}

/**
 * Sidebar entries for HR, from what the server says this user may do. Hiding a link is only
 * convenience: every HR endpoint enforces the same rules itself.
 *  - Super Admin and HR staff: the HR Management group (only the sections their permissions allow)
 *  - A manager without HR permissions: their team's tasks
 *  - Anyone with a linked employee profile: My Work
 */
export function hrNavGroups(role: string | undefined, access: HrAccessInfo | null): HrNavGroup[] {
  const isSuperAdmin = role === "super_admin";
  const can = isSuperAdmin
    ? { employees: true, tasks: true, attendance: true, reports: true }
    : access?.can ?? { employees: false, tasks: false, attendance: false, reports: false };
  const staff = Object.values(can).some(Boolean);
  const groups: HrNavGroup[] = [];

  const links: { label: string; path: string }[] = [];
  if (staff) {
    links.push({ label: "HR Dashboard", path: "/admin/hr" });
    links.push({ label: "Employees", path: "/admin/hr/employees" });
  }
  if (can.tasks || access?.isManager) links.push({ label: can.tasks ? "Daily Tasks" : "My Team's Tasks", path: "/admin/hr/tasks" });
  if (can.attendance) links.push({ label: "Attendance", path: "/admin/hr/attendance" });
  if (staff) links.push({ label: "Departments & Roles", path: "/admin/hr/structure" });
  if (can.reports) links.push({ label: "Reports & Performance", path: "/admin/hr/reports" });
  if (staff) links.push({ label: "Settings", path: "/admin/hr/settings" });
  if (links.length) groups.push({ groupName: "HR Management", kind: "hr", links });

  if (access?.employee) groups.push({ groupName: "My Work", kind: "my-work", links: [{ label: "My Tasks & Attendance", path: "/admin/hr/my-work" }] });
  return groups;
}
