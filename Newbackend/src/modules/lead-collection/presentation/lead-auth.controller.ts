import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { SensitiveThrottle } from "../../../common/throttling/rate-limit.decorators";
import { LeadAuthService } from "../application/lead-auth.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import { LeadLoginDto } from "./dtos/lead-auth.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

@ApiTags("Lead Collection")
@Public()
@Controller("lead-collection/auth")
export class LeadAuthController {
  constructor(private readonly auth: LeadAuthService) {}

  @Post("login")
  @HttpCode(200)
  @SensitiveThrottle(8, 900_000, "phone")
  async login(@Body() dto: LeadLoginDto) {
    return { success: true, data: await this.auth.login(dto) };
  }

  @Get("me")
  @UseGuards(LeadAgentGuard)
  me(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return { success: true, data: agent };
  }
}
