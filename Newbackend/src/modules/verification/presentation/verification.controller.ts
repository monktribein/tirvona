import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { VerificationService } from "../application/verification.service";
import {
  ScheduleInspectionDto,
  VerificationStatusDto,
} from "./verification.dto";
@Controller("verify")
export class VerificationController {
  constructor(private readonly service: VerificationService) {}
  @Get("pending")
  @Roles(
    "inspector",
    "district_officer",
    "state_admin",
    "govt_admin",
    "government_admin",
    "national_admin",
    "super_admin",
  )
  async pending(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.pending(user);
    return { success: true, count: data.length, data };
  }
  @Post(":id/schedule")
  @Roles(
    "inspector",
    "district_officer",
    "state_admin",
    "govt_admin",
    "government_admin",
    "national_admin",
    "super_admin",
  )
  async schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ScheduleInspectionDto,
  ) {
    return {
      success: true,
      message: "Inspection scheduled successfully",
      data: await this.service.schedule(user, id, dto.date),
    };
  }
  @Post(":id/status")
  @Roles(
    "district_officer",
    "state_admin",
    "govt_admin",
    "government_admin",
    "national_admin",
    "super_admin",
  )
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: VerificationStatusDto,
  ) {
    return {
      success: true,
      message: `Ashram status updated to: ${dto.status}`,
      data: await this.service.status(user, id, dto),
    };
  }
}
