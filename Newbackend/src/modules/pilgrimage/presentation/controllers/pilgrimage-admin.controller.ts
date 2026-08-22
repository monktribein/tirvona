import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { PILGRIMAGE_MODEL } from "../../domain/pilgrimage.constants";
import { PilgrimageAccessService } from "../../application/pilgrimage-access.service";
import { PilgrimageManagementService } from "../../application/pilgrimage-management.service";
import {
  ApproveCircuitDto,
  CircuitListQueryDto,
  PaginationDto,
  SetCircuitStatusDto,
  ToggleFlagDto,
  UpsertPilgrimageSettingDto,
} from "../dtos/pilgrimage.dto";

@ApiTags("Pilgrimage Platform Admin")
@ApiBearerAuth()
@Roles("super_admin")
@Controller("pilgrimage/admin")
export class PilgrimageAdminController {
  constructor(
    private readonly accessService: PilgrimageAccessService,
    private readonly management: PilgrimageManagementService,
    @InjectModel(PILGRIMAGE_MODEL.Circuit) private readonly circuits: Model<any>,
    @InjectModel(PILGRIMAGE_MODEL.Itinerary)
    private readonly itineraries: Model<any>,
  ) {}

  @Get("dashboard") async dashboard(@CurrentUser() user: AuthenticatedUser) {
    const access = await this.accessService.resolve(user);
    return { success: true, data: await this.management.dashboard(access) };
  }

  @Get("circuits") async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CircuitListQueryDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      ...(await this.management.listCircuits(access, query)),
    };
  }

  @Get("approvals") async approvals(@Query() page: PaginationDto) {
    const circuits = await this.circuits
      .find({ status: "pending" })
      .populate("ashramId", "name ashramCode")
      .populate("ownerId", "name email phone")
      .sort({ submittedAt: 1 })
      .limit(page.limit)
      .lean();
    return {
      success: true,
      data: { circuits },
      counts: { circuits: circuits.length },
    };
  }

  @Post("circuits/:id/review") async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApproveCircuitDto,
  ) {
    return {
      success: true,
      message:
        dto.decision === "approve"
          ? "Circuit approved and now live."
          : "Circuit sent back to the ashram.",
      data: await this.management.reviewCircuit(user, id, dto),
    };
  }

  @Patch("circuits/:id/status") async setStatus(
    @Param("id") id: string,
    @Body() dto: SetCircuitStatusDto,
  ) {
    return {
      success: true,
      message: "Circuit status updated.",
      data: await this.management.setStatus(id, dto.status),
    };
  }

  @Patch("circuits/:id/featured") async setFeatured(
    @Param("id") id: string,
    @Body() dto: ToggleFlagDto,
  ) {
    return {
      success: true,
      message: dto.value ? "Circuit featured." : "Circuit unfeatured.",
      data: await this.management.setFeatured(id, dto.value),
    };
  }

  @Get("itineraries") async savedItineraries(@Query() page: PaginationDto) {
    const [data, total] = await Promise.all([
      this.itineraries
        .find()
        .populate("userId", "name email")
        .populate("circuitId", "name slug")
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit)
        .lean(),
      this.itineraries.estimatedDocumentCount(),
    ]);
    return { success: true, data, total, page: page.page };
  }

  @Get("settings") async settings(@CurrentUser() user: AuthenticatedUser) {
    const access = await this.accessService.resolve(user);
    return { success: true, data: await this.management.listSettings(access) };
  }

  @Post("settings") async upsertSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertPilgrimageSettingDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Pilgrimage settings saved.",
      data: await this.management.upsertSetting(user, access, dto),
    };
  }
}
