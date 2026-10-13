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
import { LeadTrackingService } from "../application/lead-tracking.service";
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
  constructor(
    private readonly attendanceService: LeadAttendanceService,
    private readonly tracking: LeadTrackingService,
  ) {}

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
      const result: any = await this.attendanceService.markCheckOut(agent, dto);
      // The shift is over: save its distance so it outlives the raw points.
      // A failure here must not undo a successful check-out.
      const attendanceId = result?.record?._id;
      if (attendanceId)
        await this.tracking
          .saveShiftDistance(agent.id, String(attendanceId))
          .catch((error) => console.error("[check-out] distance not saved", error));
      return {
        success: true,
        data: result,
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
