import { Schema, SchemaTypes } from "../../../../database/orm";
import {
  HR_ATTENDANCE_STATUSES,
  HR_CORRECTION_STATUSES,
  HR_EMPLOYEE_STATUSES,
  HR_EMPLOYMENT_TYPES,
  HR_LEAVE_STATUSES,
  HR_LEAVE_TYPES,
  HR_REVIEW_STATUSES,
  HR_TASK_EVENT_TYPES,
  HR_TASK_PRIORITIES,
  HR_TASK_STATUSES,
} from "../../domain/hr.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});

const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

/** Lower-cased, single-spaced name used to stop "Sales" and " sales " being created twice. */
const nameKey = { type: String, required: true, unique: true, index: true, trim: true };

/**
 * 1. hr_offices: Tirvona's offices. Configured by an authorised admin; never hard-deleted.
 */
export const HrOfficeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    nameKey,
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    active: { type: Boolean, default: true, index: true },
    createdBy: id("User"),
  },
  opts("hr_offices"),
);

/**
 * 2. hr_departments: which team an employee belongs to.
 */
export const HrDepartmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey,
    description: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true, index: true },
    createdBy: id("User"),
  },
  opts("hr_departments"),
);

/**
 * 3. hr_designations: job titles. A title grants no access to anything.
 */
export const HrDesignationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Unique per department (see the index below), so "Team Lead" can exist in several. */
    nameKey: { type: String, required: true, trim: true },
    /** Optional: the department this title belongs to. */
    departmentId: id("HrDepartment"),
    active: { type: Boolean, default: true, index: true },
    createdBy: id("User"),
  },
  opts("hr_designations"),
);
HrDesignationSchema.index({ departmentId: 1, nameKey: 1 }, { unique: true, name: "ux_hr_designation_department_name" });

/**
 * 4. hr_employees: one row per person, even if they work from both offices (officeIds).
 * `userId` optionally links the person's existing Tirvona login; linking never changes that
 * login's role or permissions.
 */
export const HrEmployeeSchema = new Schema(
  {
    employeeCode: { type: String, required: true, unique: true, index: true, trim: true, uppercase: true },
    userId: { type: SchemaTypes.ObjectId, ref: "User", unique: true, sparse: true, default: null },
    fullName: { type: String, required: true, trim: true },
    workEmail: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    photoUrl: { type: String, trim: true, default: "" },
    primaryOfficeId: id("HrOffice", true),
    /** Every office the employee works from; always contains primaryOfficeId. */
    officeIds: { type: [SchemaTypes.ObjectId], ref: "HrOffice", default: [] },
    departmentId: id("HrDepartment"),
    designationId: id("HrDesignation"),
    reportingManagerId: id("HrEmployee"),
    status: { type: String, enum: HR_EMPLOYEE_STATUSES, default: "active", index: true },
    employmentType: { type: String, enum: HR_EMPLOYMENT_TYPES, default: "full_time" },
    /** IST calendar date, YYYY-MM-DD. */
    joiningDate: { type: String, trim: true },
    responsibilities: { type: String, trim: true, default: "" },
    skills: { type: [String], default: [] },
    /** HR-only notes. Never shown to managers or the employee. */
    notes: { type: String, trim: true, default: "" },
    deactivatedAt: { type: Date },
    deactivationReason: { type: String, trim: true },
    createdBy: id("User"),
  },
  opts("hr_employees"),
);
HrEmployeeSchema.index({ primaryOfficeId: 1, status: 1 }, { name: "ix_hr_employee_office" });
HrEmployeeSchema.index({ officeIds: 1 }, { name: "ix_hr_employee_offices" });
HrEmployeeSchema.index({ departmentId: 1, status: 1 }, { name: "ix_hr_employee_department" });
HrEmployeeSchema.index({ reportingManagerId: 1, status: 1 }, { name: "ix_hr_employee_manager" });

/**
 * 5. hr_tasks: one row per employee per task. A task given to several people on purpose is
 * several rows sharing `groupId`.
 */
export const HrTaskSchema = new Schema(
  {
    taskNumber: { type: String, required: true, unique: true, index: true, trim: true },
    groupId: { type: String, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    expectedOutcome: { type: String, trim: true, default: "" },
    employeeId: id("HrEmployee", true),
    /** The employee's office and department when the task was (re)assigned. */
    officeId: id("HrOffice"),
    departmentId: id("HrDepartment"),
    createdBy: id("User", true),
    createdByName: { type: String, trim: true },
    /** IST calendar date the work is for, YYYY-MM-DD. */
    assignedDate: { type: String, required: true, trim: true },
    dueAt: { type: Date, required: true },
    priority: { type: String, enum: HR_TASK_PRIORITIES, default: "medium", index: true },
    status: { type: String, enum: HR_TASK_STATUSES, default: "assigned", index: true },
    progressPercent: { type: Number, default: 0 },
    progressNote: { type: String, trim: true, default: "" },
    blockedReason: { type: String, trim: true, default: "" },
    completionSummary: { type: String, trim: true, default: "" },
    deliverableUrl: { type: String, trim: true, default: "" },
    reviewStatus: { type: String, enum: HR_REVIEW_STATUSES, default: "none" },
    reviewComment: { type: String, trim: true, default: "" },
    reviewedBy: id("User"),
    reviewedByName: { type: String, trim: true },
    reviewedAt: { type: Date },
    rejectionCount: { type: Number, default: 0 },
    startedAt: { type: Date },
    submittedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    /** Reminder claims: set once per due time so a reminder is never sent twice. */
    dueSoonNotified: { type: Boolean, default: false },
    overdueNotified: { type: Boolean, default: false },
    /** Lets a retried create return the tasks it already created instead of creating them twice. */
    idempotencyKey: { type: String, trim: true },
  },
  opts("hr_tasks"),
);
HrTaskSchema.index({ employeeId: 1, assignedDate: -1 }, { name: "ix_hr_task_employee_date" });
HrTaskSchema.index({ officeId: 1, assignedDate: -1 }, { name: "ix_hr_task_office_date" });
HrTaskSchema.index({ departmentId: 1, assignedDate: -1 }, { name: "ix_hr_task_department_date" });
HrTaskSchema.index({ status: 1, dueAt: 1 }, { name: "ix_hr_task_status_due" });
HrTaskSchema.index({ assignedDate: -1 }, { name: "ix_hr_task_date" });
HrTaskSchema.index({ completedAt: -1 }, { name: "ix_hr_task_completed" });
HrTaskSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true, name: "ux_hr_task_idem" });

/**
 * 6. hr_task_events: append-only history of every task (assignment, status changes, reviews,
 * reassignment, comments). There is no API that edits or deletes a row here.
 */
export const HrTaskEventSchema = new Schema(
  {
    taskId: id("HrTask", true),
    type: { type: String, enum: HR_TASK_EVENT_TYPES, required: true },
    actorId: id("User"),
    actorName: { type: String, trim: true },
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    message: { type: String, trim: true, default: "" },
    data: { type: SchemaTypes.Mixed },
  },
  opts("hr_task_events"),
);
HrTaskEventSchema.index({ taskId: 1, createdAt: 1 }, { name: "ix_hr_task_event_task" });

/**
 * 7. hr_attendance: at most one row per employee per IST day.
 */
export const HrAttendanceSchema = new Schema(
  {
    employeeId: id("HrEmployee", true),
    date: { type: String, required: true, trim: true },
    officeId: id("HrOffice"),
    status: { type: String, enum: HR_ATTENDANCE_STATUSES, required: true },
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    /** "self": the employee checked in; "hr": entered by HR; "correction": an approved correction. */
    source: { type: String, enum: ["self", "hr", "correction"], default: "self" },
    note: { type: String, trim: true, default: "" },
    updatedBy: id("User"),
  },
  opts("hr_attendance"),
);
HrAttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true, name: "ux_hr_attendance_employee_day" });
HrAttendanceSchema.index({ date: 1, officeId: 1 }, { name: "ix_hr_attendance_date_office" });

/**
 * 8. hr_leaves: leave requests and HR-recorded leave. Only "approved" leave counts.
 */
export const HrLeaveSchema = new Schema(
  {
    employeeId: id("HrEmployee", true),
    fromDate: { type: String, required: true, trim: true },
    toDate: { type: String, required: true, trim: true },
    type: { type: String, enum: HR_LEAVE_TYPES, default: "casual" },
    reason: { type: String, trim: true, default: "" },
    status: { type: String, enum: HR_LEAVE_STATUSES, default: "pending", index: true },
    requestedBy: id("User"),
    decidedBy: id("User"),
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, default: "" },
  },
  opts("hr_leaves"),
);
HrLeaveSchema.index({ employeeId: 1, fromDate: 1 }, { name: "ix_hr_leave_employee" });
HrLeaveSchema.index({ status: 1, fromDate: 1, toDate: 1 }, { name: "ix_hr_leave_status_dates" });

/**
 * 9. hr_attendance_corrections: an employee asks for a day's attendance to be fixed; HR
 * approves or rejects. The before/after values stay on the row as the audit history.
 */
export const HrAttendanceCorrectionSchema = new Schema(
  {
    employeeId: id("HrEmployee", true),
    date: { type: String, required: true, trim: true },
    requestedStatus: { type: String, enum: HR_ATTENDANCE_STATUSES, required: true },
    requestedCheckInAt: { type: Date },
    requestedCheckOutAt: { type: Date },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: HR_CORRECTION_STATUSES, default: "pending", index: true },
    requestedBy: id("User"),
    decidedBy: id("User"),
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, default: "" },
    before: { type: SchemaTypes.Mixed },
    after: { type: SchemaTypes.Mixed },
  },
  opts("hr_attendance_corrections"),
);
HrAttendanceCorrectionSchema.index({ employeeId: 1, date: 1 }, { name: "ix_hr_correction_employee_day" });

/**
 * 10. hr_settings: one row (key "default") with the HR working-week and reminder settings, and
 * the counter behind generated employee codes.
 */
export const HrSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true, trim: true },
    weeklyOffDays: { type: [Number], default: [0] },
    dueSoonHours: { type: Number, default: 2 },
    employeeSeq: { type: Number, default: 0 },
    updatedBy: id("User"),
  },
  opts("hr_settings"),
);
