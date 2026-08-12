import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../../common/decorators/public.decorator";
import { LeadAuthService } from "../application/lead-auth.service";
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import { CurrentLeadAgent } from "./decorators/current-lead-agent.decorator";
import { LeadLoginDto } from "./dtos/lead-auth.dto";
import { LeadAgentGuard } from "./guards/lead-agent.guard";

/**
 * Sign-in for the leadTirvona field app.
 *
 * `@Public()` at class level takes the platform JWT guard out of the way;
 * `/me` then re-gates itself with `LeadAgentGuard`.
 */
@ApiTags("Lead Collection")
@Public()
@Controller("lead-collection/auth")
export class LeadAuthController {
  constructor(private readonly auth: LeadAuthService) {}

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  async login(@Body() dto: LeadLoginDto) {
    return { success: true, data: await this.auth.login(dto) };
  }

  @Get("me")
  @UseGuards(LeadAgentGuard)
  me(@CurrentLeadAgent() agent: AuthenticatedLeadUser) {
    return { success: true, data: agent };
  }
}
