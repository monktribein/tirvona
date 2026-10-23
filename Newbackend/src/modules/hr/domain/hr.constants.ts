/**
 * HR Management: Tirvona's own employees across its offices, their daily tasks and attendance.
 *
 * Three separate ideas, never mixed up:
 *  - department:  which team an employee belongs to (hr_departments)
 *  - designation: the employee's job title (hr_designations)
 *  - system role: what the employee's login may do in the app (users.role + users.permissions)
 * A job title never grants access. HR access is only ever one of HR_PERMISSIONS below, granted by
 * a Super Admin on the user's account; super_admin implicitly has all of them.
 */

export const HR_PERMISSIONS = {
  /** Employees, offices, departments, designations and HR settings, including contact details. */
  employees: "hr.employees.manage",
  /** Create, review and manage every employee's tasks. */
  tasks: "hr.tasks.manage",
  /** Attendance register, leave approval and attendance corrections. */
  attendance: "hr.attendance.manage",
  /** Reports and CSV exports. */
  reports: "hr.reports.view",
} as const;
export type HrCapability = keyof typeof HR_PERMISSIONS;
export const HR_CAPABILITIES = Object.keys(HR_PERMISSIONS) as HrCapability[];

export const HR_EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type HrEmployeeStatus = (typeof HR_EMPLOYEE_STATUSES)[number];

export const HR_EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;

export const HR_TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type HrTaskPriority = (typeof HR_TASK_PRIORITIES)[number];

export const HR_TASK_STATUSES = [
  "assigned",
  "in_progress",
  "blocked",
  "submitted",
  "completed",
  "cancelled",
] as const;
export type HrTaskStatus = (typeof HR_TASK_STATUSES)[number];

/** Work still to be done by the employee. Only these can become overdue. */
export const HR_OPEN_TASK_STATUSES: HrTaskStatus[] = ["assigned", "in_progress", "blocked"];

export const HR_REVIEW_STATUSES = ["none", "pending", "approved", "rejected"] as const;

export const HR_TASK_EVENT_TYPES = [
  "created",
  "edited",
  "due_changed",
  "started",
  "progress",
  "blocked",
  "unblocked",
  "submitted",
  "approved",
  "rejected",
  "reopened",
  "cancelled",
  "reassigned",
  "comment",
] as const;
export type HrTaskEventType = (typeof HR_TASK_EVENT_TYPES)[number];

export const HR_ATTENDANCE_STATUSES = ["present", "half_day", "absent"] as const;
export type HrAttendanceStatus = (typeof HR_ATTENDANCE_STATUSES)[number];

export const HR_LEAVE_TYPES = ["casual", "sick", "earned", "unpaid", "other"] as const;
export const HR_LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const HR_CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;

/** Defaults for the single hr_settings row. */
export const HR_DEFAULT_SETTINGS = {
  /** 0 = Sunday … 6 = Saturday. Days nobody is expected at work. */
  weeklyOffDays: [0],
  /** How long before the deadline the "due soon" reminder goes out. */
  dueSoonHours: 2,
};

export const HR_SETTINGS_KEY = "default";

/** Longest date range a report or attendance summary may cover. */
export const HR_MAX_REPORT_DAYS = 366;
