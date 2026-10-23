import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Permissions } from "../../../common/decorators/permissions.decorator";
import { HR_PERMISSIONS } from "../domain/hr.constants";
import { HrAccessService } from "../application/hr-access.service";
import { HrAttendanceService } from "../application/hr-attendance.service";
import {
  HrAttendanceMarkDto,
  HrAttendanceQueryDto,
  HrCorrectionQueryDto,
  HrDecisionDto,
  HrLeaveQueryDto,
  HrLeaveRecordDto,
  HrRangeQueryDto,
} from "./hr.dto";

/** HR side of attendance, leave and corrections. Needs the HR attendance permission. */
@Permissions(HR_PERMISSIONS.attendance)
@Controller("hr")
export class HrAttendanceController {
  constructor(
    private readonly access: HrAccessService,
    private readonly attendance: HrAttendanceService,
  ) {}

  @Get("attendance")
  async register(@CurrentUser() user: AuthenticatedUser, @Query() query: HrAttendanceQueryDto) {
    return { success: true, ...(await this.attendance.register(await this.access.resolve(user), query)) };
  }

  @Put("attendance")
  async mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrAttendanceMarkDto) {
    return { success: true, message: "Attendance saved", data: await this.attendance.mark(await this.access.resolve(user), dto) };
  }

  @Get("attendance/summary")
  async summary(@CurrentUser() user: AuthenticatedUser, @Query() query: HrRangeQueryDto) {
    return { success: true, data: await this.attendance.summary(await this.access.resolve(user), query) };
  }

  @Get("leaves")
  async leaves(@CurrentUser() user: AuthenticatedUser, @Query() query: HrLeaveQueryDto) {
    return { success: true, ...(await this.attendance.listLeaves(await this.access.resolve(user), query)) };
  }

  @Post("leaves")
  async recordLeave(@CurrentUser() user: AuthenticatedUser, @Body() dto: HrLeaveRecordDto) {
    return { success: true, message: "Leave recorded", data: await this.attendance.recordLeave(await this.access.resolve(user), dto) };
  }

  @Post("leaves/:id/decision")
  async decideLeave(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrDecisionDto) {
    return {
      success: true,
      message: dto.decision === "approve" ? "Leave approved" : "Leave rejected",
      data: await this.attendance.decideLeave(await this.access.resolve(user), id, dto.decision, dto.note),
    };
  }

  @Get("attendance-corrections")
  async corrections(@CurrentUser() user: AuthenticatedUser, @Query() query: HrCorrectionQueryDto) {
    return { success: true, ...(await this.attendance.listCorrections(await this.access.resolve(user), query)) };
  }

  @Post("attendance-corrections/:id/decision")
  async decideCorrection(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: HrDecisionDto) {
    return {
      success: true,
      message: dto.decision === "approve" ? "Correction applied" : "Correction rejected",
      data: await this.attendance.decideCorrection(await this.access.resolve(user), id, dto.decision, dto.note),
    };
  }
}
