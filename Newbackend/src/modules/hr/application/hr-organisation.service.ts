import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { HR_DEFAULT_SETTINGS, HR_SETTINGS_KEY } from "../domain/hr.constants";
import type {
  HrDepartmentDto,
  HrDepartmentUpdateDto,
  HrDesignationDto,
  HrDesignationUpdateDto,
  HrOfficeDto,
  HrOfficeUpdateDto,
  HrSettingsDto,
} from "../presentation/hr.dto";
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrAuditService } from "./hr-audit.service";

const ENTITY_ID = /^[0-9a-f]{24}$/i;
export const isEntityId = (value: unknown): value is string => typeof value === "string" && ENTITY_ID.test(value);

/** "  Customer   Support " -> "customer support": what makes two names the same. */
export const nameKeyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

const officeView = (o: any) => ({
  id: String(o._id),
  code: o.code,
  name: o.name,
  address: o.address ?? "",
  city: o.city ?? "",
  phone: o.phone ?? "",
  email: o.email ?? "",
  active: o.active !== false,
});

const departmentView = (d: any) => ({
  id: String(d._id),
  name: d.name,
  description: d.description ?? "",
  active: d.active !== false,
});

const designationView = (d: any) => ({
  id: String(d._id),
  name: d.name,
  departmentId: d.departmentId ? String(d.departmentId) : null,
  active: d.active !== false,
});

/** Offices, departments, designations and HR settings. */
@Injectable()
export class HrOrganisationService {
  constructor(
    @InjectModel("HrOffice") private readonly offices: Model<any>,
    @InjectModel("HrDepartment") private readonly departments: Model<any>,
    @InjectModel("HrDesignation") private readonly designations: Model<any>,
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    @InjectModel("HrSettings") private readonly settingsModel: Model<any>,
    private readonly audit: HrAuditService,
  ) {}

  /** Anyone with an HR permission, and every linked employee (to pick an office at check-in). */
  private requireViewer(access: HrAccess) {
    if (!HrAccessService.hasAnyCapability(access) && !access.employee && !access.teamIds.length)
      throw new ForbiddenException("Your account does not have access to HR Management.");
  }

  // ------------------------------------------------------------ offices

  async listOffices(access: HrAccess) {
    this.requireViewer(access);
    const rows = await this.offices.find({}).sort({ name: 1 }).limit(100).lean();
    const staff = HrAccessService.hasAnyCapability(access);
    if (!staff) return rows.filter((o: any) => o.active !== false).map((o: any) => ({ id: String(o._id), code: o.code, name: o.name, active: true }));
    const active = await this.employees
      .find({ status: "active" })
      .select("officeIds primaryOfficeId departmentId")
      .limit(5000)
      .lean();
    return rows.map((o: any) => {
      const id = String(o._id);
      const here = active.filter((e: any) => (e.officeIds ?? []).map(String).includes(id) || String(e.primaryOfficeId) === id);
      return {
        ...officeView(o),
        employeeCount: here.length,
        departmentCount: new Set(here.filter((e: any) => e.departmentId).map((e: any) => String(e.departmentId))).size,
      };
    });
  }

  async createOffice(access: HrAccess, dto: HrOfficeDto) {
    HrAccessService.require(access, "employees");
    const key = nameKeyOf(dto.name);
    if (await this.offices.exists({ $or: [{ code: dto.code.toUpperCase() }, { nameKey: key }] }))
      throw new ConflictException("An office with this code or name already exists.");
    const office = await this.offices.create({ ...dto, code: dto.code.toUpperCase(), nameKey: key, createdBy: access.userId });
    await this.audit.record(access.userId, "HR_OFFICE_CREATED", { officeId: String(office._id), code: office.code });
    return officeView(office);
  }

  async updateOffice(access: HrAccess, id: string, dto: HrOfficeUpdateDto) {
    HrAccessService.require(access, "employees");
    const office = await this.byId(this.offices, id, "Office");
    const changes: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const key = nameKeyOf(dto.name);
      if (await this.offices.exists({ nameKey: key, _id: { $ne: office._id } }))
        throw new ConflictException("Another office already has this name.");
      changes.name = dto.name;
      changes.nameKey = key;
    }
    for (const field of ["address", "city", "phone", "email"] as const)
      if (dto[field] !== undefined) changes[field] = dto[field];
    if (dto.active === false && office.active !== false) {
      const assigned = await this.employees.countDocuments({
        status: "active",
        $or: [{ primaryOfficeId: office._id }, { officeIds: office._id }],
      });
      if (assigned)
        throw new BadRequestException(`${assigned} active employee(s) still work from this office. Move them first.`);
    }
    if (dto.active !== undefined) changes.active = dto.active;
    const updated = await this.offices.findOneAndUpdate({ _id: office._id }, { $set: changes }, { new: true }).lean();
    await this.audit.record(access.userId, "HR_OFFICE_UPDATED", { officeId: id, fields: Object.keys(changes) });
    return officeView(updated);
  }

  // ------------------------------------------------------------ departments

  async listDepartments(access: HrAccess) {
    this.requireViewer(access);
    const rows = await this.departments.find({}).sort({ name: 1 }).limit(300).lean();
    if (!HrAccessService.hasAnyCapability(access)) return rows.map(departmentView);
    const active = await this.employees.find({ status: "active" }).select("departmentId").limit(5000).lean();
    return rows.map((d: any) => ({
      ...departmentView(d),
      employeeCount: active.filter((e: any) => String(e.departmentId) === String(d._id)).length,
    }));
  }

  async createDepartment(access: HrAccess, dto: HrDepartmentDto) {
    HrAccessService.require(access, "employees");
    const key = nameKeyOf(dto.name);
    if (await this.departments.exists({ nameKey: key })) throw new ConflictException("This department already exists.");
    const row = await this.departments.create({ ...dto, nameKey: key, createdBy: access.userId });
    await this.audit.record(access.userId, "HR_DEPARTMENT_CREATED", { departmentId: String(row._id) });
    return departmentView(row);
  }

  async updateDepartment(access: HrAccess, id: string, dto: HrDepartmentUpdateDto) {
    HrAccessService.require(access, "employees");
    const row = await this.byId(this.departments, id, "Department");
    const changes: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const key = nameKeyOf(dto.name);
      if (await this.departments.exists({ nameKey: key, _id: { $ne: row._id } }))
        throw new ConflictException("Another department already has this name.");
      changes.name = dto.name;
      changes.nameKey = key;
    }
    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.active === false && row.active !== false) {
      const assigned = await this.employees.countDocuments({ status: "active", departmentId: row._id });
      if (assigned) throw new BadRequestException(`${assigned} active employee(s) are in this department. Move them first.`);
    }
    if (dto.active !== undefined) changes.active = dto.active;
    const updated = await this.departments.findOneAndUpdate({ _id: row._id }, { $set: changes }, { new: true }).lean();
    await this.audit.record(access.userId, "HR_DEPARTMENT_UPDATED", { departmentId: id, fields: Object.keys(changes) });
    return departmentView(updated);
  }

  // ------------------------------------------------------------ designations

  async listDesignations(access: HrAccess) {
    this.requireViewer(access);
    const rows = await this.designations.find({}).sort({ name: 1 }).limit(500).lean();
    return rows.map(designationView);
  }

  async createDesignation(access: HrAccess, dto: HrDesignationDto) {
    HrAccessService.require(access, "employees");
    const departmentId = dto.departmentId ? (await this.activeDepartment(dto.departmentId))._id : null;
    const key = nameKeyOf(dto.name);
    if (await this.designations.exists({ nameKey: key, departmentId }))
      throw new ConflictException("This designation already exists in that department.");
    const row = await this.designations.create({ name: dto.name, nameKey: key, departmentId, createdBy: access.userId });
    await this.audit.record(access.userId, "HR_DESIGNATION_CREATED", { designationId: String(row._id) });
    return designationView(row);
  }

  async updateDesignation(access: HrAccess, id: string, dto: HrDesignationUpdateDto) {
    HrAccessService.require(access, "employees");
    const row = await this.byId(this.designations, id, "Designation");
    const changes: Record<string, unknown> = {};
    let departmentId = row.departmentId ?? null;
    if (dto.departmentId !== undefined) {
      departmentId = dto.departmentId ? (await this.activeDepartment(dto.departmentId))._id : null;
      changes.departmentId = departmentId;
    }
    const name = dto.name ?? row.name;
    const key = nameKeyOf(name);
    if (dto.name !== undefined || dto.departmentId !== undefined) {
      if (await this.designations.exists({ nameKey: key, departmentId, _id: { $ne: row._id } }))
        throw new ConflictException("This designation already exists in that department.");
      changes.name = name;
      changes.nameKey = key;
    }
    if (dto.active === false && row.active !== false) {
      const assigned = await this.employees.countDocuments({ status: "active", designationId: row._id });
      if (assigned) throw new BadRequestException(`${assigned} active employee(s) have this designation. Change it first.`);
    }
    if (dto.active !== undefined) changes.active = dto.active;
    const updated = await this.designations.findOneAndUpdate({ _id: row._id }, { $set: changes }, { new: true }).lean();
    await this.audit.record(access.userId, "HR_DESIGNATION_UPDATED", { designationId: id, fields: Object.keys(changes) });
    return designationView(updated);
  }

  // ------------------------------------------------------------ settings

  /** The single settings row, created with the defaults the first time it is needed. */
  async settings(): Promise<any> {
    const found = await this.settingsModel.findOne({ key: HR_SETTINGS_KEY }).lean();
    if (found) return found;
    try {
      return (await this.settingsModel.create({ key: HR_SETTINGS_KEY, ...HR_DEFAULT_SETTINGS })).toObject();
    } catch (error) {
      // Two requests creating it at once: the other one won.
      if ((error as { code?: number }).code !== 11000) throw error;
      return this.settingsModel.findOne({ key: HR_SETTINGS_KEY }).lean();
    }
  }

  async getSettings(access: HrAccess) {
    HrAccessService.requireAny(access);
    const s = await this.settings();
    return { weeklyOffDays: s.weeklyOffDays ?? HR_DEFAULT_SETTINGS.weeklyOffDays, dueSoonHours: s.dueSoonHours ?? HR_DEFAULT_SETTINGS.dueSoonHours };
  }

  async updateSettings(access: HrAccess, dto: HrSettingsDto) {
    HrAccessService.require(access, "employees");
    await this.settings();
    const changes: Record<string, unknown> = { updatedBy: access.userId };
    if (dto.weeklyOffDays) changes.weeklyOffDays = [...new Set(dto.weeklyOffDays)].sort();
    if (dto.dueSoonHours !== undefined) changes.dueSoonHours = dto.dueSoonHours;
    await this.settingsModel.findOneAndUpdate({ key: HR_SETTINGS_KEY }, { $set: changes });
    await this.audit.record(access.userId, "HR_SETTINGS_UPDATED", { fields: Object.keys(changes).filter((k) => k !== "updatedBy") });
    return this.getSettings(access);
  }

  /** Next generated employee code (EMP-0001, EMP-0002 ...), taken from an atomic counter. */
  async nextEmployeeCode(): Promise<string> {
    await this.settings();
    const row = await this.settingsModel.findOneAndUpdate({ key: HR_SETTINGS_KEY }, { $inc: { employeeSeq: 1 } }, { new: true }).lean();
    return `EMP-${String(row.employeeSeq).padStart(4, "0")}`;
  }

  // ------------------------------------------------------------ lookups used by the other HR services

  async activeOffices(ids: string[]): Promise<any[]> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !isEntityId(id))) throw new BadRequestException("Choose a valid office.");
    const rows = await this.offices.find({ _id: { $in: unique }, active: true }).lean();
    if (rows.length !== unique.length) throw new BadRequestException("Choose an active office.");
    return rows;
  }

  async activeDepartment(id: string): Promise<any> {
    if (!isEntityId(id)) throw new BadRequestException("Choose a valid department.");
    const row = await this.departments.findOne({ _id: id, active: true }).lean();
    if (!row) throw new BadRequestException("Choose an active department.");
    return row;
  }

  async activeDesignation(id: string): Promise<any> {
    if (!isEntityId(id)) throw new BadRequestException("Choose a valid designation.");
    const row = await this.designations.findOne({ _id: id, active: true }).lean();
    if (!row) throw new BadRequestException("Choose an active designation.");
    return row;
  }

  /** Id -> name maps for the given office, department and designation ids, in three queries. */
  async names(ids: { offices?: unknown[]; departments?: unknown[]; designations?: unknown[] }) {
    const clean = (list?: unknown[]) => [...new Set((list ?? []).filter(Boolean).map(String))].filter(isEntityId);
    const [offices, departments, designations] = await Promise.all([
      clean(ids.offices).length ? this.offices.find({ _id: { $in: clean(ids.offices) } }).select("name code").lean() : [],
      clean(ids.departments).length ? this.departments.find({ _id: { $in: clean(ids.departments) } }).select("name").lean() : [],
      clean(ids.designations).length ? this.designations.find({ _id: { $in: clean(ids.designations) } }).select("name").lean() : [],
    ]);
    const map = (rows: any[]) => new Map<string, string>(rows.map((r) => [String(r._id), r.name]));
    return { offices: map(offices), departments: map(departments), designations: map(designations) };
  }

  private async byId(model: Model<any>, id: string, label: string) {
    if (!isEntityId(id)) throw new NotFoundException(`${label} not found`);
    const row = await model.findById(id).lean();
    if (!row) throw new NotFoundException(`${label} not found`);
    return row as any;
  }
}
