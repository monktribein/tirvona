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
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { LeadUsersService } from "../application/lead-users.service";
import { LeadsService } from "../application/leads.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import {
  CreateLeadUserDto,
  LeadUserQueryDto,
  ResetLeadUserPasswordDto,
  UpdateLeadUserDto,
} from "./dtos/lead-user.dto";
import { LeadQueryDto, SaveLeadDto } from "./dtos/lead.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";
import { LeadSupervisorGuard } from "./guards/lead-supervisor.guard";

@ApiTags("Lead Collection")
@Public()
@UseGuards(LeadAgentGuard, LeadSupervisorGuard)
@Controller("lead-collection/supervisor")
export class LeadSupervisorController {
  constructor(
    private readonly leadUsers: LeadUsersService,
    private readonly leads: LeadsService,
  ) { }

  @Get("dashboard")
  async dashboard(@CurrentLeadAgent() supervisor: AuthenticatedLeadUser) {
    const [stats, agents] = await Promise.all([
      this.leads.statsByDistrict(supervisor.state, supervisor.district),
      this.leadUsers.listByDistrict(supervisor.state, supervisor.district, {
        page: 1,
        limit: 1000,
      }),
    ]);

    return {
      success: true,
      data: {
        supervisor: {
          id: supervisor.id,
          name: supervisor.name,
          state: supervisor.state,
          district: supervisor.district,
        },
        totalAgents: agents.total,
        ...stats,
      },
    };
  }

  @Get("agents")
  async listAgents(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Query() query: LeadUserQueryDto,
  ) {
    return {
      success: true,
      data: await this.leadUsers.listByDistrict(
        supervisor.state,
        supervisor.district,
        query,
      ),
    };
  }

  @Get("agents/:agentId")
  async getAgent(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
  ) {
    const agent = await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );
    const stats = await this.leads.stats({
      capturedBy: agent._id.toString(),
      state: supervisor.state,
      district: supervisor.district,
    });

    return {
      success: true,
      data: { ...agent, stats },
    };
  }

  @Get("agents/:agentId/leads")
  async getAgentLeads(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
    @Query() query: LeadQueryDto,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    return {
      success: true,
      data: await this.leads.listByDistrict(
        query,
        supervisor.state,
        supervisor.district,
        agentId,
      ),
    };
  }

  @Get("agents/:agentId/leads/:leadId")
  async getAgentLead(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
    @Param("leadId") leadId: string,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    return {
      success: true,
      data: await this.leads.findOne(leadId, {
        capturedBy: agentId,
        state: supervisor.state,
        district: supervisor.district,
      }),
    };
  }

  @Put("agents/:agentId/leads/:leadId")
  async updateAgentLead(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
    @Param("leadId") leadId: string,
    @Body() dto: SaveLeadDto,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    return {
      success: true,
      message: "Lead updated successfully",
      data: await this.leads.update(leadId, dto, {
        capturedBy: agentId,
        state: supervisor.state,
        district: supervisor.district,
      }),
    };
  }

  @Post("agents")
  async createAgent(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Body() dto: CreateLeadUserDto,
  ) {
    return {
      success: true,
      message: "Field agent account created",
      data: await this.leadUsers.createForSupervisor(dto, {
        id: supervisor.id,
        name: supervisor.name,
        state: supervisor.state,
        district: supervisor.district,
      }),
    };
  }

  @Put("agents/:agentId")
  async updateAgent(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
    @Body() dto: UpdateLeadUserDto,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    delete dto.state;
    delete dto.district;
    if (dto.role && dto.role !== "field_agent" && dto.role !== "lead_executive" && dto.role !== "document_verifier") {
      delete dto.role;
    }

    return {
      success: true,
      message: "Agent updated successfully",
      data: await this.leadUsers.update(agentId, dto),
    };
  }

  @Post("agents/:agentId/reset-password")
  @HttpCode(200)
  async resetAgentPassword(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
    @Body() dto: ResetLeadUserPasswordDto,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    return {
      success: true,
      message: "Password reset. The agent's existing sessions were signed out.",
      data: await this.leadUsers.resetPassword(agentId, dto),
    };
  }

  @Delete("agents/:agentId")
  async deleteAgent(
    @CurrentLeadAgent() supervisor: AuthenticatedLeadUser,
    @Param("agentId") agentId: string,
  ) {
    await this.leadUsers.findOneInDistrict(
      agentId,
      supervisor.state,
      supervisor.district,
    );

    return {
      success: true,
      message: "Field agent deleted. Their captured leads were retained.",
      data: await this.leadUsers.remove(agentId),
    };
  }
}

