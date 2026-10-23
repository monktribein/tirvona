import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { HR_MAX_REPORT_DAYS, HR_TASK_STATUSES } from "../domain/hr.constants";
import { overdueFilter, taskMetrics } from "../domain/hr-tasks";
import { daySpan, isDateKey, todayIst } from "../domain/hr-attendance";
import { istDayBounds } from "../../day-stay/domain/day-stay-time";
import type { HrDashboardQueryDto, HrTaskReportQueryDto } from "../presentation/hr.dto";
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrOrganisationService } from "./hr-organisation.service";

/** Upper bound on tasks one report reads; the response says when it was reached. */
const REPORT_TASK_LIMIT = 20_000;

@Injectable()
export class HrReportsService {
  constructor(
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    @InjectModel("HrTask") private readonly tasks: Model<any>,
    @InjectModel("HrAttendance") private readonly attendance: Model<any>,
    @InjectModel("HrLeave") private readonly leaves: Model<any>,
    @InjectModel("HrOffice") private readonly offices: Model<any>,
    private readonly organisation: HrOrganisationService,
  ) {}

  /**
   * The HR dashboard. Every number is counted from the records with the definitions in
   * domain/hr-tasks.ts and domain/hr-attendance.ts:
   *  - present: an attendance record for the date marked present or half day
   *  - on leave: approved leave covering the date (and no present record)
   *  - absent / not checked in: every other active employee in the filter
   *  - assigned: tasks whose task date is the date; completed: approved on the date (IST)
   *  - in progress, overdue and pending review: the state right now
   */
  async dashboard(access: HrAccess, query: HrDashboardQueryDto) {
    HrAccessService.requireAny(access);
    const date = query.date ?? todayIst();
    if (!isDateKey(date)) throw new BadRequestException("Choose a valid date.");

    const people = await this.employees
      .find(this.employeeFilter(query))
      .select("primaryOfficeId officeIds")
      .limit(5000)
      .lean();
    const ids = people.map((p: any) => p._id);
    const [presentRows, leaveRows, activeOffices] = await Promise.all([
      ids.length ? this.attendance.find({ employeeId: { $in: ids }, date, status: { $in: ["present", "half_day"] } }).select("employeeId").lean() : [],
      ids.length ? this.leaves.find({ employeeId: { $in: ids }, status: "approved", fromDate: { $lte: date }, toDate: { $gte: date } }).select("employeeId").lean() : [],
      this.offices.find({ active: true }).sort({ name: 1 }).limit(50).lean(),
    ]);
    const present = new Set(presentRows.map((r: any) => String(r.employeeId)));
    const onLeave = new Set(leaveRows.map((r: any) => String(r.employeeId)).filter((id: string) => !present.has(id)));

    const task = this.taskFilter(query);
    const { start, end } = istDayBounds(date);
    const assignedFilter = { ...task, assignedDate: date, ...(query.status ? { status: query.status } : {}) };
    const [assigned, completed, inProgress, overdue, pendingReview, dayStatuses] = await Promise.all([
      this.tasks.countDocuments(assignedFilter),
      this.tasks.countDocuments({ ...task, status: "completed", completedAt: { $gte: start, $lte: end } }),
      this.tasks.countDocuments({ ...task, status: "in_progress" }),
      this.tasks.countDocuments({ ...task, ...overdueFilter() }),
      this.tasks.countDocuments({ ...task, status: "submitted" }),
      this.tasks.find({ ...task, assignedDate: date }).select("status").limit(REPORT_TASK_LIMIT).lean(),
    ]);
    const byStatus = Object.fromEntries(HR_TASK_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const row of dayStatuses as any[]) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

    return {
      date,
      employees: {
        active: people.length,
        byOffice: activeOffices
          .filter((o: any) => !query.officeId || String(o._id) === query.officeId)
          .map((o: any) => ({
            officeId: String(o._id),
            name: o.name,
            // Someone who works from both offices is counted in each.
            count: people.filter((p: any) => String(p.primaryOfficeId) === String(o._id) || (p.officeIds ?? []).map(String).includes(String(o._id))).length,
          })),
        present: present.size,
        onLeave: onLeave.size,
        absentOrNotCheckedIn: Math.max(0, people.length - present.size - onLeave.size),
      },
      tasks: { assigned, completed, inProgress, overdue, pendingReview, assignedByStatus: byStatus },
    };
  }

  /**
   * Task performance for tasks whose task date falls in the range, grouped by employee,
   * office or department. Shows completion with priority mix, on-time and first-pass review
   * rates side by side: it deliberately produces no single "productivity" score.
   */
  async taskReport(access: HrAccess, query: HrTaskReportQueryDto) {
    HrAccessService.require(access, "reports");
    this.assertRange(query.from, query.to);
    const filter: Record<string, unknown> = { ...this.taskFilter(query), assignedDate: { $gte: query.from, $lte: query.to } };
    const rows = await this.tasks
      .find(filter)
      .select("employeeId officeId departmentId status priority dueAt createdAt submittedAt rejectionCount")
      .limit(REPORT_TASK_LIMIT)
      .lean();
    const groupBy = query.groupBy ?? "employee";
    const keyOf = (t: any) => String((groupBy === "employee" ? t.employeeId : groupBy === "office" ? t.officeId : t.departmentId) ?? "none");
    const groups = new Map<string, any[]>();
    for (const t of rows) {
      const key = keyOf(t);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const keys = [...groups.keys()].filter((k) => k !== "none");
    const names = await this.organisation.names({ offices: groupBy === "office" ? keys : [], departments: groupBy === "department" ? keys : [] });
    const people = groupBy === "employee" && keys.length
      ? await this.employees.find({ _id: { $in: keys } }).select("fullName employeeCode").lean()
      : [];
    const personById = new Map<string, any>(people.map((p: any) => [String(p._id), p]));
    const labelOf = (key: string) => {
      if (key === "none") return groupBy === "department" ? "No department" : "Not set";
      if (groupBy === "employee") return personById.get(key)?.fullName ?? "Unknown employee";
      return (groupBy === "office" ? names.offices : names.departments).get(key) ?? "Unknown";
    };
    const now = new Date();
    const data = [...groups.entries()]
      .map(([key, list]) => ({
        key,
        label: labelOf(key),
        employeeCode: groupBy === "employee" ? personById.get(key)?.employeeCode ?? null : null,
        ...taskMetrics(list, now),
      }))
      .sort((a, b) => b.assigned - a.assigned || a.label.localeCompare(b.label));
    return {
      from: query.from,
      to: query.to,
      groupBy,
      truncated: rows.length >= REPORT_TASK_LIMIT,
      totals: taskMetrics(rows, now),
      data,
    };
  }

  private employeeFilter(query: { officeId?: string; departmentId?: string; employeeId?: string }) {
    const and: Record<string, unknown>[] = [{ status: "active" }];
    if (query.officeId) and.push({ $or: [{ primaryOfficeId: query.officeId }, { officeIds: query.officeId }] });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.employeeId) and.push({ _id: query.employeeId });
    return { $and: and };
  }

  /** Tasks are filtered by the office and department they were assigned under. */
  private taskFilter(query: { officeId?: string; departmentId?: string; employeeId?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.officeId) filter.officeId = query.officeId;
    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.employeeId) filter.employeeId = query.employeeId;
    return filter;
  }

  private assertRange(from: string, to: string) {
    if (!isDateKey(from) || !isDateKey(to)) throw new BadRequestException("Choose a valid date range.");
    if (from > to) throw new BadRequestException("The start date is after the end date.");
    if (daySpan(from, to) > HR_MAX_REPORT_DAYS) throw new BadRequestException(`Choose a range of at most ${HR_MAX_REPORT_DAYS} days.`);
  }
}
