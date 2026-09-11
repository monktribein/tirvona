import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
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
    try {
      return {
        success: true,
        data: await this.attendanceService.markCheckIn(agent, dto),
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      console.error("[check-in] failed", err);
      throw new BadRequestException("Check-in failed. Please try again.");
    }
  }

  @Post("check-out")
  async checkOut(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Body() dto: MarkCheckOutDto,
  ) {
    try {
      return {
        success: true,
        data: await this.attendanceService.markCheckOut(agent, dto),
      };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      console.error("[check-out] failed", err);
      throw new BadRequestException("Check-out failed. Please try again.");
    }
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
