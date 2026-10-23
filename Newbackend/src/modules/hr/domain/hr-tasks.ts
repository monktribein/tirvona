/**
 * Daily-task rules: which status changes are allowed, what "overdue" means, and how the
 * report metrics are calculated. Pure functions, so every screen and report uses the same
 * definitions.
 */
import { HR_OPEN_TASK_STATUSES, type HrTaskPriority, type HrTaskStatus } from "./hr.constants";

/**
 * Allowed status changes. A task only becomes "completed" when a reviewer approves the
 * submitted work; nothing (including a passed deadline) completes it automatically.
 */
export const HR_TASK_TRANSITIONS: Record<HrTaskStatus, HrTaskStatus[]> = {
  assigned: ["in_progress", "blocked", "submitted", "cancelled"],
  // -> assigned: reassigned to another employee, who starts it afresh
  in_progress: ["blocked", "submitted", "cancelled", "assigned"],
  blocked: ["in_progress", "cancelled", "assigned"],
  // approve -> completed; reject -> back to in_progress with the reviewer's comment
  submitted: ["completed", "in_progress", "cancelled"],
  // reopen
  completed: ["in_progress"],
  // reopen
  cancelled: ["assigned"],
};

export const canTransition = (from: HrTaskStatus, to: HrTaskStatus): boolean =>
  HR_TASK_TRANSITIONS[from]?.includes(to) ?? false;

export const isOpenStatus = (status: string): boolean =>
  (HR_OPEN_TASK_STATUSES as string[]).includes(status);

/**
 * Overdue: the work is still open (assigned, in progress or blocked) and its due time has
 * passed. Work submitted for review is not overdue, and nothing is ever marked done because
 * of its deadline.
 */
export const isOverdue = (task: { status: string; dueAt?: Date | string | null }, now = new Date()): boolean =>
  isOpenStatus(task.status) && !!task.dueAt && new Date(task.dueAt).getTime() < now.getTime();

/** The Mongo-style filter for the same definition, for counting in the database. */
export const overdueFilter = (now = new Date()) => ({
  status: { $in: HR_OPEN_TASK_STATUSES },
  dueAt: { $lt: now },
});

export interface HrTaskForMetrics {
  status: string;
  priority: HrTaskPriority | string;
  dueAt?: Date | string | null;
  createdAt?: Date | string | null;
  submittedAt?: Date | string | null;
  rejectionCount?: number;
}

export interface HrTaskMetrics {
  assigned: number;
  completed: number;
  /** Completed tasks whose final submission came in on or before the due time. */
  completedOnTime: number;
  /** Completed without the reviewer sending it back even once. */
  firstPassApproved: number;
  open: number;
  overdue: number;
  blocked: number;
  pendingReview: number;
  cancelled: number;
  /** Times reviewers sent work back, across all these tasks. */
  rejections: number;
  completedByPriority: Record<"low" | "medium" | "high" | "urgent", number>;
  /**
   * Mean hours from the task being assigned (created) to the employee's final submission,
   * over completed tasks. Reviewer waiting time is deliberately left out. Null when nothing
   * was completed.
   */
  avgCompletionHours: number | null;
}

export const emptyMetrics = (): HrTaskMetrics => ({
  assigned: 0,
  completed: 0,
  completedOnTime: 0,
  firstPassApproved: 0,
  open: 0,
  overdue: 0,
  blocked: 0,
  pendingReview: 0,
  cancelled: 0,
  rejections: 0,
  completedByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
  avgCompletionHours: null,
});

const HOUR_MS = 3_600_000;

export function taskMetrics(tasks: HrTaskForMetrics[], now = new Date()): HrTaskMetrics {
  const m = emptyMetrics();
  let hours = 0;
  let timed = 0;
  for (const t of tasks) {
    m.assigned += 1;
    m.rejections += Number(t.rejectionCount ?? 0);
    if (isOpenStatus(t.status)) m.open += 1;
    if (isOverdue(t, now)) m.overdue += 1;
    if (t.status === "blocked") m.blocked += 1;
    if (t.status === "submitted") m.pendingReview += 1;
    if (t.status === "cancelled") m.cancelled += 1;
    if (t.status !== "completed") continue;
    m.completed += 1;
    if (t.priority in m.completedByPriority)
      m.completedByPriority[t.priority as keyof HrTaskMetrics["completedByPriority"]] += 1;
    if (!Number(t.rejectionCount ?? 0)) m.firstPassApproved += 1;
    const submitted = t.submittedAt ? new Date(t.submittedAt).getTime() : NaN;
    if (t.dueAt && Number.isFinite(submitted) && submitted <= new Date(t.dueAt).getTime()) m.completedOnTime += 1;
    const created = t.createdAt ? new Date(t.createdAt).getTime() : NaN;
    if (Number.isFinite(created) && Number.isFinite(submitted) && submitted >= created) {
      hours += (submitted - created) / HOUR_MS;
      timed += 1;
    }
  }
  m.avgCompletionHours = timed ? Math.round((hours / timed) * 10) / 10 : null;
  return m;
}
