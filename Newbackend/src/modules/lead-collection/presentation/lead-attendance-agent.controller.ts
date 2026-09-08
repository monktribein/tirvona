import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../../common/decorators/public.decorator";
import { LeadAttendanceService } from "../application/lead-attendance.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import {
  AttendanceQueryDto,
  MarkCheckInDto,
  MarkCheckOutDto,
} from "./dtos/lead-attendance.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

@ApiTags("Lead Collection - Attendance")
@Public()
@UseGuards(LeadAgentGuard)
@SkipThrottle({ default: true, ipAbuse: true })
@Controller("lead-collection/agent/attendance")
export class LeadAttendanceAgentController {
  constructor(private readonly attendanceService: LeadAttendanceService) {}

  @Post("check-in")
  async checkIn(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Body() dto: MarkCheckInDto,
  ) {
    return {
      success: true,
      data: await this.attendanceService.markCheckIn(agent, dto),
    };
  }

  @Post("check-out")
  async checkOut(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Body() dto: MarkCheckOutDto,
  ) {
    return {
      success: true,
      data: await this.attendanceService.markCheckOut(agent, dto),
    };
  }

  @Get("today")
  async today(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return {
      success: true,
      data: await this.attendanceService.getTodayStatus(agent.id),
    };
  }

  @Get("history")
  async myHistory(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return {
      success: true,
      data: await this.attendanceService.getAgentAttendanceHistory(agent.id, query),
    };
  }
}
