import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../../common/decorators/public.decorator";
import { LeadTrackingService } from "../application/lead-tracking.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import {
  RecordFixesDto,
  TrackingConsentDto,
  TrackingDayQueryDto,
  TrackingHistoryQueryDto,
} from "./dtos/lead-tracking.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

/**
 * An agent's own movement data. Every route reads the agent from the token
 * rather than from a parameter, so there is no id an agent could substitute to
 * reach somebody else's route.
 */
@ApiTags("Lead Collection - Tracking")
@Public()
@UseGuards(LeadAgentGuard)
@SkipThrottle({ default: true, ipAbuse: true })
@Controller("lead-collection/agent/tracking")
export class LeadTrackingAgentController {
  constructor(private readonly tracking: LeadTrackingService) {}

  @Get("consent")
  async readConsent(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return {
      success: true,
      data: {
        consent: await this.tracking.getConsent(agent.id),
        settings: this.tracking.settings(),
      },
    };
  }

  @Post("consent")
  async setConsent(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Body() dto: TrackingConsentDto,
  ) {
    const consent = await this.tracking.setConsent(agent, dto);
    return {
      success: true,
      message: consent.granted
        ? "Location tracking is on. Your route will be recorded while you work."
        : "Location tracking is off. No further points will be recorded.",
      data: consent,
    };
  }

  @Post("fixes")
  async record(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Body() dto: RecordFixesDto,
  ) {
    return {
      success: true,
      data: await this.tracking.recordFixes(agent, dto),
    };
  }

  @Get("today")
  async today(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return { success: true, data: await this.tracking.day(agent.id) };
  }

  @Get("day")
  async day(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Query() query: TrackingDayQueryDto,
  ) {
    return {
      success: true,
      data: await this.tracking.day(agent.id, query.date),
    };
  }

  @Get("history")
  async history(
    @CurrentLeadAgent() agent: AuthenticatedLeadUser,
    @Query() query: TrackingHistoryQueryDto,
  ) {
    return {
      success: true,
      data: await this.tracking.history(agent.id, query),
    };
  }
}
