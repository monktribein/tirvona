import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { HrAccessService } from "../application/hr-access.service";
import { HrAttendanceService } from "../application/hr-attendance.service";
import { HrTasksService } from "../application/hr-tasks.service";
import {
  HrCheckInDto,
  HrCorrectionRequestDto,
  HrLeaveRequestDto,
  HrMyTasksQueryDto,
} from "./hr.dto";

/**
 * The signed-in user's own HR data. Everything here is read from the caller's own linked
 * employee profile; no employee id is ever taken from the request.
 */
@Controller("hr/me")
export class HrSelfController {
  constructor(
    private readonly access: HrAccessService,
    private readonly tasks: HrTasksService,
    private readonly attendance: HrAttendanceService,
  ) {}

  /** What the HR screens and sidebar should offer this user. Safe for any signed-in user. */
  @Get("access")
  async myAccess(@CurrentUser() user: AuthenticatedUser) {
    const access = await this.access.resolve(user);
    const e = access.employee;
    return {
      success: true,
      data: {
        can: access.can,
        isManager: access.teamIds.length > 0,
        teamSize: access.teamIds.length,
        employee: e
          ? {
              id: String(e._id),
              employeeCode: e.employeeCode,
              fullName: e.fullName,
              primaryOfficeId: e.primaryOfficeId ? String(e.primaryOfficeId) : null,
              officeIds: (e.officeIds ?? []).map(String),
            }
          : null,
      },
    };
  }

  @Get("tasks")
  async myTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: HrMyTasksQueryDto) {
    return { success: true, ...(await this.tasks.myTasks(await this.access.resolve(user), query)) };
  }

  @Get("attendance/today")
  async today(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.attendance.myToday(await this.access.resolve(user)) };
  }

  @Get("attendance")
  async myAttendance(@CurrentUser() user: AuthenticatedUser, @Query("from") from?: string, @Query("to") to?: string) {
    return { success: true, data: await this.attendance.myAttendance(await this.access.resolve(user), from, to) };
  }

  @Post("attendance/check-in")
  async checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrCheckInDto) {
    return { success: true, message: "Checked in", data: await this.attendance.checkIn(await this.access.resolve(user), dto.officeId) };
  }

  @Post("attendance/check-out")
  async checkOut(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, message: "Checked out", data: await this.attendance.checkOut(await this.access.resolve(user)) };
  }

  @Get("leaves")
  async myLeaves(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.attendance.myLeaves(await this.access.resolve(user)) };
  }

  @Post("leaves")
  async requestLeave(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrLeaveRequestDto) {
    return { success: true, message: "Leave requested", data: await this.attendance.requestLeave(await this.access.resolve(user), dto) };
  }

  @Post("leaves/:id/cancel")
  async cancelLeave(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, message: "Leave request cancelled", data: await this.attendance.cancelMyLeave(await this.access.resolve(user), id) };
  }

  @Get("attendance-corrections")
  async myCorrections(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.attendance.myCorrections(await this.access.resolve(user)) };
  }

  @Post("attendance-corrections")
  async requestCorrection(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrCorrectionRequestDto) {
    return { success: true, message: "Correction requested", data: await this.attendance.requestCorrection(await this.access.resolve(user), dto) };
  }
}
