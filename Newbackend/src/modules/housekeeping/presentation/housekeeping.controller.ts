import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { HousekeepingService } from "../application/housekeeping.service";
import { UpdateHousekeepingDto } from "./housekeeping.dto";
@Controller("housekeeping")
@Roles("owner", "manager", "reception", "housekeeping", "super_admin")
export class HousekeepingController {
  constructor(private readonly service: HousekeepingService) {}
  @Get() async board(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    const data = await this.service.board(user, ashramId);
    return { success: true, count: data.length, data };
  }
  @Patch(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateHousekeepingDto,
  ) {
    return { success: true, data: await this.service.update(user, id, dto) };
  }
}
