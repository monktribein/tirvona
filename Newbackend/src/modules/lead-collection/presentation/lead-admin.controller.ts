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
  LeadUsersService,
  type LeadAdminActor,
} from "../application/lead-users.service";
import { LeadsService } from "../application/leads.service";
import {
  CreateLeadUserDto,
  CreateLeadRegionDto,
  LeadUserQueryDto,
  ResetLeadUserPasswordDto,
  UpdateLeadUserDto,
} from "./dtos/lead-user.dto";
import { LeadDecisionDto, LeadQueryDto, SaveLeadDto } from "./dtos/lead.dto";

@ApiTags("Lead Collection")
@ApiBearerAuth()
@Roles("super_admin")
@SkipThrottle({ default: true, ipAbuse: true })
@Controller("lead-collection/admin")
export class LeadAdminController {
  constructor(
    private readonly leads: LeadsService,
    private readonly leadUsers: LeadUsersService,
  ) {}

  private actor(user: AuthenticatedUser): LeadAdminActor {
    return { id: user.id, name: user.name };
  }

  @Get("leads")
  async listLeads(@Query() query: LeadQueryDto) {
    return { success: true, data: await this.leads.list(query) };
  }

  @Get("leads/stats")
  async leadStats() {
    return { success: true, data: await this.leads.stats() };
  }

  @Get("leads/:id")
  async oneLead(@Param("id") id: string) {
    return { success: true, data: await this.leads.findOne(id) };
  }

  @Post("leads")
  async createLead(@Body() dto: SaveLeadDto) {
    return {
      success: true,
      message: "Lead created",
      data: await this.leads.createAsAdmin(dto),
    };
  }

  @Put("leads/:id")
  async updateLead(@Param("id") id: string, @Body() dto: SaveLeadDto) {
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
      data: await this.leads.decide(id, "approved", dto, this.actor(user)),
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
      data: await this.leads.decide(id, "rejected", dto, this.actor(user)),
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
      data: await this.leads.decide(id, "converted", dto, this.actor(user)),
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
      data: await this.leads.decide(id, "pending", dto, this.actor(user)),
    };
  }

  @Delete("leads/:id")
  async removeLead(@Param("id") id: string) {
    return {
      success: true,
      message: "Lead deleted",
      data: await this.leads.remove(id),
    };
  }

  @Get("regions")
  async listRegions() {
    return { success: true, data: await this.leadUsers.listRegions() };
  }

  @Post("regions")
  async addRegion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadRegionDto,
  ) {
    return {
      success: true,
      message: "Lead region added",
      data: await this.leadUsers.addRegion(dto, this.actor(user)),
    };
  }

  @Delete("regions")
  async removeRegion(
    @Query("state") state: string,
    @Query("district") district: string,
  ) {
    return {
      success: true,
      message: "Lead region removed",
      data: await this.leadUsers.removeRegion(state, district),
    };
  }

  @Get("users")
  async listUsers(@Query() query: LeadUserQueryDto) {
    return { success: true, data: await this.leadUsers.list(query) };
  }

  @Get("users/:id")
  async oneUser(@Param("id") id: string) {
    return { success: true, data: await this.leadUsers.findOne(id) };
  }

  @Post("users")
  async createUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadUserDto,
  ) {
    return {
      success: true,
      message: "Field agent account created",
      data: await this.leadUsers.create(dto, this.actor(user)),
    };
  }

  @Put("users/:id")
  async updateUser(@Param("id") id: string, @Body() dto: UpdateLeadUserDto) {
    return {
      success: true,
      message: "Field agent updated",
      data: await this.leadUsers.update(id, dto),
    };
  }

  @Post("users/:id/reset-password")
  @HttpCode(200)
  async resetUserPassword(
    @Param("id") id: string,
    @Body() dto: ResetLeadUserPasswordDto,
  ) {
    return {
      success: true,
      message: "Password reset. The agent's existing sessions were signed out.",
      data: await this.leadUsers.resetPassword(id, dto),
    };
  }

  @Delete("users/:id")
  async removeUser(@Param("id") id: string) {
    return {
      success: true,
      message: "Field agent deleted. Their captured leads were retained.",
      data: await this.leadUsers.remove(id),
    };
  }
}
