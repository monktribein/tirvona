import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { RoomRatesService } from "../application/room-rates.service";
import {
  BulkRoomRatesDto,
  ToggleRateDiscountDto,
  UpsertRoomRateDto,
} from "./dtos/room-rate.dto";

@ApiTags("Room Rates")
@ApiBearerAuth()
@Roles("owner", "stay_admin", "manager", "super_admin")
@Controller("room-rates")
export class RoomRatesController {
  constructor(private readonly service: RoomRatesService) {}

  @Get("stay/:ashramId")
  @Header("Cache-Control", "no-store")
  async listByStay(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ashramId") ashramId: string,
  ) {
    const data = await this.service.listByStay(user, ashramId);
    return { success: true, data };
  }

  @Get("room/:roomId")
  @Header("Cache-Control", "no-store")
  async getByRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param("roomId") roomId: string,
  ) {
    const data = await this.service.getByRoom(user, roomId);
    return { success: true, data };
  }

  @Post()
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertRoomRateDto,
  ) {
    const data = await this.service.upsertRate(user, dto);
    return {
      success: true,
      message: "Room rate updated successfully.",
      data,
    };
  }

  @Patch(":roomId/toggle-discount")
  async toggleDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("roomId") roomId: string,
    @Body() dto: ToggleRateDiscountDto,
  ) {
    const data = await this.service.toggleDiscount(
      user,
      roomId,
      dto.isDiscountActive,
    );
    return {
      success: true,
      message: `Discount ${dto.isDiscountActive ? "enabled" : "disabled"} successfully.`,
      data,
    };
  }

  @Post("bulk")
  async bulkUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkRoomRatesDto,
  ) {
    const data = await this.service.bulkUpdate(user, dto);
    return {
      success: true,
      message: `Updated rates for ${data.updatedCount} room categories.`,
      data,
    };
  }

  @Public()
  @Get("effective/:roomId")
  @Header("Cache-Control", "no-store")
  async publicEffectiveRate(@Param("roomId") roomId: string) {
    const data = await this.service.getPublicEffectiveRate(roomId);
    return { success: true, data };
  }
}
