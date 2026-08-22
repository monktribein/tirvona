import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { PilgrimageAccessService } from "../../application/pilgrimage-access.service";
import { PilgrimageManagementService } from "../../application/pilgrimage-management.service";
import {
  CircuitListQueryDto,
  CreateCircuitDto,
  CreateStopDto,
  ReorderStopsDto,
  UpdateCircuitDto,
  UpdateStopDto,
  UpsertPilgrimageSettingDto,
} from "../dtos/pilgrimage.dto";

/**
 * The ashram-facing circuit console. Scope comes from ashram ownership, so an
 * owner sees only their own circuits while an ashram admin sees every one.
 */
@ApiTags("Pilgrimage Owner Console")
@ApiBearerAuth()
@Roles(
  "ashram_owner",
  "owner",
  "ashram_admin",
  "stay_admin",
  "manager",
  "super_admin",
)
@Controller("pilgrimage/owner")
export class PilgrimageOwnerController {
  constructor(
    private readonly accessService: PilgrimageAccessService,
    private readonly management: PilgrimageManagementService,
  ) {}

  @Get("me") async access(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.accessService.resolve(user) };
  }

  @Get("ashrams") async ashrams(@CurrentUser() user: AuthenticatedUser) {
    const access = await this.accessService.resolve(user);
    return { success: true, data: await this.management.listAshrams(access) };
  }

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

  @Post("circuits") async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCircuitDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Circuit saved as a draft. Add stops, then submit for review.",
      data: await this.management.createCircuit(user, access, dto),
    };
  }

  @Get("circuits/:id") async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const access = await this.accessService.resolve(user);
    return { success: true, data: await this.management.getCircuit(access, id) };
  }

  @Put("circuits/:id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateCircuitDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Circuit updated.",
      data: await this.management.updateCircuit(access, id, dto),
    };
  }

  @Post("circuits/:id/submit") async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Sent for review. It goes live once the platform approves it.",
      data: await this.management.submitCircuit(access, id),
    };
  }

  @Delete("circuits/:id") async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Circuit deleted.",
      data: await this.management.deleteCircuit(access, id),
    };
  }

  @Post("stops") async addStop(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStopDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Stop added.",
      data: await this.management.addStop(access, dto),
    };
  }

  @Put("stops/:id") async updateStop(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateStopDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Stop updated.",
      data: await this.management.updateStop(access, id, dto),
    };
  }

  @Delete("stops/:id") async deleteStop(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Stop removed.",
      data: await this.management.deleteStop(access, id),
    };
  }

  @Post("stops/reorder") async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderStopsDto,
  ) {
    const access = await this.accessService.resolve(user);
    return {
      success: true,
      message: "Route order saved.",
      data: await this.management.reorderStops(access, dto),
    };
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
      message: "Settings saved.",
      data: await this.management.upsertSetting(user, access, dto),
    };
  }
}
