import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { HR_CAPABILITIES, HR_PERMISSIONS, type HrCapability } from "../domain/hr.constants";

/**
 * What one signed-in user may do in HR. Worked out per request from the user's own account
 * and their linked employee profile; nothing is taken from the request body.
 *
 *  - Super Admin: everything.
 *  - HR staff: only the HR permissions a Super Admin granted on their account.
 *  - Manager: an active employee with active direct reports sees and manages only those
 *    reports' tasks (teamIds). Being a manager grants nothing else.
 *  - Employee: only their own profile, tasks, attendance and leave.
 */
export interface HrAccess {
  userId: string;
  userName: string;
  isSuperAdmin: boolean;
  can: Record<HrCapability, boolean>;
  /** The caller's own active employee profile, if their login is linked to one. */
  employee: any | null;
  /** Active employees who report directly to the caller. */
  teamIds: string[];
}

@Injectable()
export class HrAccessService {
  constructor(@InjectModel("HrEmployee") private readonly employees: Model<any>) {}

  async resolve(user: AuthenticatedUser): Promise<HrAccess> {
    const isSuperAdmin = user.role === "super_admin";
    const granted = new Set(user.permissions ?? []);
    const can = Object.fromEntries(
      HR_CAPABILITIES.map((cap) => [cap, isSuperAdmin || granted.has(HR_PERMISSIONS[cap])]),
    ) as Record<HrCapability, boolean>;
    const employee = user.id
      ? await this.employees.findOne({ userId: user.id, status: "active" }).lean()
      : null;
    const team = employee
      ? await this.employees
          .find({ reportingManagerId: employee._id, status: "active" })
          .select("_id")
          .limit(1000)
          .lean()
      : [];
    return {
      userId: String(user.id),
      userName: user.name,
      isSuperAdmin,
      can,
      employee,
      teamIds: team.map((t: any) => String(t._id)),
    };
  }

  static hasAnyCapability(access: HrAccess): boolean {
    return HR_CAPABILITIES.some((cap) => access.can[cap]);
  }

  static require(access: HrAccess, cap: HrCapability): void {
    if (!access.can[cap])
      throw new ForbiddenException("Your account does not have this HR permission. Ask a Super Admin.");
  }

  static requireAny(access: HrAccess): void {
    if (!HrAccessService.hasAnyCapability(access))
      throw new ForbiddenException("Your account does not have access to HR Management.");
  }

  static requireEmployee(access: HrAccess): any {
    if (!access.employee)
      throw new ForbiddenException("Your login is not linked to an active employee profile. Ask HR to link it.");
    return access.employee;
  }
}
