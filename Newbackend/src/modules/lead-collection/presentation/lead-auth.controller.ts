import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../../common/decorators/public.decorator";
import { LeadAuthService } from "../application/lead-auth.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import { LeadLoginDto } from "./dtos/lead-auth.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

@ApiTags("Lead Collection")
@Public()
@SkipThrottle({ default: true, ipAbuse: true })
@Controller("lead-collection/auth")
export class LeadAuthController {
  constructor(private readonly auth: LeadAuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LeadLoginDto) {
    return { success: true, data: await this.auth.login(dto) };
  }

  @Get("me")
  @UseGuards(LeadAgentGuard)
  me(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return { success: true, data: agent };
  }
}
