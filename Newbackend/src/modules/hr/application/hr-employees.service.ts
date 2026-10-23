import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { canonicalPhone, phoneCandidates } from "../../../common/phone/phone.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { HR_OPEN_TASK_STATUSES, HR_PERMISSIONS, HR_TASK_STATUSES } from "../domain/hr.constants";
import { overdueFilter } from "../domain/hr-tasks";
import { addDays, todayIst } from "../domain/hr-attendance";
import type {
  HrAccountLookupDto,
  HrEmployeeDto,
  HrEmployeeQueryDto,
  HrEmployeeStatusDto,
  HrEmployeeUpdateDto,
} from "../presentation/hr.dto";
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrAuditService } from "./hr-audit.service";
import { HrOrganisationService, isEntityId } from "./hr-organisation.service";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HR_PERMISSION_VALUES = Object.values(HR_PERMISSIONS) as string[];

type Names = Awaited<ReturnType<HrOrganisationService["names"]>>;

/** How much of an employee record the caller may see. */
interface ViewLevel {
  /** Work email and contact number. */
  contact: boolean;
  /** HR-only notes. */
  notes: boolean;
}

@Injectable()
export class HrEmployeesService {
  constructor(
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    @InjectModel("HrTask") private readonly tasks: Model<any>,
    @InjectModel("HrAttendance") private readonly attendance: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    private readonly organisation: HrOrganisationService,
    private readonly audit: HrAuditService,
  ) {}

  /**
   * Which employees the caller may list: everyone for HR staff, only direct reports for a
   * manager. Returns null when the caller may not list employees at all.
   */
  private listScope(access: HrAccess): Record<string, unknown> | null {
    if (HrAccessService.hasAnyCapability(access)) return {};
    if (access.teamIds.length) return { _id: { $in: access.teamIds } };
    return null;
  }

  private view(e: any, names: Names, level: ViewLevel, managers: Map<string, any> = new Map()) {
    const manager = e.reportingManagerId ? managers.get(String(e.reportingManagerId)) : null;
    return {
      id: String(e._id),
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      photoUrl: e.photoUrl || "",
      status: e.status,
      employmentType: e.employmentType,
      joiningDate: e.joiningDate ?? null,
      primaryOfficeId: e.primaryOfficeId ? String(e.primaryOfficeId) : null,
      primaryOfficeName: names.offices.get(String(e.primaryOfficeId)) ?? null,
      offices: (e.officeIds ?? []).map((id: unknown) => ({ id: String(id), name: names.offices.get(String(id)) ?? "" })),
      departmentId: e.departmentId ? String(e.departmentId) : null,
      departmentName: e.departmentId ? names.departments.get(String(e.departmentId)) ?? null : null,
      designationId: e.designationId ? String(e.designationId) : null,
      designationName: e.designationId ? names.designations.get(String(e.designationId)) ?? null : null,
      reportingManagerId: e.reportingManagerId ? String(e.reportingManagerId) : null,
      reportingManagerName: manager?.fullName ?? null,
      responsibilities: e.responsibilities ?? "",
      skills: e.skills ?? [],
      hasLogin: !!e.userId,
      ...(level.contact ? { workEmail: e.workEmail ?? "", phone: e.phone ?? "" } : {}),
      ...(level.notes ? { notes: e.notes ?? "", deactivationReason: e.deactivationReason ?? "" } : {}),
    };
  }

  private async views(rows: any[], level: ViewLevel) {
    const names = await this.organisation.names({
      offices: rows.flatMap((e) => [e.primaryOfficeId, ...(e.officeIds ?? [])]),
      departments: rows.map((e) => e.departmentId),
      designations: rows.map((e) => e.designationId),
    });
    const managerIds = [...new Set(rows.map((e) => e.reportingManagerId).filter(Boolean).map(String))];
    const managers = managerIds.length
      ? await this.employees.find({ _id: { $in: managerIds } }).select("fullName").lean()
      : [];
    const managerMap = new Map<string, any>(managers.map((m: any) => [String(m._id), m]));
    return rows.map((e) => this.view(e, names, level, managerMap));
  }

  // ------------------------------------------------------------ reads

  async list(access: HrAccess, query: HrEmployeeQueryDto) {
    const scope = this.listScope(access);
    if (!scope) throw new ForbiddenException("Your account does not have access to the employee directory.");
    const contact = access.can.employees;
    const and: Record<string, unknown>[] = [scope];
    const status = query.status ?? "active";
    if (status !== "all") and.push({ status });
    if (query.officeId) and.push({ $or: [{ primaryOfficeId: query.officeId }, { officeIds: query.officeId }] });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.designationId) and.push({ designationId: query.designationId });
    if (query.managerId) and.push({ reportingManagerId: query.managerId });
    if (query.search) {
      const pattern = { $regex: escapeRegex(query.search), $options: "i" };
      const fields: Record<string, unknown>[] = [{ fullName: pattern }, { employeeCode: pattern }];
      if (contact) fields.push({ workEmail: pattern });
      and.push({ $or: fields });
    }
    const filter = { $and: and };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortField = { name: "fullName", code: "employeeCode", joiningDate: "joiningDate", createdAt: "createdAt" }[query.sort ?? "name"] ?? "fullName";
    const direction = query.order === "desc" ? -1 : 1;
    const [rows, total] = await Promise.all([
      this.employees.find(filter).sort({ [sortField]: direction, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.employees.countDocuments(filter),
    ]);
    return { data: await this.views(rows, { contact, notes: false }), total, page, limit };
  }

  /** Short list for pickers (task assignment, filters): active employees the caller may see. */
  async directory(access: HrAccess) {
    const scope = this.listScope(access);
    if (!scope) throw new ForbiddenException("Your account does not have access to the employee directory.");
    const rows = await this.employees
      .find({ ...scope, status: "active" })
      .select("employeeCode fullName primaryOfficeId officeIds departmentId designationId reportingManagerId")
      .sort({ fullName: 1 })
      .limit(2000)
      .lean();
    return rows.map((e: any) => ({
      id: String(e._id),
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      primaryOfficeId: e.primaryOfficeId ? String(e.primaryOfficeId) : null,
      officeIds: (e.officeIds ?? []).map(String),
      departmentId: e.departmentId ? String(e.departmentId) : null,
      designationId: e.designationId ? String(e.designationId) : null,
      reportingManagerId: e.reportingManagerId ? String(e.reportingManagerId) : null,
    }));
  }

  /** One profile with its task and attendance summaries. Self, team manager or HR staff only. */
  async get(access: HrAccess, id: string) {
    if (!isEntityId(id)) throw new NotFoundException("Employee not found");
    const self = access.employee && String(access.employee._id) === id;
    const staff = HrAccessService.hasAnyCapability(access);
    if (!staff && !self && !access.teamIds.includes(id)) throw new NotFoundException("Employee not found");
    const row = await this.employees.findById(id).lean();
    if (!row) throw new NotFoundException("Employee not found");
    const [view] = await this.views([row], { contact: access.can.employees || !!self, notes: access.can.employees });

    const statusCounts = Object.fromEntries(
      await Promise.all(HR_TASK_STATUSES.map(async (s) => [s, await this.tasks.countDocuments({ employeeId: row._id, status: s })])),
    );
    const overdue = await this.tasks.countDocuments({ employeeId: row._id, ...overdueFilter() });
    const today = todayIst();
    const since = addDays(today, -29);
    const days = await this.attendance
      .find({ employeeId: row._id, date: { $gte: since, $lte: today } })
      .select("status")
      .lean();
    const attendance = {
      from: since,
      to: today,
      present: days.filter((d: any) => d.status === "present").length,
      halfDay: days.filter((d: any) => d.status === "half_day").length,
      absent: days.filter((d: any) => d.status === "absent").length,
    };

    let account: { role: string; hrPermissions: string[]; name: string } | null = null;
    if (access.can.employees && row.userId) {
      const user = await this.users.findById(row.userId).select("name role permissions").lean();
      if (user)
        account = {
          name: user.name,
          role: user.role,
          hrPermissions: (user.permissions ?? []).filter((p: string) => HR_PERMISSION_VALUES.includes(p)),
        };
    }
    return { ...view, account, taskSummary: { ...statusCounts, overdue }, attendanceSummary: attendance };
  }

  // ------------------------------------------------------------ writes (HR employees permission only)

  async create(access: HrAccess, dto: HrEmployeeDto) {
    HrAccessService.require(access, "employees");
    const fields = await this.validated(dto, null);
    const explicitCode = dto.employeeCode?.toUpperCase();
    if (explicitCode && (await this.employees.exists({ employeeCode: explicitCode })))
      throw new ConflictException("Another employee already has this Employee ID.");

    let created: any;
    for (let attempt = 1; ; attempt += 1) {
      const employeeCode = explicitCode ?? (await this.organisation.nextEmployeeCode());
      try {
        created = await this.employees.create({ ...fields, employeeCode, status: "active", createdBy: access.userId });
        break;
      } catch (error) {
        // A generated code that someone typed in by hand earlier: take the next one.
        if ((error as { code?: number }).code !== 11000 || explicitCode || attempt >= 5) throw error;
      }
    }
    await this.audit.record(access.userId, "HR_EMPLOYEE_CREATED", {
      employeeId: String(created._id),
      employeeCode: created.employeeCode,
      linkedLogin: !!created.userId,
    });
    return this.get(access, String(created._id));
  }

  async update(access: HrAccess, id: string, dto: HrEmployeeUpdateDto) {
    HrAccessService.require(access, "employees");
    if (!isEntityId(id)) throw new NotFoundException("Employee not found");
    const row = await this.employees.findById(id).lean();
    if (!row) throw new NotFoundException("Employee not found");
    const fields = await this.validated(dto, row);
    const changed = Object.keys(fields).filter((k) => JSON.stringify(fields[k] ?? null) !== JSON.stringify(row[k] ?? null));
    if (!changed.length) return this.get(access, id);
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    for (const key of changed) {
      if (fields[key] === undefined) unset[key] = "";
      else set[key] = fields[key];
    }
    await this.employees.updateOne({ _id: row._id }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    // Field names only: contact details and notes are never copied into the audit log.
    await this.audit.record(access.userId, "HR_EMPLOYEE_UPDATED", { employeeId: id, fields: changed });
    return this.get(access, id);
  }

  async setStatus(access: HrAccess, id: string, dto: HrEmployeeStatusDto) {
    HrAccessService.require(access, "employees");
    if (!isEntityId(id)) throw new NotFoundException("Employee not found");
    const row = await this.employees.findById(id).lean();
    if (!row) throw new NotFoundException("Employee not found");
    if (row.status === dto.status) return this.get(access, id);
    if (dto.status === "inactive" && !dto.reason?.trim())
      throw new BadRequestException("Give a reason for deactivating this employee.");
    if (dto.status === "active") {
      // Reactivating must not break the "one profile per person" rules if someone else took the email/login meanwhile.
      await this.assertUnique({ workEmail: row.workEmail, phone: row.phone, userId: row.userId }, row._id);
    }
    const claimed = await this.employees.findOneAndUpdate(
      { _id: row._id, status: row.status },
      dto.status === "inactive"
        ? { $set: { status: "inactive", deactivatedAt: new Date(), deactivationReason: dto.reason!.trim() } }
        : { $set: { status: "active" }, $unset: { deactivatedAt: "", deactivationReason: "" } },
    );
    if (!claimed) throw new ConflictException("This employee was changed by someone else. Reload and try again.");
    await this.audit.record(access.userId, dto.status === "inactive" ? "HR_EMPLOYEE_DEACTIVATED" : "HR_EMPLOYEE_REACTIVATED", {
      employeeId: id,
    });
    const openTasks = await this.tasks.countDocuments({ employeeId: row._id, status: { $in: HR_OPEN_TASK_STATUSES } });
    return { ...(await this.get(access, id)), openTasks };
  }

  /**
   * Finds one existing Tirvona login by exact email or phone, so HR can link it to an
   * employee. Exact match only (no browsing of accounts) and minimal fields.
   */
  async accountLookup(access: HrAccess, dto: HrAccountLookupDto) {
    HrAccessService.require(access, "employees");
    if (!dto.email && !dto.phone) throw new BadRequestException("Enter the login's email or phone number.");
    const filter = dto.email ? { email: dto.email.toLowerCase().trim() } : { phone: { $in: phoneCandidates(dto.phone!) } };
    const user = await this.users.findOne({ ...filter, isDeleted: { $ne: true } }).select("name role status").lean();
    if (!user) return null;
    const linked = await this.employees.findOne({ userId: user._id }).select("employeeCode fullName").lean();
    return {
      id: String(user._id),
      name: user.name,
      role: user.role,
      status: user.status,
      linkedEmployee: linked ? { id: String(linked._id), employeeCode: linked.employeeCode, fullName: linked.fullName } : null,
    };
  }

  // ------------------------------------------------------------ validation

  /**
   * Turns the request into the fields to store, checking every reference (offices,
   * department, designation, manager, login) and the duplicate rules.
   * `existing` is null for a new employee.
   */
  private async validated(dto: HrEmployeeDto | HrEmployeeUpdateDto, existing: any | null): Promise<Record<string, any>> {
    const out: Record<string, any> = {};
    const isNew = !existing;
    const has = (key: keyof HrEmployeeUpdateDto) => isNew || (dto as any)[key] !== undefined;
    const optionalId = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

    if (has("fullName")) out.fullName = dto.fullName!.trim().replace(/\s+/g, " ");
    if (has("workEmail")) {
      const email = dto.workEmail?.trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Enter a valid work email.");
      out.workEmail = email || undefined;
    }
    if (has("phone")) {
      const phone = dto.phone?.trim();
      if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) throw new BadRequestException("Enter a valid contact number.");
      out.phone = phone ? canonicalPhone(phone) : undefined;
    }
    if (has("photoUrl")) {
      const url = dto.photoUrl?.trim();
      if (url && !/^https:\/\//i.test(url)) throw new BadRequestException("The photo must be an https link.");
      out.photoUrl = url || "";
    }
    if (has("joiningDate")) {
      const date = dto.joiningDate?.trim();
      if (date && !DATE_KEY.test(date)) throw new BadRequestException("Use a joining date in the format YYYY-MM-DD.");
      out.joiningDate = date || undefined;
    }
    if (has("employmentType")) out.employmentType = dto.employmentType ?? "full_time";
    if (has("responsibilities")) out.responsibilities = dto.responsibilities?.trim() ?? "";
    if (has("notes")) out.notes = dto.notes?.trim() ?? "";
    if (has("skills")) out.skills = [...new Set((dto.skills ?? []).map((s) => s.trim()).filter(Boolean))];

    // Offices: the primary office is always one of the employee's offices.
    if (has("primaryOfficeId") || has("officeIds")) {
      const primary = String(dto.primaryOfficeId ?? existing?.primaryOfficeId ?? "");
      const extra = (dto.officeIds ?? (existing ? (existing.officeIds ?? []).map(String) : [])) as string[];
      const all = [...new Set([primary, ...extra])];
      await this.organisation.activeOffices(all);
      out.primaryOfficeId = primary;
      out.officeIds = all;
    }
    if (has("departmentId")) {
      const id = optionalId(dto.departmentId);
      out.departmentId = id ? (await this.organisation.activeDepartment(id))._id : undefined;
    }
    if (has("designationId")) {
      const id = optionalId(dto.designationId);
      if (id) {
        const designation = await this.organisation.activeDesignation(id);
        const departmentId = out.departmentId ?? existing?.departmentId;
        if (designation.departmentId && departmentId && String(designation.departmentId) !== String(departmentId))
          throw new BadRequestException("That designation belongs to a different department.");
        out.designationId = designation._id;
      } else out.designationId = undefined;
    }
    if (has("reportingManagerId")) {
      const id = optionalId(dto.reportingManagerId);
      if (id) {
        if (existing && String(existing._id) === id) throw new BadRequestException("An employee cannot report to themselves.");
        const manager = isEntityId(id) ? await this.employees.findOne({ _id: id, status: "active" }).lean() : null;
        if (!manager) throw new BadRequestException("Choose an active employee as the reporting manager.");
        if (existing) await this.assertNoCycle(String(existing._id), manager);
        out.reportingManagerId = manager._id;
      } else out.reportingManagerId = undefined;
    }
    if (has("userId")) {
      const id = optionalId(dto.userId);
      if (id) {
        const user = isEntityId(id) ? await this.users.findOne({ _id: id, isDeleted: { $ne: true } }).select("_id").lean() : null;
        if (!user) throw new BadRequestException("That login account was not found.");
        out.userId = user._id;
      } else out.userId = undefined;
    }
    await this.assertUnique(
      { workEmail: out.workEmail, phone: out.phone, userId: out.userId },
      existing?._id ?? null,
    );
    return out;
  }

  /** One profile per person: the same work email, contact number or login cannot be on two employees. */
  private async assertUnique(fields: { workEmail?: string; phone?: string; userId?: unknown }, selfId: unknown | null) {
    const notSelf = selfId ? { _id: { $ne: selfId } } : {};
    if (fields.workEmail && (await this.employees.exists({ workEmail: fields.workEmail, ...notSelf })))
      throw new ConflictException("Another employee already has this work email.");
    if (fields.phone && (await this.employees.exists({ phone: { $in: phoneCandidates(fields.phone) }, ...notSelf })))
      throw new ConflictException("Another employee already has this contact number.");
    if (fields.userId && (await this.employees.exists({ userId: fields.userId, ...notSelf })))
      throw new ConflictException("This login is already linked to another employee.");
  }

  /** Stops A reporting to B while B (directly or further up) reports to A. */
  private async assertNoCycle(employeeId: string, manager: any) {
    let current = manager;
    for (let depth = 0; current && depth < 50; depth += 1) {
      if (String(current._id) === employeeId)
        throw new BadRequestException("That manager already reports to this employee; the reporting line would loop.");
      if (!current.reportingManagerId) return;
      current = await this.employees.findById(current.reportingManagerId).select("reportingManagerId").lean();
    }
  }
}
