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
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { OfflineInventoryService } from "../application/offline-inventory.service";
import {
  OfflineRoomQueryDto,
  OfflineTransferHistoryQueryDto,
  SaveOfflineRoomDto,
  TransferOfflineInventoryDto,
  UpdateOfflineRoomDto,
} from "./dtos/offline-inventory.dto";

const VIEW_ROLES = [
  "ashram_owner",
  "owner",
  "manager",
  "ashram_admin",
  "stay_admin",
  "super_admin",
] as const;

const MANAGE_ROLES = ["ashram_owner", "owner", "manager"] as const;

@ApiTags("Offline Inventory")
@ApiBearerAuth()
@Controller("offline-inventory")
export class OfflineInventoryController {
  constructor(private readonly service: OfflineInventoryService) {}

  @Get("rooms")
  @Roles(...VIEW_ROLES)
  async rooms(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OfflineRoomQueryDto,
  ) {
    const data = await this.service.list(user, query);
    return {
      success: true,
      count: data.length,
      canManage: this.service.canManageOfflineRooms(user),
      data,
    };
  }

  @Get("summary")
  @Roles(...VIEW_ROLES)
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return { success: true, data: await this.service.summary(user, ashramId) };
  }

  @Get("transfers")
  @Roles(...VIEW_ROLES)
  async transfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OfflineTransferHistoryQueryDto,
  ) {
    const data = await this.service.history(user, query);
    return { success: true, count: data.length, data };
  }

  @Post("rooms")
  @Roles(...MANAGE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOfflineRoomDto,
  ) {
    return {
      success: true,
      message: "Offline room created.",
      data: await this.service.create(user, dto),
    };
  }

  @Put("rooms/:id")
  @Roles(...MANAGE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateOfflineRoomDto,
  ) {
    return {
      success: true,
      message: "Offline room updated.",
      data: await this.service.update(user, id, dto),
    };
  }

  @Delete("rooms/:id")
  @Roles(...MANAGE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.service.remove(user, id);
    return { success: true, message: "Offline room removed." };
  }

  @Post("rooms/:id/transfer")
  @Roles(...MANAGE_ROLES)
  async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: TransferOfflineInventoryDto,
  ) {
    const result = await this.service.transferToTirvona(user, id, dto);
    return {
      success: true,
      message: `${dto.units} unit(s) moved into Tirvona inventory.`,
      data: result,
    };
  }
}
