import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  assertInLocation,
  assertWritableInLocation,
  locationMatches,
  type LocationScope,
} from "../../../common/auth/location-scope";
import { HrLocationService } from "../../hr/application/hr-location.service";
import {
  LeadUsersService,
  type LeadAdminActor,
} from "../application/lead-users.service";
import { LeadsService } from "../application/leads.service";
import { LeadAttendanceService } from "../application/lead-attendance.service";
import { LeadTrackingService } from "../application/lead-tracking.service";
import {
  CreateLeadUserDto,
  CreateLeadRegionDto,
  LeadUserQueryDto,
  ResetLeadUserPasswordDto,
  UpdateLeadUserDto,
} from "./dtos/lead-user.dto";
import { LeadDecisionDto, LeadQueryDto, SaveLeadDto } from "./dtos/lead.dto";
import { AttendanceQueryDto } from "./dtos/lead-attendance.dto";
import {
  TrackingDayQueryDto,
  TrackingHistoryQueryDto,
} from "./dtos/lead-tracking.dto";

@ApiTags("Lead Collection")
@ApiBearerAuth()
/**
 * Lead Collection administration. Super Admin sees everything; an `hr` login
 * sees and manages only the leads, field agents and regions of its office's area.
 */
@Roles("super_admin", "hr", "executive")
@SkipThrottle({ default: true, ipAbuse: true })
@Controller("lead-collection/admin")
export class LeadAdminController {
  constructor(
    private readonly leads: LeadsService,
    private readonly leadUsers: LeadUsersService,
    private readonly attendanceService: LeadAttendanceService,
    private readonly tracking: LeadTrackingService,
    private readonly location: HrLocationService,
  ) {}

  private scope(user: AuthenticatedUser): Promise<LocationScope> {
    return this.location.scopeFor(user);
  }

  /** A lead the caller may act on (404 when it is outside an HR login's area). */
  private async scopedLead(user: AuthenticatedUser, id: string) {
    const lead: any = await this.leads.findOne(id);
    assertInLocation(
      await this.scope(user),
      "Lead",
      lead.location?.address,
      lead.location?.city,
      lead.location?.district,
    );
    return lead;
  }

  /** A field agent the caller may act on (404 when outside an HR login's area). */
  private async scopedAgent(user: AuthenticatedUser, id: string) {
    const agent: any = await this.leadUsers.findOne(id);
    assertInLocation(await this.scope(user), "Field agent", agent.district, agent.region);
    return agent;
  }

  private actor(user: AuthenticatedUser): LeadAdminActor {
    return { id: user.id, name: user.name };
  }

  @Get("leads")
  async listLeads(@CurrentUser() user: AuthenticatedUser, @Query() query: LeadQueryDto) {
    return { success: true, data: await this.leads.list(query, undefined, await this.scope(user)) };
  }

  @Get("leads/stats")
  async leadStats(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.leads.stats(undefined, await this.scope(user)) };
  }

  @Get("leads/:id")
  async oneLead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.scopedLead(user, id) };
  }

  @Post("leads")
  async createLead(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveLeadDto) {
    assertWritableInLocation(
      await this.scope(user),
      dto.location?.address,
      dto.location?.city,
      dto.location?.district,
    );
    return {
      success: true,
      message: "Lead created",
      data: await this.leads.createAsAdmin(dto),
    };
  }

  @Put("leads/:id")
  async updateLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SaveLeadDto,
  ) {
    await this.scopedLead(user, id);
    if (dto.location)
      assertWritableInLocation(
        await this.scope(user),
        dto.location.address,
        dto.location.city,
        dto.location.district,
      );
    return {
      success: true,
      message: "Lead updated",
      data: await this.leads.update(id, dto),
    };
  }

  @Post("leads/:id/approve")
  @HttpCode(200)
  async approveLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: LeadDecisionDto,
  ) {
    return {
      success: true,
      message: "Lead approved",
      data: await this.scopedLead(user, id).then(() =>
        this.leads.decide(id, "approved", dto, this.actor(user)),
      ),
    };
  }

  @Post("leads/:id/reject")
  @HttpCode(200)
  async rejectLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: LeadDecisionDto,
  ) {
    return {
      success: true,
      message: "Lead rejected",
      data: await this.scopedLead(user, id).then(() =>
        this.leads.decide(id, "rejected", dto, this.actor(user)),
      ),
    };
  }

  @Post("leads/:id/convert")
  @HttpCode(200)
  async convertLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: LeadDecisionDto,
  ) {
    return {
      success: true,
      message: "Lead marked as converted",
      data: await this.scopedLead(user, id).then(() =>
        this.leads.decide(id, "converted", dto, this.actor(user)),
      ),
    };
  }

  @Post("leads/:id/reopen")
  @HttpCode(200)
  async reopenLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: LeadDecisionDto,
  ) {
    return {
      success: true,
      message: "Lead reopened for review",
      data: await this.scopedLead(user, id).then(() =>
        this.leads.decide(id, "pending", dto, this.actor(user)),
      ),
    };
  }

  @Delete("leads/:id")
  async removeLead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.scopedLead(user, id);
    return {
      success: true,
      message: "Lead deleted",
      data: await this.leads.remove(id),
    };
  }

  @Get("regions")
  async listRegions(@CurrentUser() user: AuthenticatedUser) {
    const scope = await this.scope(user);
    const regions = await this.leadUsers.listRegions();
    return { success: true, data: regions.filter((r) => locationMatches(scope, r.district)) };
  }

  @Post("regions")
  async addRegion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadRegionDto,
  ) {
    assertWritableInLocation(await this.scope(user), dto.district);
    return {
      success: true,
      message: "Lead region added",
      data: await this.leadUsers.addRegion(dto, this.actor(user)),
    };
  }

  @Delete("regions")
  async removeRegion(
    @CurrentUser() user: AuthenticatedUser,
    @Query("state") state: string,
    @Query("district") district: string,
  ) {
    assertWritableInLocation(await this.scope(user), district);
    return {
      success: true,
      message: "Lead region removed",
      data: await this.leadUsers.removeRegion(state, district),
    };
  }

  @Get("users")
  async listUsers(@CurrentUser() user: AuthenticatedUser, @Query() query: LeadUserQueryDto) {
    return { success: true, data: await this.leadUsers.list(query, await this.scope(user)) };
  }

  @Get("users/:id")
  async oneUser(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.scopedAgent(user, id) };
  }

  @Post("users")
  async createUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadUserDto,
  ) {
    assertWritableInLocation(await this.scope(user), dto.district);
    return {
      success: true,
      message: "Field agent account created",
      data: await this.leadUsers.create(dto, this.actor(user)),
    };
  }

  @Put("users/:id")
  async updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadUserDto,
  ) {
    await this.scopedAgent(user, id);
    if (dto.district !== undefined) assertWritableInLocation(await this.scope(user), dto.district);
    return {
      success: true,
      message: "Field agent updated",
      data: await this.leadUsers.update(id, dto),
    };
  }

  @Post("users/:id/reset-password")
  @HttpCode(200)
  async resetUserPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResetLeadUserPasswordDto,
  ) {
    await this.scopedAgent(user, id);
    return {
      success: true,
      message: "Password reset. The agent's existing sessions were signed out.",
      data: await this.leadUsers.resetPassword(id, dto),
    };
  }

  @Delete("users/:id")
  async removeUser(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.scopedAgent(user, id);
    return {
      success: true,
      message: "Field agent deleted. Their captured leads were retained.",
      data: await this.leadUsers.remove(id),
    };
  }

  @Get("attendance/summary")
  async attendanceSummary(@CurrentUser() user: AuthenticatedUser) {
    const scope = await this.scope(user);
    const data = await this.attendanceService.getAllAgentsAttendanceSummary();
    if (scope === null) return { success: true, data };
    // An HR login only sees the agents of its area.
    const agents = await this.leadUsers.list({ page: 1, limit: 10_000 } as LeadUserQueryDto, scope);
    const allowed = new Set(agents.items.map((a: any) => String(a._id ?? a.id)));
    const keep = (map: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(map).filter(([agentId]) => allowed.has(agentId)));
    return { success: true, data: { summaryMap: keep(data.summaryMap), todayMap: keep(data.todayMap) } };
  }

  @Get("attendance/agent/:id")
  async agentAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: AttendanceQueryDto,
  ) {
    await this.scopedAgent(user, id);
    const history = await this.attendanceService.getAgentAttendanceHistory(id, query);
    return {
      success: true,
      data: await this.tracking.withAttendanceDistances(id, history, query),
    };
  }

  /** The full route of one check-in → check-out shift, for the monitoring map. */
  @Get("agents/:agentId/shifts/:attendanceId/route")
  async shiftRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param("agentId") agentId: string,
    @Param("attendanceId") attendanceId: string,
  ) {
    const agent = await this.scopedAgent(user, agentId);
    return {
      success: true,
      data: {
        agent: {
          id: String(agent._id),
          name: agent.name,
          phone: agent.phone,
          role: agent.role,
          state: agent.state,
          district: agent.district,
        },
        shift: await this.tracking.shiftRoute(agentId, attendanceId),
      },
    };
  }

  /**
   * Movement tracking for any agent. A super admin is unrestricted, so the
   * only lookup needed is that the agent exists.
   */
  @Get("agents/:agentId/tracking")
  async agentTracking(
    @CurrentUser() user: AuthenticatedUser,
    @Param("agentId") agentId: string,
    @Query() query: TrackingDayQueryDto,
  ) {
    const agent = await this.scopedAgent(user, agentId);

    return {
      success: true,
      data: {
        agent: {
          id: String(agent._id),
          name: agent.name,
          phone: agent.phone,
          state: agent.state,
          district: agent.district,
          consent: await this.tracking.getConsent(agentId),
        },
        day: await this.tracking.day(agentId, query.date),
      },
    };
  }

  @Get("agents/:agentId/tracking/history")
  async agentTrackingHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("agentId") agentId: string,
    @Query() query: TrackingHistoryQueryDto,
  ) {
    await this.scopedAgent(user, agentId);
    return { success: true, data: await this.tracking.history(agentId, query) };
  }

  /** Latest known position of every tracked agent, across every district. */
  @Get("tracking/live")
  async liveTracking(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: await this.tracking.liveBoard({}, undefined, await this.scope(user)),
    };
  }
}
