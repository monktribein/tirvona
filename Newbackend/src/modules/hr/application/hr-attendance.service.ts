import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { HR_MAX_REPORT_DAYS } from "../domain/hr.constants";
import {
  addDays,
  daySpan,
  isDateKey,
  rangesOverlap,
  summariseAttendance,
  todayIst,
} from "../domain/hr-attendance";
import { istDayBounds } from "../../day-stay/domain/day-stay-time";
import type {
  HrAttendanceMarkDto,
  HrAttendanceQueryDto,
  HrCorrectionQueryDto,
  HrCorrectionRequestDto,
  HrLeaveQueryDto,
  HrLeaveRecordDto,
  HrLeaveRequestDto,
  HrRangeQueryDto,
} from "../presentation/hr.dto";
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrAuditService } from "./hr-audit.service";
import { HrNotificationService } from "./hr-notification.service";
import { HrOrganisationService, isEntityId } from "./hr-organisation.service";

/** How far back an employee may ask for a day to be corrected. */
const CORRECTION_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

const attendanceView = (a: any) =>
  a
    ? {
        id: String(a._id),
        date: a.date,
        status: a.status,
        officeId: a.officeId ? String(a.officeId) : null,
        checkInAt: a.checkInAt ?? null,
        checkOutAt: a.checkOutAt ?? null,
        source: a.source,
        note: a.note ?? "",
        updatedAt: a.updatedAt,
      }
    : null;

const leaveView = (l: any, names?: Map<string, any>) => ({
  id: String(l._id),
  employeeId: String(l.employeeId),
  employeeName: names?.get(String(l.employeeId))?.fullName ?? undefined,
  employeeCode: names?.get(String(l.employeeId))?.employeeCode ?? undefined,
  fromDate: l.fromDate,
  toDate: l.toDate,
  type: l.type,
  reason: l.reason ?? "",
  status: l.status,
  decidedByName: l.decidedByName ?? "",
  decidedAt: l.decidedAt ?? null,
  decisionNote: l.decisionNote ?? "",
  createdAt: l.createdAt,
});

const correctionView = (c: any, names?: Map<string, any>) => ({
  id: String(c._id),
  employeeId: String(c.employeeId),
  employeeName: names?.get(String(c.employeeId))?.fullName ?? undefined,
  employeeCode: names?.get(String(c.employeeId))?.employeeCode ?? undefined,
  date: c.date,
  requestedStatus: c.requestedStatus,
  requestedCheckInAt: c.requestedCheckInAt ?? null,
  requestedCheckOutAt: c.requestedCheckOutAt ?? null,
  reason: c.reason,
  status: c.status,
  decidedByName: c.decidedByName ?? "",
  decidedAt: c.decidedAt ?? null,
  decisionNote: c.decisionNote ?? "",
  before: c.before ?? null,
  after: c.after ?? null,
  createdAt: c.createdAt,
});

/** Only what changes between two versions of an attendance day goes into the audit log. */
const snapshot = (a: any) =>
  a ? { status: a.status, checkInAt: a.checkInAt ?? null, checkOutAt: a.checkOutAt ?? null, officeId: a.officeId ? String(a.officeId) : null } : null;

@Injectable()
export class HrAttendanceService {
  constructor(
    @InjectModel("HrAttendance") private readonly attendance: Model<any>,
    @InjectModel("HrLeave") private readonly leaves: Model<any>,
    @InjectModel("HrAttendanceCorrection") private readonly corrections: Model<any>,
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    private readonly organisation: HrOrganisationService,
    private readonly notifications: HrNotificationService,
    private readonly audit: HrAuditService,
  ) {}

  // ------------------------------------------------------------ the employee's own attendance

  async checkIn(access: HrAccess, officeId?: string) {
    const employee = HrAccessService.requireEmployee(access);
    const office = this.officeFor(employee, officeId);
    const date = todayIst();
    const existing = await this.attendance.findOne({ employeeId: employee._id, date }).lean();
    if (existing?.checkInAt) throw new ConflictException("You have already checked in today.");
    if (existing) throw new ConflictException("HR has already recorded your attendance for today. Ask for a correction if it is wrong.");
    try {
      await this.attendance.create({ employeeId: employee._id, date, officeId: office, status: "present", checkInAt: new Date(), source: "self", updatedBy: access.userId });
    } catch (error) {
      // Two check-ins at the same moment: the unique (employee, day) index lets only one through.
      if ((error as { code?: number }).code === 11000) throw new ConflictException("You have already checked in today.");
      throw error;
    }
    return this.myToday(access);
  }

  async checkOut(access: HrAccess) {
    const employee = HrAccessService.requireEmployee(access);
    const date = todayIst();
    const row = await this.attendance.findOne({ employeeId: employee._id, date }).lean();
    if (!row?.checkInAt) throw new BadRequestException("Check in first.");
    const claimed = await this.attendance.findOneAndUpdate(
      { _id: row._id, checkOutAt: null },
      { $set: { checkOutAt: new Date(), updatedBy: access.userId } },
    );
    if (!claimed) throw new ConflictException("You have already checked out today.");
    return this.myToday(access);
  }

  async myToday(access: HrAccess) {
    const employee = HrAccessService.requireEmployee(access);
    const date = todayIst();
    const [row, leave] = await Promise.all([
      this.attendance.findOne({ employeeId: employee._id, date }).lean(),
      this.leaves.findOne({ employeeId: employee._id, status: "approved", fromDate: { $lte: date }, toDate: { $gte: date } }).lean(),
    ]);
    return { date, attendance: attendanceView(row), onLeave: !!leave };
  }

  async myAttendance(access: HrAccess, from?: string, to?: string) {
    const employee = HrAccessService.requireEmployee(access);
    const today = todayIst();
    const end = to && isDateKey(to) ? to : today;
    const start = from && isDateKey(from) ? from : addDays(end, -29);
    this.assertRange(start, end);
    const [rows, leaves, settings] = await Promise.all([
      this.attendance.find({ employeeId: employee._id, date: { $gte: start, $lte: end } }).sort({ date: -1 }).lean(),
      this.leaves.find({ employeeId: employee._id, status: "approved", fromDate: { $lte: end }, toDate: { $gte: start } }).lean(),
      this.organisation.settings(),
    ]);
    return {
      from: start,
      to: end,
      days: rows.map(attendanceView),
      summary: summariseAttendance({ from: start, to: end, today, joiningDate: employee.joiningDate, weeklyOffDays: settings.weeklyOffDays ?? [0], records: rows, leaves }),
    };
  }

  // ------------------------------------------------------------ HR register and manual entries

  /**
   * The day's register: every active employee in the filter with their state for the date
   * (present, half day, absent, on approved leave, or not marked).
   */
  async register(access: HrAccess, query: HrAttendanceQueryDto) {
    HrAccessService.require(access, "attendance");
    const date = query.date ?? todayIst();
    const people = await this.employeesIn(query);
    const ids = people.map((p: any) => p._id);
    const [rows, leaves] = await Promise.all([
      ids.length ? this.attendance.find({ employeeId: { $in: ids }, date }).lean() : [],
      ids.length ? this.leaves.find({ employeeId: { $in: ids }, status: "approved", fromDate: { $lte: date }, toDate: { $gte: date } }).lean() : [],
    ]);
    const byEmployee = new Map<string, any>(rows.map((r: any) => [String(r.employeeId), r]));
    const onLeave = new Set(leaves.map((l: any) => String(l.employeeId)));
    const names = await this.organisation.names({ offices: people.map((p: any) => p.primaryOfficeId), departments: people.map((p: any) => p.departmentId) });
    const all = people.map((p: any) => {
      const record = byEmployee.get(String(p._id));
      const state = record?.status ?? (onLeave.has(String(p._id)) ? "on_leave" : "not_marked");
      return {
        employeeId: String(p._id),
        employeeCode: p.employeeCode,
        fullName: p.fullName,
        officeName: names.offices.get(String(p.primaryOfficeId)) ?? null,
        departmentName: p.departmentId ? names.departments.get(String(p.departmentId)) ?? null : null,
        state,
        onApprovedLeave: onLeave.has(String(p._id)),
        attendance: attendanceView(record),
      };
    });
    const counts = { present: 0, half_day: 0, absent: 0, on_leave: 0, not_marked: 0 } as Record<string, number>;
    for (const row of all) counts[row.state] = (counts[row.state] ?? 0) + 1;
    const filtered = query.status ? all.filter((r) => r.state === query.status) : all;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, date, counts };
  }

  /** HR enters or changes one employee's day. Every change is written to the audit log with before/after. */
  async mark(access: HrAccess, dto: HrAttendanceMarkDto) {
    HrAccessService.require(access, "attendance");
    const employee = await this.employeeById(dto.employeeId);
    if (dto.date > todayIst()) throw new BadRequestException("Attendance cannot be entered for a future date.");
    const times = this.validTimes(dto.date, dto.status, dto.checkInAt, dto.checkOutAt);
    const office = this.officeFor(employee, dto.officeId);
    const before = await this.attendance.findOne({ employeeId: employee._id, date: dto.date }).lean();
    const fields = { status: dto.status, ...times, officeId: office, source: "hr", note: dto.reason, updatedBy: access.userId };
    const after = before
      ? await this.attendance.findOneAndUpdate({ _id: before._id }, { $set: fields }, { new: true }).lean()
      : (await this.attendance.create({ employeeId: employee._id, date: dto.date, ...fields })).toObject();
    await this.audit.record(
      access.userId,
      "HR_ATTENDANCE_MARKED",
      { employeeId: String(employee._id), date: dto.date, reason: dto.reason },
      snapshot(before),
      snapshot(after),
    );
    return attendanceView(after);
  }

  async summary(access: HrAccess, query: HrRangeQueryDto) {
    if (!access.can.attendance && !access.can.reports)
      throw new ForbiddenException("Your account does not have access to attendance summaries.");
    this.assertRange(query.from, query.to);
    const people = await this.employeesIn(query);
    const ids = people.map((p: any) => p._id);
    const [rows, leaves, settings] = await Promise.all([
      ids.length ? this.attendance.find({ employeeId: { $in: ids }, date: { $gte: query.from, $lte: query.to } }).select("employeeId date status").lean() : [],
      ids.length ? this.leaves.find({ employeeId: { $in: ids }, status: "approved", fromDate: { $lte: query.to }, toDate: { $gte: query.from } }).select("employeeId fromDate toDate").lean() : [],
      this.organisation.settings(),
    ]);
    const names = await this.organisation.names({ offices: people.map((p: any) => p.primaryOfficeId), departments: people.map((p: any) => p.departmentId) });
    const today = todayIst();
    const data = people.map((p: any) => {
      const id = String(p._id);
      return {
        employeeId: id,
        employeeCode: p.employeeCode,
        fullName: p.fullName,
        officeName: names.offices.get(String(p.primaryOfficeId)) ?? null,
        departmentName: p.departmentId ? names.departments.get(String(p.departmentId)) ?? null : null,
        ...summariseAttendance({
          from: query.from,
          to: query.to,
          today,
          joiningDate: p.joiningDate,
          weeklyOffDays: settings.weeklyOffDays ?? [0],
          records: rows.filter((r: any) => String(r.employeeId) === id),
          leaves: leaves.filter((l: any) => String(l.employeeId) === id),
        }),
      };
    });
    return { from: query.from, to: query.to, weeklyOffDays: settings.weeklyOffDays ?? [0], data };
  }

  // ------------------------------------------------------------ leave

  async requestLeave(access: HrAccess, dto: HrLeaveRequestDto) {
    const employee = HrAccessService.requireEmployee(access);
    this.assertLeaveDates(dto.fromDate, dto.toDate);
    await this.assertNoOverlap(employee._id, dto.fromDate, dto.toDate);
    const leave = await this.leaves.create({ employeeId: employee._id, fromDate: dto.fromDate, toDate: dto.toDate, type: dto.type, reason: dto.reason, status: "pending", requestedBy: access.userId });
    return leaveView(leave);
  }

  async myLeaves(access: HrAccess) {
    const employee = HrAccessService.requireEmployee(access);
    const rows = await this.leaves.find({ employeeId: employee._id }).sort({ fromDate: -1 }).limit(100).lean();
    return rows.map((l: any) => leaveView(l));
  }

  async cancelMyLeave(access: HrAccess, id: string) {
    const employee = HrAccessService.requireEmployee(access);
    if (!isEntityId(id)) throw new NotFoundException("Leave request not found");
    const claimed = await this.leaves.findOneAndUpdate(
      { _id: id, employeeId: employee._id, status: "pending" },
      { $set: { status: "cancelled" } },
      { new: true },
    );
    if (!claimed) throw new BadRequestException("Only your own pending leave requests can be cancelled.");
    return leaveView(claimed);
  }

  async listLeaves(access: HrAccess, query: HrLeaveQueryDto) {
    HrAccessService.require(access, "attendance");
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.officeId) {
      const inOffice = await this.employees.find({ $or: [{ primaryOfficeId: query.officeId }, { officeIds: query.officeId }] }).select("_id").limit(5000).lean();
      filter.employeeId = query.employeeId
        ? (inOffice.some((e: any) => String(e._id) === query.employeeId) ? query.employeeId : { $in: [] })
        : { $in: inOffice.map((e: any) => e._id) };
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.leaves.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.leaves.countDocuments(filter),
    ]);
    const names = await this.employeeNames(rows.map((r: any) => r.employeeId));
    return { data: rows.map((l: any) => leaveView(l, names)), total, page, limit };
  }

  /** HR records leave on an employee's behalf; it is approved at once. */
  async recordLeave(access: HrAccess, dto: HrLeaveRecordDto) {
    HrAccessService.require(access, "attendance");
    const employee = await this.employeeById(dto.employeeId);
    this.assertLeaveDates(dto.fromDate, dto.toDate, true);
    await this.assertNoOverlap(employee._id, dto.fromDate, dto.toDate);
    const leave = await this.leaves.create({
      employeeId: employee._id, fromDate: dto.fromDate, toDate: dto.toDate, type: dto.type, reason: dto.reason,
      status: "approved", requestedBy: access.userId, decidedBy: access.userId, decidedByName: access.userName, decidedAt: new Date(),
    });
    await this.audit.record(access.userId, "HR_LEAVE_RECORDED", { leaveId: String(leave._id), employeeId: String(employee._id), fromDate: dto.fromDate, toDate: dto.toDate });
    return leaveView(leave);
  }

  async decideLeave(access: HrAccess, id: string, decision: "approve" | "reject", note?: string) {
    HrAccessService.require(access, "attendance");
    if (!isEntityId(id)) throw new NotFoundException("Leave request not found");
    const leave = await this.leaves.findById(id).lean();
    if (!leave) throw new NotFoundException("Leave request not found");
    if (access.employee && String(access.employee._id) === String(leave.employeeId))
      throw new ForbiddenException("You cannot decide your own leave request.");
    if (decision === "approve") await this.assertNoOverlap(leave.employeeId, leave.fromDate, leave.toDate, leave._id, ["approved"]);
    const claimed = await this.leaves.findOneAndUpdate(
      { _id: leave._id, status: "pending" },
      { $set: { status: decision === "approve" ? "approved" : "rejected", decidedBy: access.userId, decidedByName: access.userName, decidedAt: new Date(), decisionNote: note ?? "" } },
      { new: true },
    );
    if (!claimed) throw new BadRequestException("This leave request has already been decided or cancelled.");
    await this.audit.record(access.userId, decision === "approve" ? "HR_LEAVE_APPROVED" : "HR_LEAVE_REJECTED", { leaveId: id, employeeId: String(leave.employeeId) });
    const userIds = await this.notifications.userIdsOf([leave.employeeId]);
    await this.notifications.send(
      userIds,
      decision === "approve" ? "Leave approved" : "Leave not approved",
      `${leave.fromDate} to ${leave.toDate}${note ? `: ${note}` : ""}`,
      "/admin/hr/my-work?tab=attendance",
      decision === "approve" ? "hr.leave.approved" : "hr.leave.rejected",
    );
    return leaveView(claimed);
  }

  // ------------------------------------------------------------ corrections

  async requestCorrection(access: HrAccess, dto: HrCorrectionRequestDto) {
    const employee = HrAccessService.requireEmployee(access);
    const today = todayIst();
    if (dto.date > today) throw new BadRequestException("You cannot correct a future date.");
    if (dto.date < addDays(today, -CORRECTION_WINDOW_DAYS))
      throw new BadRequestException(`Corrections can only be asked for the last ${CORRECTION_WINDOW_DAYS} days.`);
    const times = this.validTimes(dto.date, dto.requestedStatus, dto.requestedCheckInAt, dto.requestedCheckOutAt);
    if (await this.corrections.exists({ employeeId: employee._id, date: dto.date, status: "pending" }))
      throw new ConflictException("You already have a pending correction for this day.");
    const row = await this.corrections.create({
      employeeId: employee._id,
      date: dto.date,
      requestedStatus: dto.requestedStatus,
      requestedCheckInAt: times.checkInAt,
      requestedCheckOutAt: times.checkOutAt,
      reason: dto.reason,
      status: "pending",
      requestedBy: access.userId,
    });
    return correctionView(row);
  }

  async myCorrections(access: HrAccess) {
    const employee = HrAccessService.requireEmployee(access);
    const rows = await this.corrections.find({ employeeId: employee._id }).sort({ createdAt: -1 }).limit(100).lean();
    return rows.map((c: any) => correctionView(c));
  }

  async listCorrections(access: HrAccess, query: HrCorrectionQueryDto) {
    HrAccessService.require(access, "attendance");
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.employeeId) filter.employeeId = query.employeeId;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.corrections.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.corrections.countDocuments(filter),
    ]);
    const names = await this.employeeNames(rows.map((r: any) => r.employeeId));
    return { data: rows.map((c: any) => correctionView(c, names)), total, page, limit };
  }

  /** Approving applies the requested values to the day; the before/after stay on the request and in the audit log. */
  async decideCorrection(access: HrAccess, id: string, decision: "approve" | "reject", note?: string) {
    HrAccessService.require(access, "attendance");
    if (!isEntityId(id)) throw new NotFoundException("Correction request not found");
    const request = await this.corrections.findById(id).lean();
    if (!request) throw new NotFoundException("Correction request not found");
    if (access.employee && String(access.employee._id) === String(request.employeeId))
      throw new ForbiddenException("You cannot decide your own correction request.");
    if (request.status !== "pending") throw new BadRequestException("This correction has already been decided.");
    const decided = { decidedBy: access.userId, decidedByName: access.userName, decidedAt: new Date(), decisionNote: note ?? "" };

    if (decision === "reject") {
      const claimed = await this.corrections.findOneAndUpdate({ _id: request._id, status: "pending" }, { $set: { status: "rejected", ...decided } }, { new: true });
      if (!claimed) throw new BadRequestException("This correction has already been decided.");
      await this.audit.record(access.userId, "HR_ATTENDANCE_CORRECTION_REJECTED", { correctionId: id, employeeId: String(request.employeeId), date: request.date });
      await this.notifyCorrection(request, false, note);
      return correctionView(claimed);
    }

    // Claim first so two approvers cannot both apply it.
    const claimed = await this.corrections.findOneAndUpdate({ _id: request._id, status: "pending" }, { $set: { status: "approved", ...decided } });
    if (!claimed) throw new BadRequestException("This correction has already been decided.");
    const employee = await this.employees.findById(request.employeeId).lean();
    const before = await this.attendance.findOne({ employeeId: request.employeeId, date: request.date }).lean();
    const fields = {
      status: request.requestedStatus,
      checkInAt: request.requestedCheckInAt ?? null,
      checkOutAt: request.requestedCheckOutAt ?? null,
      source: "correction",
      note: `Correction: ${request.reason}`,
      updatedBy: access.userId,
    };
    const after = before
      ? await this.attendance.findOneAndUpdate({ _id: before._id }, { $set: fields }, { new: true }).lean()
      : (await this.attendance.create({ employeeId: request.employeeId, date: request.date, officeId: employee?.primaryOfficeId ?? null, ...fields })).toObject();
    const updated = await this.corrections.findOneAndUpdate({ _id: request._id }, { $set: { before: snapshot(before), after: snapshot(after) } }, { new: true }).lean();
    await this.audit.record(access.userId, "HR_ATTENDANCE_CORRECTION_APPROVED", { correctionId: id, employeeId: String(request.employeeId), date: request.date }, snapshot(before), snapshot(after));
    await this.notifyCorrection(request, true, note);
    return correctionView(updated);
  }

  private async notifyCorrection(request: any, approved: boolean, note?: string) {
    const userIds = await this.notifications.userIdsOf([request.employeeId]);
    await this.notifications.send(
      userIds,
      approved ? "Attendance corrected" : "Attendance correction not approved",
      `${request.date}${note ? `: ${note}` : ""}`,
      "/admin/hr/my-work?tab=attendance",
      approved ? "hr.attendance.corrected" : "hr.attendance.correction_rejected",
    );
  }

  // ------------------------------------------------------------ helpers

  /** Active employees matching an office / department / employee / name filter (bounded). */
  private async employeesIn(query: { officeId?: string; departmentId?: string; employeeId?: string; search?: string }) {
    const and: Record<string, unknown>[] = [{ status: "active" }];
    if (query.officeId) and.push({ $or: [{ primaryOfficeId: query.officeId }, { officeIds: query.officeId }] });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.employeeId) and.push({ _id: query.employeeId });
    if (query.search) {
      const pattern = { $regex: escapeRegex(query.search), $options: "i" };
      and.push({ $or: [{ fullName: pattern }, { employeeCode: pattern }] });
    }
    return this.employees
      .find({ $and: and })
      .select("employeeCode fullName primaryOfficeId officeIds departmentId joiningDate")
      .sort({ fullName: 1 })
      .limit(5000)
      .lean();
  }

  private async employeeById(id: string) {
    const row = isEntityId(id) ? await this.employees.findOne({ _id: id, status: "active" }).lean() : null;
    if (!row) throw new BadRequestException("Choose an active employee.");
    return row;
  }

  private async employeeNames(ids: unknown[]) {
    const unique = [...new Set(ids.map(String))];
    const rows = unique.length ? await this.employees.find({ _id: { $in: unique } }).select("fullName employeeCode").lean() : [];
    return new Map<string, any>(rows.map((r: any) => [String(r._id), r]));
  }

  /** The office for an attendance day: one of the employee's own offices, the primary one by default. */
  private officeFor(employee: any, officeId?: string) {
    if (!officeId) return employee.primaryOfficeId ?? null;
    const allowed = [String(employee.primaryOfficeId), ...(employee.officeIds ?? []).map(String)];
    if (!allowed.includes(officeId)) throw new BadRequestException("Choose one of the employee's own offices.");
    return officeId;
  }

  /** Check-in must fall on the day; check-out after it, within 24 hours. Absent days carry no times. */
  private validTimes(date: string, status: string, checkInAt?: string, checkOutAt?: string) {
    if (status === "absent") return { checkInAt: null, checkOutAt: null };
    const inAt = checkInAt ? new Date(checkInAt) : null;
    const outAt = checkOutAt ? new Date(checkOutAt) : null;
    const { start, end } = istDayBounds(date);
    if (inAt && (inAt < start || inAt > end)) throw new BadRequestException("The check-in time must be on the same day.");
    if (outAt && !inAt) throw new BadRequestException("Give a check-in time with the check-out time.");
    if (inAt && outAt && (outAt <= inAt || outAt.getTime() - inAt.getTime() > DAY_MS))
      throw new BadRequestException("The check-out time must be after check-in, within 24 hours.");
    if ((inAt && inAt.getTime() > Date.now()) || (outAt && outAt.getTime() > Date.now()))
      throw new BadRequestException("Times cannot be in the future.");
    return { checkInAt: inAt, checkOutAt: outAt };
  }

  private assertRange(from: string, to: string) {
    if (!isDateKey(from) || !isDateKey(to)) throw new BadRequestException("Choose a valid date range.");
    if (from > to) throw new BadRequestException("The start date is after the end date.");
    if (daySpan(from, to) > HR_MAX_REPORT_DAYS) throw new BadRequestException(`Choose a range of at most ${HR_MAX_REPORT_DAYS} days.`);
  }

  private assertLeaveDates(from: string, to: string, allowPast = false) {
    if (!isDateKey(from) || !isDateKey(to)) throw new BadRequestException("Choose valid leave dates.");
    if (from > to) throw new BadRequestException("The leave cannot end before it starts.");
    if (daySpan(from, to) > 90) throw new BadRequestException("One leave entry can cover at most 90 days.");
    if (!allowPast && from < addDays(todayIst(), -CORRECTION_WINDOW_DAYS))
      throw new BadRequestException("That leave starts too far in the past. Ask HR to record it.");
  }

  private async assertNoOverlap(employeeId: unknown, from: string, to: string, ignoreId?: unknown, statuses = ["pending", "approved"]) {
    const others = await this.leaves
      .find({ employeeId, status: { $in: statuses }, fromDate: { $lte: to }, toDate: { $gte: from }, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })
      .limit(5)
      .lean();
    if (others.some((l: any) => rangesOverlap(l.fromDate, l.toDate, from, to)))
      throw new ConflictException("This overlaps another leave request for the same days.");
  }
}
