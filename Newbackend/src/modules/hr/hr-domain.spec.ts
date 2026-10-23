/// <reference types="jest" />
import { canTransition, isOverdue, overdueFilter, taskMetrics } from "./domain/hr-tasks";
import { daySpan, eachDay, rangesOverlap, summariseAttendance, weekdayOf } from "./domain/hr-attendance";

const NOW = new Date("2026-10-23T10:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe("HR task status rules", () => {
  it("only completes a task through review approval", () => {
    expect(canTransition("submitted", "completed")).toBe(true);
    for (const from of ["assigned", "in_progress", "blocked", "cancelled"] as const) expect(canTransition(from, "completed")).toBe(false);
  });

  it("allows reopening, rejection back to work, and reassignment resets", () => {
    expect(canTransition("completed", "in_progress")).toBe(true);
    expect(canTransition("cancelled", "assigned")).toBe(true);
    expect(canTransition("submitted", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "assigned")).toBe(true);
    expect(canTransition("blocked", "submitted")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
});

describe("HR overdue definition", () => {
  it("is open work past its due time, never submitted or finished work", () => {
    expect(isOverdue({ status: "in_progress", dueAt: hoursAgo(1) }, NOW)).toBe(true);
    expect(isOverdue({ status: "blocked", dueAt: hoursAgo(1) }, NOW)).toBe(true);
    expect(isOverdue({ status: "assigned", dueAt: hoursAgo(-1) }, NOW)).toBe(false);
    expect(isOverdue({ status: "submitted", dueAt: hoursAgo(5) }, NOW)).toBe(false);
    expect(isOverdue({ status: "completed", dueAt: hoursAgo(5) }, NOW)).toBe(false);
    expect(isOverdue({ status: "cancelled", dueAt: hoursAgo(5) }, NOW)).toBe(false);
  });

  it("uses the same definition for the database filter", () => {
    expect(overdueFilter(NOW)).toEqual({ status: { $in: ["assigned", "in_progress", "blocked"] }, dueAt: { $lt: NOW } });
  });
});

describe("HR task metrics", () => {
  it("counts completion, on-time, first-pass and average time to submission", () => {
    const m = taskMetrics(
      [
        // on time, first pass: 4h from creation to submission
        { status: "completed", priority: "high", createdAt: hoursAgo(10), submittedAt: hoursAgo(6), dueAt: hoursAgo(5), rejectionCount: 0 },
        // late, sent back once: 8h
        { status: "completed", priority: "low", createdAt: hoursAgo(10), submittedAt: hoursAgo(2), dueAt: hoursAgo(5), rejectionCount: 1 },
        { status: "in_progress", priority: "urgent", createdAt: hoursAgo(10), dueAt: hoursAgo(1) },
        { status: "blocked", priority: "medium", createdAt: hoursAgo(3), dueAt: hoursAgo(-5) },
        { status: "submitted", priority: "medium", createdAt: hoursAgo(3), submittedAt: hoursAgo(1), dueAt: hoursAgo(2) },
        { status: "cancelled", priority: "low", createdAt: hoursAgo(3), dueAt: hoursAgo(2) },
      ],
      NOW,
    );
    expect(m).toMatchObject({
      assigned: 6,
      completed: 2,
      completedOnTime: 1,
      firstPassApproved: 1,
      open: 2,
      overdue: 1,
      blocked: 1,
      pendingReview: 1,
      cancelled: 1,
      rejections: 1,
      completedByPriority: { low: 1, medium: 0, high: 1, urgent: 0 },
      avgCompletionHours: 6,
    });
  });

  it("reports no average when nothing was completed", () => {
    expect(taskMetrics([{ status: "assigned", priority: "low" }], NOW).avgCompletionHours).toBeNull();
  });
});

describe("HR attendance summary", () => {
  // 2026-10-19 is a Monday; 2026-10-25 a Sunday.
  const base = { from: "2026-10-19", to: "2026-10-25", today: "2026-10-25", weeklyOffDays: [0] };

  it("counts working days, presence, leave, absence and unmarked days", () => {
    expect(weekdayOf("2026-10-25")).toBe(0);
    const s = summariseAttendance({
      ...base,
      records: [
        { date: "2026-10-19", status: "present" },
        { date: "2026-10-20", status: "half_day" },
        { date: "2026-10-21", status: "absent" },
        // a check-in on the weekly off still counts as present
        { date: "2026-10-25", status: "present" },
      ],
      leaves: [{ fromDate: "2026-10-22", toDate: "2026-10-23" }],
    });
    expect(s).toEqual({ workingDays: 6, present: 2, halfDay: 1, leaveDays: 2, absent: 1, notMarked: 1 });
  });

  it("ignores days before joining and after today", () => {
    const s = summariseAttendance({ ...base, today: "2026-10-21", joiningDate: "2026-10-20", records: [], leaves: [] });
    expect(s.workingDays).toBe(2);
    expect(s.notMarked).toBe(2);
  });

  it("does not count leave on a weekly off", () => {
    const s = summariseAttendance({ ...base, records: [], leaves: [{ fromDate: "2026-10-24", toDate: "2026-10-25" }] });
    expect(s.leaveDays).toBe(1);
  });

  it("date helpers", () => {
    expect(daySpan("2026-10-01", "2026-10-31")).toBe(31);
    expect(eachDay("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(rangesOverlap("2026-10-01", "2026-10-05", "2026-10-05", "2026-10-09")).toBe(true);
    expect(rangesOverlap("2026-10-01", "2026-10-04", "2026-10-05", "2026-10-09")).toBe(false);
  });
});
