import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { AshramsService } from "../application/ashrams.service";
import { CreateRoomDto, RoomAvailabilityDto } from "./dtos/ashram.dto";

@ApiTags("Rooms")
@ApiBearerAuth()
@Roles("owner", "manager", "super_admin")
@Controller("rooms")
export class RoomsController {
  constructor(private readonly service: AshramsService) {}
  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ) {
    return { success: true, data: await this.service.createRoom(user, dto) };
  }
  @Put(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateRoomDto,
  ) {
    return {
      success: true,
      data: await this.service.updateRoom(user, id, dto),
    };
  }
  @Post(":id/availability") async availability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RoomAvailabilityDto,
  ) {
    return {
      success: true,
      data: await this.service.setAvailability(user, id, dto),
    };
  }
  @Get(":id/calendar") async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return {
      success: true,
      data: await this.service.calendar(user, id, startDate, endDate),
    };
  }
}
