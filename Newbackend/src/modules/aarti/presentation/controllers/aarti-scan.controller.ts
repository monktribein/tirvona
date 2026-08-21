import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { AARTI_CAPABILITIES } from "../../domain/aarti.constants";
import { AartiScanService } from "../../application/aarti-scan.service";
import { AartiCapabilities } from "../decorators/aarti-capabilities.decorator";
import {
  AartiCapabilityGuard,
  type AartiRequest,
} from "../guards/aarti-capability.guard";
import { GateRosterDto, GateScanDto, ManualCheckInDto } from "../dtos/aarti.dto";

@ApiTags("Aarti Gate")
@ApiBearerAuth()
@UseGuards(AartiCapabilityGuard)
@Controller("aarti/scan")
export class AartiScanController {
  constructor(private readonly service: AartiScanService) {}

  @Get("me")
  access(@Req() request: AartiRequest) {
    return { success: true, data: request.aarti };
  }

  @Post()
  @AartiCapabilities(AARTI_CAPABILITIES.SCAN_QR)
  async scan(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: GateScanDto,
  ) {
    const result = await this.service.scan(user, request.aarti, dto);
    return { success: result.ok, ...result };
  }

  @Post("manual-check-in")
  @AartiCapabilities(AARTI_CAPABILITIES.MANUAL_CHECK_IN)
  async manual(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AartiRequest,
    @Body() dto: ManualCheckInDto,
  ) {
    return {
      success: true,
      message: "Devotees admitted.",
      data: await this.service.manualCheckIn(user, request.aarti, dto),
    };
  }

  @Get("roster")
  @AartiCapabilities(AARTI_CAPABILITIES.VIEW_BOOKING)
  async roster(@Req() request: AartiRequest, @Query() query: GateRosterDto) {
    return {
      success: true,
      data: await this.service.gateRoster(
        request.aarti,
        query.sessionId,
        query.date,
      ),
    };
  }
}
