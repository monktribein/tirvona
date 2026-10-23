import api from "../lib/api";

/** HR Management API (`/api/hr/...`). Every call is authorised and scoped on the server. */

export type HrCapability = "employees" | "tasks" | "attendance" | "reports";
export type HrTaskStatus = "assigned" | "in_progress" | "blocked" | "submitted" | "completed" | "cancelled";
export type HrTaskPriority = "low" | "medium" | "high" | "urgent";
export type HrAttendanceStatus = "present" | "half_day" | "absent";
export type HrRegisterState = HrAttendanceStatus | "on_leave" | "not_marked";

export interface HrAccessInfo {
  can: Record<HrCapability, boolean>;
  isManager: boolean;
  teamSize: number;
  employee: { id: string; employeeCode: string; fullName: string; primaryOfficeId: string | null; officeIds: string[] } | null;
}

export interface HrOffice {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  active: boolean;
  employeeCount?: number;
  departmentCount?: number;
}

export interface HrDepartment {
  id: string;
  name: string;
  description: string;
  active: boolean;
  employeeCount?: number;
}

export interface HrDesignation {
  id: string;
  name: string;
  departmentId: string | null;
  active: boolean;
}

export interface HrDirectoryEntry {
  id: string;
  employeeCode: string;
  fullName: string;
  primaryOfficeId: string | null;
  officeIds: string[];
  departmentId: string | null;
  designationId: string | null;
  reportingManagerId: string | null;
}

export interface HrEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  photoUrl: string;
  status: "active" | "inactive";
  employmentType: string;
  joiningDate: string | null;
  primaryOfficeId: string | null;
  primaryOfficeName: string | null;
  offices: Array<{ id: string; name: string }>;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  responsibilities: string;
  skills: string[];
  hasLogin: boolean;
  /** Only for HR employee staff and the employee themself. */
  workEmail?: string;
  phone?: string;
  /** HR employee staff only. */
  notes?: string;
  deactivationReason?: string;
}

export interface HrEmployeeProfile extends HrEmployee {
  account: { name: string; role: string; hrPermissions: string[] } | null;
  taskSummary: Record<HrTaskStatus | "overdue", number>;
  attendanceSummary: { from: string; to: string; present: number; halfDay: number; absent: number };
  openTasks?: number;
}

export interface HrEmployeeInput {
  employeeCode?: string;
  fullName: string;
  workEmail?: string;
  phone?: string;
  photoUrl?: string;
  primaryOfficeId: string;
  officeIds?: string[];
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  employmentType?: string;
  joiningDate?: string;
  responsibilities?: string;
  skills?: string[];
  notes?: string;
  userId?: string;
}

export interface HrTask {
  id: string;
  taskNumber: string;
  groupId: string | null;
  title: string;
  description: string;
  expectedOutcome: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  officeId: string | null;
  officeName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  createdByName: string;
  assignedDate: string;
  dueAt: string;
  priority: HrTaskPriority;
  status: HrTaskStatus;
  overdue: boolean;
  progressPercent: number;
  progressNote: string;
  blockedReason: string;
  completionSummary: string;
  deliverableUrl: string;
  reviewStatus: "none" | "pending" | "approved" | "rejected";
  reviewComment: string;
  reviewedByName: string;
  reviewedAt: string | null;
  rejectionCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HrTaskEvent {
  id: string;
  type: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string;
  data: Record<string, any> | null;
  createdAt: string;
}

export interface HrTaskDetail extends HrTask {
  history: HrTaskEvent[];
  permissions: { work: boolean; manage: boolean; review: boolean };
}

export interface HrAttendanceDay {
  id: string;
  date: string;
  status: HrAttendanceStatus;
  officeId: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  source: "self" | "hr" | "correction";
  note: string;
}

export interface HrRegisterRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  officeName: string | null;
  departmentName: string | null;
  state: HrRegisterState;
  onApprovedLeave: boolean;
  attendance: HrAttendanceDay | null;
}

export interface HrAttendanceSummaryRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  officeName: string | null;
  departmentName: string | null;
  workingDays: number;
  present: number;
  halfDay: number;
  leaveDays: number;
  absent: number;
  notMarked: number;
}

export interface HrLeave {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  fromDate: string;
  toDate: string;
  type: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decidedByName: string;
  decidedAt: string | null;
  decisionNote: string;
  createdAt: string;
}

export interface HrCorrection {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  date: string;
  requestedStatus: HrAttendanceStatus;
  requestedCheckInAt: string | null;
  requestedCheckOutAt: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedByName: string;
  decidedAt: string | null;
  decisionNote: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  createdAt: string;
}

export interface HrDashboard {
  date: string;
  employees: {
    active: number;
    byOffice: Array<{ officeId: string; name: string; count: number }>;
    present: number;
    onLeave: number;
    absentOrNotCheckedIn: number;
  };
  tasks: {
    assigned: number;
    completed: number;
    inProgress: number;
    overdue: number;
    pendingReview: number;
    assignedByStatus: Record<HrTaskStatus, number>;
  };
}

export interface HrTaskMetrics {
  assigned: number;
  completed: number;
  completedOnTime: number;
  firstPassApproved: number;
  open: number;
  overdue: number;
  blocked: number;
  pendingReview: number;
  cancelled: number;
  rejections: number;
  completedByPriority: Record<HrTaskPriority, number>;
  avgCompletionHours: number | null;
}

export interface HrTaskReportRow extends HrTaskMetrics {
  key: string;
  label: string;
  employeeCode: string | null;
}

export interface HrTaskReport {
  from: string;
  to: string;
  groupBy: "employee" | "office" | "department";
  truncated: boolean;
  totals: HrTaskMetrics;
  data: HrTaskReportRow[];
}

type Params = Record<string, string | number | boolean | undefined>;

/** Drops empty filters so the server never sees `officeId=`. */
const clean = (params?: Params) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "" && v !== null));

const data = async <T>(promise: Promise<{ data: any }>): Promise<T> => (await promise).data?.data as T;

export const hrService = {
  // ---- who am I in HR (safe for every signed-in user; no toast on failure)
  access: () => data<HrAccessInfo>(api.get("/hr/me/access", { skipToast: true })),

  // ---- dashboard
  dashboard: (params?: Params) => api.get("/hr/dashboard", { params: clean(params) }),

  // ---- organisation
  offices: () => data<HrOffice[]>(api.get("/hr/offices")),
  createOffice: (body: Partial<HrOffice>) => data<HrOffice>(api.post("/hr/offices", body)),
  updateOffice: (id: string, body: Partial<HrOffice>) => data<HrOffice>(api.patch(`/hr/offices/${id}`, body)),
  departments: () => data<HrDepartment[]>(api.get("/hr/departments")),
  createDepartment: (body: { name: string; description?: string }) => data<HrDepartment>(api.post("/hr/departments", body)),
  updateDepartment: (id: string, body: Partial<HrDepartment>) => data<HrDepartment>(api.patch(`/hr/departments/${id}`, body)),
  designations: () => data<HrDesignation[]>(api.get("/hr/designations")),
  createDesignation: (body: { name: string; departmentId?: string }) => data<HrDesignation>(api.post("/hr/designations", body)),
  updateDesignation: (id: string, body: { name?: string; departmentId?: string; active?: boolean }) =>
    data<HrDesignation>(api.patch(`/hr/designations/${id}`, body)),
  settings: () => data<{ weeklyOffDays: number[]; dueSoonHours: number }>(api.get("/hr/settings")),
  updateSettings: (body: { weeklyOffDays?: number[]; dueSoonHours?: number }) => data(api.patch("/hr/settings", body)),

  // ---- employees
  employees: (params?: Params) => api.get("/hr/employees", { params: clean(params) }),
  directory: () => data<HrDirectoryEntry[]>(api.get("/hr/employees/directory", { skipToast: true })),
  employee: (id: string) => data<HrEmployeeProfile>(api.get(`/hr/employees/${id}`)),
  createEmployee: (body: HrEmployeeInput) => data<HrEmployeeProfile>(api.post("/hr/employees", body)),
  updateEmployee: (id: string, body: Partial<HrEmployeeInput>) => data<HrEmployeeProfile>(api.patch(`/hr/employees/${id}`, body)),
  setEmployeeStatus: (id: string, status: "active" | "inactive", reason?: string) =>
    data<HrEmployeeProfile>(api.patch(`/hr/employees/${id}/status`, { status, reason })),
  accountLookup: (params: { email?: string; phone?: string }) =>
    data<{ id: string; name: string; role: string; status: string; linkedEmployee: { id: string; employeeCode: string; fullName: string } | null } | null>(
      api.get("/hr/account-lookup", { params: clean(params) }),
    ),

  // ---- tasks
  tasks: (params?: Params) => api.get("/hr/tasks", { params: clean(params) }),
  myTasks: (params?: Params) => api.get("/hr/me/tasks", { params: clean(params) }),
  task: (id: string) => data<HrTaskDetail>(api.get(`/hr/tasks/${id}`)),
  createTask: (body: {
    title: string;
    description?: string;
    expectedOutcome?: string;
    employeeIds: string[];
    assignToMultiple?: boolean;
    assignedDate?: string;
    dueAt: string;
    priority?: HrTaskPriority;
    idempotencyKey?: string;
  }) => data<HrTask[]>(api.post("/hr/tasks", body)),
  updateTask: (id: string, body: { title?: string; description?: string; expectedOutcome?: string; dueAt?: string; priority?: HrTaskPriority }) =>
    data<HrTaskDetail>(api.patch(`/hr/tasks/${id}`, body)),
  startTask: (id: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/start`, {})),
  taskProgress: (id: string, body: { progressPercent?: number; note: string }) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/progress`, body)),
  blockTask: (id: string, reason: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/block`, { reason })),
  unblockTask: (id: string, note?: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/unblock`, { note })),
  submitTask: (id: string, body: { completionSummary: string; deliverableUrl?: string }) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/submit`, body)),
  reviewTask: (id: string, decision: "approve" | "reject", comment?: string) =>
    data<HrTaskDetail>(api.post(`/hr/tasks/${id}/review`, { decision, comment })),
  reopenTask: (id: string, reason: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/reopen`, { reason })),
  cancelTask: (id: string, reason: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/cancel`, { reason })),
  reassignTask: (id: string, employeeId: string, reason: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/reassign`, { employeeId, reason })),
  commentTask: (id: string, message: string) => data<HrTaskDetail>(api.post(`/hr/tasks/${id}/comments`, { message })),

  // ---- attendance (HR)
  register: (params?: Params) => api.get("/hr/attendance", { params: clean(params) }),
  markAttendance: (body: { employeeId: string; date: string; status: HrAttendanceStatus; checkInAt?: string; checkOutAt?: string; reason: string }) =>
    data<HrAttendanceDay>(api.put("/hr/attendance", body)),
  attendanceSummary: (params: Params) =>
    data<{ from: string; to: string; weeklyOffDays: number[]; data: HrAttendanceSummaryRow[] }>(api.get("/hr/reports/attendance", { params: clean(params) })),
  leaves: (params?: Params) => api.get("/hr/leaves", { params: clean(params) }),
  recordLeave: (body: { employeeId: string; fromDate: string; toDate: string; type: string; reason: string }) => data<HrLeave>(api.post("/hr/leaves", body)),
  decideLeave: (id: string, decision: "approve" | "reject", note?: string) => data<HrLeave>(api.post(`/hr/leaves/${id}/decision`, { decision, note })),
  corrections: (params?: Params) => api.get("/hr/attendance-corrections", { params: clean(params) }),
  decideCorrection: (id: string, decision: "approve" | "reject", note?: string) =>
    data<HrCorrection>(api.post(`/hr/attendance-corrections/${id}/decision`, { decision, note })),

  // ---- attendance (self)
  myToday: () => data<{ date: string; attendance: HrAttendanceDay | null; onLeave: boolean }>(api.get("/hr/me/attendance/today")),
  myAttendance: (params?: Params) =>
    data<{ from: string; to: string; days: HrAttendanceDay[]; summary: Omit<HrAttendanceSummaryRow, "employeeId" | "employeeCode" | "fullName" | "officeName" | "departmentName"> }>(
      api.get("/hr/me/attendance", { params: clean(params) }),
    ),
  checkIn: (officeId?: string) => data(api.post("/hr/me/attendance/check-in", officeId ? { officeId } : {})),
  checkOut: () => data(api.post("/hr/me/attendance/check-out", {})),
  myLeaves: () => data<HrLeave[]>(api.get("/hr/me/leaves")),
  requestLeave: (body: { fromDate: string; toDate: string; type: string; reason: string }) => data<HrLeave>(api.post("/hr/me/leaves", body)),
  cancelMyLeave: (id: string) => data<HrLeave>(api.post(`/hr/me/leaves/${id}/cancel`, {})),
  myCorrections: () => data<HrCorrection[]>(api.get("/hr/me/attendance-corrections")),
  requestCorrection: (body: { date: string; requestedStatus: HrAttendanceStatus; requestedCheckInAt?: string; requestedCheckOutAt?: string; reason: string }) =>
    data<HrCorrection>(api.post("/hr/me/attendance-corrections", body)),

  // ---- reports
  taskReport: (params: Params) => data<HrTaskReport>(api.get("/hr/reports/tasks", { params: clean(params) })),
};
