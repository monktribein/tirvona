import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { HR_ROLE, areaLabelForCity, placeTermsForCity } from "../../../common/auth/location-scope";

/** The location-scoped roles whose logins get an office here, and how each is named. */
export type AreaAccountRole = "hr" | "executive";
const ACCOUNT_LABEL: Record<AreaAccountRole, string> = { hr: "HR", executive: "Executive" };
import { HrAccessService, type HrAccess } from "./hr-access.service";
import { HrEmployeesService } from "./hr-employees.service";
import { HrAuditService } from "./hr-audit.service";

/**
 * Logins created with the `hr` or `executive` role, and the HR office each one works from.
 * The office's city is the only place that login can see in Leads, Food,
 * Temples and Pandits. The office is kept on the employee profile linked to
 * the login, created here on first assignment.
 */
@Injectable()
export class HrAccountsService {
  constructor(
    private readonly employeesService: HrEmployeesService,
    private readonly audit: HrAuditService,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("HrEmployee") private readonly employees: Model<any>,
    @InjectModel("HrOffice") private readonly offices: Model<any>,
  ) {}

  async list(access: HrAccess, role: AreaAccountRole = HR_ROLE) {
    HrAccessService.require(access, "employees");
    const users = (await this.users
      .find({ role, isDeleted: { $ne: true } })
      .select("name email phone status createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()) as any[];
    const linked = (await this.employees
      .find({ userId: { $in: users.map((u) => u._id) } })
      .select("userId employeeCode status primaryOfficeId")
      .lean()) as any[];
    const offices = (await this.offices
      .find({ _id: { $in: linked.map((e) => e.primaryOfficeId).filter(Boolean) } })
      .select("name city active")
      .lean()) as any[];
    return users.map((u) => {
      const employee = linked.find((e) => String(e.userId) === String(u._id));
      const office = employee ? offices.find((o) => String(o._id) === String(employee.primaryOfficeId)) : null;
      return {
        userId: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone ?? "",
        accountStatus: u.status,
        employee: employee
          ? { id: String(employee._id), employeeCode: employee.employeeCode, status: employee.status }
          : null,
        office: office
          ? { id: String(office._id), name: office.name, city: office.city ?? "", active: office.active !== false }
          : null,
        /** Places this login can see. Empty until an active office with a city is assigned. */
        coverage: office && office.active !== false && employee?.status === "active" ? placeTermsForCity(office.city ?? "") : [],
        /** The same, as people say it ("Vrindavan & Mathura"); empty when it sees nothing. */
        area: office && office.active !== false && employee?.status === "active" ? areaLabelForCity(office.city ?? "") : "",
      };
    });
  }

  async assignOffice(access: HrAccess, userId: string, officeId: string, role: AreaAccountRole = HR_ROLE) {
    const label = ACCOUNT_LABEL[role];
    HrAccessService.require(access, "employees");
    const user = (await this.users
      .findOne({ _id: userId, role, isDeleted: { $ne: true } })
      .select("name email phone status")
      .lean()) as any;
    if (!user) throw new NotFoundException(`${label} account not found`);
    if (user.status !== "active")
      throw new ConflictException(`Make this ${label} account Active in User Management before assigning an office.`);
    const office = (await this.offices.findOne({ _id: officeId, active: true }).select("name city").lean()) as any;
    if (!office) throw new NotFoundException("Office not found or inactive");
    if (!String(office.city ?? "").trim())
      throw new BadRequestException(`Add this office's city in HR Settings first: the city decides what the ${label} account can see.`);

    const employee = (await this.employees.findOne({ userId }).select("status").lean()) as any;
    if (employee) {
      if (employee.status !== "active")
        throw new ConflictException(`This ${label} account's employee profile is inactive. Reactivate it in Employees first.`);
      await this.employeesService.update(access, String(employee._id), {
        primaryOfficeId: officeId,
        officeIds: [officeId],
      } as any);
    } else {
      await this.employeesService.create(access, {
        fullName: user.name,
        workEmail: user.email,
        phone: user.phone || undefined,
        primaryOfficeId: officeId,
        officeIds: [officeId],
        userId,
      } as any);
    }
    await this.audit.record(access.userId, role === "hr" ? "HR_ACCOUNT_OFFICE_ASSIGNED" : "EXECUTIVE_ACCOUNT_OFFICE_ASSIGNED", {
      userId,
      officeId,
      city: office.city,
    });
    return (await this.list(access, role)).find((row) => row.userId === userId);
  }
}
